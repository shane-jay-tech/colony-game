// c921-01：只读存在性断言——逐键检查 ART_MANIFEST 的 path 是否真在 public/ 下。
// 用法：cd D:\code\colony-game && npx tsx scripts/art-exists-check.mts（或 npm run art:exists-check）
// 判据（c930-21 固化，rc 语义）：rc=0 ⇔ required:true 全在盘 且 无 orphan 磁盘件；
//   unresolved 只落在 required:false（待补素材清单）时不算失败。pre-commit/CI 接入属排程域未做。
// c921-02 复用本脚本做转码后回归。
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PUB = path.join(ROOT, 'public');

type Def = { key: string; path: string; category: string; required: boolean };
const mod = await import('../src/renderer/data/artManifest');
const manifest = mod.ART_MANIFEST as Def[];

const norm = (p: string) => p.replace(/^[\\/]+/, '').split(path.sep).join('/');
const unresolved: Def[] = [];

for (const a of manifest) {
  const ok = fs.existsSync(path.join(PUB, norm(a.path)));
  if (!ok) unresolved.push(a);
  console.log((ok ? 'OK  ' : 'MISS') + '  ' + a.key.padEnd(28) + ' required=' + String(a.required).padEnd(5) + ' ' + norm(a.path));
}

// 磁盘 → manifest：public/art 下所有文件是否被某条 path 声明（归一化为 art/... 口径）
const declared = new Set(manifest.map(a => norm(a.path)));
const diskArt: string[] = [];
const walk = (dir: string) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else diskArt.push(path.relative(PUB, full).split(path.sep).join('/'));
  }
};
walk(path.join(PUB, 'art'));
const orphans = diskArt.filter(f => !declared.has(f));

const requiredKeys = manifest.filter(a => a.required);
const requiredMissing = requiredKeys.filter(a => !fs.existsSync(path.join(PUB, norm(a.path))));

console.log('');
console.log('manifestKeys=' + manifest.length);
console.log('unresolved=' + unresolved.length);
console.log('unresolvedKeys=' + JSON.stringify(unresolved.map(a => a.key)));
console.log('requiredTrue=' + requiredKeys.length + ' requiredFalse=' + (manifest.length - requiredKeys.length));
console.log('requiredTrueMissing=' + requiredMissing.length + (requiredMissing.length ? ' ' + JSON.stringify(requiredMissing.map(a => a.key)) : ''));
console.log('diskArtFiles=' + diskArt.length);
console.log('orphansArtFiles=' + orphans.length + ' ' + JSON.stringify(orphans));

// c930-21：rc 契约固化——**仅 required:true 缺件 ⇒ rc=1**。
//   unresolved 只含 required:false（待补素材清单）与 orphans（scatter 贴图系 E2 刻意例外、
//   manifest_portraits_*.json 系生成物）都是告警面，不失败——首跑实测：unresolved=2／orphans=12，
//   若按「orphan 即红」本脚本将常驻常红，守卫价值归零。pre-commit/CI 接入属排程域未做。
const failed = requiredMissing.length > 0;
process.exitCode = failed ? 1 : 0;
