import type { TutorialStep } from './schema';

/**
 * 前 180s 新手引导剧本（Kimi 调研 B.7 + 反审 #8 必修）。
 * 设计原则：每步 ≤15 字，强制单线点亮一个按钮，其他 60% 灰遮罩。
 */
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'tut_grant_field',
    trigger: 'first_login',
    uiTarget: 'btn_grant_field',
    text: '点此授田',
    textPlain: '点击"授田"按钮分配第一块田地。',
    requiredAction: 'click:btn_grant_field',
    nextStepId: 'tut_wait_grain',
    timeScale: 1,
  },
  {
    id: 'tut_wait_grain',
    trigger: 'first_grain_harvest',
    uiTarget: 'hud_grain',
    text: '收获第一粒粮',
    textPlain: '观察顶栏粮食数字变化。',
    requiredAction: 'observe:hud_grain_change',
    nextStepId: 'tut_population_5',
    timeScale: 0.5,
  },
  {
    id: 'tut_population_5',
    trigger: 'population_threshold_5',
    uiTarget: 'btn_open_court',
    text: '人口已聚，开朝议',
    textPlain: '人口达到 5，可处理首次朝议事件。',
    requiredAction: 'click:btn_open_court',
    timeScale: 0.2,
  },
];
