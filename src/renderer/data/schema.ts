/**
 * v0.7 完整数据形状（TypeScript 接口）。
 *
 * 来源：
 *   - DeepSeek 蓝图（building/policy/event/decree/save 五大主接口）
 *   - Kimi 反审追加：tutorial / particle / floatingText / shake / defeat / offline / audio
 *   - Opus 仲裁：把 ResourceCost 改造为 Partial<Record<ResourceId, number>>，
 *     把 ModifierEffect.target 改造为联合字面量类型。
 *
 * 这个文件是"v0.7 数据契约"。改动这里影响整个项目的扩展成本，
 * 任何新增字段都要先评审能否兼容存档（SaveData 版本号同步升）。
 */

import type {
  ResourceCost,
  ResourceId,
  ModifierTargetKey,
} from './resourceRegistry';

// ============== Modifier ================================================

export type ModifierOp = 'add' | 'mul';

export interface ModifierEffect {
  target: ModifierTargetKey;
  op: ModifierOp;
  value: number;
}

export type ModifierCategory =
  | 'economy'
  | 'military'
  | 'culture'
  | 'tech'
  | 'population'
  | 'diplomacy'
  | 'disaster';

export interface ModifierInstance {
  id: string;
  name: string;
  category: ModifierCategory;
  stackable: boolean;
  effects: ModifierEffect[];
  /** 对应徽章纹理 key（见 BadgeId）；null 表示不显示徽章 */
  visualBadge: BadgeId | null;
  /** -1 = 永久 */
  remainingDays: number;
  /** 古风描述 */
  description: string;
  /** 白话翻译（Kimi 反审：必须给非古文母语玩家路径） */
  descPlain: string;
}

// ============== Building ================================================

export type BuildingCategory = '民生' | '工坊' | '礼制' | '军事' | '科技';

/** Tier 1 = 茅屋, Tier 2 = 瓦房, Tier 3 = 殿宇 */
export type BuildingTier = 1 | 2 | 3;

export type BuildingStatus =
  | 'idle'
  | 'constructing'
  | 'working'
  | 'paused'
  | 'derelict';

export interface BuildingDef {
  id: string;
  name: string;
  category: BuildingCategory;
  tier: BuildingTier;
  /** v1.0 #4：阶段名（如「草庐」「列肆」「百炼」），替代笼统的 T1/T2/T3 标签 */
  tierName?: string;
  cost: ResourceCost;
  /** 游戏内天数 */
  constructionTime: number;
  output: { resource: ResourceId; perDay: number }[];
  upkeep: ResourceCost;
  size: { width: number; height: number };
  /** spritesheet key in BootScene */
  assetKey: string;
  /** 升级到本 tier 需要的前置（建筑 id 或国策 id） */
  upgradeRequires: string[];
  badgeRules: BadgeRule[];
  description: string;
  descPlain: string;
  // v0.9 升级链
  /** 同链路低一级建筑 id（T2 指 T1）；空表示本身就是起点 */
  upgradesFrom?: string;
  /** 同链路高一级建筑 id（T1 指 T2）；空表示无更高阶 */
  upgradesTo?: string;
  /** 升级（不是新建）的成本，通常比新建便宜 */
  upgradeCost?: ResourceCost;
  /** 升级耗时（天） */
  upgradeTime?: number;
  /** v1.0 #3：相邻加成（参纪元 1800）。多条命中取 mul 最大那条，不叠乘。 */
  adjacencyBonus?: AdjacencyBonus[];
  /** Phase1：提供的住房容量（人口增长上限）。仅居住类建筑（民居/王宫等）设置。 */
  housingCapacity?: number;
}

/** v1.0 #3：相邻加成规则 —— 受益方为本 def，命中范围内有 partnerDefId 时启用。 */
export interface AdjacencyBonus {
  /** 相邻方 building id（必须 working） */
  partnerDefId: string;
  /** Manhattan 距离上限（建筑包围盒最近格的距离），默认 3 */
  range: number;
  /** 影响哪个资源的产出（必须是本 def.output 列表中已有项） */
  resource: ResourceId;
  /** 乘数（如 1.30 = +30%）；不写则 1 */
  outputMul?: number;
  /** 古风一句话理由（在 popover/tooltip 解释为何加成） */
  description: string;
}

export interface BuildingInstance {
  /** Reference to BuildingDef.id */
  defId: string;
  /** Tile-coord */
  position: { x: number; y: number };
  status: BuildingStatus;
  tier: BuildingTier;
  /** 0..100 */
  constructionProgress: number;
  /** Per-instance modifiers (from local events / decrees) */
  modifiers: string[];
  /** v0.9：升级进行中时填入目标 defId；与 status='constructing' 共同标记升级态 */
  upgradingTo?: string;
}

// ============== Badge (Status Indicator) ================================

