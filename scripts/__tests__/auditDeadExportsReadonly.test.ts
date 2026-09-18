// c918-15：audit-dead-exports 只读语义回归守护——
// 历经 n916c-17→n916d-25→n916f-04 三次语义变更，防止再退回「复跑即写盘」。
// 无参运行后断言默认 JSON 的 mtime 与内容均不变。
import { execSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from 'vitest';

const ROOT = join(__dirname, '..', '..');
const TARGET = join(ROOT, 'docs', 'insights', 'colony-dead-exports-20260914.json');

test('audit-dead-exports 无参运行＝只读：默认 JSON mtime/内容不变', () => {
  const beforeMtime = statSync(TARGET).mtimeMs;
  const beforeContent = readFileSync(TARGET, 'utf8');

  execSync('node scripts/audit-dead-exports.mjs', { cwd: ROOT, stdio: 'ignore' });

  const afterMtime = statSync(TARGET).mtimeMs;
  const afterContent = readFileSync(TARGET, 'utf8');
  expect(afterMtime).toBe(beforeMtime);
  expect(afterContent).toBe(beforeContent);
});
