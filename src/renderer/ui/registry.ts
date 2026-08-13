/**
 * P1-2 架构硬化：Phaser registry key 的单一事实源 + 类型化访问。
 *
 * 旧况：77 处 registry.get/set 散落字符串（20 个 key），拼错 key 只能运行时发现。
 * 现况：所有 key 在此登记；get/set 走泛型 helper，编译期即可校验 key 名与值类型。
 * 类型依赖一律 import type（编译后擦除，无运行时环依赖）。
 */

import type { GameStore } from '../state/gameStore';
import type { BuildMode } from '../state/buildMode';
import type { GameMode } from '../scenes/ModeSelectScene';
import type { Toast } from './Toast';
import type { AudioManager } from './AudioManager';
import type { PolicyTreePanel } from './PolicyTreePanel';
import type { MegaProjectPanel } from './MegaProjectPanel';
import type { MilitaryPanel } from './MilitaryPanel';
import type { CodexPanel } from './CodexPanel';
import type { DiplomacyPanel } from './DiplomacyPanel';
import type { PopulationPanel } from './PopulationPanel';
import type { ProductionPanel } from './ProductionPanel';
import type { GradePanel } from './GradePanel';
import type { ScoreCardPanel } from './ScoreCardPanel';
import type { SaveLoadPanel } from './SaveLoadPanel';
import type { SettingsPanel } from './SettingsPanel';
import type { InfluencePanel } from './InfluencePanel';
import type { MapRenderer } from '../render/MapRenderer';

/** 全部 registry key（唯一允许出现字符串的地方）。 */
export const REGISTRY_KEYS = {
  store: 'store',
  buildMode: 'buildMode',
  gameMode: 'gameMode',
  toast: 'toast',
  audioManager: 'audioManager',
  policyTreePanel: 'policyTreePanel',
  megaProjectPanel: 'megaProjectPanel',
  militaryPanel: 'militaryPanel',
  codexPanel: 'codexPanel',
  diplomacyPanel: 'diplomacyPanel',
  populationPanel: 'populationPanel',
  productionPanel: 'productionPanel',
  gradePanel: 'gradePanel',
  scoreCardPanel: 'scoreCardPanel',
  saveLoadPanel: 'saveLoadPanel',
  settingsPanel: 'settingsPanel',
  influencePanel: 'influencePanel',
  mapRenderer: 'mapRenderer',
  introDone: 'introDone',
  treePanelOpen: 'treePanelOpen',
  countryName: 'introCountryName',
  identity: 'introIdentity',
} as const;

export type RegistryKey = (typeof REGISTRY_KEYS)[keyof typeof REGISTRY_KEYS];

/** key → 值类型映射（get 的返回类型据此推导，调用方无需写泛型）。 */
export interface RegistryTypes {
  [REGISTRY_KEYS.store]: GameStore;
  [REGISTRY_KEYS.buildMode]: BuildMode;
  [REGISTRY_KEYS.gameMode]: GameMode;
  [REGISTRY_KEYS.toast]: Toast;
  [REGISTRY_KEYS.audioManager]: AudioManager;
  [REGISTRY_KEYS.policyTreePanel]: PolicyTreePanel;
  [REGISTRY_KEYS.megaProjectPanel]: MegaProjectPanel;
  [REGISTRY_KEYS.militaryPanel]: MilitaryPanel;
  [REGISTRY_KEYS.codexPanel]: CodexPanel;
  [REGISTRY_KEYS.diplomacyPanel]: DiplomacyPanel;
  [REGISTRY_KEYS.populationPanel]: PopulationPanel;
  [REGISTRY_KEYS.productionPanel]: ProductionPanel;
  [REGISTRY_KEYS.gradePanel]: GradePanel;
  [REGISTRY_KEYS.scoreCardPanel]: ScoreCardPanel;
  [REGISTRY_KEYS.saveLoadPanel]: SaveLoadPanel;
  [REGISTRY_KEYS.settingsPanel]: SettingsPanel;
  [REGISTRY_KEYS.influencePanel]: InfluencePanel;
  [REGISTRY_KEYS.mapRenderer]: MapRenderer;
  [REGISTRY_KEYS.introDone]: boolean;
  [REGISTRY_KEYS.treePanelOpen]: boolean;
  [REGISTRY_KEYS.countryName]: string;
  [REGISTRY_KEYS.identity]: string;
}

/**
 * 类型化读：缺省返回 undefined。
 * 入参收 DataManager——scene.registry 与 game.registry 皆可（main.ts 启动期没有 scene 只有 game）。
 */
export function registryGet<K extends RegistryKey>(dm: Phaser.Data.DataManager, key: K): RegistryTypes[K] | undefined {
  return dm.get(key) as RegistryTypes[K] | undefined;
}

/** 类型化写（允许 undefined：场景销毁时清空引用）。 */
export function registrySet<K extends RegistryKey>(dm: Phaser.Data.DataManager, key: K, value: RegistryTypes[K] | undefined): void {
  dm.set(key, value);
}

/**
 * 迁移过渡期守卫（测试用）：断言 key 清单稳定——新增/更名 key 必须先改 REGISTRY_KEYS。
 * 迁移完成后由 copyBias 式守护测试锁定，防止散落字符串回流。
 */
export const REGISTRY_KEY_COUNT = Object.keys(REGISTRY_KEYS).length;
