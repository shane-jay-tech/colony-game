import Phaser from 'phaser';
import { COLORS, COLORS_HEX, FONTS } from '../ui/palette';
import type { GameStore } from '../state/gameStore';
import type { ModifierInstance } from '../data/schema';

/**
 * IntroScene — v0.8 J-3e / J-3e+：开场代入感（修缺陷 #9）。
 *
 * 进游戏前流程：
 *   1. 显示 "邦国录" 标题 + 一段春秋小邦时代背景文本
 *   2. 玩家从 24 个春秋古国名池中随机抽 6 候选；可"换一批"重抽，
 *      也可在输入框里自取一字（最多三字）
 *   3. 玩家三选一身份：小邦君 / 流亡公子 / 国人推举领袖
 *      - 每个身份配一段从底层视角入的开场楔子
 *      - 每个身份给一个起始 modifier（永久）
 *   4. 点"立邦"按钮 → 写入 registry + 起始 modifier → 启动 GameScene
 *
 * 设计约束：
 *   - 国号用 Phaser DOMElement 包一个 input（main.ts 已开 dom.createContainer）
 *   - 视觉对齐 palette（GOLD/WOOD/PAPER），不引入第 12 色
 *   - 适配 Phaser.Scale.RESIZE：所有元素 setScrollFactor(0)，layout() 在 resize 重排
 *   - 文案半文半白，禁偏僻字（feedback memory：colony-game-text-balance）
 */

interface IdentityChoice {
  id: 'lord_minor' | 'exile_prince' | 'elected_leader';
  name: string;
  prologueTitle: string;
  /** 楔子正文（春秋底层视角入；～180-220 字） */
  prologue: string;
  /** 起始 modifier */
  startingModifier: ModifierInstance;
  /** 短摘要给按钮显示 */
  summary: string;
}

/**
 * 春秋时期实存的小邦国名池（24 个）。每次进入 IntroScene 随机抽 6 个作候选；
 * 玩家可以点候选填入输入框，也可以在输入框里自取一字。
 */
const COUNTRY_POOL: string[] = [
  '邾', '莒', '滕', '薛', '徐', '邓',
  '申', '息', '随', '唐', '虞', '巴',
  '罗', '纪', '葛', '戴', '巢', '舒',
  '宗', '向', '郯', '谷', '蓼', '卢',
];

const CANDIDATE_COUNT = 6;

/** 输入框允许的字符：限中文汉字（不允许英文/数字/符号），最多 3 字 */
const VALID_NAME_RE = /^[一-鿿]{1,3}$/;

