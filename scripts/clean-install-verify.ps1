<#
.SYNOPSIS
  c927-32 清洁目录安装验证三件套（b461 遗留1 落地预备；**本脚本不自动放行**，下载/构建/GUI 需人工执行）。
.DESCRIPTION
  五步：robocopy 净拷贝 → .npmrc 去 cache= 行（备份） → npm ci（独立缓存+npmmirror） → npm run build（勿 electron:build:win） → 构建产物断言。
  -DryRun 干跑：只做参数校验与逐步预告，零写入零联网（c927-32 完成标准①）。
  任务书原文的「断言 BUILD_ID 存在」按锚点漂移纪律修正：全仓无 BUILD_ID 字面量（rg 0 命中），
  实际断言＝electron-vite 产物三件套（dist/main/index.js、dist/preload/index.mjs、dist/renderer/index.html）存在且非空。
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\clean-install-verify.ps1 -DryRun     # 干跑（可随时跑）
  powershell -ExecutionPolicy Bypass -File scripts\clean-install-verify.ps1            # 真跑（人工放行后）
#>
param(
  [switch]$DryRun,
  [string]$Target = 'D:\tmp\colony-clean',
  [string]$Source = ''
)
$ErrorActionPreference = 'Stop'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$logFile = Join-Path $env:TEMP "clean-install-verify-$stamp.log"

function Write-Step([int]$No, [string]$Name, [string]$Status) {
  $line = "[step $No] $Name => $Status"
  Write-Host $line
  Add-Content -Path $logFile -Value $line -Encoding utf8
}
function Assert-True([bool]$Cond, [string]$Msg) {
  if (-not $Cond) { throw "前置检查失败：$Msg" }
}

# ── 参数校验（干跑也执行＝完成标准①）────────────────────────────
if (-not $Source) {
  $Source = Split-Path -Parent $PSScriptRoot   # 脚本在 <repo>\scripts\ 下 ⇒ 仓根是其父目录
}
Assert-True (Test-Path (Join-Path $Source 'package.json')) "仓根无 package.json（Source=$Source）"
Assert-True (Test-Path (Join-Path $Source 'electron.vite.config.ts')) "仓根无 electron.vite.config.ts（Source=$Source）"
Assert-True (Test-Path (Join-Path $Source '.npmrc')) ".npmrc 不存在（Step2 去	cache= 行的对象）"
Assert-True ($Source -ne $Target) "Source 与 Target 相同会原地自毁（Source=$Source Target=$Target）"
Assert-True (-not ($Target.StartsWith($Source))) "Target 不得在 Source 内部（robocopy 会自吞）"
Assert-True ([bool](Get-Command npm -ErrorAction SilentlyContinue)) "npm 不在 PATH"
Assert-True ([bool](Get-Command robocopy -ErrorAction SilentlyContinue)) "robocopy 不在 PATH（Windows 自带，异常环境请先修 PATH）"
$drive = ([System.IO.DriveInfo]::new(($Target -replace '^([A-Za-z]):.*', '$1:') + '\'))
Assert-True $drive.AvailableFreeSpace -gt 6GB "目标盘 $($drive.Name) 剩余 $([math]::Round($drive.AvailableFreeSpace/1GB,1))GB < 6GB（node_modules+构建双份）"
Write-Host "参数校验通过：Source=$Source Target=$Target DryRun=$DryRun 日志=$logFile"

if ($DryRun) {
  Write-Host '── 干跑模式：以下为将执行序列，零写入零联网 ──'
  Write-Step 1 'robocopy 净拷贝' "将执行 robocopy `"$Source`" `"$Target`" /E /XD node_modules dist dist-out tmp _archive .git /NFL /NDL"
  Write-Step 2 '.npmrc 去 cache= 行' "将备份 .npmrc → .npmrc.bak-cleanverify，删除 cache= 打头行（现值见 b461：cache=D:\npm-cache）"
  Write-Step 3 'npm ci' "将在 $Target 执行 npm ci --cache $env:TEMP\npm-cache --registry=https://registry.npmmirror.com（联网，人工放行域）"
  Write-Step 4 'npm run build' "将执行 npm run build（electron-vite build；**勿** electron:build:win）"
  Write-Step 5 '产物断言' '将断言 dist/main/index.js、dist/preload/index.mjs、dist/renderer/index.html 存在且非空'
  Write-Host '干跑结束：参数校验通过、序列预告完毕。真跑需人工放行（见 docs/insights/c927-32-clean-verify.md）。'
  exit 0
}

# ── 真跑（人工放行域）───────────────────────────────────────────
try {
  # Step 1 净拷贝（排除依赖/产物/工作树垃圾）
  robocopy $Source $Target /E /XD node_modules dist dist-out tmp _archive .git /NFL /NDL
  if ($LASTEXITCODE -ge 8) { throw "robocopy 失败 rc=$LASTEXITCODE" }
  Write-Step 1 'robocopy 净拷贝' "完成 rc=$LASTEXITCODE"

  # Step 2 .npmrc：备份后删 cache= 行
  $npmrc = Join-Path $Target '.npmrc'
  Copy-Item $npmrc "$npmrc.bak-cleanverify" -Force
  $lines = Get-Content $npmrc
  $kept = $lines | Where-Object { $_ -notmatch '^\s*cache\s*=' }
  Set-Content -Path $npmrc -Value $kept -Encoding utf8
  Write-Step 2 '.npmrc 去 cache= 行' "移除 $($lines.Count - $kept.Count) 行（备份 .npmrc.bak-cleanverify）"

  # Step 3 依赖安装（独立缓存＝不污染全局 cache=D:\npm-cache 旧态）
  Push-Location $Target
  npm ci --cache (Join-Path $env:TEMP 'npm-cache') --registry=https://registry.npmmirror.com 2>&1 | Add-Content $logFile
  if ($LASTEXITCODE -ne 0) { throw "npm ci 失败 rc=$LASTEXITCODE" }
  Write-Step 3 'npm ci' '完成'

  # Step 4 构建（electron-vite build；明确不跑 electron:build:win＝不打包 exe）
  npm run build 2>&1 | Add-Content $logFile
  if ($LASTEXITCODE -ne 0) { throw "npm run build 失败 rc=$LASTEXITCODE" }
  Write-Step 4 'npm run build' '完成'

  # Step 5 产物断言
  foreach ($f in @('dist\main\index.js', 'dist\preload\index.mjs', 'dist\renderer\index.html')) {
    $p = Join-Path $Target $f
    Assert-True (Test-Path $p) "构建产物缺失：$f"
    Assert-True ((Get-Item $p).Length -gt 0) "构建产物空文件：$f"
  }
  Write-Step 5 '产物断言' '三件套全部存在且非空'
  Write-Host "清洁安装验证通过。回滚：还原 $npmrc.bak-cleanverify；清理：Remove-Item -Recurse -Force $Target"
  exit 0
} catch {
  Write-Step 'ERR' '失败' $_.Exception.Message
  Write-Host "失败。回滚说明见 docs/insights/c927-32-clean-verify.md §回滚（.npmrc 原件在 Target 外的备份与本仓 .npmrc 均未动）"
  exit 1
} finally {
  Pop-Location -ErrorAction SilentlyContinue
}
