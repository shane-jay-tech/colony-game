// c918-20：ModeSelectScene 模式选择组合 smoke（PLAN 第 6 项欠账）。
// mock Phaser.Scene 基类（避免真引擎），钉「点 story 卡→mode='story'→IntroScene；
// 点 sandbox 卡→mode='sandbox'」两链，与 registry 写入。
// c919-01：FakeScene 类迁共享脚手架 ui/__tests__/fakeScene 的 sceneClassMock 单例
//（vi.mock 工厂不可引用外部变量，改经 await import 取用同一单例，registryStore/sceneStart 与断言侧同源）。
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('phaser', async () => {
  const mod = await import('../../ui/__tests__/fakeScene');
  return mod.makePhaserMock() as never;
});

import { ModeSelectScene } from '../../scenes/ModeSelectScene';
import { REGISTRY_KEYS } from '../../ui/registry';
import { sceneClassMock } from '../../ui/__tests__/fakeScene';

const { registryStore, sceneStart } = sceneClassMock;

/** 收集 create() 里两张卡的 pointerup 处理器（sandbox/story 各一）。 */
function captureChooseHandlers(scene: ModeSelectScene) {
  return {
    sandbox: () => (scene as unknown as { chooseSandbox: () => void }).chooseSandbox(),
    story: () => (scene as unknown as { chooseStory: () => void }).chooseStory(),
  };
}

describe('ModeSelectScene', () => {
  let scene: ModeSelectScene;

  beforeEach(() => {
    registryStore.clear();
    sceneStart.mockClear();
    scene = new ModeSelectScene();
    scene.create();
  });

  it('create 后两卡 zone 各挂 pointerup（择途入口就绪）', () => {
    // 通过私有选择器触达：能跑通即 create 的装配链完整
    const h = captureChooseHandlers(scene);
    expect(typeof h.sandbox).toBe('function');
    expect(typeof h.story).toBe('function');
  });

  it('点 sandbox 卡：gameMode 写 sandbox 并进入 IntroScene', () => {
    const h = captureChooseHandlers(scene);
    h.sandbox();
    expect(registryStore.get(REGISTRY_KEYS.gameMode)).toBe('sandbox');
    expect(sceneStart).toHaveBeenCalledWith('IntroScene');
  });

  it('点 story 卡：gameMode 写 story 并进入 IntroScene', () => {
    const h = captureChooseHandlers(scene);
    h.story();
    expect(registryStore.get(REGISTRY_KEYS.gameMode)).toBe('story');
    expect(sceneStart).toHaveBeenCalledWith('IntroScene');
  });

  it('两模式都指向同一立国流程（IntroScene）——只是 mode 不同', () => {
    const h = captureChooseHandlers(scene);
    h.sandbox();
    expect(registryStore.get(REGISTRY_KEYS.gameMode)).toBe('sandbox');
    h.story();
    expect(registryStore.get(REGISTRY_KEYS.gameMode)).toBe('story');
    expect(sceneStart).toHaveBeenCalledTimes(2);
    expect(sceneStart).toHaveBeenCalledWith('IntroScene');
  });
});
