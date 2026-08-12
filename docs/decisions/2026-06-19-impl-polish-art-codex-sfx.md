# 邦国录「加工/打磨」批次 — 人物美术接线 / 百科 / 收尾 / 音效 / 故事核查

## 结构化元数据
- **任务类型**：implement（多项打磨，承接 2026-06-19「接空壳系统」之后的「把这些继续加工」）
- **调用模型**：Claude Opus 4.6（实现+自审）＋ DeepSeek V4 Pro（代码审，quick）。GPT/Kimi 本批未叫（低 blast radius 的 UI/内容/打磨，按「协作投入按价值缩放」走单实现+独立评审）。
- **mode**：quick（无安全/并发/公共 API/资金；唯一状态改动=监察台间隔系数，确定性且带测试）
- **finding 计数**：DeepSeek 报 CRITICAL×1（已**证据反驳**）、MAJOR×4、nit×4
- **被接受的 finding**：F-02 / F-03 / F-04 + CodexPanel selectTopic clamp（已修）
- **被 Opus override / 反驳的**：F-01（证据反驳，见下）；F-05（已知边界，文档接受）；factionSystem 极端系数 nit、window.setTimeout nit（既有模式/已有保护，不动）
- **测试**：954 全绿（type-check + vitest）；新增 CodexPanel.test（6）+ factionSystem 监察台系数断言（1）
- **残留风险**：见末节
- **用户返工**：否

---

## 原始需求
用户（非技术）在「邦国录」接好 4 大空壳系统后说「把这些继续加工吧」，指此前列出的剩余缺口：人物美术、音效、新手引导/百科、故事深度、AI 深度、收尾打磨。

## 改了什么（按任务）

### #24 人物美术（通义万相 wan2.7-image-pro）
- 新 `scripts/gen_portraits_events.py`：5 将领立绘（720×1280 半身、软背景）+ 10 事件插画（1280×720 16:9）。全部生成并逐张目检质量良好。
- `BootScene.ts` 载入 `portrait_<id>` / `evt_art_<name>`。
- `MilitaryPanel.ts`：军务面板加「麾下将领」立绘画廊（头像 + 指挥/忠诚 + 出征中遮罩）。
- `schema.ts` CourtEvent 加 `illustrationKey?`；`EventModal.ts` 顶部渲染 16:9 插画、面板高度自适应、缺图静默回退纯文字。
- 事件配图：洪水(河决/江堤)→flood、邻邦遣使→diplomacy、盗贼→battle、诉苦之会→rebellion。

### #25 新手引导 / 百科面板（典册）
- 新 `ui/CodexPanel.ts`：左侧 10 主题（上手/资源/建筑劳力/国策朝令/国格/军事将领/阶层博弈/大业/经济供养/操作）+ 右侧大白话讲解，打开时停（引用计数 `requestPause('codex')`）。
- 顶栏「?」按钮由「重放一次性欢迎引导」改为「打开典册」（可随时查，更有用）。
- `UIScene.ts` 注册/布局/销毁/置空齐套；新增 `CodexPanel.test.ts`。

### #26 收尾打磨
- **监察台加成**（兑现 descPlain「处理效率 +30%」）：`factionSystem.scheduleFactionEvent/tickFaction` 加 `intervalFactor` 形参；`gameStore.factionIntervalFactor()` 按 working `bld_censor` 数量算 `min(2.0, 1.3^n)` 拉长诉求间隔（拆除/损毁即回退）。带单测。
- **铜/礼获取引导**：`jitHints.ts` 加 `first_bronze_income`（铜冶坊→养兵）/`first_rite_income`（祖庙太庙→晋格/大业）两条首次提示；`JitHintManager.ts` 接 RESOURCES_CHANGED deltas.bronze/rite。
- **结局插画**：`TransitionScene` 加可选 `imageKey`，结局过场上方居中展示 `evt_art_ending_<gong|jia|huo>`，文字下移；缺图静默回退。`GameScene` 结局监听传入。

### #27 AI 深度（核查后确认已满足，无需改）
军事节拍 `runMilitaryTick`（tickDay 内）在 `runNpcDynamicsTick` **之前**执行并把 `playerMilitaryPower` 刷为「兵阶层+兵种建筑+将领」聚合值（gameStore:1536）；NPC 决策读的就是这个含军队的真实军力（gameStore:1906）。即「养兵威慑邻国」已由前一批 P4 的 tick 顺序实现。

### #28 音效
- 主功能工具栏 4 按钮 + 顶栏「?」加 `playUi('sfx_click')`。
- 补齐「警告/提醒」类（此前 sfx_warn 只能手动播）：来犯预警 DEFENSE_ALERT→sfx_warn、阶层上书 FACTION_DEMAND_TRIGGERED→sfx_bell、晋格 GRADE_CHANGED(ascend)→sfx_gong / 降格→sfx_warn。constructor on() + destroy off() 对称。
- 检查表「放置/完工/点击/警告/事件」全覆盖（既有 6 个合成 wav 够用，未新增音效文件）。

### #29 故事深度（核查后确认已完整，未新增内容）
核查 `storyChapters.ts`/`storyEvents.ts`：序章+七卷（chapter 0–7）齐全，23 个剧情事件**全部带 choices（分支）**，三结局（公/家/货）各有旁白 + 王朝渐腐过场旁白；第五卷「海与灯」已含 lighthouse/gu/ruan 三事件。内容取材小说《天下人书记》。**结论**：叙事内容已相当完整且高质量；本批的故事面改进=接上结局插画（#26）。未自造填充事件——会有与源小说基调冲突 + 注水风险，留作「用户明确要扩展时再借 Kimi 对源本起草」。

