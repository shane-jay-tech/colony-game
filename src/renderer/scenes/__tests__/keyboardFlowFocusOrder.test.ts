/**
 * inbox `20260925-120433-4686`（风险档 B · 工作类型 ux）
 *
 * 卷宗原文：「验证菜单、暂停、选择、确认、取消和焦点顺序。验收：核心流程无需鼠标完成；焦点不会丢失或被遮挡。」
 *
 * 接班第一动作＝先证名词在世（rg 实测），落点如下：
 *   - 菜单 = `scenes/ModeSelectScene.ts`（进游戏第一屏"请择一途"两卡）＋ `scenes/IntroScene.ts`（立国）。
 *     Electron 侧只有 `src/main/index.ts` 的 `autoHideMenuBar: true`，主进程**未自建 Menu**（① 组实测）。
 *   - 暂停 = `state/gameStore.ts` 的 `state.paused`（用户口，空格）与 `pauseHolders`（模态口），
 *     `isPaused()` 是两者的或；键盘口在 `scenes/GameScene.ts` 的 `keydown-SPACE`。
 *   - 选择 / 确认 = IntroScene 与各模态的按钮（`pointerdown` / `pointerup`）。
 *   - 取消 = `keydown-ESC` 的注册点（GameScene / BuildingPopover / PolicyTreePanel）。
 *   - 🔴 **「焦点顺序」在本仓不存在**（否证卷宗前提，故收窄而非判 failed）：`src/renderer` 非测试源里
 *     没有任何键盘导航键（方向键 / Enter / Tab 全 0），`src` 与 `public` 里 DOM 焦点 API 也全 0；
 *     源码出现的 `focus` 字样是政策树的**分支小标签数据字段**（`data/policies.ts` 里 `focus: '重粮'` 那类）
 *     与注释英文词，与键盘焦点无关。
 *     ⇒ 收窄成两条可执行面：**① 键盘监听注册/解绑是否残留**（"焦点丢失"在本仓的真形态），
 *       **② 暂停提示的层级遮挡**（"被遮挡"的真形态）。
 *
 * ⚠ 本班零生产码改动、零平衡数值改动。③⑤ 两组钉的是**在册缺口的现状**（首两屏只能鼠标、暂停遮罩被面板压住），
 *    不是"认可"它——缺口清单与最小改法写进 result「遗留问题」；键位方案属产品裁决面，执行手不代拍。
 *
 * 📌 c1001-01（2026-10-03，重落 c927-07）：三入口键盘实现重落盘 ⇒ ①③ 两组改钉（原「14 处/导航键 0 命中/
 *    两屏键盘 0 处/四模态只有指针口」钉的缺口现状已失效）；改法逐条照 c927-07 遗留节可批形状执行，
 *    唯一表 21 条、字面串总量 32（c927-07 普查读数原样复现）。配对棘轮语义移交 keyboardThreeEntries.test.ts。
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';

vi.mock('phaser', async () => {
  const mod = await import('../../ui/__tests__/fakeScene');
  return mod.makePhaserMock() as never;
});

import { GameScene } from '../GameScene';
import { GameStore } from '../../state/gameStore';
import type { IEventEmitter } from '../../state/gameStore';
import type { WorldMap } from '../../data/mapSchema';
import { BuildMode } from '../../state/buildMode';

const RENDERER_ROOT = resolve(__dirname, '../..'); // src/renderer
const REPO_ROOT = resolve(__dirname, '../../../..'); // 仓根

/** 递归列出目录下的 .ts（默认排除 __tests__，即"生产源"口径）。 */
function tsFiles(root: string, includeTests = false): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const abs = join(root, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' && !includeTests) continue;
      out.push(...tsFiles(abs, includeTests));
    } else if (entry.name.endsWith('.ts')) {
      out.push(abs);
    }
  }
  return out.sort();
}

/** 递归列任意目录下的 html/ts/js（public 面用）。 */
function webFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const abs = join(root, entry.name);
    if (entry.isDirectory()) out.push(...webFiles(abs));
    else if (/\.(html|ts|js)$/.test(entry.name)) out.push(abs);
  }
  return out.sort();
}

