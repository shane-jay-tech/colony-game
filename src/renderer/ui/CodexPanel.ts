import Phaser from 'phaser';
import { COLORS, COLORS_HEX, FONTS } from './palette';
import { drawDecorativePanelFrame } from './panelDecoration';
import type { GameStore } from '../state/gameStore';

/**
 * CodexPanel：典册（新手引导 / 百科）——随时可查的说明书。
 *
 * 邦国录系统繁多（资源/建筑/国策朝令/国格/军事将领/阶层博弈/大业/经济供养），新手极易懵。
 * 本面板左侧主题列表 + 右侧大白话讲解，打开时游戏时停。由顶栏「?」按钮打开。
 * 纯静态内容，无 store 依赖（除时停）。范式照 MegaProjectPanel（居中模态 + 引用计数时停）。
 */

const PANEL_W = 700;
const PANEL_H = 540;
const LIST_W = 150;

interface Topic { title: string; body: string }

const TOPICS: Topic[] = [
  {
    title: '上手指引',
    body:
      '你在经营一个春秋小邦，目标是从「聚落」一路爬到「天下共主」。\n\n' +
      '开局要务：\n' +
      '1. 先建几座「农田」保证有饭吃（人口每天会吃粮，断粮会饿死）。\n' +
      '2. 建「民居」提高住房上限，人口才能涨。\n' +
      '3. 建「水井/市集」起步，攒钱采纳国策。\n' +
      '4. 之后按需发展工坊、军事、外交、礼制。\n\n' +
      '游戏开局是暂停的——你第一次操作后时间才开始走。顶栏右侧有速度/暂停键。',
  },
  {
    title: '资源',
    body:
      '粮：人口每天吃；断粮先掉士气、宽限几天后开始饿死减员。\n' +
      '木 / 石：建造主材。\n' +
      '钱：采纳国策、颁朝令、外交、招募将领都要花。\n' +
      '布 / 铜 / 礼：中后期资源——工匠要布、士兵要铜、礼制要礼器。\n' +
      '民：你的人口=劳力池，建筑会占用劳力（不消耗）。顶栏显示「现有/住房上限」。\n\n' +
      '资源有储量上限（基础 9999），建「仓廪」可提高存储上限。',
  },
  {
    title: '建筑与劳力',
    body:
      '建造：点左侧「建造」栏选建筑，在地图上放置；占用对应数量的「民」（不是消耗）。\n' +
      '升级：点已建建筑可原地升级（纪元式 T1→T2→T3）。\n' +
      '拆除：点「拆除工具」后，**左键点建筑即拆**（返还半数材料）；右键/ESC 退出拆除。\n\n' +
      '相邻加成：有些建筑挨着会增益（如农田临水井 +30% 粮）。\n' +
      '灰显的建筑=前置已满足但还差国格，会标「需晋X」——升国格后即可建。',
  },
  {
    title: '国策与朝令',
    body:
      '点顶栏「朝堂」打开全屏国策树（打开时游戏暂停）。\n\n' +
      '国策：永久加成，排成分支树，有前置依赖、有的互斥（二选一）。已采纳显 ✓。\n' +
      '朝令：分阶段推进的政令（按天数+花费逐阶完成）。\n\n' +
      '**把鼠标悬停在任意节点上，就能看到它的具体效果**（产出+X%、军力+N 等）——看不懂就先悬停。',
  },
  {
    title: '国格阶梯',
    body:
      '六级：聚落 → 城邑 → 邦国 → 诸侯 → 霸主 → 天下共主。\n\n' +
      '靠人口、钱、以及建成特定建筑来晋级（如升城邑需人口≥30+钱≥80+建市集）。\n' +
      '国格越高，解锁的建筑、国策、兵种越多。\n\n' +
      '低谷时（国库+存粮长期双空）会触发危机、可能降格或割地，但不会 Game Over——能翻身。',
  },
  {
    title: '军事与将领',
    body:
      '点顶栏「军务」打开。\n\n' +
      '军力 = 兵阶层人口 + 已解锁兵种（靠兵营/练兵场/马厩/战车坊/禁军府）+ 将领指挥。养兵越强，越能威慑邻国、出征越易胜。\n' +
      '将领：可招募（耗钱，有忠诚度，忠诚太低会叛逃），出征带将有加成。\n' +
      '出征：选目标邦国 + 突袭/威慑/围攻，会真实结算战利品/伤亡/声望。\n' +
      '防御：邻国会「来犯」（提前预警几天）——平时养了兵就守土，没兵就被劫掠。',
  },
  {
    title: '阶层博弈',
    body:
      '人口超过 80 后，国中会出现三大势力：豪强、外戚、士人。\n\n' +
      '他们不时上书提诉求（减赋/封赏/开朝议等），会弹窗让你选「接受」或「拒绝」，各有后果（钱、民心、研究、权力倾向等）。\n' +
      '建「监察台」有助于处理这些诉求。',
  },
  {
    title: '大业（巨型工程）',
    body:
      '点顶栏「大业」打开。\n\n' +
      '铸九鼎 / 作春秋 / 修直道——耗时很长、消耗很大，但完工给强力永久增益（声望、产出、贸易、永镇四方等）。\n' +
      '部分工程需要前置建筑（如铸九鼎/作春秋需先建「太庙」）。这是你后期的终极目标锚点。',
  },
  {
    title: '经济与供养',
    body:
      '人口每天吃粮：农 1、工 1.5、兵 2、士 2（粮/天/人）。粮要持续够。\n' +
      '中后期供养：工要布、兵要铜、士要钱——这些缺了不会饿死，但会掉民心，记得建蚕桑/铸造、给士发俸。\n\n' +
      '季节影响：春、秋产粮高，冬天消耗略高——农田数量要按全年配平，别旺季猛建、淡季饿肚。',
  },
  {
    title: '操作与界面',
    body:
      '地图：拖拽平移，滚轮缩放。\n' +
      '顶栏下方一排大按钮=主功能（朝堂/邦交/军务/大业）；右上角=设置/帮助/速度。\n' +
      '速度键：|| 暂停、> >> >>> 三档快进。\n' +
      '点顶栏「民」可看人口详情；国策树/各面板打开时游戏自动暂停，可从容决策。\n\n' +
      '存档自动保存，版本兼容。遇到不懂的随时回来查本「典册」。',
  },
];

