// n916d-24：BootScene loaderror 去重锁定——单次加载失败仅一条错误记录。
// 源码级钉测（免 Phaser 头依赖）：loaderror 注册恰好 1 处；此前两处同回调注册
// 会让每个缺图文件双打 debug 日志。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = readFileSync(
  resolve(process.cwd(), 'src/renderer/scenes/BootScene.ts'),
  'utf-8',
);

describe('n916d-24 BootScene loaderror 注册去重', () => {
  it('loaderror 注册恰好 1 处', () => {
    const needle = "this.load.on('loaderror'";
    const count = SRC.split(needle).length - 1;
    expect(count).toBe(1);
  });

  it('唯一回调语义保持：debug 单条 + fallback 提示', () => {
    const handler = SRC.slice(
      SRC.indexOf("this.load.on('loaderror'"),
      SRC.indexOf("for (const item of getBootLoadList('building')"),
    );
    expect((handler.match(/console\.debug/g) ?? []).length).toBe(1);
    expect(handler).toContain('sprite missing (fallback to sigil)');
  });
});
