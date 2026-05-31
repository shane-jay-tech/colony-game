import type { FloatingTextConfig, ParticleEffectDef, ScreenShakeConfig } from './schema';

/**
 * "Juice" 三件套（Kimi 调研 B.9）：飘字 + 粒子 + 屏幕震。
 * Part 1 给基础库，Part 2 接入到具体游戏事件。
 */

export const FLOATING_TEXTS: Record<string, FloatingTextConfig> = {
  resourceGain: {
    id: 'fx_resource_gain',
    fontStyle: 'number',
    color: '#C9A84C',
    velocityY: -40,
    duration: 800,
    ease: 'Cubic.easeOut',
  },
  resourceLoss: {
    id: 'fx_resource_loss',
    fontStyle: 'number',
    color: '#B71C1C',
    velocityY: -30,
    duration: 1000,
    ease: 'Cubic.easeOut',
  },
  goalCompleted: {
    id: 'fx_goal_completed',
    fontStyle: 'title',
    color: '#C9A84C',
    velocityY: -60,
    duration: 1500,
    ease: 'Sine.easeOut',
  },
};

export const PARTICLES: Record<string, ParticleEffectDef> = {
  grainHarvest: {
    id: 'fx_grain_harvest',
    textureKey: 'particle_grain',
    lifespan: 600,
    gravityY: 200,
    scale: { start: 0.6, end: 0.1 },
    quantity: 8,
    angleSpread: 60,
  },
  buildComplete: {
    id: 'fx_build_complete',
    textureKey: 'particle_dust',
    lifespan: 800,
    gravityY: 50,
    scale: { start: 0.4, end: 0 },
    quantity: 12,
    angleSpread: 360,
  },
};

export const SHAKES: Record<string, ScreenShakeConfig> = {
  disasterMinor: {
    id: 'fx_shake_minor',
    duration: 100,
    intensity: 0.005,
    direction: 'horizontal',
  },
  disasterMajor: {
    id: 'fx_shake_major',
    duration: 300,
    intensity: 0.015,
    direction: 'both',
  },
};
