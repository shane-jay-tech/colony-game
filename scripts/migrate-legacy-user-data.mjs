#!/usr/bin/env node
/**
 * c1007-25：老档 user-data 路径迁移工具（c1006-04 遗留 1）。
 *
 * 背景：c1006-04（commit 2405592）给 D 盘用户层加 <username> 命名空间——
 * 旧路径 D:/colony-game/user-data/（无用户层，含 session/temp/logs）与新路径
 * user-data/<ns>/ 并存，首启新路径空档。本脚本做**一次性搬移**：旧路径下的
 * saves（存档）/session/temp/logs 内容移入新路径对应位。
 *
 * 语义：
 * - 默认 dry-run（只打印计划，零移动）；--apply 才真搬；
 * - 幂等：目标已存在的同名条目跳过（保留新路径现状，不覆盖）；
 *   源条目搬空后删除空目录（rmdir 仅空目录，非递归删除——永不删有内容的目录）；
 * - saves 优先：存档是唯一不可再生物质，session/temp/logs 是可再生缓存；
 * - 启用属主班拍板（本脚本默认不挂任何启动链）。
 *
 * 用法：node scripts/migrate-legacy-user-data.mjs [--apply] [--ns <username>] [--root D:/colony-game]
 */
import { existsSync, mkdirSync, readdirSync, renameSync, rmdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { userInfo } from 'node:os';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const nsArgIdx = args.indexOf('--ns');
const rootArgIdx = args.indexOf('--root');
const root = rootArgIdx >= 0 ? args[rootArgIdx + 1] : 'D:/colony-game';

function safeNamespace() {
  try {
    // 与 src/main/index.ts USER_NAMESPACE 同清洗口径：文件名非法字符折叠 '_'
    return String(userInfo().username).replace(/[\\/:*?"<>|]/g, '_') || 'default';
  } catch {
    return 'default';
  }
}
const ns = nsArgIdx >= 0 ? args[nsArgIdx + 1] : safeNamespace();

const LEGACY = join(root, 'user-data');
const TARGET = join(LEGACY, ns);
// saves 优先列出（不可再生）；session/temp/logs 为可再生缓存，迁移是顺手保历史
const MIGRATE_DIRS = ['saves', 'session', 'temp', 'logs'];

if (!existsSync(LEGACY)) {
  console.log(`[migrate] 旧路径不存在：${LEGACY} —— 无可迁移面，零动作`);
  process.exit(0);
}

console.log(`[migrate] ${apply ? 'APPLY' : 'DRY-RUN'}  legacy=${LEGACY}  target=${TARGET}`);
let planned = 0;
let moved = 0;
let skipped = 0;

for (const dir of MIGRATE_DIRS) {
  const src = join(LEGACY, dir);
  if (!existsSync(src)) continue;
  const entries = readdirSync(src);
  if (entries.length === 0) {
    console.log(`  ${dir}/  空，跳过`);
    continue;
  }
  const dstDir = join(TARGET, dir);
  for (const entry of entries) {
    const from = join(src, entry);
    const to = join(dstDir, entry);
    planned += 1;
    if (existsSync(to)) {
      skipped += 1;
      console.log(`  ${dir}/${entry}  目标已存在，跳过（幂等）`);
      continue;
    }
    console.log(`  ${dir}/${entry}  ->  ${apply ? to : '(dry-run)'}`);
    if (apply) {
      mkdirSync(dstDir, { recursive: true });
      renameSync(from, to);
      moved += 1;
    }
  }
  if (apply && readdirSync(src).length === 0) {
    rmdirSync(src); // 仅空目录；非递归——有残留内容时保留原样
    console.log(`  ${dir}/  已搬空，移除空目录`);
  }
}

console.log(`[migrate] 计划 ${planned} 条；${apply ? `实移 ${moved}，跳过 ${skipped}` : `dry-run 零变更（--apply 生效）`}`);
if (!apply) process.exit(0);
