# colony BootScene loaderror 重复注册核查（n916f-07，只读判定）

- 班次：日间续班（用户令继续）
- **状态备注：本单与 n916d-24（修复，a009bdb）/n916e-08（复核）同题第三份**——判定＝真重复，且**修复已落地**（现 src 仅剩单处注册），本班 src 零改动，报告为判定表存档

## 一、rg 实录（当前时点，命令在前）

```
$ grep -rn "loaderror" src/
:30 注释 / :33 this.load.on('loaderror', …)   ← 唯一注册
:39 注释 / :42 n916d-24 去重标记注释
:47/:70 注释（地形/音频段语义提及，非注册）
```

## 二、判定表（修前形态 → 现状）

| file:line（修前） | 注册对象 | 回调要点 | 是否同键 | 影响 |
|---|---|---|---|---|
| BootScene.ts:33 | this.load（全局加载器）/loaderror | console.debug 单条 sprite missing | 同键 | 每缺图文件打 1 条 |
| BootScene.ts:42（修前） | this.load /loaderror | 与 :33 逐字相同 | **同键重复** | 同失败双打（Phaser on 不去重） |

**判定：真重复**（同 emitter 同事件同回调体，非分组别正常多订阅）。最强反方：「分资源组各自注册属正常」——反证：两处回调体逐字相同且均无 keys 过滤，语义完全重叠，不构成分组。

**现状**：修复已在 a009bdb 落地（n916d-24）——第二处删除＋`bootLoadErrorDedup.test.ts` 2 用例钉测（注册恰 1 处＋回调语义保持），npm test rc=0（本班复跑通过）。

## 三、patch 草案（已落地形态，存档）

```diff
-    this.load.on('loaderror', (file: Phaser.Loader.File) => {
-      console.debug('[BootScene] sprite missing (fallback to sigil):', file.key);
-    });
+    // （n916d-24：此处曾重复注册第二个 loaderror，同一失败双打日志——已合并为上方一处。）
```

## 四、src 零改动声明（重要：并发会话在途）

本班对 src/ **零改动**。当前 `git diff --stat src/` 显示 7 文件（90+/19-）＝**另一日间会话的在途未提交工作**（63dca27 同作者的后续件，含 MapRenderer.ts；本班全程未触碰），其提交责任在彼会话——如实记录避免归属混淆。

——完。