export type BadgeId =
  | 'badge_grain_low'
  | 'badge_people_low'
  | 'badge_idle'
  | 'badge_grain_up'
  | 'badge_disease'
  | 'badge_riot';

export interface BadgeRule {
  /**
   * 触发条件（DSL 风格 string，由系统层解析）。
   * 例：'self.output.grain == 0'、'country_grain < 50'。
   */
  condition: string;
  badge: BadgeId;
  /** 可选优先级，多个 rule 命中时取最高 */
  priority?: number;
}

// ============== Policy Tree =============================================

export type PolicyBranch = '农桑' | '工坊' | '礼制' | '保甲' | '外交' | '学问';

export interface PolicyNode {
  id: string;
  name: string;
  branch: PolicyBranch;
  /** 树画布坐标 */
  x: number;
  y: number;
  cost: ResourceCost;
  effects: ModifierEffect[];
  prerequisites: string[];
  /** 解锁阶层 1..8（同时也是树深度：1=入门，4=终极） */
  tier: number;
  description: string;
  descPlain: string;
  /**
   * v1.0 #1（HOI4 树状递进）：互斥兄弟节点 id 列表。
   * 任一已采纳就锁死本条；走"重粮 / 重桑"二选一这种路径分歧。
   */
  mutuallyExclusive?: string[];
  /**
   * v1.0 #1：分支内的"亚路径"标签（如 农桑→重粮 / 重桑），用于 UI 视觉分组。
   * 缺省 = 直接从 branch 起步、无亚路径。
   */
  focus?: string;
}

// ============== Court Event (朝议事件) ==================================

export type CourtEventTag = '正' | '负' | '中' | '抉择';

export interface CourtEventTrigger {
  /** DSL string；'random' + value=概率 / 'season == summer' / 'country_grain < 50' 等 */
  condition: string;
  value?: number;
}

export interface CourtEventChoice {
  text: string;
  textPlain: string;
  effects: ModifierEffect[];
  /** 移除已激活的某些 modifier id */
  removeEffects: string[];
}

export interface CourtEventContext {
  condition: string; // 'default' or specific
  title: string;
  desc: string; // 古文
  descPlain: string; // 白话
}

export interface CourtEvent {
  id: string;
  tags: CourtEventTag[];
  triggers: CourtEventTrigger[];
  contexts: CourtEventContext[];
  /** 仅"抉择"事件提供 */
  choices?: CourtEventChoice[];
  /** 多少游戏内秒/天后未处理则按 choices[0] 默认（保守选项） */
  defaultTimeoutDays?: number;
}

// ============== Royal Decree (朝令) =====================================

export interface DecreeStage {
  order: number;
  cost: ResourceCost;
  days: number;
  effects: ModifierEffect[];
  /** Modifier id 列表；激活 stage 时移除这些 */
  removeEffects: string[];
}

/** v1.0 #2：朝令分类（用于 CourtPanel 分组 + 玩家辨识 paradox 风格五大族） */
export type DecreeCategory = '内政' | '军事' | '外交' | '礼制' | '工坊';

export interface RoyalDecree {
  id: string;
  name: string;
  /** v1.0 #2：分门别类，CourtPanel 按此聚合分组 */
  category: DecreeCategory;
  description: string;
  descPlain: string;
  /** 解锁条件（DSL） */
  unlockCondition: { type: string; value: number }[];
  /** v1.0 #2：链路前置——必须先完成此 decree id 才能采纳本条（HOI4-style 国策树灵感的轻量版） */
  chainPrev?: string;
  stages: DecreeStage[];
}

// ============== NPC Country / Diplomacy (v1.0 #6) =======================

/**
 * v1.0 #6：NPC 邦国设计 —— 解决"只有一个国家太单调"。
 *
 * 三类原型决定起步偏向（不是种族属性，是文化倾向）：
 *   - commercial（商）：齐风，钱产出富，通商收益最高
 *   - martial（武）：晋风，军力强，开战胜率最高
 *   - cultural（礼）：鲁风，礼制深，外交事件更易发生
 *
 * 动态字段（保存到存档）：stance / militaryPower / renown / tradeRoute / tradeCooldown / warStatus / lastEnvoyDay / lastWarDay
 * 静态字段（来自 NPC_COUNTRIES 定义）：id / name / archetype / homeColor / description
 */
// Phase1：'tribal' = 蛮夷/戎狄——不结盟、不走友好通商出使、任何阶段都可能骚扰（走 archetype 默认分支）。
export type NpcArchetype = 'commercial' | 'martial' | 'cultural' | 'tribal';

export type WarStatus = 'peace' | 'tension' | 'war';

