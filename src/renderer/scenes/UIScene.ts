import Phaser from 'phaser';
import type { GameStore } from '../state/gameStore';
import type { BuildMode } from '../state/buildMode';
import { HUD } from '../ui/HUD';
import { BuildPanel } from '../ui/BuildPanel';
import { Toast } from '../ui/Toast';
import { PolicyTreePanel } from '../ui/PolicyTreePanel';
import { MegaProjectPanel } from '../ui/MegaProjectPanel';
import { MilitaryPanel } from '../ui/MilitaryPanel';
import { CodexPanel } from '../ui/CodexPanel';
import { DiplomacyPanel } from '../ui/DiplomacyPanel';
import { PopulationPanel } from '../ui/PopulationPanel';
import { EventModal } from '../ui/EventModal';
import { FactionDemandModal } from '../ui/FactionDemandModal';
import { CrisisModal } from '../ui/CrisisModal';
import { TutorialModal } from '../ui/TutorialModal';
import { STATE_EVENTS } from '../state/gameStore';
import { Legend } from '../ui/Legend';
import { ZoomControl } from '../ui/ZoomControl';
import { StoryBar } from '../ui/StoryBar';
import { AudioManager } from '../ui/AudioManager';
import { JitHintManager } from '../ui/JitHintManager';
import { SettingsPanel } from '../ui/SettingsPanel';
import { SaveLoadPanel } from '../ui/SaveLoadPanel';
import type { MapRenderer } from '../render/MapRenderer';

/**
 * UIScene：HUD 顶栏 + 左侧建造面板 + 右侧朝堂面板 + Toast + EventModal + TutorialModal。
 *
 * Slice E 实装 HUD/BuildPanel/Toast；Slice G 加 CourtPanel + EventModal + TutorialModal。
 *   - 从 game.registry 取 GameStore + BuildMode
 *   - 监听 scale.on('resize') 做 debounce 重排（含模态居中）
 *   - shutdown 时拆解所有监听器（避免 hot reload 留下幽灵 listener）
 *
 * Toast 暴露在 game.registry['toast']，CourtPanel/GameScene 用它反馈失败。
 */
export class UIScene extends Phaser.Scene {
  private resizeTimer: number | null = null;
  /** v0.9 hotfix#4：maximize 动画结束后 250ms 安全网；Windows 给最终尺寸时再 layout 一次 */
  private safetyNetTimer: number | null = null;
  private hud: HUD | null = null;
  private buildPanel: BuildPanel | null = null;
  private policyTreePanel: PolicyTreePanel | null = null;
  private megaProjectPanel: MegaProjectPanel | null = null;
  private militaryPanel: MilitaryPanel | null = null;
  private codexPanel: CodexPanel | null = null;
  private diplomacyPanel: DiplomacyPanel | null = null;
  private populationPanel: PopulationPanel | null = null;
  private eventModal: EventModal | null = null;
  private factionDemandModal: FactionDemandModal | null = null;
  private crisisModal: CrisisModal | null = null;
  private tutorialModal: TutorialModal | null = null;
  private toast: Toast | null = null;
  private legend: Legend | null = null;
  private zoomControl: ZoomControl | null = null;
  private storyBar: StoryBar | null = null;
  private audioManager: AudioManager | null = null;
  private jitHintManager: JitHintManager | null = null;
  private settingsPanel: SettingsPanel | null = null;
  private saveLoadPanel: SaveLoadPanel | null = null;
  private store: GameStore | null = null;
  // A-9：暂停遮罩
  private pauseOverlay: Phaser.GameObjects.Graphics | null = null;
  private pauseText: Phaser.GameObjects.Text | null = null;

