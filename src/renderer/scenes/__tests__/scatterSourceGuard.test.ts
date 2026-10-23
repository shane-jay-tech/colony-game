// c918-06（S3）：scatter 唯一来源守卫——BootScene 不得出现散布字面清单。
// c1023-10（c1011-11 残余①·PLAN#2 末条）：权威源换代——加载清单由 scatterConfig.ALL_SCATTER_IDS
// （原唯一权威）改为 artManifest.SCATTER_ART 直取（manifest 为权威 boot-loading 源）；
// 本守卫随批换代并保留「无字面清单」两断言的原始粒度。
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from 'vitest';

const bootSceneSource = readFileSync(
  join(__dirname, '..', 'BootScene.ts'),
  'utf8',
);

test('BootScene 散布加载自 artManifest.SCATTER_ART 派生（c1023-10 权威换代，无字面清单）', () => {
  expect(bootSceneSource).toContain("SCATTER_ART");
  expect(bootSceneSource).toContain("for (const asset of SCATTER_ART)");
  // 旧权威（scatterConfig 直呼）不再出现在加载面
  expect(bootSceneSource).not.toContain("ALL_SCATTER_IDS");
});

test('BootScene 无散布字面清单（守卫：注入字面数组即红）', () => {
  // 字面清单特征：形如 ['a', 'b', …] 的数组且元素带 scatter/树石灌木语义。
  // 守卫粒度＝禁止 "for (const … of ['" 后接散布 id 字面量的模式。
  expect(/for \(const \w+ of \[\s*'[^']+'\s*,\s*'[^']+'/.test(bootSceneSource)).toBe(false);
  // 同时禁止散布 webp 路径绕过 SCATTER_ART 直接硬编码出现
  expect(/load\.image\(`scatter_\$\{[^}]+\}`\s*,\s*`art\/scatter\/(?!\$\{)/.test(bootSceneSource)).toBe(false);
});

test('散布清单不自定义于 BootScene（唯一权威在 artManifest.SCATTER_ART）', () => {
  expect(bootSceneSource).not.toMatch(/const\s+\w*SCATTER\w*\s*=\s*\[/);
  expect(bootSceneSource).not.toMatch(/['"]tree['"]|['"]stone['"]|['"]bush['"]|['"]reed['"]/);
});