---

## DeepSeek 评审 findings 与处理（verbatim 见下「附录」）

| ID | 级别 | 处理 |
|---|---|---|
| F-01 阶层 modifier 叠加漏洞 | CRITICAL | **证据反驳**：`addModifier`（gameStore:595-597）对 `stackable:false` 按 id 查重即 return；`makeFactionModifier` 用确定性 id `faction_<demandId>_<target>` + `stackable:false`。重复接受同一诉求是 no-op，不会叠加。DeepSeek 自标「impl 未见」的条件式 CRITICAL，核对实现后不成立。（acceptedDemands 数组重复 push 仅 cosmetic，filter 用 includes 无害。） |
| F-02 fadeTweens 数组无限增长 | MAJOR | **已修**：tween onComplete 里 splice 自身。 |
| F-03 TransitionScene pointerdown 未在 shutdown 解绑 | MAJOR | **已修**：shutdown 加 `input.removeAllListeners()`。 |
| F-04 GRADE_CHANGED 双绑无注释 | MAJOR | **已修**：两处加 [1/2]/[2/2] 注释，防未来误删其一。 |
| F-05 EventModal 覆盖未结算的旧事件 | MAJOR | **文档接受**：store 同时仅一个 pendingEventId，且 onReplaced 已先置空 currentEvent → 真实触发概率极低；且非本批改动。记为已知边界，不在本批修。 |
| nit CodexPanel selectTopic 越界 | SUGGESTION | **已修**：clamp。 |
| nit factionSystem 极端 factor | SUGGESTION | 不动：已有 `Math.max(1,…)` 下限 + gameStore 层 `min(2.0,…)` 上限。 |
| nit TransitionScene window.setTimeout | SUGGESTION | 不动：与 ModeSelectScene 既有模式一致，shutdown 已清理。 |

**override 留痕**：本批 Opus override 2 条外部意见——F-01（证据反驳）、F-05（文档接受已知边界）。均非「主观合理化」，附了代码证据/触发概率论证。F-01 属安全/整体性类 CRITICAL，按「仲裁防偏置」第 3 条走了「②让代码事实复核」路径（读 addModifier 实现验证），未走「写理由接受风险」。

## 验证
- `npm run verify`：type-check + 954 测试全绿。
- `npm run electron:build:win`：邦国录-0.9.0 出包成功（每次先确认 邦国录.exe 未运行）。

## 残留风险（≥2）
1. **数值仍待真人试玩**：监察台间隔系数（1.3^n、封顶 2×）、结局插画观感、各音效音量平衡都是「接成可玩 + 逻辑正确」级别，手感未经 playtest 校准。
2. **F-05 已知边界**：极端并发触发两个朝议事件时旧事件会被覆盖（理论上 store 单 pending 不会发生）；若未来改成多 pending 队列需补结算。
3. **新美术体积**：15 张图增大了打包体积；wan2.7 生成的图风格虽统一，个别将领立绘与游戏内像素建筑画风存在「写实 vs 像素」张力（属既有取舍）。

## 反方观点
DeepSeek 对「单实现 + 单评审」批次仍挖出 4 条 MAJOR（含 2 个真实资源泄漏 F-02/F-03）——说明即便低 blast radius 的打磨，评审层也确实抓到了 Opus 自审漏掉的泄漏。印证 CLAUDE.md「评审层永不删」。反向看：F-01 的条件式 CRITICAL 也提示评审者在看不到被调用实现时会偏保守报高，仲裁方必须核实而非照单全收（本批即如此）。

---

## 附录：DeepSeek 评审 verbatim
（已脱敏：本批无 key/token/凭据出现）

Verdict: ship-with-fixes

F-01 CRITICAL 功能/边界 — gameStore resolveFactionDemand→makeFactionModifier(demandId,…)：诉求池耗尽后 pickDemand 重置可重选同 demandId，若 addModifier 不去重则 goldMul/researchMul 无限叠加致经济崩盘。置信度 高（addModifier 实现未见）。→ 修复建议：id 加时间戳/计数，或 addModifier 去重。
F-02 MAJOR 边界/性能 — AudioManager.fadeTween 把 tween push 进 fadeTweens 从不移除，长会话内存上涨。→ onComplete splice。
F-03 MAJOR 边界 — TransitionScene create 注册 pointerdown，shutdown 只清 resize/timer 不清 input，强制 stop 时监听残留。→ shutdown removeAllListeners。
F-04 MAJOR 可维护 — GRADE_CHANGED 绑 onBgmRefresh 与 onGradeSfx 两次无注释，易误删其一。→ 合并或加注释。
F-05 MAJOR 设计 — EventModal.handleTriggered 无条件覆写 currentEvent，旧事件未结算，store 仍等答复，可能卡死。→ 先 resolveEvent(0) 再展示新事件。
nits：CodexPanel.selectTopic 无越界保护；AudioManager setVolume 转型脆弱；factionSystem 极端 factor；TransitionScene 宜用 Phaser timer。
good：CodexPanel/EventModal 正确用引用计数 pause 并在 destroy 释放；AudioManager 资产缺失优雅降级。