  // Phase1：国格软认可 / 登顶祝贺（晋阶走 Toast；降格由 CrisisModal 通告，不重复 Toast）
  private onGradeChanged = (payload: unknown): void => {
    const p = (payload && typeof payload === 'object') ? payload as { to?: number; def?: { ascendBlurb?: string }; reason?: string } : {};
    if (p.reason !== 'ascend') return; // 仅晋阶祝贺；crisis 降格交给 CrisisModal
    const blurb = p.def?.ascendBlurb ?? '国格晋阶。';
    this.toast?.show(`国格晋阶 · ${blurb}`, 'info', 3200);
  };
  private onTianxia = (): void => {
    this.toast?.show('天下共主 · 圆满。山河任君纵横，亦可继续经营，无有尽头。', 'info', 5000);
  };
  // Phase1：NPC 动态行动 → Toast。骚扰/围攻用 error 色（红），内斗用 info（棕）。
  private onNpcAction = (payload: unknown): void => {
    const p = (payload && typeof payload === 'object') ? payload as { kind?: string; text?: string } : {};
    if (!p.text) return;
    const hostile = p.kind === 'harass_player' || p.kind === 'assault_player';
    this.toast?.show(p.text, hostile ? 'error' : 'info', hostile ? 3600 : 2600);
  };
  // A1：怨愤临界警示 → 长 Toast（error 色）
  private onWrathAlert = (payload: unknown): void => {
    const p = (payload && typeof payload === 'object') ? payload as { text?: string } : {};
    if (p.text) this.toast?.show(p.text, 'error', 5000);
  };
  // Phase2：史官氛围评语（双轴跨档）→ 轻 Toast
  private onStoryNarration = (payload: unknown): void => {
    const p = (payload && typeof payload === 'object') ? payload as { text?: string } : {};
    if (p.text) this.toast?.show(p.text, 'info', 3200);
  };
  // A-5：世界呼吸 toast
  private onBreathingToast = (payload: unknown): void => {
    const p = (payload && typeof payload === 'object') ? payload as { entry?: { text?: string } } : {};
    if (p.entry?.text) this.toast?.show(p.entry.text, 'info', 5000);
  };
  // A-5：世界呼吸 bulletin（用长 Toast 代替独立面板）
  private onBreathingBulletin = (payload: unknown): void => {
    const p = (payload && typeof payload === 'object') ? payload as { entry?: { text?: string } } : {};
    if (p.entry?.text) this.toast?.show(p.entry.text, 'info', 8000);
  };
  // A-6：史官谏言（长 Toast + 特殊前缀标识为史官）
  private onHistorianAdvice = (payload: unknown): void => {
    const p = (payload && typeof payload === 'object') ? payload as { advice?: { text?: string } } : {};
    if (p.advice?.text) this.toast?.show(`[史官] ${p.advice.text}`, 'info', 6000);
  };
  // P4：来犯预警 / 出征结算 → toast 提醒（军务面板看详情）
  private onDefenseAlert = (payload: unknown): void => {
    const p = (payload && typeof payload === 'object') ? payload as { alert?: { daysUntilAttack?: number } } : {};
    const days = p.alert?.daysUntilAttack ?? 3;
    this.toast?.show(`⚠ 邻邦来犯，约 ${days} 日后兵临！速整军备战（军务）`, 'error', 6000);
  };
  private onExpeditionResolved = (payload: unknown): void => {
    const p = (payload && typeof payload === 'object') ? payload as { defense?: boolean; intercepted?: boolean; result?: { outcome?: string } } : {};
    if (p.defense) {
      this.toast?.show(p.intercepted ? '守土之战已结，详见军务' : '未及拦截，邦境遭劫掠！', p.intercepted ? 'info' : 'error', 5000);
    } else {
      const o = p.result?.outcome;
      const txt = o === 'victory' ? '出征大捷，载誉而归！' : o === 'pyrrhic' ? '惨胜而归，伤亡不小' : '出征失利，折戟而返';
      this.toast?.show(txt, o === 'defeat' ? 'error' : 'info', 5000);
    }
  };
  // A-9：暂停/恢复遮罩
  private onPausedChanged = (): void => {
    if (!this.store || !this.pauseOverlay || !this.pauseText) return;
    const paused = this.store.isPaused();
    if (paused) {
      const w = this.scale.width;
      const h = this.scale.height;
      this.pauseOverlay.clear();
      this.pauseOverlay.fillStyle(0x000000, 0.35);
      this.pauseOverlay.fillRect(0, 0, w, h);
      this.pauseOverlay.setVisible(true);
      this.pauseText.setPosition(w / 2, h / 2).setVisible(true);
    } else {
      this.pauseOverlay.setVisible(false);
      this.pauseText.setVisible(false);
    }
  };
  // Phase2：章节切换 → 长 Toast 当章节引子 banner
  private onStoryChapter = (payload: unknown): void => {
    const p = (payload && typeof payload === 'object') ? payload as { def?: { title?: string; subtitle?: string; intro?: string } } : {};
    const def = p.def;
    if (!def) return;
    const head = def.subtitle ? `${def.title}　${def.subtitle}` : (def.title ?? '');
    this.toast?.show(`${head}\n${def.intro ?? ''}`, 'info', 6000);
  };