const IDENTITIES: IdentityChoice[] = [
  {
    id: 'lord_minor',
    name: '小邦君',
    prologueTitle: '受命于先君',
    prologue:
      '老臣捧着先君的玉印走进内室。你伸手接过来，玉色温润如霜，重得让你手心微微一沉。' +
      '你父亲上个月死于瘟疫，母亲哭了七天七夜。如今轮到你去祖庙告祭——而你才十六岁。' +
      '田里收割的农人停下手，抬头看向城门那边，想看清楚新立的小邦君到底是什么模样。' +
      '老臣低声说："君上，邦虽小，民还可以活下去。"',
    startingModifier: {
      id: 'mod_intro_lord_minor',
      name: '先君遗泽',
      category: 'culture',
      stackable: false,
      effects: [
        { target: 'country_morale', op: 'add', value: 5 },
        { target: 'country_military_power', op: 'add', value: 3 },
      ],
      visualBadge: null,
      remainingDays: -1,
      description: '继位有据，士民暂安。',
      descPlain: '小邦君开局：民心 +5、军力 +3（永久）。',
    },
    summary: '继承父位之少君。民心 +5、军力 +3。',
  },
  {
    id: 'exile_prince',
    name: '流亡公子',
    prologueTitle: '车辙未冷，故国已远',
    prologue:
      '十年前你叔父杀了你父亲，你被乳母裹在怀里逃出王宫。' +
      '这十年里，你住过齐国的客舍，吃过宋人的稀粥，也给晋国的贵族驾过车。' +
      '直到上个月，你在驿道上听见几个农人议论："那位公子要是回来了，地租兴许能轻些。"你停下脚步，手把缰绳握紧。' +
      '今天清晨你立在邦境上，身后只跟着三辆车——但村口的孩童远远看见车上的旗号，已经跑回去叫老人出来。',
    startingModifier: {
      id: 'mod_intro_exile_prince',
      name: '十年阅世',
      category: 'culture',
      stackable: false,
      effects: [
        { target: 'country_renown', op: 'add', value: 5 },
        { target: 'country_diplomacy_weight', op: 'add', value: 5 },
        { target: 'country_morale', op: 'add', value: -2 },
        { target: 'country_military_power', op: 'add', value: -2 },
      ],
      visualBadge: null,
      remainingDays: -1,
      description: '羁旅之人，得失参半。',
      descPlain: '流亡公子开局：信誉 +5、外交 +5；但民心 -2、军力 -2（永久）。',
    },
    summary: '十年羁旅之归人。信誉 +5、外交 +5；民心 -2、军力 -2。',
  },
  {
    id: 'elected_leader',
    name: '国人推举领袖',
    prologueTitle: '老者执酒，市人议事',
    prologue:
      '没有印玺，也没有仪仗车马。' +
      '旧国君没有子嗣就病死了，老贵族们关起祖庙的门，吵了半个月都定不下继承人。' +
      '七月十五市集那天，几位老者捧着酒立在石碑前，召集国人一起议事。' +
      '人群中你被推到了石碑下——你不是贵族出身，也不是太后娘家亲族，你只是这三年里一直帮乡里量田、写状子的那个人。' +
      '老者把酒杯递到你手里："今日所立的不是君，是国人共信的领头人。日后若失信，碑可以毁，人也可以换。" ',
    startingModifier: {
      id: 'mod_intro_elected_leader',
      name: '国人共信',
      category: 'culture',
      stackable: false,
      effects: [
        { target: 'country_morale', op: 'add', value: 8 },
        { target: 'country_renown', op: 'add', value: 8 },
        { target: 'country_military_power', op: 'add', value: -3 },
      ],
      visualBadge: null,
      remainingDays: -1,
      description: '民立非世，可立可废。',
      descPlain: '国人推举开局：民心 +8、信誉 +8；但军力 -3（无禁卫，永久）。',
    },
    summary: '市碑前共议而立之领袖。民心 +8、信誉 +8；军力 -3。',
  },
];

/** 标志位 — main.ts 启动种子资源时 IntroScene 写一份永久 modifier，避免 STATE_REPLACED 时再次注入 */
export const REGISTRY_KEYS = {
  COUNTRY_NAME: 'introCountryName',
  IDENTITY: 'introIdentity',
  INTRO_DONE: 'introDone',
} as const;

interface CandidateButton {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  nameText: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  name: string;
}

interface IdentityButton {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  nameText: Phaser.GameObjects.Text;
  summaryText: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  choice: IdentityChoice;
}

export class IntroScene extends Phaser.Scene {
  private bgGfx!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private bgStoryText!: Phaser.GameObjects.Text;

  private countrySectionLabel!: Phaser.GameObjects.Text;
  private countryHintText!: Phaser.GameObjects.Text;
  private countryInputDom!: Phaser.GameObjects.DOMElement;
  private currentCandidates: string[] = [];
  private candidateButtons: CandidateButton[] = [];

  private rerollBtnBg!: Phaser.GameObjects.Graphics;
  private rerollBtnLabel!: Phaser.GameObjects.Text;
  private rerollBtnZone!: Phaser.GameObjects.Zone;

  private identitySectionLabel!: Phaser.GameObjects.Text;
  private identityButtons: IdentityButton[] = [];
  private selectedIdentityId: IdentityChoice['id'] | null = null;

  private prologueTitleText!: Phaser.GameObjects.Text;
  private prologueBodyText!: Phaser.GameObjects.Text;

  private startBtnBg!: Phaser.GameObjects.Graphics;
  private startBtnLabel!: Phaser.GameObjects.Text;
  private startBtnZone!: Phaser.GameObjects.Zone;

  private inputListener: (() => void) | null = null;
  private layoutTimer: number | null = null;

  constructor() {
    super({ key: 'IntroScene' });
  }

  /** 防抖延后排版：避免在 resize 事件里同步调 layout→setStyle→Text.updateText 崩溃（见 ModeSelectScene 同注）。 */
  private scheduleLayout = (): void => {
    if (this.layoutTimer !== null) window.clearTimeout(this.layoutTimer);
    this.layoutTimer = window.setTimeout(() => { this.layoutTimer = null; this.layout(); }, 80);
  };