/**
 * 键盘绑定普查：返回 `keydown-<键名>` 的 {file, ev} 全集（`on` 与 `off` 各算一处，
 * 成对关系见 ② 组）。式子用 `new RegExp` 现拼，免得本件自己成为"某字面串 0 命中"判据的假命中源。
 */
function keydownBindings(): Array<{ file: string; ev: string }> {
  const re = new RegExp('keydown-([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*)', 'g');
  const hits: Array<{ file: string; ev: string }> = [];
  for (const f of tsFiles(RENDERER_ROOT)) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(re)) {
      const ev = m[1];
      if (!ev) continue; // noUncheckedIndexedAccess：捕获组理论上可空，空即跳过
      hits.push({ file: f.slice(RENDERER_ROOT.length + 1).replace(/\\/g, '/'), ev });
    }
  }
  return hits;
}

function read(relFromRepoRoot: string): string {
  return readFileSync(join(REPO_ROOT, relFromRepoRoot), 'utf8');
}

/** 16×16 全平原图（与 UIScene.test 同构，够 GameStore 建 accessor）。 */
function plainMap(): WorldMap {
  const tiles = [];
  for (let i = 0; i < 16 * 16; i++) tiles.push({ terrain: 'plain' as const, buildable: true });
  return { width: 16, height: 16, tiles, resourceNodes: [], seed: 0 };
}

function makeStore(): GameStore {
  const ee = new EventEmitter() as unknown as IEventEmitter;
  return new GameStore(ee, { worldMap: plainMap() }, { policies: [], decrees: [] });
}

/** GameScene 的键盘处理器面（private ⇒ 显式 cast 触达，与 ModeSelectScene.test 同手法）。 */
interface KeyboardHandlers {
  store?: GameStore;
  buildMode?: BuildMode;
  buildingPopover?: { hide: () => void };
  spaceHandler: () => void;
  speedKeyHandler1: () => void;
  speedKeyHandler2: () => void;
  speedKeyHandler3: () => void;
  escHandler: () => void;
}

/** 不跑 create()：只取实例属性初始化出来的按键处理器，避免拉整条装配链。 */
function bareGameScene(): KeyboardHandlers {
  return new GameScene() as unknown as KeyboardHandlers;
}