  constructor() {
    super({ key: 'UIScene', active: false });
  }

  create(): void {
    // 关键修复(2026-06-02)：Phaser 不自动调 scene.shutdown()，手动绑 SHUTDOWN 事件清理监听/计时器。
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    const store = this.registry.get('store') as GameStore | undefined;
    const buildMode = this.registry.get('buildMode') as BuildMode | undefined;
    if (!store || !buildMode) {
      console.error('[UIScene] missing store or buildMode in registry');
      return;
    }

    this.hud = new HUD(this, store);
    this.buildPanel = new BuildPanel(this, store, buildMode);
    // 2026-06-19：全屏国策树（HUD「朝堂」按钮打开，时停）取代了原右侧折叠 CourtPanel。
    this.policyTreePanel = new PolicyTreePanel(this, store);
    this.registry.set('policyTreePanel', this.policyTreePanel);
    this.megaProjectPanel = new MegaProjectPanel(this, store);
    this.registry.set('megaProjectPanel', this.megaProjectPanel);
    this.militaryPanel = new MilitaryPanel(this, store);
    this.registry.set('militaryPanel', this.militaryPanel);
    // 2026-06-19：典册（新手引导/百科），顶栏「?」按钮打开，时停
    this.codexPanel = new CodexPanel(this, store);
    this.registry.set('codexPanel', this.codexPanel);
    this.legend = new Legend(this, store);
    this.toast = new Toast(this);
    // Slice G：toast 必须先注册才能让 EventModal/CourtPanel 失败时回报
    this.registry.set('toast', this.toast);
    // v1.0 #6：邦交面板（中央模态，HUD 按钮触发开关）
    this.diplomacyPanel = new DiplomacyPanel(this, store);
    this.registry.set('diplomacyPanel', this.diplomacyPanel);
    // 2026-06-17：人口详情面板（点 HUD「民」token 打开）
    this.populationPanel = new PopulationPanel(this, store);
    this.registry.set('populationPanel', this.populationPanel);
    this.eventModal = new EventModal(this, store);
    this.factionDemandModal = new FactionDemandModal(this, store);
    // Phase1：低谷危机通告模态
    this.crisisModal = new CrisisModal(this, store);
    // 教程模态最后构造：它在欢迎步骤会立即 setPaused(true)，HUD 的 speed 显示需要先就绪
    this.tutorialModal = new TutorialModal(this, store);

    // Phase2：故事顶栏（章节 + 双轴半可视 + 距下章）；沙盒模式自隐藏
    this.storyBar = new StoryBar(this, store);
    // Phase4：音频引擎（动态 BGM + 音效；音频资产未就位时静音降级）
    this.audioManager = new AudioManager(this, store);
    this.registry.set('audioManager', this.audioManager);
    // Phase4：JIT 即时提示（首次遇到情境弹一句教学；toast 已在上方注册）
    this.jitHintManager = new JitHintManager(this, store);
    // Phase A-1：音量设置面板（HUD 设置按钮触发）
    this.settingsPanel = new SettingsPanel(this);
    this.registry.set('settingsPanel', this.settingsPanel);
    // 存档/读档面板（引擎已有 IPC + saveLoad.ts，这里补玩家可见入口）
    this.saveLoadPanel = new SaveLoadPanel(this, store);
    this.registry.set('saveLoadPanel', this.saveLoadPanel);

    // Phase1：国格晋阶 / 登顶 → Toast 软认可
    this.store = store;
    store.on(STATE_EVENTS.GRADE_CHANGED, this.onGradeChanged);
    store.on(STATE_EVENTS.TIANXIA_ACKNOWLEDGED, this.onTianxia);
    store.on(STATE_EVENTS.NPC_ACTION, this.onNpcAction);
    store.on(STATE_EVENTS.STORY_NARRATION, this.onStoryNarration);
    store.on(STATE_EVENTS.STORY_CHAPTER_CHANGED, this.onStoryChapter);
    store.on(STATE_EVENTS.BREATHING_TOAST, this.onBreathingToast);
    store.on(STATE_EVENTS.BREATHING_BULLETIN, this.onBreathingBulletin);
    store.on(STATE_EVENTS.HISTORIAN_ADVICE, this.onHistorianAdvice);
    store.on(STATE_EVENTS.WRATH_ALERT, this.onWrathAlert);
    store.on(STATE_EVENTS.DEFENSE_ALERT, this.onDefenseAlert);
    store.on(STATE_EVENTS.EXPEDITION_RESOLVED, this.onExpeditionResolved);
    // v1.0 #5：缩放工具条。MapRenderer 由 GameScene 在 create 时注册到 registry，
    // ZoomControl 通过 lazy getter 拿引用——避免 UIScene 比 GameScene 先 create 时拿到 null。
    this.zoomControl = new ZoomControl(this, store, () => {
      return (this.registry.get('mapRenderer') as MapRenderer | null) ?? null;
    });

    // A-9：暂停遮罩（灰色半透明 + "已暂停" 文字，depth 在 toast 之下、面板之上）
    this.pauseOverlay = this.add.graphics().setDepth(900).setVisible(false);
    this.pauseText = this.add.text(0, 0, '已暂停', {
      fontFamily: '"Noto Serif SC", "Source Han Serif SC", serif',
      fontSize: '36px', fontStyle: 'bold', color: '#F5ECD7',
    }).setOrigin(0.5, 0.5).setDepth(901).setVisible(false).setAlpha(0.85);
    store.on(STATE_EVENTS.PAUSED_CHANGED, this.onPausedChanged);
    this.onPausedChanged();

    this.scale.on('resize', this.scheduleResize, this);
  }

