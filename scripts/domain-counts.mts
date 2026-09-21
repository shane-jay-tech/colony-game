#!/usr/bin/env npx tsx
// domain-counts.mts（c922-07）：内容域计数打印器——终结 START_HERE 手工计数漂移链。
// 背景：c921-08 实测 START_HERE 第 50 行的 5 个域数里有 2 个已漂（国策 23→39、故事事件 23→35），
//       且「沙盒40」是口径歧义（40 = ALL_EXPANDED 单项，沙盒合计 48 = 基础 8 + 扩展 40）。
//       同文件第 127 行还独立漂着第三个测试用例数。手工改数字每落一批内容就再漂一次，
//       故把「取当前值」固化为脚本：START_HERE 只该写「运行 npx tsx scripts/domain-counts.mts」。
// 口径：不 grep `id:` 行、不数正则命中——直接 import 真实数组取 .length，数组即唯一事实源。
//       （c921-08 已证 grep 法对 storyEvents=35/policies=39 只是碰巧对，方法本身不可信。）
// 只读：不写任何文件、不改 START_HERE；`--check` 仅影响退出码。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { BUILDINGS } from '../src/renderer/data/buildings.ts';
import { POLICIES } from '../src/renderer/data/policies.ts';
import { DECREES } from '../src/renderer/data/decrees.ts';
import { EVENTS } from '../src/renderer/data/events.ts';
import { ALL_EXPANDED_EVENTS } from '../src/renderer/data/eventsExpanded.ts';
import { STORY_EVENTS } from '../src/renderer/data/storyEvents.ts';

// events.ts:8 的 BASE_EVENTS 是模块内 const（未 export），按 events.ts:276 的定义
// `EVENTS = [...BASE_EVENTS, ...ALL_EXPANDED_EVENTS, ...STORY_EVENTS]` 反解，
// 不为取数去给生产码加导出（那会越出本单「零生产码改动」范围）。
const BASE_EVENTS_COUNT = EVENTS.length - ALL_EXPANDED_EVENTS.length - STORY_EVENTS.length;
if (BASE_EVENTS_COUNT < 0) {
  console.error(`不变量破裂：EVENTS(${EVENTS.length}) < 扩展(${ALL_EXPANDED_EVENTS.length})+故事(${STORY_EVENTS.length})——合并式已不再是简单拼接，请复核 events.ts`);
  process.exit(3);
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const START_HERE = 'docs/design/00_上手须知_START_HERE.md';

/** START_HERE 第 50 行「已跑通」行的声称值（按内容语义定位，不锁死行号——他人插一行就漂）。 */
function claimed() {
  const line = readFileSync(join(ROOT, START_HERE), 'utf8')
    .split(/\r?\n/)
    .find((l) => l.includes('已跑通') && l.includes('朝令'));
  const m = line?.match(/建筑\((\d+)\)\/国策\((\d+)\)\/朝令\((\d+)\)\/事件\(沙盒(\d+)\+故事(\d+)\)/);
  return { raw: line ?? '(未定位到第 50 行)', five: m ? m.slice(1).map(Number) : null };
}

const actual = [
  BUILDINGS.length,
  POLICIES.length,
  DECREES.length,
  BASE_EVENTS_COUNT + ALL_EXPANDED_EVENTS.length, // 沙盒合计
  STORY_EVENTS.length,
];
const names = ['建筑 BUILDINGS', '国策 POLICIES', '朝令 DECREES', '沙盒事件 BASE+EXPANDED', '故事事件 STORY_EVENTS'];

const c = claimed();
console.log(`# 内容域五计数（事实源＝数组 .length；生成于 c922-07 脚本 scripts/domain-counts.mts）`);
actual.forEach((v, i) => console.log(`${names[i]} = ${v}`));
console.log(`合并集 EVENTS = ${EVENTS.length} （= 基础 ${BASE_EVENTS_COUNT} + 扩展 ${ALL_EXPANDED_EVENTS.length} + 故事 ${STORY_EVENTS.length}，非「沙盒」口径，别填进 START_HERE）`);

console.log(`\n# 对照 ${START_HERE} 「已跑通」行`);
console.log(`声称原文：${c.raw}`);
if (!c.five) {
  console.log('判定：无法解析（该行措辞变了）——请同步更新本脚本的 claimed() 正则');
  process.exit(process.argv.includes('--check') ? 2 : 0);
}
const labels = ['建筑', '国策', '朝令', '沙盒', '故事'];
let drift = 0;
c.five.forEach((claim, i) => {
  const ok = claim === actual[i];
  if (!ok) drift++;
  const d = actual[i] - claim;
  console.log(`${ok ? '✓' : '✗'} ${labels[i]}：START_HERE=${claim} 实测=${actual[i]}${ok ? '' : ` （漂 ${d > 0 ? '+' : ''}${d}，正数＝文档低估）`}`);
});
console.log(drift ? `\n漂移 ${drift} 项。订正口径见本输出，或整行改写为「域计数运行 npx tsx scripts/domain-counts.mts 取当前值」。` : '\n五项全一致。');
if (process.argv.includes('--check')) process.exit(drift ? 1 : 0);
