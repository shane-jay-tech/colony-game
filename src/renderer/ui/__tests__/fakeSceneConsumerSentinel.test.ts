/**
 * c1002-33（c924-02 遗留）：fakeScene 消费面清单哨兵——共享脚手架的消费文件集合看守。
 *
 * 背景（c924-02 原话）：「消费面口径未入册：下次动共享件仍需现场 rg -l fakeScene 重取」。
 * 本件把消费面清单钉成**文件名集合比对**（不用计数——防静默增删相消）：任何新增/删除
 * fakeScene 消费文件的改动都必须显式更新 BASELINE（评审即见），共享件的「破坏半径」从此在册。
 *
 * 基线锚定 2026-10-04 现取（rg -l fakeScene src/ = 37 件：本件自身 + fakeScene.ts 本体 + 35 消费件）。
 * 变更流程：新增消费者 → BASELINE 加行（一行注释说明用途）；退役消费者 → 删行。
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const UI_TESTS = join(__dirname);

/** 递归列 src/ 下含 "fakeScene" 字面串的 .ts 文件（与 `rg -l fakeScene src/` 同口径）。 */
function fakeSceneConsumers(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === 'dist') continue;
        walk(p);
      } else if (e.name.endsWith('.ts') && readFileSync(p, 'utf8').includes('fakeScene')) {
        out.push(relative(process.cwd(), p).replace(/\\/g, '/'));
      }
    }
  };
  walk(join(process.cwd(), 'src'));
  return out.sort();
}

/** 基线集合（2026-10-04 现取；文件名集合非计数——禁令口径）。变更须显式改本清单。 */
const BASELINE = new Set([
  'src/renderer/render/__tests__/MapRenderer.panby-nan.test.ts',
  'src/renderer/scenes/__tests__/BootScene.runtime-error.test.ts',
  'src/renderer/scenes/__tests__/GameSceneFeedbackBatch2.test.ts',
  'src/renderer/scenes/__tests__/GameSceneLifecycle.test.ts',
  'src/renderer/scenes/__tests__/GameSceneToastFailure.test.ts',
  'src/renderer/scenes/__tests__/IntroScene.test.ts',
  'src/renderer/scenes/__tests__/IntroSceneShutdown.test.ts',
  'src/renderer/scenes/__tests__/ModeSelectScene.test.ts',
  'src/renderer/scenes/__tests__/ModeSelectSceneShutdown.test.ts',
  'src/renderer/scenes/__tests__/TransitionScene.test.ts',
  'src/renderer/scenes/__tests__/UIScene.test.ts',
  'src/renderer/scenes/__tests__/UISceneEventSet.test.ts',
  'src/renderer/scenes/__tests__/keyboardFlowFocusOrder.test.ts',
  'src/renderer/scenes/__tests__/keyboardThreeEntries.test.ts',
  'src/renderer/scenes/__tests__/pauseReachability.test.ts',
  'src/renderer/scenes/__tests__/speedKeyModalGuard.test.ts',
  'src/renderer/state/__tests__/queueFairnessPins.test.ts',
  'src/renderer/ui/__tests__/BuildPanel.test.ts',
  'src/renderer/ui/__tests__/BuildingPopover.test.ts',
  'src/renderer/ui/__tests__/CodexPanel.test.ts',
  'src/renderer/ui/__tests__/DiplomacyPanel.test.ts',
  'src/renderer/ui/__tests__/CrisisModal.test.ts', // c1010-02 fakeScene 替身五例（漏登记补行，c1014-06 代登记）
  'src/renderer/ui/__tests__/EventModal.test.ts',
  'src/renderer/ui/__tests__/FactionDemandModal.test.ts',
  'src/renderer/ui/__tests__/HUD.test.ts',
  'src/renderer/ui/__tests__/Legend.test.ts',
  'src/renderer/ui/__tests__/MegaProjectPanel.test.ts',
  'src/renderer/ui/__tests__/MilitaryPanel.test.ts',
  'src/renderer/ui/__tests__/PolicyTreePanel.test.ts',
  'src/renderer/ui/__tests__/PopulationPanel.test.ts',
  'src/renderer/ui/__tests__/ProductionGradePanels.test.ts',
  'src/renderer/ui/__tests__/SaveLoadPanel.test.ts',
  'src/renderer/ui/__tests__/ScoreCardPanel.test.ts',
  'src/renderer/ui/__tests__/SettingsPanel.test.ts',
  'src/renderer/ui/__tests__/TutorialModal.test.ts',
  'src/renderer/ui/__tests__/fakeScene.ts', // 共享件本体
  'src/renderer/ui/__tests__/fakeSceneConsumerSentinel.test.ts', // 本件（含字面串 "fakeScene"）
  'src/renderer/ui/__tests__/hudRefreshCost.test.ts',
  'src/renderer/ui/__tests__/panelDecoration.test.ts',
]);

describe('fakeScene 消费面清单哨兵（c1002-33）', () => {
  it('现取消费集合 === 登记基线集合（新增/退役消费文件须显式进基线）', () => {
    const got = new Set(fakeSceneConsumers());
    const unexpected = [...got].filter((f) => !BASELINE.has(f));
    const missing = [...BASELINE].filter((f) => !got.has(f));
    expect(
      { unexpected, missing, total: got.size },
      '消费面漂移：新增消费者请把文件加进 BASELINE（一行注释说明用途）；退役请删行',
    ).toEqual({ unexpected: [], missing: [], total: BASELINE.size });
  });

  it('敏感性自证：扫描器对「含字面串」的判定是活的（基线集合非空且本体在列）', () => {
    const got = fakeSceneConsumers();
    expect(got.length).toBeGreaterThan(30);
    expect(got).toContain('src/renderer/ui/__tests__/fakeScene.ts');
    expect(got).toContain('src/renderer/ui/__tests__/fakeSceneConsumerSentinel.test.ts');
  });
});
