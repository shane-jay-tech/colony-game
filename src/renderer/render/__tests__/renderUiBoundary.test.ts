// c923-16（R1 后半）：render 层不得向上依赖 ui 层——把「一条 grep」变成门禁。
// 同型先例：src/renderer/data/__tests__/dataLayerBoundary.test.ts（c922-11，钉 data ↛ state）。
// 起因：台账 c922-16「3.4 的『反向依赖』未进门禁：dataLayerBoundary.test.ts 只管 data → state，
// 没有任何测试拦 render → ui ⇒ 台账判 ◐ 的同时本仓无法自动防它继续扩散」。本文件即该后半句。
// 上游规则原文：PLAN.md:39「Move shared visual constants used by both render and UI into a neutral
// shared module to remove reverse layer dependencies.」＝已落地的 src/shared/visualConstants.ts（c-15）。
//
// 预跑现值（2026-09-23T11:5x，ripgrep 15.0.0，非交互 bash；命令见下）：
//   $ rg -n "from ['\"][^'\"]*/ui/" src/renderer/render --glob '!**/__tests__/**' --glob '!tmp/**'
//   src/renderer/render/mapColors.ts:18  import { COLORS } from '../ui/palette';
//   src/renderer/render/MapRenderer.ts:6 import { COLORS, COLORS_HEX, UI } from '../ui/palette';
// ⇒ 命中 2，与 ALLOWED 白名单逐条一致 ⇒ 判据「命中>0 则白名单化并留 TODO」走白名单分支。
//
// 范围刻意只到 render/，不含 scenes/：scenes 是组装层，天然要造 UI 面板（现值同口径命中
// 36 条 / 6 文件，UIScene.ts 独占 25 条），纳进来等于把正常分层判成违规。
//
// 本文件钉三件事（全部「扫到东西才算数」，防空扫假绿）：
//   ① 覆盖面自证：扫描集非空且含点名文件、解析出的说明符数有下界；
//   ② 命中集与白名单**逐条相等**：新增上引即红，存量上引消失也红（逼着同步删档，防白名单变收容所）；
//   ③ 白名单自身形状：每条必须带非空 TODO（未收口的理由）且所指文件真实在扫描集内。
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const RENDER_DIR = resolve(__dirname, '..');
const UI_DIR = resolve(RENDER_DIR, '..', 'ui');
/** tsconfig.base.json 的 paths：'@/*' → './src/renderer/*'，别名同样能写向上依赖，一并拦。 */
const RENDER_ROOT = resolve(RENDER_DIR, '..');

/** 只扫真实源文件，排除 __tests__（测试里允许出现反向路径字符串，否则本文件自己就会被自己拦下）。 */
function collectTs(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__tests__') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...collectTs(p));
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/** from '@/ui-x' / import '@/ui-x' / import('@/ui-x') / require('@/ui-x') 的说明符字面。 */
const SPECIFIER_RE = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*['"]([^'"]+)['"]/g;

/** 说明符解析后是否落在 ui 层目录内（相对路径与 @ 别名两条通道都算）。 */
function landsInUi(specifier: string, fromFile: string): boolean {
  const target = specifier.startsWith('@/')
    ? resolve(RENDER_ROOT, specifier.slice(2))
    : resolve(fromFile, '..', specifier);
  return target === UI_DIR || target.startsWith(UI_DIR + sep);
}

const FILES = collectTs(RENDER_DIR);

/** 全部说明符（①的自证分母：解析数为 0 就说明正则失效，此时 ② 的「命中为空」不可信）。 */
const SPECIFIERS: string[] = [];
/** 上引 ui 层的命中，形如 `MapRenderer.ts -> ../ui/palette`。 */
const HITS: string[] = [];
for (const f of FILES) {
  const rel = relative(RENDER_DIR, f).split(sep).join('/');
  for (const m of readFileSync(f, 'utf8').matchAll(SPECIFIER_RE)) {
    const specifier = m[1];
    if (specifier === undefined) continue; // noUncheckedIndexedAccess：捕获组类型上是 string|undefined
    SPECIFIERS.push(`${rel} ${specifier}`);
    if (landsInUi(specifier, f)) HITS.push(`${rel} -> ${specifier}`);
  }
}

interface AllowedReverseImport {
  /** 相对 render/ 的路径。 */
  file: string;
  specifier: string;
  /** 未收口的理由——必须指向把它搬走的那一项，空串即门禁失效。 */
  todo: string;
}

// 存量债登记（2026-09-23 现值 2 条，与文件头 rg 读数一致）。
const ALLOWED: readonly AllowedReverseImport[] = [
  {
    file: 'mapColors.ts',
    specifier: '../ui/palette',
    todo: 'PLAN.md:39/c-15 后续：COLORS 是 render 与 UI 共用视觉常量，待下沉 src/shared/visualConstants.ts（现该模块只有 MASK_FILL_WHITE）后删本条',
  },
  {
    file: 'MapRenderer.ts',
    specifier: '../ui/palette',
    todo: 'PLAN.md:39/c-15 后续：同上；另 UI 色板键名与 render 无关，下沉时一并改名，删本条前不得新增任何 ui 上引',
  },
];

const ALLOWED_KEYS = ALLOWED.map(a => `${a.file} -> ${a.specifier}`).sort();

describe('c923-16 render ↛ ui 反向依赖门禁（R1 后半，PLAN.md:39）', () => {
  it('① 扫描器自证非空：render/ 源文件集与说明符解析数都要过下界', () => {
    const relFiles = FILES.map(f => relative(RENDER_DIR, f).split(sep).join('/')).sort();
    expect(relFiles.length).toBeGreaterThanOrEqual(8); // 现值 8：无子目录，__tests__ 已排除
    expect(relFiles).toEqual(expect.arrayContaining(['MapRenderer.ts', 'mapColors.ts']));
    expect(SPECIFIERS.length).toBeGreaterThanOrEqual(8); // 现值 20
  });

  it('② render/ 上引 ui/ 的命中集与白名单逐条相等（新增即红，消失也要红）', () => {
    expect(HITS.slice().sort()).toEqual(ALLOWED_KEYS);
  });

  it('③ 白名单形状：每条带非空 TODO 且所指文件真实存在（防收容所式挂账）', () => {
    expect(ALLOWED.length).toBeGreaterThan(0);
    const known = new Set(FILES.map(f => relative(RENDER_DIR, f).split(sep).join('/')));
    for (const a of ALLOWED) {
      expect(a.todo.length, `白名单 ${a.file} 的 todo 不能为空`).toBeGreaterThan(10);
      expect(known.has(a.file), `白名单挂了不在扫描集里的 ${a.file}`).toBe(true);
      expect(landsInUi(a.specifier, join(RENDER_DIR, a.file))).toBe(true);
    }
    expect(new Set(ALLOWED_KEYS).size).toBe(ALLOWED.length); // 无重复条目
  });
});
