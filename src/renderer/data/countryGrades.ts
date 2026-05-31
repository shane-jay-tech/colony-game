/**
 * 国格阶梯（Phase 1 · 沙盒脊梁）——给玩家"一级级往上爬"的奔头。
 *
 * 六级：聚落 → 城邑 → 邦国 → 诸侯 → 霸主 → 天下共主。
 * 升级条件 = 综合门槛（人口为主 + 经济达标）**且** 本级标志成就（建筑/国策/朝令/邦交里程碑）。
 * 两者都满足才进位（见 state/countryGrade.ts evaluateGrade）。登顶天下共主给软性圆满认可，
 * 不强制结束，此后无限玩。
 *
 * ⚠️ 门槛数值为 8h 沙盒占位值，集中此处便于后续"经济重平衡 pass"统一调整。
 * 标志成就引用的 id 均已核实存在于 buildings.ts / decrees.ts（2026-05-31）。
 */

import type { ResourceId } from './resourceRegistry';

/** 综合门槛：人口必达 + 列出的资源各自必达（未列出的资源不要求）。 */
export interface GradeThreshold {
  population: number;
  gold?: number;
  cloth?: number;
  rite?: number;
  bronze?: number;
}

/** 标志成就：本级必须达成的一个里程碑。kind 决定查哪个集合，id 为现有内容 id。 */
export interface SignatureAchievement {
  /** building=已建成(working) / policy=已采纳 / decree=已完成 / diplomacy=邦交语义旗标 */
  kind: 'building' | 'policy' | 'decree' | 'diplomacy';
  id: string;
  /** 给 HUD/Toast 的简短说法（半文半白） */
  label: string;
}

export interface GradeDef {
  /** 0..5 */
  level: number;
  name: string;
  threshold: GradeThreshold;
  /** level 0（起始）为 null */
  signature: SignatureAchievement | null;
  /** 晋阶时的祝贺文案（半文半白，禁偏字） */
  ascendBlurb: string;
}

/**
 * 邦交语义旗标：齐晋鲁三邦皆"友好"以上（stance 阈值由 gameStore 现算后塞进 GradeInput）。
 * 用作天下共主一级的"天下归心"判据之一（当前表里以铸鼎为标志，此旗标留作后续扩展）。
 */
export const DIPLO_FLAG_ALL_FRIENDLY = 'all_npc_friendly';

export const COUNTRY_GRADES: GradeDef[] = [
  {
    level: 0,
    name: '聚落',
    threshold: { population: 0 },
    signature: null,
    ascendBlurb: '草庐数十，炊烟初起。',
  },
  {
    level: 1,
    name: '城邑',
    threshold: { population: 30, gold: 80 },
    signature: { kind: 'building', id: 'bld_market', label: '设市通货' },
    ascendBlurb: '夯土为墙，立市聚人——成城邑矣。',
  },
  {
    level: 2,
    name: '邦国',
    threshold: { population: 60, gold: 200, cloth: 40 },
    signature: { kind: 'building', id: 'bld_ancestor_shrine', label: '立宗庙' },
    ascendBlurb: '宗庙既立，百业并兴——正式立国。',
  },
  {
    level: 3,
    name: '诸侯',
    threshold: { population: 120, gold: 400, rite: 6 },
    signature: { kind: 'building', id: 'bld_palace', label: '筑宫室' },
    ascendBlurb: '宫室初成，列国侧目——已为一方诸侯。',
  },
  {
    level: 4,
    name: '霸主',
    threshold: { population: 200, gold: 700, bronze: 30 },
    signature: { kind: 'decree', id: 'decree_hegemony', label: '修武备、行称霸' },
    ascendBlurb: '会盟列邦，号令四邻——霸业成矣。',
  },
  {
    level: 5,
    name: '天下共主',
    threshold: { population: 320, gold: 1200, rite: 20 },
    signature: { kind: 'decree', id: 'decree_cast_ding', label: '铸九鼎、定鼎天下' },
    ascendBlurb: '九鼎既铸，名动天下——你做到了。山河任君纵横，亦可继续经营，无有尽头。',
  },
];

/** 查表辅助：按级取定义（越界 clamp 到合法范围）。 */
export function gradeDefAt(level: number): GradeDef {
  const i = Math.max(0, Math.min(COUNTRY_GRADES.length - 1, Math.floor(level)));
  return COUNTRY_GRADES[i]!;
}

export const MAX_GRADE = COUNTRY_GRADES.length - 1;