export interface NpcCountryDef {
  id: string;
  name: string;
  archetype: NpcArchetype;
  /** 16-bit hex color for UI swatch（如 0xCAB47C） */
  homeColor: number;
  description: string;
  descPlain: string;
  /** 起始 stance（-100 敌对 .. 100 盟友），以及起始军力 / 信誉 */
  initialStance: number;
  initialMilitaryPower: number;
  initialRenown: number;
}

export interface NpcCountryState {
  id: string;
  /** -100..100，每日漂移按 player renown / NPC archetype 走 */
  stance: number;
  militaryPower: number;
  renown: number;
  /** 通商已开启 */
  tradeRoute: boolean;
  /** 距下一次通商收入还有多少天（30 日一轮） */
  tradeCooldown: number;
  warStatus: WarStatus;
  /** 最近一次「出使」那一日的 currentDay 值（防 spam，14 日冷却） */
  lastEnvoyDay: number;
  /** 最近一次「兴师」那一日的 currentDay 值（防 spam，30 日冷却）。
   *  与出使分开计时——否则出使后会误锁宣战、反之亦然。 */
  lastWarDay: number;
  /** Phase1 动态成长：当前盟友 NPC id（玩家强时合纵围攻；tribal 恒空） */
  allyIds: string[];
  /** Phase1：攻击/骚扰倾向 0..100（archetype 初值 + 动态漂移） */
  aggression: number;
  /** Phase1：NPC 上次主动行动（成长/骚扰/结盟）那一日，节流用（独立于 lastEnvoy/lastWarDay） */
  lastActionDay: number;
}

export interface DiplomacyAction {
  /** 'trade' | 'envoy' | 'war' */
  kind: 'trade' | 'envoy' | 'war';
  npcId: string;
}

// ============== Tutorial (Kimi 反审 #8 接入点) ==========================

export type TutorialTrigger =
  | 'first_login'
  | 'first_building_placed'
  | 'first_grain_harvest'
  | 'first_event'
  | 'population_threshold_5'
  | 'population_threshold_20';

export interface TutorialStep {
  id: string;
  trigger: TutorialTrigger;
  /** CSS / Phaser GameObject name 选择器 */
  uiTarget: string;
  /** 高亮矩形（屏幕坐标）；缺省=由系统从 uiTarget bounds 推算 */
  highlightRect?: { x: number; y: number; w: number; h: number };
  /** ≤15 字（Kimi 调研约束） */
  text: string;
  textPlain: string;
  /** 下一步触发的玩家动作；nextStepId 接续 */
  requiredAction: string;
  nextStepId?: string;
  /** 时间流速；默认 1 */
  timeScale?: number;
}

// ============== Floating Text ===========================================

export interface FloatingTextConfig {
  id: string;
  /** 引用 palette.FONTS 中的 key */
  fontStyle: 'title' | 'body' | 'number' | 'small';
  color: string;
  velocityY: number;
  duration: number;
  /** Phaser ease 名 */
  ease: string;
}

// ============== Particle Effect =========================================

export interface ParticleEffectDef {
  id: string;
  textureKey: string;
  lifespan: number;
  gravityY: number;
  scale: { start: number; end: number };
  /** 一次发射粒子数 */
  quantity: number;
  /** 方向锥角度（度数） */
  angleSpread?: number;
}

// ============== Screen Shake ============================================

export interface ScreenShakeConfig {
  id: string;
  duration: number;
  /** 0..1，对应 cameras.main.shake 的 intensity */
  intensity: number;
  direction: 'horizontal' | 'vertical' | 'both';
}

// ============== Offline Reward ==========================================

export interface OfflineReward {
  /** 上限（小时） */
  maxOfflineHours: number;
  /** 离线产出按 decay 比例发放（0.5 = 50%） */
  decayFactor: number;
  /** 哪些 modifier 类别仍生效（'economy' 'population' 等） */
  applicableModifiers: ModifierCategory[];
  /** 哪些资源补给 */
  snapshotResources: ResourceId[];
}

// ============== Audio Cue ===============================================

export interface AudioCue {
  /** 触发器（事件名称） */
  eventTrigger: string;
  /** Phaser audio key */
  assetKey: string;
  volume: number;
  loop: boolean;
}

// ============== Save Data ===============================================

export interface SaveData {
  version: string; // '0.7.0'
  timestamp: number;
  world: {
    /** 资源使用 ResourceBag（typed） */
    resources: Partial<Record<ResourceId, number>>;
    buildings: BuildingInstance[];
    /** 已采纳 / 未采纳的国策（按 id） */
    policies: { id: string; adopted: boolean }[];
    activeModifiers: ModifierInstance[];
    activeDecrees: {
      id: string;
      currentStage: number;
      daysElapsed: number;
    }[];
    /** 已触发的事件 id */
    eventHistory: string[];
    /** 当前 tutorial 步 */
    tutorialStepId: string | null;
    /** 上次离线的 timestamp（用于 OfflineProgressionService） */
    lastSeenTimestamp: number;
  };
}
