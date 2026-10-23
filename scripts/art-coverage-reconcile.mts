#!/usr/bin/env npx tsx
// art-coverage-reconcile.mts（c927-53）：ART_MANIFEST × boot 加载面 的**覆盖率双向对账**打印器。
//
// 出身：tmp/art-verify-20260921.mts（c921-07 只读临时探针）的**第三条腿**——原文件 :50-:56 的
//   `manifestKeysNotLoaded` / `loadItemsNotInManifest` 两段。前两腿（loadUrl×磁盘实存、
//   manifest.path↔loadUrl 同义）已由 c922-04 固化进 `src/renderer/data/__tests__/bootLoadList.test.ts`
//   的 ①②③ 用例；第三腿当时没搬（该单只点名两条不变量），于是继续留在 gitignore 的 tmp/ 里、跑完即失。
//   本单只搬那一腿——前两腿**不在本脚本里重做**（判据已在世，重复一份＝第二事实源）。
//
// 为什么它够格常驻（三条，逐条可在盘上核）：
//   1) 它补的是那枚在世守卫的**结构性盲区**，不是它的副本：`bootLoadList.test.ts` ② 的循环体逐字是
//      `if (declared === undefined || NO_OWN_ART_KEYS.has(item.key)) continue;` ⇒ 只出现在一侧的键被静默跳过；
//      且 ② 只遍历 LOAD_SOURCES ⇒ 「manifest 声明了、却没有任何加载源消费」的死项**永远看不到**。
//      两向都漏 ⇒ 覆盖率这一维在 HEAD 上零守卫。本脚本正是把这两个方向各数一遍。
//   2) 本仓曾明摆着有两个事实源（BootScene scatter 循环上方注释「h912-11：manifest 无 scatter
//      类目，保留原清单」；c921-01 报告第四节登记在案）——**c1023-10 已收口**：清单入
//      ART_MANIFEST.SCATTER_ART，BootScene 直取加载。本脚本的双向差集读数自此应恒为 0，
//      留作「manifest 是权威源」这句自述的常年在证。
//   3) 判据形态**不适合做成 vitest 断言**：一侧为空、另一侧非空曾是**注册在案的正常态**（E2 的
//      scatter 例外；c1023-10 后该集恒空）。写成用例，下次红了的最低成本动作是"往例外集里加个键"；
//      写成用例，下次红了的最低成本动作是"往例外集里加个键"；写成打印器＋`--check` 退出码，
//      读数可以原样进晨报/文档，例外集要不要扩由人裁。故此件与 `scripts/domain-counts.mts` 同型
//      （打印器＋只影响退出码的 `--check`），不做成第 4 条用例。
//
// 只读自证：本文件对 `node:fs` **只 import readFileSync**（读上面那枚测试件的条数钉值做交叉核对），
//   无 writeFileSync / appendFile / mkdir / rm / copyFile ⇒ 不存在任何写盘分支，也没有 `--write` 形态。
//   ⚠ 同目录 `scripts/audit-dead-exports.mjs` 的 `--write`/`--out` 会当场把
//   `docs/insights/colony-dead-exports-20260914.json.bak` 复活（该 .bak 此刻是待人工裁决的在途删除件）——
//   与本脚本无关，本脚本不 import 它、不调用它。
//
// 用法：cd D:\code\colony-game && npx tsx scripts/art-coverage-reconcile.mts [--check]
//   默认打印读数并 rc=0；`--check` 时若存在**未解释差集**或**复刻条数与在世守卫不一致** ⇒ rc=1。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { ART_MANIFEST, EVENT_ART, SCATTER_ART, TERRAIN_ART, eventArtUrl, getBootLoadList } from '../src/renderer/data/artManifest';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const GUARD_TEST = join(ROOT, 'src', 'renderer', 'data', '__tests__', 'bootLoadList.test.ts');

type Def = { key: string; path: string; category: string; required: boolean };
const manifest = ART_MANIFEST as Def[];
const manifestKeys = new Set(manifest.map((a) => a.key));

// boot 加载面：按 BootScene.preload 的原文复刻这五个源（与 c922-04 守卫同口径的复刻，
// 复刻风险与交叉核对见下方 X1——不要在这里"顺手补第六源"，音频面不在 ART_MANIFEST 语义内）。
const LOAD_SOURCES: Array<{ site: string; items: Array<{ key: string; url: string }> }> = [
  { site: 'building: getBootLoadList(building)', items: getBootLoadList('building') },
  { site: 'terrain: TERRAIN_ART 直取 asset.path', items: TERRAIN_ART.map((a) => ({ key: a.key, url: a.path })) },
  { site: 'scatter: SCATTER_ART 直取 asset.path（c1023-10 权威化）', items: SCATTER_ART.map((a) => ({ key: a.key, url: a.path })) },
  { site: 'general: getBootLoadList(general)', items: getBootLoadList('general') },
  { site: 'event: 硬编码模板 art/events/<name>.webp', items: EVENT_ART.map((a) => ({
    key: a.key,
    url: eventArtUrl(a.key.startsWith('evt_art_') ? a.key.slice('evt_art_'.length) : a.key),
  })) },
];

