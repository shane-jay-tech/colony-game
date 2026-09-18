// c918-06（S3）：scatter 唯一来源守卫——BootScene 不得出现散布字面清单，
// 加载必须派生自 scatterConfig 的 ALL_SCATTER_IDS（唯一权威源）。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from 'vitest';

const bootSceneSource = readFileSync(
  join(__dirname, '..', 'BootScene.ts'),
  'utf8',
);

test('BootScene 散布加载自 scatterConfig 派生（无字面清单）', () => {
  expect(bootSceneSource).toContain("ALL_SCATTER_IDS as SCATTER_IDS");
  expect(bootSceneSource).toContain("for (const id of SCATTER_IDS)");
});

test('BootScene 无散布字面清单（守卫：注入字面数组即红）', () => {
  // 字面清单特征：形如 ['a', 'b', …] 的数组且元素带 scatter/树石灌木语义。
  // 守卫粒度＝禁止 "for (const … of ['" 后接散布 id 字面量的模式。
  expect(/for \(const \w+ of \[\s*'[^']+'\s*,\s*'[^']+'/.test(bootSceneSource)).toBe(false);
  // 同时禁止散布 png 路径绕过 SCATTER_IDS 直接硬编码出现
  expect(/load\.image\(`scatter_\$\{[^}]+\}`\s*,\s*`art\/scatter\/(?!\$\{)/.test(bootSceneSource) &&
    !/for \(const id of SCATTER_IDS\)/.test(bootSceneSource)).toBe(false);
});

test('SCATTER_IDS 唯一来源为 scatterConfig（BootScene 不自定义清单）', () => {
  expect(bootSceneSource).not.toMatch(/const\s+\w*SCATTER\w*\s*=\s*\[/);
  expect(bootSceneSource).not.toMatch(/['"]tree['"]|['"]stone['"]|['"]bush['"]|['"]reed['"]/);
});
