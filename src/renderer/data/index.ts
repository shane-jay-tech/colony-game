/**
 * 静态数据汇总 + 启动期校验入口。
 * 任何 scene 想读静态数据，从这里 import。
 */

import { BUILDINGS } from './buildings';
import { POLICIES } from './policies';
import { EVENTS } from './events';
import { DECREES } from './decrees';
import { TUTORIAL_STEPS } from './tutorial';
import { FLOATING_TEXTS, PARTICLES, SHAKES } from './particles';
import { DEFEAT_CONDITIONS } from './defeat';
import { OFFLINE_REWARD } from './offline';
import { AUDIO_CUES } from './audio';
import { validateAllStaticData } from './modifierValidator';

export {
  BUILDINGS,
  POLICIES,
  EVENTS,
  DECREES,
  TUTORIAL_STEPS,
  FLOATING_TEXTS,
  PARTICLES,
  SHAKES,
  DEFEAT_CONDITIONS,
  OFFLINE_REWARD,
  AUDIO_CUES,
};

/**
 * 启动期一次性 sanity check。任何静态数据非法 → 抛错让游戏不能跑，
 * 比上线后 NaN 强百倍。
 */
export function validateStaticData(): void {
  validateAllStaticData({
    policies: POLICIES,
    events: EVENTS,
    decrees: DECREES,
  });
}