  create(): void {
    // 关键修复(2026-06-02)：Phaser 不自动调 scene.shutdown()，必须手动绑 SHUTDOWN 事件，
    // 否则切场景后 scale 'resize' 监听残留、对已销毁文字跑 layout 崩溃（resize 崩真因）。
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    // 背景
    this.bgGfx = this.add.graphics();
    this.bgGfx.fillStyle(COLORS.BG_INK, 1);
    this.bgGfx.fillRect(0, 0, this.scale.width, this.scale.height);

    this.titleText = this.add.text(0, 0, '邦国录', {
      ...FONTS.title,
      fontSize: '46px',
      color: COLORS_HEX.GOLD,
    } as Phaser.Types.GameObjects.Text.TextStyle);

    this.subtitleText = this.add.text(0, 0, '春秋小邦立国志 · v0.9', {
      ...FONTS.body,
      fontSize: '14px',
      color: COLORS_HEX.PAPER_DIM,
    } as Phaser.Types.GameObjects.Text.TextStyle);

    this.bgStoryText = this.add.text(0, 0, this.openingStoryText(), {
      ...FONTS.body,
      fontSize: '13px',
      color: COLORS_HEX.PAPER_DIM,
      wordWrap: { width: 760, useAdvancedWrap: true },
      lineSpacing: 4,
      align: 'center',
    } as Phaser.Types.GameObjects.Text.TextStyle);

    // 一、择 邦 名
    this.countrySectionLabel = this.add.text(0, 0, '一、择 邦 名', {
      ...FONTS.panelHeading,
      color: COLORS_HEX.GOLD,
    } as Phaser.Types.GameObjects.Text.TextStyle);

    this.countryHintText = this.add.text(0, 0, '点下列邦名以填入，亦可自取一字（最多三字汉字）', {
      ...FONTS.small,
      color: COLORS_HEX.PAPER_DIM,
    } as Phaser.Types.GameObjects.Text.TextStyle);

    // DOM 输入框
    const inputHTML =
      `<input type="text" maxlength="3" placeholder="自取邦名" ` +
      `style="width:316px;height:44px;font-size:24px;text-align:center;` +
      `background:${COLORS_HEX.BG_INK};color:${COLORS_HEX.PAPER};` +
      `border:2px solid ${COLORS_HEX.GOLD};outline:none;` +
      `font-family:'Noto Serif SC','Source Han Serif SC',serif;letter-spacing:6px;` +
      `caret-color:${COLORS_HEX.GOLD};box-sizing:border-box;padding:0;" />`;
    this.countryInputDom = this.add.dom(0, 0).createFromHTML(inputHTML);
    this.countryInputDom.setOrigin(0, 0);
    const inputEl = this.countryInputDom.node as HTMLInputElement;
    this.inputListener = () => {
      // 过滤非汉字字符（直接清掉）
      const cleaned = (inputEl.value || '').replace(/[^一-鿿]/g, '');
      if (cleaned !== inputEl.value) inputEl.value = cleaned;
      this.refreshAllVisuals();
    };
    inputEl.addEventListener('input', this.inputListener);

    // 6 候选按钮
    this.currentCandidates = this.sampleCandidates();
    for (let i = 0; i < CANDIDATE_COUNT; i++) {
      const container = this.add.container(0, 0);
      const bg = this.add.graphics();
      const nameText = this.add.text(0, 0, '', {
        ...FONTS.title,
        fontSize: '26px',
        color: COLORS_HEX.GOLD,
      } as Phaser.Types.GameObjects.Text.TextStyle);
      const zone = this.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      const btn: CandidateButton = { container, bg, nameText, zone, name: '' };
      zone.on('pointerdown', () => {
        if (btn.name) this.selectCandidate(btn.name);
      });
      container.add([bg, nameText, zone]);
      this.candidateButtons.push(btn);
    }
    this.applyCandidateLabels();

    // 换一批
    this.rerollBtnBg = this.add.graphics();
    this.rerollBtnLabel = this.add.text(0, 0, '换一批', {
      ...FONTS.body,
      fontSize: '14px',
      color: COLORS_HEX.PAPER,
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.rerollBtnZone = this.add.zone(0, 0, 96, 40).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.rerollBtnZone.on('pointerdown', () => this.rerollCandidates());

    // 二、择 身 份
    this.identitySectionLabel = this.add.text(0, 0, '二、择 身 份', {
      ...FONTS.panelHeading,
      color: COLORS_HEX.GOLD,
    } as Phaser.Types.GameObjects.Text.TextStyle);

    for (const id of IDENTITIES) {
      const container = this.add.container(0, 0);
      const bg = this.add.graphics();
      const nameText = this.add.text(0, 0, id.name, {
        ...FONTS.panelHeading,
        fontSize: '20px',
        color: COLORS_HEX.GOLD,
      } as Phaser.Types.GameObjects.Text.TextStyle);
      const summaryText = this.add.text(0, 0, id.summary, {
        ...FONTS.small,
        color: COLORS_HEX.PAPER_DIM,
        wordWrap: { width: 240, useAdvancedWrap: true },
        lineSpacing: 2,
      } as Phaser.Types.GameObjects.Text.TextStyle);
      const zone = this.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.selectIdentity(id.id));
      container.add([bg, nameText, summaryText, zone]);
      this.identityButtons.push({ container, bg, nameText, summaryText, zone, choice: id });
    }

    // 楔子（点了身份才显示文本，否则显示提示）
    this.prologueTitleText = this.add.text(0, 0, '——选 身 份 后 显 现 楔 子——', {
      ...FONTS.title,
      fontSize: '18px',
      color: COLORS_HEX.GOLD_DIM,
    } as unknown as Phaser.Types.GameObjects.Text.TextStyle);
    this.prologueBodyText = this.add.text(0, 0, '', {
      ...FONTS.body,
      fontSize: '14px',
      color: COLORS_HEX.PAPER,
      wordWrap: { width: 740, useAdvancedWrap: true },
      lineSpacing: 6,
      align: 'center',
    } as Phaser.Types.GameObjects.Text.TextStyle);

    // 立 邦
    this.startBtnBg = this.add.graphics();
    this.startBtnLabel = this.add.text(0, 0, '立 邦', {
      ...FONTS.title,
      fontSize: '22px',
      color: COLORS_HEX.PAPER,
    } as Phaser.Types.GameObjects.Text.TextStyle);
    this.startBtnZone = this.add.zone(0, 0, 200, 56).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.startBtnZone.on('pointerdown', () => this.tryStart());

    this.scale.on('resize', this.scheduleLayout);
    this.layout();
    this.refreshAllVisuals();
  }

  private openingStoryText(): string {
    return (
      '春秋时代，周天子势衰，诸侯分立。立国者数百，存者不过数十，强吞弱，弱求援。' +
      '\n你的小邦只有数千户人家，未上诸侯之名，民间有锄有犁却少祭祀礼器，邻邦有兵有甲而我连座烽火台都没有。' +
      '\n眼下先择邦名以告祖庙，再定身份以受其位——是要走"为君之道"以兵威立国，还是走"为民之道"以信誉立国，由你一念。'
    );
  }

  /** 从 24 池里不重复抽 6 个 */
  private sampleCandidates(): string[] {
    const pool = [...COUNTRY_POOL];
    const result: string[] = [];
    for (let i = 0; i < CANDIDATE_COUNT && pool.length > 0; i++) {
      const idx = Phaser.Math.Between(0, pool.length - 1);
      const picked = pool.splice(idx, 1)[0];
      if (picked !== undefined) result.push(picked);
    }
    return result;
  }

  private applyCandidateLabels(): void {
    for (let i = 0; i < this.candidateButtons.length; i++) {
      const b = this.candidateButtons[i];
      if (!b) continue;
      b.name = this.currentCandidates[i] ?? '';
      b.nameText.setText(b.name);
    }
  }

  private rerollCandidates(): void {
    this.currentCandidates = this.sampleCandidates();
    this.applyCandidateLabels();
    this.layout();
  }

  private selectCandidate(name: string): void {
    const inputEl = this.countryInputDom.node as HTMLInputElement;
    inputEl.value = name;
    this.refreshAllVisuals();
  }

  /** 读输入框，去前后空白 */
  private getCurrentCountryName(): string {
    const inputEl = this.countryInputDom.node as HTMLInputElement;
    return (inputEl.value || '').trim();
  }

  private isCountryNameValid(): boolean {
    const name = this.getCurrentCountryName();
    return name.length > 0 && VALID_NAME_RE.test(name);
  }

  private selectIdentity(id: IdentityChoice['id']): void {
    this.selectedIdentityId = id;
    const choice = IDENTITIES.find(i => i.id === id);
    if (choice) {
      this.prologueTitleText.setText(choice.prologueTitle);
      this.prologueTitleText.setColor(COLORS_HEX.GOLD);
      this.prologueBodyText.setText(choice.prologue);
    }
    this.layout();
  }

  private refreshAllVisuals(): void {
    const currentName = this.getCurrentCountryName();

    // 候选按钮：当前 input 值与按钮名相同则高亮
    for (const b of this.candidateButtons) {
      const selected = b.name.length > 0 && b.name === currentName;
      this.paintBtnBg(b.bg, 88, 88, selected);
      b.nameText.setColor(selected ? COLORS_HEX.PAPER : COLORS_HEX.GOLD);
      const nameX = Math.floor((88 - b.nameText.width) / 2);
      const nameY = Math.floor((88 - b.nameText.height) / 2);
      b.nameText.setPosition(nameX, nameY);
    }

    // 换一批按钮
    this.rerollBtnBg.clear();
    this.rerollBtnBg.fillStyle(COLORS.WOOD, 0.85);
    const rx = this.rerollBtnZone.x;
    const ry = this.rerollBtnZone.y;
    this.rerollBtnBg.fillRect(rx, ry, 96, 40);
    this.rerollBtnBg.lineStyle(1, COLORS.GOLD_DIM, 1);
    this.rerollBtnBg.strokeRect(rx, ry, 96, 40);

    // 身份按钮
    for (const b of this.identityButtons) {
      const selected = this.selectedIdentityId === b.choice.id;
      this.paintBtnBg(b.bg, 252, 88, selected);
      b.nameText.setColor(selected ? COLORS_HEX.PAPER : COLORS_HEX.GOLD);
    }

    // 立邦按钮
    const ready = this.isCountryNameValid() && this.selectedIdentityId !== null;
    this.startBtnBg.clear();
    this.startBtnBg.fillStyle(ready ? COLORS.GOLD : COLORS.WOOD, ready ? 0.95 : 0.55);
    const bx = this.startBtnZone.x;
    const by = this.startBtnZone.y;
    this.startBtnBg.fillRect(bx, by, 200, 56);
    this.startBtnBg.lineStyle(2, COLORS.GOLD_DIM, 1);
    this.startBtnBg.strokeRect(bx, by, 200, 56);
    this.startBtnLabel.setColor(ready ? COLORS_HEX.INK : COLORS_HEX.PAPER_DIM);
  }

  private paintBtnBg(bg: Phaser.GameObjects.Graphics, w: number, h: number, selected: boolean): void {
    bg.clear();
    bg.fillStyle(selected ? COLORS.GOLD : COLORS.WOOD, selected ? 0.95 : 0.7);
    bg.fillRect(0, 0, w, h);
    bg.lineStyle(2, selected ? COLORS.GOLD : COLORS.GOLD_DIM, 1);
    bg.strokeRect(0, 0, w, h);
  }

  private layout(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    this.bgGfx.clear();
    this.bgGfx.fillStyle(COLORS.BG_INK, 1);
    this.bgGfx.fillRect(0, 0, W, H);

    // 标题
    const titleX = Math.floor((W - this.titleText.width) / 2);
    this.titleText.setPosition(titleX, 24);
    const subX = Math.floor((W - this.subtitleText.width) / 2);
    this.subtitleText.setPosition(subX, 78);

    // 背景故事
    const storyW = Math.min(760, W - 64);
    this.bgStoryText.setStyle({ wordWrap: { width: storyW, useAdvancedWrap: true } });
    this.bgStoryText.setPosition(Math.floor((W - storyW) / 2), 108);

    let cursorY = 108 + this.bgStoryText.height + 18;

    // 国号 section 标题
    this.countrySectionLabel.setPosition(Math.floor((W - this.countrySectionLabel.width) / 2), cursorY);
    cursorY += this.countrySectionLabel.height + 6;

    // 提示行
    this.countryHintText.setPosition(Math.floor((W - this.countryHintText.width) / 2), cursorY);
    cursorY += this.countryHintText.height + 10;

    // input + reroll 同行
    const inputW = 320;
    const inputH = 48;
    const rerollW = 96;
    const rerollH = 40;
    const blockGap = 14;
    const blockW = inputW + blockGap + rerollW;
    const ix = Math.floor((W - blockW) / 2);
    this.countryInputDom.setPosition(ix, cursorY);
    this.rerollBtnZone.setPosition(ix + inputW + blockGap, cursorY + Math.floor((inputH - rerollH) / 2));
    this.rerollBtnLabel.setPosition(
      this.rerollBtnZone.x + Math.floor((rerollW - this.rerollBtnLabel.width) / 2),
      this.rerollBtnZone.y + Math.floor((rerollH - this.rerollBtnLabel.height) / 2),
    );
    cursorY += inputH + 14;

    // 6 候选按钮一行
    const cBtnW = 88;
    const cBtnH = 88;
    const cGap = 14;
    const cTotalW = cBtnW * CANDIDATE_COUNT + cGap * (CANDIDATE_COUNT - 1);
    let cx = Math.floor((W - cTotalW) / 2);
    for (const b of this.candidateButtons) {
      b.container.setPosition(cx, cursorY);
      b.zone.setSize(cBtnW, cBtnH).setPosition(0, 0);
      cx += cBtnW + cGap;
    }
    cursorY += cBtnH + 22;

    // 身份 section
    this.identitySectionLabel.setPosition(Math.floor((W - this.identitySectionLabel.width) / 2), cursorY);
    cursorY += this.identitySectionLabel.height + 8;

    const iBtnW = 252;
    const iBtnH = 88;
    const iGap = 16;
    const iTotalW = iBtnW * IDENTITIES.length + iGap * (IDENTITIES.length - 1);
    let ix2 = Math.floor((W - iTotalW) / 2);
    for (const b of this.identityButtons) {
      b.container.setPosition(ix2, cursorY);
      b.zone.setSize(iBtnW, iBtnH).setPosition(0, 0);
      b.nameText.setPosition(16, 10);
      b.summaryText.setStyle({ wordWrap: { width: iBtnW - 32, useAdvancedWrap: true } });
      b.summaryText.setPosition(16, 38);
      ix2 += iBtnW + iGap;
    }
    cursorY += iBtnH + 18;

    // 楔子
    const prologueW = Math.min(740, W - 64);
    this.prologueTitleText.setPosition(Math.floor((W - this.prologueTitleText.width) / 2), cursorY);
    cursorY += this.prologueTitleText.height + 6;
    this.prologueBodyText.setStyle({ wordWrap: { width: prologueW, useAdvancedWrap: true } });
    this.prologueBodyText.setPosition(Math.floor((W - prologueW) / 2), cursorY);
    cursorY += Math.max(72, this.prologueBodyText.height) + 14;

    // 立邦
    const btnX = Math.floor((W - 200) / 2);
    const btnY = Math.min(cursorY, H - 76);
    this.startBtnZone.setPosition(btnX, btnY);
    this.startBtnLabel.setPosition(
      btnX + Math.floor((200 - this.startBtnLabel.width) / 2),
      btnY + Math.floor((56 - this.startBtnLabel.height) / 2),
    );

    this.refreshAllVisuals();
  }

  private tryStart(): void {
    if (!this.isCountryNameValid()) return;
    if (this.selectedIdentityId === null) return;
    const identity = IDENTITIES.find(i => i.id === this.selectedIdentityId);
    if (!identity) return;
    const countryName = this.getCurrentCountryName();

    this.registry.set(REGISTRY_KEYS.COUNTRY_NAME, countryName);
    this.registry.set(REGISTRY_KEYS.IDENTITY, identity.id);

    const store = this.registry.get('store') as GameStore | undefined;
    if (store) {
      store.addModifier(structuredClone(identity.startingModifier));
      // Phase1/2：按 ModeSelectScene 选定的模式落进 state
      const mode = this.registry.get('gameMode');
      if (mode === 'story') {
        store.startStoryMode(); // 设 mode='story' + 初始化 storyFlags（序章态）
      } else {
        store.setMode('sandbox');
      }
      // Phase1：每局随机刷 NPC 阵容（池中选 4，含 ≥1 蛮夷）——不同局不同邻邦
      store.startNewGameNpcs(Math.floor(Math.random() * 0x7fffffff));
    }

    this.registry.set(REGISTRY_KEYS.INTRO_DONE, true);
    this.scene.start('GameScene');
  }

  shutdown(): void {
    this.scale.off('resize', this.scheduleLayout);
    if (this.layoutTimer !== null) { window.clearTimeout(this.layoutTimer); this.layoutTimer = null; }
    if (this.inputListener && this.countryInputDom?.node) {
      (this.countryInputDom.node as HTMLInputElement).removeEventListener('input', this.inputListener);
      this.inputListener = null;
    }
  }
}
