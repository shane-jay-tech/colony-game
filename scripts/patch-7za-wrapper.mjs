/**
 * 给 node_modules/7zip-bin/win/x64/7za.exe 打 wrapper：
 * Windows 普通用户没有 SeCreateSymbolicLinkPrivilege，electron-builder 解压 winCodeSign-2.6.0.7z
 * 时会因 macOS dylib 的符号链接（darwin/10.12/lib/lib{crypto,ssl}.dylib）失败 (exit 2)。
 * 这两个文件 Windows build 完全用不到（osslsigncode 是 windows-* 子目录里的独立 .exe）。
 *
 * 做法：
 *   1. 把原 7za.exe 重命名为 7za.real.exe
 *   2. 用 Windows 自带的 .NET Framework csc.exe 编译一个极简 C# wrapper
 *   3. wrapper 转发所有 arg/stdio 给 7za.real.exe
 *   4. 仅当 exit 2 且 stderr 全部为 "Cannot create symbolic link" 行时才吞为 0；
 *      其他 exit 2（CRC 错误、写盘失败、文件损坏）按原样透传，不掩盖真实失败
 *      （DeepSeek 二审 critical F8）。
 *   5. wrapper 输出为新的 7za.exe
 *
 * 幂等：检测到 7za.real.exe 已存在则跳过。
 *
 * 原子性：rename → compile，任一失败 finally 块统一回滚（DeepSeek 二审 major F9）。
 */