export class CodexPanel {
  private readonly scene: Phaser.Scene;
  private readonly store: GameStore;
  private readonly container: Phaser.GameObjects.Container;
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly overlayZone: Phaser.GameObjects.Zone;
  private readonly bg: Phaser.GameObjects.Graphics;
  private readonly title: Phaser.GameObjects.Text;
  private readonly content: Phaser.GameObjects.Text;
  private readonly closeBg: Phaser.GameObjects.Graphics;
  private readonly closeText: Phaser.GameObjects.Text;
  private readonly closeZone: Phaser.GameObjects.Zone;
  private tabs: { bg: Phaser.GameObjects.Graphics; txt: Phaser.GameObjects.Text; zone: Phaser.GameObjects.Zone }[] = [];

  private isOpen = false;
  private holdsPause = false;
  private destroyed = false;
  private selected = 0;
  private static readonly PAUSE_HOLDER = 'codex';

  constructor(scene: Phaser.Scene, store: GameStore) {
    this.scene = scene;
    this.store = store;
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(2000).setVisible(false);
    this.overlay = scene.add.graphics();
    this.overlayZone = scene.add.zone(0, 0, scene.scale.width, scene.scale.height)
      .setOrigin(0, 0).setInteractive({ useHandCursor: false });
    this.overlayZone.on('pointerup', () => this.close());
    this.container.add([this.overlay, this.overlayZone]);

    this.bg = scene.add.graphics();
    this.title = scene.add.text(0, 0, '典册 · 邦国须知', { ...FONTS.title, color: COLORS_HEX.GOLD } as Phaser.Types.GameObjects.Text.TextStyle);
    this.content = scene.add.text(0, 0, '', {
      ...FONTS.body, color: COLORS_HEX.INK, wordWrap: { width: PANEL_W - LIST_W - 64 }, lineSpacing: 6,
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.closeBg = scene.add.graphics();
    this.closeText = scene.add.text(0, 0, '✕', { ...FONTS.body, color: COLORS_HEX.PAPER, fontStyle: 'bold' } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0.5);
    this.closeZone = scene.add.zone(0, 0, 32, 32).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.closeZone.on('pointerup', () => this.close());
    this.container.add([this.bg, this.title, this.content, this.closeBg, this.closeText, this.closeZone]);

    // 左侧主题列表按钮（一次性创建）
    TOPICS.forEach((t, i) => {
      const tbg = scene.add.graphics();
      const txt = scene.add.text(0, 0, t.title, { ...FONTS.body, color: COLORS_HEX.PAPER } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0, 0.5);
      const zone = scene.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerup', () => { this.selected = i; this.layout(); });
      this.container.add([tbg, txt, zone]);
      this.tabs.push({ bg: tbg, txt, zone });
    });
  }

  toggle(): void { this.isOpen ? this.close() : this.open(); }
  open(): void {
    if (this.destroyed || this.isOpen) return;
    this.isOpen = true;
    if (!this.holdsPause) { this.store.requestPause(CodexPanel.PAUSE_HOLDER); this.holdsPause = true; }
    this.layout();
    this.container.setVisible(true);
  }
  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.container.setVisible(false);
    if (this.holdsPause) { this.store.releasePause(CodexPanel.PAUSE_HOLDER); this.holdsPause = false; }
  }
  isVisible(): boolean { return this.isOpen; }

  layout(): void {
    if (!this.isOpen) return;
    const sw = this.scene.scale.width, sh = this.scene.scale.height;
    const px = Math.floor((sw - PANEL_W) / 2), py = Math.floor((sh - PANEL_H) / 2);
    this.overlay.clear();
    this.overlay.fillStyle(COLORS.BG_INK, 0.6);
    this.overlay.fillRect(0, 0, sw, sh);
    this.overlayZone.setPosition(0, 0).setSize(sw, sh);
    this.bg.clear();
    drawDecorativePanelFrame(this.bg, px, py, PANEL_W, PANEL_H, 'left');
    // 左侧列表底纹
    this.bg.fillStyle(COLORS.WOOD, 0.35);
    this.bg.fillRect(px + 12, py + 60, LIST_W, PANEL_H - 76);
    this.title.setPosition(px + 24, py + 20);
    const cx = px + PANEL_W - 44, cy = py + 16;
    this.closeBg.clear();
    this.closeBg.fillStyle(COLORS.CINNABAR, 0.85);
    this.closeBg.fillRect(cx, cy, 32, 32);
    this.closeText.setPosition(cx + 16, cy + 16);
    this.closeZone.setPosition(cx, cy).setSize(32, 32);

    // 左侧主题按钮
    const listX = px + 16, listY = py + 68, rowH = 40;
    this.tabs.forEach((tab, i) => {
      const y = listY + i * rowH;
      const active = i === this.selected;
      tab.bg.clear();
      tab.bg.fillStyle(active ? COLORS.GOLD : COLORS.WOOD_LIGHT, active ? 0.95 : 0.0);
      if (active) tab.bg.fillRect(listX, y, LIST_W - 8, rowH - 6);
      tab.txt.setColor(active ? COLORS_HEX.INK : COLORS_HEX.PAPER).setPosition(listX + 10, y + (rowH - 6) / 2);
      tab.zone.setPosition(listX, y).setSize(LIST_W - 8, rowH - 6);
    });

    // 右侧内容
    const topic = TOPICS[this.selected]!;
    this.content.setText(topic.body).setPosition(px + LIST_W + 36, py + 68);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.holdsPause) { this.store.releasePause(CodexPanel.PAUSE_HOLDER); this.holdsPause = false; }
    this.container.destroy(true);
  }

  // 测试 hook（DeepSeek nit：越界 index 会让 layout 访问 TOPICS[selected] 出错，clamp 防御）
  selectTopic(i: number): void { this.selected = Math.max(0, Math.min(i, TOPICS.length - 1)); if (this.isOpen) this.layout(); }
  topicCount(): number { return TOPICS.length; }
}
