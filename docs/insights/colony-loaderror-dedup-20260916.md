# colony BootScene loaderror 重复注册核查与最小修复（n916e-08）

- 班次：日间续班（用户令继续）
- **状态备注：本单与 n916d-24 同题——修复已落地**（提交 **a009bdb**，本日 08:28：合并重复注册＋源码钉测 2 用例 `src/renderer/scenes/__tests__/bootLoadErrorDedup.test.ts`）。本报告为交叉引用＋当前时点复核

## 一、rg 复核（当前时点，命令在前）

```
$ grep -rn "loaderror" src/
:30 注释（缺图不崩说明）
:33  this.load.on('loaderror', …)      ← 唯一注册（n916d-24 修后）
:39/:42 注释（n916d-24 去重标记）
:47/:70 注释（地形/音频段提及 loaderror 语义，非注册）
```

判定：修前两处注册（:33 与修前 :42）**同一 emitter（this.load）同一事件同一回调体**＝真重复（Phaser load.on 不去重 ⇒ 同失败双打 debug）；n916d-24 已合并为 :33 单处，日志文案与行为保持（单失败单条 debug）。

## 二、修复 diff 摘要与影响面

- 修复＝删除第二个重复注册块（修前 :42-45），保留 :33 处；影响面＝缺图文件从双条 debug 日志变单条（即本单目标），加载清单/资源路径/回退语义零改动。
- 钉测：`bootLoadErrorDedup.test.ts` ① 源码 `this.load.on('loaderror'` 恰 1 处；② 唯一回调含 1 条 console.debug＋fallback 文案——防回潮。

## 三、回归（命令在前）

```
$ npm.cmd test
Test Files 94 passed (94)
Tests      1153 passed (1153)        ← failed=0（含 n916d-24 新增 2 用例；a009bdb 提交时 pre-commit type-check+全测通过）
```

boot 断言：Phaser 头依赖重、无头实例化成本高——以源码钉测替代（n916d-24 已说明不可测原因与替代方案）。

## 四、零改动声明

本班零代码改动（修复合在 a009bdb）；资源加载清单/资源文件零触碰；U1/U2 缺图已由 n916d-22/n916d-23 另案处理。

——完。
