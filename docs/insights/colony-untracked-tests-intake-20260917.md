# colony 未跟踪测试与 src/shared 入库收口（916p-a3-002，2026-09-17）

## 提交前（git status --porcelain 原文，7 条目标路径均为 ??）

```
?? src/renderer/data/__tests__/buildingRefs.test.ts
?? src/renderer/state/__tests__/saveLoadIo.test.ts
?? src/renderer/state/__tests__/saveMatrix.extend.test.ts
?? src/renderer/state/__tests__/saveMatrix.test.ts
?? src/renderer/state/__tests__/typedEvents.test.ts
?? src/renderer/ui/__tests__/uiAdapterGuard.test.ts
?? src/shared/
```

## c916-07 自述核验

```
$ git log --all --oneline -- src/renderer/state/__tests__/saveMatrix.extend.test.ts
（空输出——该文件从未被任何提交包含）
```

结论：**c916-07 自述「已提交 saveMatrix.extend.test.ts」不符**——核验时点该文件仍为未跟踪态，本单补入库。

## npm.cmd test 实测（数字同段）

```
Test Files  91 passed (91)
     Tests  1145 passed (1145)
（与任务书预期数字一致；pre-commit 钩子在本提交时再次全绿验证）
```

## 提交后

```
$ git show --stat --oneline HEAD → 36b921a，8 files changed（7 条目标路径 + src/shared/visualConstants.ts，≥7 达标）
$ git status --porcelain | grep -cE '^\?\? (7 条目标路径…)' → 0（全部消失）
```

（8 files = 6 个单文件测试 + saveMatrix.test.ts + saveMatrix.extend.test.ts + typedEvents.test.ts + uiAdapterGuard.test.ts + buildingRefs.test.ts + saveLoadIo.test.ts 共 6 个单测 + src/shared/ 展开 2 文件 = 8；≥7 达标。）

## 验收对照

- ✅ 提交前后两次 status 同段；7 条路径消失。
- ✅ npm test 91/1145 全绿同段。
- ✅ show --stat 新增 ≥7。
- ✅ c916-07 自述核验一行结论：不符（证据＝git log --all 空输出）。
- ✅ 未 add docs/insights、tmp/、_archive/、dead-exports JSON；无 -A/-u/.；不 push。
