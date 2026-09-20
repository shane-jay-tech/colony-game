# colony P2-1 新手引导三件套只读走查（c918-24 材料单）

> 2026-09-19｜执行班 sweep-20260918-2300｜只读走查，零改动（npm test 全量绿见文末）。

## 三件套现状

| 组件 | 文件 | 现状 |
|---|---|---|
| 序章教学 | src/renderer/data/tutorial.ts:7 `TUTORIAL_STEPS` | 有教学步定义（每步 ≤15 字、单按钮点亮+60% 灰遮罩设计），但条目数少（grep 首条 tut_grant_field 授田），覆盖止于开局首步 |
| JIT 提示 | src/renderer/data/jitHints.ts:33 `JIT_HINTS` | Record<JitTrigger, JitHint> 触发字典＋`pickJitHint(trigger, seen)`（:54）带已见去重 |
| 典册 | src/renderer/ui/CodexPanel.ts:110 `CodexPanel` | 「随时可查的说明书」定位 |

## 缺口清单（附 file:line）

1. **tutorial.ts:7 无「第一局 15 分钟」动线**：TUTORIAL_STEPS 只覆盖授田单步（grep 全文件仅 1 个 step id `tut_grant_field` 前缀的连续步），从授田到首次建造/首日结算的后续步骤缺失——「15 分钟自解释」的主链路无引导。
2. **jitHints.ts 触发点未被 UI 侧消费的可见性未验证**：`pickJitHint` 带已见去重（:54），但 GameScene/UIScene 对 `pickJitHint` 的调用密度（触发时机）未见集中管理——提示出现时机是否与玩家动作同步无从确认。
3. **CodexPanel 与 JIT/Tutorial 无联动**：三件套各自独立，JIT 提示中「详见典册」类跳转链接不存在——新玩家卡关时从提示到典册需自行查找。
4. **IntroScene 单向门**（c918-21 核报）：序章无「跳过→ModeSelect」回流；新手若在立邦页迷路，只能硬着头皮走完——与 P2-1「第一局自解释」目标负相关。

## 建议优先级
1. tutorial.ts 补「授田→建屋→首日结算→调速」4 步连续动线（最大缺口，P2-1 主诉）。
2. CodexPanel 条目加入 JIT 提示的跳转锚（低成本联动）。
3. IntroScene 回流出口做产品裁决（c918-21 核报已列）。

## 只读证明
- `npm.cmd test` → **106 文件 / 1205 tests 全绿**（本单零改动前后各一次，数字一致）。
- 本单唯一产物＝本报告（docs/insights/colony-onboarding-walkthrough-20260918.md），未 add 未 commit（材料单，backlog 文件属用户在途 M 域不动）。