  private scheduleResize(): void {
    if (this.resizeTimer !== null) {
      window.clearTimeout(this.resizeTimer);
    }
    this.resizeTimer = window.setTimeout(() => {
      this.applyResize();
      this.resizeTimer = null;
    }, 80);
    // v0.9 hotfix#4：maximize 安全网。Windows maximize 动画 ~200ms，结束后再 layout 一次，
    // 捕捉动画期间 RESIZE 中间帧之后的最终尺寸。每次 resize 都重置这个 timer。
    if (this.safetyNetTimer !== null) {
      window.clearTimeout(this.safetyNetTimer);
    }
    this.safetyNetTimer = window.setTimeout(() => {
      this.applyResize();
      this.safetyNetTimer = null;
    }, 280);
  }

  private applyResize(): void {
    const rawW = this.scale.width;
    const rawH = this.scale.height;
    // v0.9 hotfix#4：软化 guard。早期硬 return 让 maximize 中间帧后再没有 layout 触发的话
    // 就一直停在错位。改成 clamp 到 min size——保证 layout 总能跑一次合理布局。
    // 安全网 timer 会在 280ms 后再 fire 一次，那时 Windows 已经给到最终尺寸。
    if (!Number.isFinite(rawW) || !Number.isFinite(rawH)) return;
    const width = Math.max(rawW, 320);
    const height = Math.max(rawH, 240);
    this.cameras.resize(width, height);
    this.hud?.layout();
    this.buildPanel?.layout();
    this.policyTreePanel?.layout();
    this.megaProjectPanel?.layout();
    this.militaryPanel?.layout();
    this.codexPanel?.layout();
    this.legend?.layout();
    this.zoomControl?.layout();
    this.eventModal?.layout();
    this.factionDemandModal?.layout();
    this.crisisModal?.layout();
    this.tutorialModal?.layout();
    this.diplomacyPanel?.layout();
    this.populationPanel?.layout();
    this.saveLoadPanel?.layout();
    this.storyBar?.layout();
  }