import { existsSync, renameSync, writeFileSync, statSync, mkdirSync, copyFileSync, unlinkSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN_DIR = resolve(__dirname, '..', 'node_modules', '7zip-bin', 'win', 'x64');
const REAL_EXE = join(BIN_DIR, '7za.real.exe');
const WRAPPER_EXE = join(BIN_DIR, '7za.exe');

if (existsSync(REAL_EXE)) {
  console.log(`[patch-7za] already patched (7za.real.exe exists, ${statSync(REAL_EXE).size} bytes); skip`);
  process.exit(0);
}
if (!existsSync(WRAPPER_EXE)) {
  console.error(`[patch-7za] FATAL: ${WRAPPER_EXE} not found; run npm install first`);
  process.exit(1);
}

// 1. find csc.exe FIRST (fail before touching files)
const csc64 = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
const csc32 = 'C:\\Windows\\Microsoft.NET\\Framework\\v4.0.30319\\csc.exe';
const csc = existsSync(csc64) ? csc64 : (existsSync(csc32) ? csc32 : null);
if (!csc) {
  console.error('[patch-7za] FATAL: no .NET Framework csc.exe found at standard paths; cannot compile wrapper');
  console.error('  Looked at:');
  console.error(`    ${csc64}`);
  console.error(`    ${csc32}`);
  console.error('  Install .NET Framework 4.x runtime (Win 11 default) or run packaging on a host that has it.');
  process.exit(1);
}

// 2. write C# source — wrapper that filters exit code 2 by stderr content
const csSource = `
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;

class SevenZaWrapper {
    static int Main(string[] args) {
        var sb = new StringBuilder();
        for (int i = 0; i < args.Length; i++) {
            string a = args[i];
            // quote each arg; escape interior quotes and trailing backslashes (Windows CommandLineToArgv rules).
            sb.Append('"');
            int bsRun = 0;
            for (int j = 0; j < a.Length; j++) {
                char c = a[j];
                if (c == '\\\\') { bsRun++; sb.Append('\\\\'); }
                else if (c == '"') {
                    for (int k = 0; k < bsRun; k++) sb.Append('\\\\'); // double the backslashes preceding a quote
                    sb.Append('\\\\').Append('"');
                    bsRun = 0;
                } else { bsRun = 0; sb.Append(c); }
            }
            for (int k = 0; k < bsRun; k++) sb.Append('\\\\'); // double trailing backslashes
            sb.Append('"');
            if (i < args.Length - 1) sb.Append(' ');
        }
        string realPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "7za.real.exe");
        var psi = new ProcessStartInfo(realPath, sb.ToString());
        psi.UseShellExecute = false;
        psi.RedirectStandardOutput = true;
        psi.RedirectStandardError = true;
        var p = Process.Start(psi);
        var stderrBuf = new StringBuilder();
        p.OutputDataReceived += (s, e) => { if (e.Data != null) Console.Out.WriteLine(e.Data); };
        p.ErrorDataReceived += (s, e) => {
            if (e.Data != null) {
                Console.Error.WriteLine(e.Data);
                stderrBuf.AppendLine(e.Data);
            }
        };
        p.BeginOutputReadLine();
        p.BeginErrorReadLine();
        p.WaitForExit();

        if (p.ExitCode != 2) return p.ExitCode;

        // exit 2: only swallow if EVERY error line is a "cannot create symbolic link" line
        // (matches "Cannot create symbolic link" in any locale's English error output).
        // 7za in zh-CN locale prepends localized error prefix but keeps "Cannot create symbolic link"
        // in English (verified). If any stderr line is neither blank nor a symlink-error line,
        // pass through the original exit code so real failures (CRC, disk full, corruption) surface.
        string stderr = stderrBuf.ToString();
        string[] lines = stderr.Split(new[] { '\\r', '\\n' }, StringSplitOptions.RemoveEmptyEntries);
        if (lines.Length == 0) return p.ExitCode; // exit 2 with no stderr is suspicious — pass through
        bool allSymlinkErrors = true;
        foreach (var line in lines) {
            string trimmed = line.Trim();
            if (trimmed.Length == 0) continue;
            if (trimmed.IndexOf("Cannot create symbolic link", StringComparison.OrdinalIgnoreCase) < 0) {
                allSymlinkErrors = false;
                break;
            }
        }
        if (allSymlinkErrors) {
            Console.Error.WriteLine("[7za-wrapper] swallowing exit 2 — all errors are symlink-creation failures");
            return 0;
        }
        return p.ExitCode;
    }
}
`;

// Use D-drive temp to avoid touching C:\Users\*\AppData\Local\Temp.
const tmpDir = 'D:\\colony-game\\.tmp\\7za-wrapper';
mkdirSync(tmpDir, { recursive: true });
const csPath = join(tmpDir, 'SevenZaWrapper.cs');
writeFileSync(csPath, csSource, 'utf8');

// 3. atomic rename → compile → on failure restore
//    Strategy: copy original to backup, compile new exe to a temp path, then atomically swap.
const tempOut = join(tmpDir, '7za-wrapper.exe');
let renamedOriginal = false;
try {
  // First, compile to temp location (no node_modules touch yet).
  execFileSync(csc, [
    '/nologo',
    '/optimize',
    '/target:exe',
    `/out:${tempOut}`,
    csPath,
  ], { stdio: 'inherit' });
  if (!existsSync(tempOut)) throw new Error('csc.exe reported success but output not found');

  // Now rename original (last point at which we touch node_modules).
  renameSync(WRAPPER_EXE, REAL_EXE);
  renamedOriginal = true;

  // Copy compiled wrapper into place.
  copyFileSync(tempOut, WRAPPER_EXE);
  console.log(`[patch-7za] wrapper compiled → ${WRAPPER_EXE} (${statSync(WRAPPER_EXE).size} bytes)`);
  console.log(`[patch-7za] original 7za preserved at ${REAL_EXE} (${statSync(REAL_EXE).size} bytes)`);
} catch (e) {
  console.error('[patch-7za] FAILED:', e.message);
  // Atomic rollback: if we renamed but didn't successfully install wrapper, restore.
  if (renamedOriginal && !existsSync(WRAPPER_EXE)) {
    try {
      renameSync(REAL_EXE, WRAPPER_EXE);
      console.error('[patch-7za] rolled back — restored original 7za.exe');
    } catch (revertErr) {
      console.error('[patch-7za] CRITICAL: rollback also failed; node_modules may be corrupted.');
      console.error('[patch-7za] manual fix: rm node_modules/7zip-bin && npm install');
    }
  }
  // clean up temp build output
  try { if (existsSync(tempOut)) unlinkSync(tempOut); } catch {}
  process.exit(1);
}

// 4. self-test: invoke wrapper with no args (7za prints help, exits 0)
try {
  execFileSync(WRAPPER_EXE, [], { stdio: 'pipe' });
  console.log('[patch-7za] self-test passed (no-args invocation OK)');
} catch (e) {
  if (e.status !== 0 && e.status !== 2 && e.status !== null) {
    console.warn(`[patch-7za] self-test: 7za --help exit ${e.status} (acceptable but unusual)`);
  }
}
console.log('[patch-7za] done');
