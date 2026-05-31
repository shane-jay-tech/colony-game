# Phase 4 代码侧（音频引擎 + 手感 Juice + JIT 新手引导）

- 日期：2026-06-01
- 模式：/implement，quick 档（GPT 未参与编码——本三块由 Opus 直接实现，DeepSeek 复审；属"核心模块"但增量小且复用既有范式，故 quick）
- 健康检查：3 relay 全绿（gpt 14.9s / deepseek 3.3s / kimi 11.6s）

## 需求
设计稿 §11.A/B/C Phase 4 代码侧三短板：①"全程静音"→音频引擎；②手感反馈薄→飘字 Juice；③新手引导缺→JIT 即时提示。

## 落地内容

### ① 音频引擎（§11.A）
- `state/audioDirector.ts`（纯函数）：`selectBgmKey({grade,crisisActive,storyChapter,ending})`，优先级 结局>危机>国格繁荣床三档；`ALL_BGM_KEYS`/`SFX_KEYS` 清单。
- `ui/AudioManager.ts`（Phaser 层）：按 STATE_EVENTS（GRADE_CHANGED/STORY_CHAPTER_CHANGED/STORY_ENDING/STATE_REPLACED/CRISIS/BUILDING_COMPLETED/BUILDING_PLACED/EVENT_TRIGGERED）切 BGM + 触发音效。**缺资产静音降级**：`scene.cache.audio.exists(key)` 为假时全 no-op，绝不报错（同 image-or-fallback 哲学）。
- UIScene 构造/销毁接线；`gameStore.isCrisisActive()` getter。

### ② 手感 Juice（§11.B）
- `MapRenderer.floatTextAtTile(gridX,gridY,text,colorHex)`：上浮 34px + 淡出 1.1s 的飘字，tween 跟踪 + recenter 平移 + destroy 清理（复用 activePulses 范式）。
- GameScene：建成/升级时飘建筑名（金色），与既有金边脉冲呼应。

### ③ JIT 即时提示（§11.C）
- `data/jitHints.ts`：6 情境（first_build/complete/grade/crisis/event/diplomacy）一句话教学 + `pickJitHint` 纯函数。
- `ui/JitHintManager.ts`：事件→trigger 接线，Toast 弹出，**首遇一次永不重复**。
- `GameState.seenJitHints:string[]` 持久化（serialize/deserialize 向后兼容 ??[] + 3 fixture 同步）。

## DeepSeek 复审（verdict: ship-with-fixes，无 critical）
6 findings 仲裁：
1. [接受] AudioManager.play() 可能抛异常（音频上下文锁/解码失败）→ 包 try-catch 静音降级。
2. [采纳简化] JIT "先 pick 后 mark" 理论重复弹——实际事件派发同步无竞态，但改为 markJitHintSeen 单闸更简明稳健。
3. [接受] recenter() 加显式 `if(destroyed)return`（原靠 ?.+空数组已基本安全，显式守卫更稳）。
4. [接受] floatTextAtTile 加并发上限 MAX_FLOATS=6，超限丢最早。
5. [部分] 坐标平移 activePulses(originX/Y) vs floatLabels(dx/dy) 差异——已补注释说明。
6. [拒绝] AudioManager↔store 耦合——与全 codebase 组件范式一致（StoryBar/HUD 同样读 store+订阅），纯选择逻辑已抽到 audioDirector 可测，注入 viewmodel 属过度设计。
- 无 critical → 二轮 cross-critique 跳过，直接落地。

## 验证
- type-check 零错；npm test 622 全绿（35 文件）。新增测试：audioDirector 3 + MapRenderer float 5（含 cap）+ jitHints 3 + jitHintsStore 3。
- 提交：6074f70(audio) / c2ac482(juice) / JIT / 本次复审修复。
- exe 重建：electron:build:win。

## 风险
- 音频/美术资产未生成 → 当前运行静音 + 引擎绘制 fallback（设计如此，非 bug）；资产就位 + BootScene 加载后自动有声/有画。
- 飘字/音效手感强度需 playtest 校准（频率、时长、音量）——待主理人试玩。
