/**
 * 人口增长（纯函数，无副作用）——8h 沙盒核心循环之一。
 *
 * 缺口背景：此前 people 资源只被建筑维护消耗、无任何自然增长，导致国格阶梯门槛
 * （pop 30→320）爬不上去。本模块补上"有余粮 + 有住房 → 人口自然增长"。
 *
 * 缺粮减员**不在本模块**：统一由 populationClassSystem.applyStarvation 负责（带宽限期 +
 * 温和/严重双档 + 从低阶层起扣）。本模块缺粮时只返回 idle、不流失，避免与 applyStarvation
 * 双重扣减（2026-06-17 review ID-2/ID-5 修复）。
 *
 * 与 productionSystem 同款分数残差风格：每日增量多为小数，用独立 carry 累积成整数，
 * 避免"每天 +0.08 永远取整为 0"。carry 存在 GameState.populationCarry（不混 productionCarry）。
 * 增长路径 rawNet ≥ 0、carry 不被赋负值（"负 carry 拖延增长" ID-3 已消除）；唯一的负增长是
 * BUG-A（2026-06-19）的"超住房上限温和回落"，走整数回落、不参与 carry，故 carry 仍恒 ≥ 0。
 */

import type { BuildingDef, BuildingInstance } from '../data/schema';

export interface PopulationConfig {
  growthRatePerDay: number;
  minDailyGrowth: number;
  /** BUG-A：超住房上限时每日回落比例（默认 0.02）。 */
  homelessDeclineRate?: number;
  /** BUG-A：单日回落硬顶，防雪崩（默认 2）。 */
  homelessDeclineMax?: number;
}

export interface PopulationGrowthInput {
  people: number;
  /** 住房上限（gameStore 用 baseCap + 建筑 housingCapacity + cap modifier 算好后传入） */
  housingCap: number;
  /** production tick 之后的当前存粮 */
  grainStock: number;
  /** 上一 tick 的人口小数残差 */
  carry: number;
  /** 最小人口（回落不跌破，默认 0）。gameStore 传 DEFAULT_STARVATION.minimumPopulation。 */
  minimumPopulation?: number;
  /** 当日人口口粮（gameStore 传 computeClassConsumption().totalGrain）。仅"够喂当前人口的真余粮"才触发超限回落，
   *  否则让位 applyStarvation，避免同 tick 超限回落 + 饥荒减员双扣（DeepSeek DOUBLE-PENALTY）。默认 0。 */
  dailyConsumption?: number;
}

export interface PopulationGrowthResult {
  /** 本 tick 取整后人口增量（grow≥0；overflow<0；缺粮/满员为 0） */
  peopleDelta: number;
  /** 结转到下一 tick 的小数残差（恒 ≥ 0） */
  carry: number;
  reason: 'grow' | 'cap' | 'idle' | 'overflow';
  /** 取整前的浮点日增量，供 UI 显示"今日约 +X"（缺粮/满员为 0；overflow 为负整数） */
  rawNet: number;
}

/** 累加所有 working 建筑提供的住房容量。 */
export function sumHousingCapacity(
  buildings: readonly BuildingInstance[],
  defLookup: (id: string) => BuildingDef | undefined,
): number {
  let sum = 0;
  for (const b of buildings) {
    if (b.status !== 'working') continue;
    const def = defLookup(b.defId);
    if (def && typeof def.housingCapacity === 'number') sum += def.housingCapacity;
  }
  return sum;
}

/**
 * 计算本 tick 人口变化。
 * - 缺粮（grainStock<=0）→ 不增长（reason='idle'）；减员交给 applyStarvation，本函数不流失。
 * - 超住房上限（people>cap）且有余粮 → 温和回落（reason='overflow'，BUG-A 2026-06-19）：拆房/割地/cap
 *   modifier 到期会让上限掉到人口之下，旧逻辑只"卡住不增"、人口永久滞留上限之上（民187/175）。现按
 *   ceil(overflow×rate) 回落、单日封顶 homelessDeclineMax 防雪崩，且不跌破 minimumPopulation。缺粮时
 *   走上面的 idle 分支让位 applyStarvation，杜绝同 tick 双重减员（DeepSeek 警告核心）。
 * - 恰满住房上限（people==cap）→ 不增（reason='cap'）。
 * - 有余粮且未满 → 按 max(people×growthRate, minDailyGrowth) 增长，clamp 到 cap 余量。
 * 增量与 carry 合并后取整，余数留 carry（overflow 为整数回落，不走 carry、清零残差）。
 */
export function computePopulationGrowth(
  input: PopulationGrowthInput,
  cfg: PopulationConfig,
): PopulationGrowthResult {
  const { people, housingCap, grainStock, carry } = input;
  const minPop = input.minimumPopulation ?? 0;
  const dailyConsumption = input.dailyConsumption ?? 0;
  const declineRate = cfg.homelessDeclineRate ?? 0.02;
  const declineMax = cfg.homelessDeclineMax ?? 2;
  const clampedCarry = Math.max(0, carry);

  if (grainStock <= 0) {
    // 缺粮：人口不在此增长，也不在此流失（减员由 applyStarvation 独家负责）
    return { peopleDelta: 0, carry: clampedCarry > 1e-9 ? clampedCarry : 0, reason: 'idle', rawNet: 0 };
  }

  // 超上限回落：仅在"真有余粮（够喂当前人口）"时触发；粮不足以喂饱时让位 applyStarvation，
  // 避免同 tick 超限回落与饥荒减员双扣（DeepSeek DOUBLE-PENALTY）。
  if (people > housingCap && grainStock >= dailyConsumption) {
    const overflow = people - housingCap;
    const maxDecline = Math.max(0, people - minPop);
    const decline = Math.min(Math.ceil(overflow * declineRate), declineMax, maxDecline);
    // 整数回落，不参与 carry 累积（回落期把碎片增长残差清零，避免负 carry 拖延后续增长）
    const delta = decline > 0 ? -decline : 0; // 归一化，避免 -0
    return {
      peopleDelta: delta,
      carry: 0,
      reason: decline > 0 ? 'overflow' : 'cap',
      rawNet: delta,
    };
  }

  // 增长路径 rawNet 恒 ≥0、carry 应 ≥0；clampedCarry 已在上面钳到 ≥0（杜绝旧存档遗留负 carry
  // 造成"有粮有房却持续掉人"，DeepSeek 复审 ID-R2）。
  let rawNet: number;
  let reason: PopulationGrowthResult['reason'];

  if (people >= housingCap) {
    // people==cap，或 people>cap 但粮不足以喂饱（已让位 applyStarvation）→ 不增不在此减
    rawNet = 0;
    reason = 'cap';
  } else {
    const desired = Math.max(people * cfg.growthRatePerDay, cfg.minDailyGrowth);
    const room = housingCap - people;
    rawNet = Math.min(desired, room);
    reason = 'grow';
  }

  const total = rawNet + clampedCarry;
  const peopleDelta = Math.trunc(total);
  const nextCarry = total - peopleDelta;
  return {
    peopleDelta,
    // rawNet≥0 ⇒ carry≥0；极小残差归零避免浮点尘埃累积
    carry: nextCarry > 1e-9 ? nextCarry : 0,
    reason,
    rawNet,
  };
}
