# colony O1：BootScene loaderror handler 重复注册去重（n916d-24）

- 班次：sweep-20260916-2300（9/17 08:2x 段）
- 结论：判定为**真重复**（两处注册同回调同作用域，Phaser `load.on` 不去重 ⇒ 同一缺图文件双打 debug 日志）；已合并为一处，语义保持；新增源码钉测 2 用例；**npm test 94 文件 1153 passed，failed=0**

## 一、两处原文与判定（修前）

BootScene.ts:33-36 与 :42-45（修前行号）两段 `this.load.on('loaderror', ...)` 回调**逐字相同**（同为 console.debug 一条 sprite missing 提示、同挂 `this.load` 加载器作用域），且中间仅隔注释——判定**真重复**，非「不同作用域的合法多订阅」。Phaser 事件系统对同一事件多次 `on` 会全部执行，故每个缺图文件会双打日志（噪声，非崩溃）。

## 二、修复（逐行标注）

```diff
 src/renderer/scenes/BootScene.ts:42-45（第二处）
-    this.load.on('loaderror', (file: Phaser.Loader.File) => {
-      // 仅打 debug，不污染 console.error——大量缺图属预期状态
-      console.debug('[BootScene] sprite missing (fallback to sigil):', file.key);
-    });
+    // （n916d-24：此处曾重复注册第二个 loaderror，同一失败双打日志——已合并为上方一处。）
```

保留第一处（:33-36），回调与作用域不变——行为差异仅「同失败从双条日志变单条」＝本单目标。加载清单与资源路径语义零改动。

## 三、锁定用例（新增 `src/renderer/scenes/__tests__/bootLoadErrorDedup.test.ts`，2 用例）

1. 源码中 `this.load.on('loaderror'` 恰好出现 **1** 处（免 Phaser 头依赖的源码级钉测，防回潮）；
2. 唯一回调语义保持：handler 体内 console.debug 恰 1 条且含 fallback 提示文案。

## 四、验收（命令在前）

```
$ npm.cmd test
Test Files 94 passed (94)
Tests      1153 passed (1151+2)      ← failed=0
```

`git diff` 仅 BootScene.ts（删重复块＋1 行注记）与新增测试文件。

——完。
