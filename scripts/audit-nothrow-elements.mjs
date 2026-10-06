#!/usr/bin/env node
// -*- coding: utf-8 -*-
// audit-nothrow-elements.mjs — 生产档坏元素对账脚本（c1006-03，c1004-11 案 B 前置·只读）。
// 读 userData/saves/*.json 真档，按 saveLoad.ts:584-585 generals map 与 :567-568 defenseAlerts
// map 的 NO_THROW 兜底路径统计坏元素分布（缺 id / id 为 "undefined" / defenseAlerts 空 {}）。
// 零写档、零修正：只出计数报告（stdout / --json）。
//
// 用法：node scripts/audit-nothrow-elements.mjs [--dir D:/colony-game/user-data/saves] [--json]
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const jsonOut = args.includes('--json');
const dirIdx = args.indexOf('--dir');
const dir = dirIdx !== -1 ? args[dirIdx + 1] : 'D:/colony-game/user-data/saves';

function auditSave(payload) {
  const r = { generals_total: 0, generals_missing_id: 0, generals_undefined_id: 0,
              alerts_total: 0, alerts_empty_object: 0, parse_error: null };
  let s;
  try { s = typeof payload === 'string' ? JSON.parse(payload) : payload; }
  catch (e) { r.parse_error = String(e); return r; }
  const state = s.state ?? s;
  const generals = state.generals;
  if (Array.isArray(generals)) {
    r.generals_total = generals.length;
    for (const g of generals) {
      if (g === null || typeof g !== 'object') { r.generals_missing_id++; continue; }
      if (g.id === undefined) r.generals_missing_id++;
      else if (String(g.id) === 'undefined') r.generals_undefined_id++;
    }
  }
  const alerts = state.defenseAlerts;
  if (Array.isArray(alerts)) {
    r.alerts_total = alerts.length;
    for (const a of alerts) {
      if (a !== null && typeof a === 'object' && Object.keys(a).length === 0) r.alerts_empty_object++;
    }
  }
  return r;
}

const out = { dir, saves: [], totals: { files: 0, generals_total: 0, generals_missing_id: 0,
  generals_undefined_id: 0, alerts_total: 0, alerts_empty_object: 0, parse_errors: 0 } };

let files = [];
try { files = readdirSync(dir).filter(f => f.endsWith('.json')); } catch { /* 目录缺=0 档 */ }

for (const f of files) {
  const full = join(dir, f);
  let payload;
  try { payload = readFileSync(full, 'utf8'); } catch { continue; }
  const r = auditSave(payload);
  r.file = f;
  out.saves.push(r);
  out.totals.files++;
  out.totals.generals_total += r.generals_total;
  out.totals.generals_missing_id += r.generals_missing_id;
  out.totals.generals_undefined_id += r.generals_undefined_id;
  out.totals.alerts_total += r.alerts_total;
  out.totals.alerts_empty_object += r.alerts_empty_object;
  if (r.parse_error) out.totals.parse_errors++;
}

if (jsonOut) { console.log(JSON.stringify(out, null, 1)); }
else {
  console.log(`[audit] saves 目录: ${dir}（${out.totals.files} 份 json）`);
  for (const r of out.saves) {
    console.log(`  ${r.file}: generals=${r.generals_total}(缺id ${r.generals_missing_id}/undefined串 ${r.generals_undefined_id}) alerts=${r.alerts_total}(空对象 ${r.alerts_empty_object})${r.parse_error ? ' 解析失败:' + r.parse_error : ''}`);
  }
  console.log(`[audit] 汇总: 坏 generals 元素 ${out.totals.generals_missing_id + out.totals.generals_undefined_id} / 空 defenseAlerts 对象 ${out.totals.alerts_empty_object} / 解析失败 ${out.totals.parse_errors}`);
  console.log('[audit] 0 条坏元素 ⇒ 案 A（NO_THROW 收紧）可安全切；>0 ⇒ 先按案 B 观测');
}
process.exit(0);