  shutdown(): void {
    this.scale.off('resize', this.scheduleResize, this);
    if (this.resizeTimer !== null) {
      window.clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }
    if (this.safetyNetTimer !== null) {
      window.clearTimeout(this.safetyNetTimer);
      this.safetyNetTimer = null;
    }
    if (this.store) {
      this.store.off(STATE_EVENTS.GRADE_CHANGED, this.onGradeChanged);
      this.store.off(STATE_EVENTS.TIANXIA_ACKNOWLEDGED, this.onTianxia);
      this.store.off(STATE_EVENTS.NPC_ACTION, this.onNpcAction);
      this.store.off(STATE_EVENTS.STORY_NARRATION, this.onStoryNarration);
      this.store.off(STATE_EVENTS.STORY_CHAPTER_CHANGED, this.onStoryChapter);
      this.store.off(STATE_EVENTS.BREATHING_TOAST, this.onBreathingToast);
      this.store.off(STATE_EVENTS.BREATHING_BULLETIN, this.onBreathingBulletin);
      this.store.off(STATE_EVENTS.HISTORIAN_ADVICE, this.onHistorianAdvice);
      this.store.off(STATE_EVENTS.WRATH_ALERT, this.onWrathAlert);
      this.store.off(STATE_EVENTS.DEFENSE_ALERT, this.onDefenseAlert);
      this.store.off(STATE_EVENTS.EXPEDITION_RESOLVED, this.onExpeditionResolved);
      this.store.off(STATE_EVENTS.PAUSED_CHANGED, this.onPausedChanged);
      this.store = null;
    }
    this.hud?.destroy();
    this.buildPanel?.destroy();
    this.policyTreePanel?.destroy();
    this.megaProjectPanel?.destroy();
    this.militaryPanel?.destroy();
    this.codexPanel?.destroy();
    this.diplomacyPanel?.destroy();
    this.populationPanel?.destroy();
    this.legend?.destroy();
    this.zoomControl?.destroy();
    this.eventModal?.destroy();
    this.factionDemandModal?.destroy();
    this.crisisModal?.destroy();
    this.tutorialModal?.destroy();
    this.storyBar?.destroy();
    this.audioManager?.destroy();
    this.jitHintManager?.destroy();
    this.settingsPanel?.destroy();
    this.saveLoadPanel?.destroy();
    this.toast?.destroy();
    this.pauseOverlay?.destroy();
    this.pauseText?.destroy();
    this.registry.set('toast', undefined);
    this.registry.set('policyTreePanel', undefined);
    this.registry.set('megaProjectPanel', undefined);
    this.registry.set('militaryPanel', undefined);
    this.registry.set('codexPanel', undefined);
    this.registry.set('treePanelOpen', false);
    this.registry.set('diplomacyPanel', undefined);
    this.registry.set('populationPanel', undefined);
    this.registry.set('settingsPanel', undefined);
    this.registry.set('saveLoadPanel', undefined);
    this.registry.set('audioManager', undefined);
    this.hud = null;
    this.buildPanel = null;
    this.policyTreePanel = null;
    this.megaProjectPanel = null;
    this.militaryPanel = null;
    this.codexPanel = null;
    this.diplomacyPanel = null;
    this.populationPanel = null;
    this.legend = null;
    this.zoomControl = null;
    this.eventModal = null;
    this.factionDemandModal = null;
    this.crisisModal = null;
    this.tutorialModal = null;
    this.storyBar = null;
    this.audioManager = null;
    this.jitHintManager = null;
    this.toast = null;
  }
}
