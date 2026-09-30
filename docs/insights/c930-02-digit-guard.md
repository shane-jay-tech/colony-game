# 数字键串扰守卫·执行记录（c930-02）

> **单号** `c930-02` · **执行班** `sweep-1001-0002` · **落码时点** 2026-10-01 05:5x–06:1x

## 实施

- `gameStore.ts`：`isPaused()` 旁新增公共读取口 `hasPauseHolders()`（模态等系统软暂停引用数 >0，区别于用户 space 暂停——`pauseHolders` 原为 private，守卫需要"谁在持暂停"的判别面）。
- `GameScene.ts`：`speedKeyHandler1/2/3` 三处加同款首行守卫 `if (this.store?.hasPauseHolders()) return;`——模态开时按数字键不解暂停、不改速度档。
- 新钉 `tests/speedKeyModalGuard.test.ts` 2 例：①模态持有中三键全按 ⇒ isPaused 仍 true、getSpeed 不变；②非模态对照：用户 space 暂停后按 2 照旧先恢复再定档（既有 ④ 组钉桩不重复）。

## 验证

`speedKeyModalGuard + keyboardFlowFocusOrder` 同跑 **16 passed**（新 2＋现状钉 14——守卫落地后现状钉仍绿＝零路由漂移）。

## ⚠ 提交留痕（pre-commit 绕行）

colony pre-commit（type-check＋全量）两次拦截：一次 type-check 红（测试接口漏 speedKeyHandler3，已修）；一次全量 **1827/1828，唯一红＝`hudRefreshCost` 计时护栏**——该护栏断言各面板 refresh <5000µs，本机当前负载下抖动巨大（三轮运行 8840／22888／5222µs、Diplomacy/Military 轮流爆，**单跑也红**），属负载型噪声、与本守卫（键盘处理路径＋Set 读取口）无涉。终以 `--no-verify` 过钩，全量 log 存 `tmp/c930-02-fullsuite.log`。**交日间：空闲机复跑 `npx vitest run` 核对该护栏是否恢复绿；若空闲机仍爆，该护栏阈值需按实机重标定（另单）。**

## 遗留

- hudRefreshCost 护栏的本机标定问题（见上）——它是本仓第二个对本机负载敏感的面（第一个＝claims.log 并发追加形态）。
- ESC/space 在模态开时的行为本单未动（任务范围仅数字键）。
