# colony 未提交生产改动盘点与提交就绪度核验（916p-a3-010，2026-09-17，只读）

## 一、M 项清点（命令与数字同段）

```
$ git status --porcelain | grep -cE '^ M'
10
```

（任务书快照 11 项；差异＝`docs/design/00_上手须知_START_HERE.md` 已由本班 a3-003 于提交 02de418 入库，快照漂移如实注记。另有 `??` 30+ 项未在本单范围。）

## 二、逐项归属表（10 行＝M 项数）

| 路径 | 增删 | 最后触及提交 | 归属判定 | 证据 |
|---|---|---|---|---|
| docs/design/OPTIMIZATION_BACKLOG.md | +5/-5 | 044bc21 第 2 轮记录 | BACKLOG 轮次勾选跟随（用户改动域） | 任务书自注「该文件当前已是工作树 M 状态，属用户改动」 |
| src/renderer/data/artManifest.ts | +2/-14 | 394a19a h912-11 批次一 | h912-11 批次一遗留（TERRAIN_ART 缩减 3 型＋注释） | 最后提交即 h912-11；差集形态与批次一口径一致 |
| src/renderer/data/__tests__/artManifest.test.ts | +6/-5 | 6f7a4c9 B3 加工链 | h912-11 批次一测试跟随 | 同族断言更新 |
| src/renderer/data/__tests__/bootLoadList.test.ts | +52 | 394a19a h912-11 批次一 | h912-11 派生加载测试 | 最后提交即 h912-11 |
| src/renderer/render/MapRenderer.ts | +4/-3 | 0d39a4b P1-6 cameraMath | P1-6 相机数学抽取跟随 | 最后提交即 P1-6 |
| src/renderer/state/gameStore.ts | +24/-6 | 34d13d3 P2 故事全流程无头试玩 | P2 验收族 | 最后提交即 P2 验收 |
| src/renderer/state/__tests__/saveGuard2.test.ts | +4/-2 | e56d82a p911r-40 saveGuard2 加固 | p911r-40 测试加固 | 最后提交即 p911r-40 |
| src/renderer/state/__tests__/saveGuard3.test.ts | +1/-2 | e56d82a p911r-40 | 同上 | 同上 |
| src/renderer/state/__tests__/saveLoad.test.ts | +49 | 589ddf2 P2 通牒压力系统 | P2 测试（存档 v9） | 最后提交即 P2 |
| src/renderer/ui/BuildPanel.ts | +2/-1 | e18672d P2-4 色板铁律 | P2-4 跟随 | 最后提交即 P2-4 |

## 三、提交就绪度（npm.cmd run verify）

```
$ npm.cmd run verify
（type-check + vitest）Tests 1145 passed (1145)   → verify_exit=0
```

## 四、两栏结论

- **可立即提交**：artManifest.ts＋artManifest.test.ts＋bootLoadList.test.ts（h912-11 资产族，建议一笔）；MapRenderer.ts（P1-6 跟随）；gameStore.ts＋saveLoad.test.ts（P2 族）；saveGuard2/3.test.ts（p911r-40）；BuildPanel.ts（P2-4）——verify 1145 全绿，改动均为已验收任务的收尾。
- **需日间拍板**：OPTIMIZATION_BACKLOG.md（用户改动域，提交时机由用户定）。

## 五、零改动自证

本单零提交/零 add/零 stash/零 checkout/零文件改动；`git status --porcelain` 开工前后一致。不 push。

## 六、验收对照

- ✅ M 项数 10＝本单范围（差异来源注明：START_HERE 已由 a3-003 入库）。
- ✅ 归属表 10 行＝M 项数，每行含增删/最后提交/归属+证据。
- ✅ verify 命令、退出码 0、Tests 1145 同段。
- ✅ 两栏结论非空。
