#!/usr/bin/env npx tsx
// story-caliber.mts（c1002-22：tmp/c922-09-probe.mts 扶正）——storyEvents 口径取数打印器。
// 背景：c922-09 result:74/:105 的 storyTargets 基线漂移链需要一手取证件（该探针原住 gitignored
//       的 tmp/，不可复跑）；与 scripts/domain-counts.mts 同型（直接 import 真实数组取数，不 grep）。
// 口径：events/choices/effects/removeEffects 计数＋ops/targets 全集＋无 choices 事件与 0 效果 choice
//       两面异常清单——基线漂移时跑本件即得当场读数，与台账机制（c927-57）互为对照。
// 只读：不写任何文件；`--check` 仅影响退出码（对照 --baseline json 的 totals 键）。
import { readFileSync } from 'node:fs';

import { STORY_EVENTS } from '../src/renderer/data/storyEvents.ts';

let ch = 0, ef = 0;
const rem: string[] = [];
const targets = new Set<string>();
const ops = new Set<string>();
for (const e of STORY_EVENTS) for (const c of e.choices ?? []) {
  ch++;
  for (const x of c.effects ?? []) { ef++; targets.add(x.target); ops.add(x.op); }
  for (const t of c.removeEffects ?? []) { rem.push(String(t)); targets.add(String(t)); }
}
const noChoice = STORY_EVENTS.filter(e => (e.choices ?? []).length === 0).map(e => e.id);
const perChoice = STORY_EVENTS.flatMap(e => (e.choices ?? []).map(c => (c.effects ?? []).length));
const totals = {
  events: STORY_EVENTS.length,
  choices: ch,
  effects: ef,
  removeEffects: rem.length,
  targets: targets.size,
  eventsWithoutChoices: noChoice.length,
  choicesWithZeroEffects: perChoice.filter(n => n === 0).length,
};

console.log(`events ${totals.events} choices ${totals.choices} effects ${totals.effects} removeEffects ${totals.removeEffects}`);
console.log('ops', [...ops]);
console.log(`targets(${totals.targets})`, [...targets].sort().join(' '));
console.log('removeEffects sample', JSON.stringify(rem.slice(0, 6)));
console.log('events without choices', noChoice.length, noChoice.join(','));
console.log('choices with 0 effects', totals.choicesWithZeroEffects);

// --check：对照基线 json（{"totals": {...}} 形状），任何键不等退出码 1（漂移取证出口）
const args = process.argv.slice(2);
const checkIdx = args.indexOf('--check');
if (checkIdx >= 0) {
  const baselinePath = args[checkIdx + 1];
  if (!baselinePath) { console.error('--check 需要基线 json 路径'); process.exit(2); }
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as { totals?: Record<string, number> };
  const ref = baseline.totals ?? (baseline as Record<string, number>);
  const drifts = Object.entries(ref).filter(([k, v]) => totals[k as keyof typeof totals] !== v);
  if (drifts.length > 0) {
    for (const [k, v] of drifts) console.error(`[drift] ${k}: baseline=${v} current=${totals[k as keyof typeof totals]}`);
    process.exit(1);
  }
  console.log('[check] 基线全等');
}