// E2 例外登记（历史唯一一条，按集合派生而非逐名硬写）：
// c1023-10 起 scatter 类目已入 ART_MANIFEST（SCATTER_ART 8 项，BootScene 直取加载）——
// 本例外集**恒空**（键已双侧登记），保留派生式作回归哨：若权威化被回退（清单移出 manifest），
// 「加载了却没登记」会自动落回本集并复活 B 向读数，不需改判据。
const REGISTERED_ONE_SIDED = new Set(SCATTER_ART.map((a) => a.key));

const consumed = new Set(LOAD_SOURCES.flatMap((s) => s.items.map((i) => i.key)));
// 方向 A：manifest → 加载面（声明了却没人加载＝死项，判据要求恒 0，无例外）
const declaredNotLoaded = manifest.filter((a) => !consumed.has(a.key)).map((a) => `${a.key}(${a.category})`);
// 方向 B：加载面 → manifest（加载了却没登记）。减去注册例外后须为 0。
const loadedNotDeclared = LOAD_SOURCES.flatMap((s) => s.items)
  .filter((i) => !manifestKeys.has(i.key))
  .map((i) => ({ key: i.key, url: i.url, registered: REGISTERED_ONE_SIDED.has(i.key) }));
const unexplainedLoaded = loadedNotDeclared.filter((i) => !i.registered).map((i) => `${i.key}(${i.url})`);
const registeredLoaded = loadedNotDeclared.filter((i) => i.registered).map((i) => i.key);
// 反向孤儿：注册例外集里"这次没被加载到"的键（scatter 少了一条 ⇒ 例外集与实况脱钩，也要点名）
const registeredButAbsent = [...REGISTERED_ONE_SIDED].filter((k) => !consumed.has(k));

// X1 交叉核对：本脚本的复刻条数必须与在世守卫 ① 钉死的总数一致。
// 两处复刻（守卫里的 LOAD_SOURCES／本脚本里的 LOAD_SOURCES）任一侧被人单独改 ⇒ 数字必然分叉，
// 这就是 c922-04 遗留 2 登记的「模板复刻漂移」风险在**只读路径上**唯一能免费拿到的兜底。
// 按语义定位那行（`expect(total).toBe(N)`），不锁行号——锁行号一人插行就漂。
let guardTotal: number | null = null;
try {
  const m = readFileSync(GUARD_TEST, 'utf8').match(/expect\(total\)\.toBe\((\d+)\)/);
  guardTotal = m ? Number(m[1]) : null;
} catch {
  guardTotal = null;
}
const scriptTotal = LOAD_SOURCES.reduce((n, s) => n + s.items.length, 0);

console.log('# ART_MANIFEST × boot 加载面 覆盖率双向对账（scripts/art-coverage-reconcile.mts，只读）');
for (const s of LOAD_SOURCES) console.log(`  ${s.site.padEnd(44)} n=${s.items.length}`);
console.log(`\nmanifestKeys=${manifest.length} loadItems=${scriptTotal} distinctLoadedKeys=${consumed.size}`);
console.log(`A 向 manifestKeysNotLoaded n=${declaredNotLoaded.length} ${JSON.stringify(declaredNotLoaded)}`);
console.log(`B 向 loadItemsNotInManifest n=${loadedNotDeclared.length}（其中注册例外 scatter ${registeredLoaded.length}）`);
console.log(`   注册例外=${JSON.stringify(registeredLoaded)}`);
console.log(`   未解释单边 n=${unexplainedLoaded.length} ${JSON.stringify(unexplainedLoaded)}`);
console.log(`   注册例外本次未见于加载面 n=${registeredButAbsent.length} ${JSON.stringify(registeredButAbsent)}`);

const problems: string[] = [];
if (declaredNotLoaded.length) problems.push(`A 向死项 ${declaredNotLoaded.length} 条：manifest 有键却无加载源消费`);
if (unexplainedLoaded.length) problems.push(`B 向未解释单边 ${unexplainedLoaded.length} 条：加载了但 ART_MANIFEST 无登记`);
if (registeredButAbsent.length) problems.push(`注册例外失配 ${registeredButAbsent.length} 条：scatter 集合里有键却没被加载`);
if (guardTotal === null) problems.push(`读不到守卫 ① 的条数钉值（${GUARD_TEST} 里 expect(total).toBe(N) 形制变了）`);
else if (guardTotal !== scriptTotal) problems.push(`复刻分叉：本脚本 loadItems=${scriptTotal} ≠ 守卫①钉值 ${guardTotal} ⇒ 两处复刻只改了一处`);

console.log(`\nX1 复刻交叉核对：脚本 ${scriptTotal} vs bootLoadList.test.ts ① 钉值 ${guardTotal ?? '(读不到)'}`);
if (problems.length === 0) {
  console.log('判定：双向差集**均已解释**（A 向 0；B 向全部落在注册的 scatter 例外内）；复刻条数一致。');
} else {
  console.log('判定：存在问题 ⇒');
  for (const p of problems) console.log('  - ' + p);
}
if (process.argv.includes('--check')) process.exit(problems.length ? 1 : 0);