describe('① 键盘面普查：卷宗六个名词在盘上的真实落点', () => {
  it('renderer 生产源的键盘绑定共 32 处（21 键名唯一面：ESC/SPACE/ONE…NINE/UP/DOWN/ENTER）', () => {
    const got = keydownBindings().map(b => `${b.file}#${b.ev}`);
    const unique = [...new Set(got)].sort();
    expect(unique).toEqual([
      'scenes/GameScene.ts#ESC',
      'scenes/GameScene.ts#ONE',
      'scenes/GameScene.ts#SPACE',
      'scenes/GameScene.ts#THREE',
      'scenes/GameScene.ts#TWO',
      'scenes/IntroScene.ts#ENTER',
      'scenes/ModeSelectScene.ts#DOWN',
      'scenes/ModeSelectScene.ts#ENTER',
      'scenes/ModeSelectScene.ts#UP',
      'ui/BuildingPopover.ts#ESC',
      'ui/EventModal.ts#EIGHT',
      'ui/EventModal.ts#ENTER',
      'ui/EventModal.ts#FIVE',
      'ui/EventModal.ts#FOUR',
      'ui/EventModal.ts#NINE',
      'ui/EventModal.ts#ONE',
      'ui/EventModal.ts#SEVEN',
      'ui/EventModal.ts#SIX',
      'ui/EventModal.ts#THREE',
      'ui/EventModal.ts#TWO',
      'ui/PolicyTreePanel.ts#ESC',
    ]);
    // 字面串总量棘轮（c1001-01 重落 c927-07 后 14→32）：⚠ 32 不是「on/off 配对数」——
    // EventModal 的数字键 off 侧走运行值变量（h.ev）无字面串，ModeSelectScene/IntroScene 的
    // off 侧才是 1:1 字面串。真正的配对棘轮由 keyboardThreeEntries.test.ts 行为钉承责
    // （shutdown/关闭路径三例逐键断言 off 与 on 同函数）。
    expect(got.length).toBe(32);
  });

  it('导航/确认键已入世（UP/DOWN/ENTER 三入口在世）；TAB 等切焦键与未接键名仍 0 命中', () => {
    const keys = keydownBindings().map(b => b.ev);
    for (const nav of ['ENTER', 'UP', 'DOWN']) {
      expect(keys, nav).toContain(nav);
    }
    for (const absent of ['NUMPAD_ENTER', 'TAB', 'LEFT', 'RIGHT', 'A', 'B']) {
      expect(keys, absent).not.toContain(absent);
    }
  });

  it('DOM 焦点面（排除键盘三入口后）为空：src 与 public 无 tabindex / focus() / activeElement / autofocus', () => {
    const files = [...tsFiles(resolve(REPO_ROOT, 'src'), true), ...webFiles(join(REPO_ROOT, 'public'))]
      // 允许含这些字面串的文件＝本件（普查代码自身）＋键盘三入口两件
      // （c1001-01 重落 c927-07：IntroScene 的 autofocus/显式 focus 是键盘入口的行为本体；
      //   keyboardThreeEntries.test.ts 的字面串是其测试自身）
      .filter(f => !f.endsWith('keyboardFlowFocusOrder.test.ts'))
      .filter(f => !f.endsWith('IntroScene.ts'))
      .filter(f => !f.endsWith('keyboardThreeEntries.test.ts'));
    const needles = ['tabindex', 'activeelement', '.focus(', 'autofocus'];
    const hits: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, 'utf8').toLowerCase(); // 大小写两形（tabindex/tabIndex）一并覆盖
      for (const n of needles) if (src.includes(n)) hits.push(`${f}#${n}`);
    }
    expect({ scanned: files.length, hits }).toEqual({ scanned: files.length, hits: [] });
  });

  it('Electron 主进程未自建应用菜单 ⇒ 卷宗的"菜单"只在游戏内两屏', () => {
    const main = read('src/main/index.ts');
    expect(main).toContain('autoHideMenuBar');
    const menuRe = new RegExp('new Menu\\b|setApplicationMenu|buildFromTemplate');
    expect(menuRe.test(main)).toBe(false);
  });
});

describe('② 取消（ESC）：三处注册、解绑成对，且无"焦点栈"协调', () => {
  it('ESC 的 on/off 在三个文件里各 1:1（"焦点丢失"口径的实测面）', () => {
    const perFile = (rel: string) => {
      const src = read(`src/renderer/${rel}`);
      const on = src.match(new RegExp("keyboard\\?\\.on\\('keydown-ESC'", 'g')) ?? [];
      const off = src.match(new RegExp("keyboard\\?\\.off\\('keydown-ESC'", 'g')) ?? [];
      return { on: on.length, off: off.length };
    };
    for (const rel of ['scenes/GameScene.ts', 'ui/BuildingPopover.ts', 'ui/PolicyTreePanel.ts']) {
      expect(perFile(rel), rel).toEqual({ on: 1, off: 1 });
    }
  });

  it('GameScene 的一次 ESC 同时做两件事：退建造模式 + 收建筑弹窗（无"谁在前台"判定）', () => {
    const scene = bareGameScene();
    const buildMode = new BuildMode();
    const cancelSpy = vi.spyOn(buildMode, 'cancel');
    const hideSpy = vi.fn();
    scene.store = makeStore();
    scene.buildMode = buildMode;
    scene.buildingPopover = { hide: hideSpy };
    scene.escHandler();
    expect(cancelSpy).toHaveBeenCalledTimes(1);
    expect(hideSpy).toHaveBeenCalledTimes(1);
  });
});

describe('③ 键盘缺口收口面（c1001-01 重落 c927-07 后）：两屏键盘在世、剩余三模态仍只有指针口', () => {
  it('两个"菜单"屏（择途 / 立国）键盘在世且指针交互未删（键盘口与鼠标口并存）', () => {
    for (const rel of ['src/renderer/scenes/ModeSelectScene.ts', 'src/renderer/scenes/IntroScene.ts']) {
      const src = read(rel);
      expect(src.includes('keyboard'), rel).toBe(true);
      expect(src, rel).toMatch(/pointer(down|up|over|out)/);
    }
  });

  it('危机/宗族/教程三张模态仍只有指针口（EventModal 已收键盘口并移出本缺口清单）', () => {
    const bound = new Set(keydownBindings().map(b => b.file));
    for (const rel of ['ui/CrisisModal.ts', 'ui/FactionDemandModal.ts', 'ui/TutorialModal.ts']) {
      expect(bound.has(rel), rel).toBe(false);
      expect(read(`src/renderer/${rel}`), rel).toMatch(/pointer(down|up)/);
    }
  });
});

describe('④ 暂停与速度的键盘可达性（真调用 GameScene 处理器，不靠源码正则）', () => {
  function ready(): { scene: KeyboardHandlers; store: GameStore } {
    const scene = bareGameScene();
    const store = makeStore();
    scene.store = store;
    return { scene, store };
  }

  it('空格：state.paused 两态往返，只动用户口（不碰模态 pauseHolders）', () => {
    const { scene, store } = ready();
    expect(store.isPaused()).toBe(false);
    scene.spaceHandler();
    expect(store.isPaused()).toBe(true);
    scene.spaceHandler();
    expect(store.isPaused()).toBe(false);
  });

  it('数字键 1/2/3：先恢复再定档（暂停态下按 2 直接可跑）', () => {
    const { scene, store } = ready();
    scene.spaceHandler();
    expect(store.isPaused()).toBe(true);
    scene.speedKeyHandler2();
    expect(store.isPaused()).toBe(false);
    expect(store.getSpeed()).toBe(2);
    scene.speedKeyHandler1();
    expect(store.getSpeed()).toBe(1);
    scene.speedKeyHandler3();
    expect(store.getSpeed()).toBe(3);
  });

  it('store 未装配（GameScene 声明期即置 null）时按键不抛：切换窗口内键盘先于装配的形态', () => {
    const scene = bareGameScene();
    expect(scene.store ?? null).toBeNull();
    expect(() => scene.spaceHandler()).not.toThrow();
    expect(() => scene.speedKeyHandler1()).not.toThrow();
    expect(() => scene.escHandler()).not.toThrow();
  });
});

describe('⑤ 遮挡：暂停遮罩/提示的层级实际低于所有面板（在册缺陷现状）', () => {
  /** 现读某文件里 `setDepth(<整数>)` 的全部取值。 */
  function depths(rel: string): number[] {
    const src = read(`src/renderer/${rel}`);
    return (src.match(/setDepth\((-?\d+)\)/g) ?? []).map(s => Number(/-?\d+/.exec(s)?.[0]));
  }

  it('层级现值：暂停遮罩 900 / 提示 901，而 HUD 与 BuildPanel 1000、面板与模态 2000、Toast 2400', () => {
    const ui = depths('scenes/UIScene.ts');
    expect(ui).toContain(900);
    expect(ui).toContain(901);
    expect(depths('ui/HUD.ts')).toContain(1000);
    expect(depths('ui/BuildPanel.ts')).toContain(1000);
    expect(depths('ui/EventModal.ts')).toContain(2000);
    expect(depths('ui/Toast.ts')).toContain(2400);
  });

  it('🔴 在册缺口：UIScene 注释称"面板之上"，实际遮罩 depth 小于每一类面板容器', () => {
    const src = read('src/renderer/scenes/UIScene.ts');
    const overlay = /pauseOverlay = this\.add\.graphics\(\)\.setDepth\((\d+)\)/.exec(src);
    if (!overlay) throw new Error('UIScene.ts 暂停遮罩的构造形态变了，本桩需同步');
    const overlayDepth = Number(overlay[1]);
    expect(overlayDepth).toBeLessThan(Math.min(...[1000, 2000, 2400]));
  });

  it('遮罩未 setInteractive ⇒ 它只压暗不挡点击（模态在暂停期间仍可操作）', () => {
    const src = read('src/renderer/scenes/UIScene.ts');
    const from = src.indexOf('pauseOverlay = this.add.graphics()');
    const to = src.indexOf('store.on(STATE_EVENTS.PAUSED_CHANGED');
    expect(from).toBeGreaterThan(-1);
    expect(to).toBeGreaterThan(from);
    expect(src.slice(from, to).includes('setInteractive')).toBe(false);
  });
});
