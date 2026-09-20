# colony P4-3 终检预演：verify + build 证据（c918-27）

> 2026-09-19 05:1x｜执行班 sweep-20260918-2300｜只读预演（verify+build，零改动）。
> ⚠️ 在途 M 文件 8 项（含 gameStore.ts/saveLoad.ts 等，见 c918-12 归属表）在验证树内——本预演结论＝「含在途改动的当前树」状态。

## 一、verify（type-check + 全量测试）
- `npm run verify` → **EXIT=0**。
- type-check：0 错误（含在途 M 文件 gameStore.ts/saveLoad.ts 等）。
- 全量测试：**107 文件 / 1208 tests 全绿**（含本班新增 snapshot/guard 用例）。
- 判定：**绿**——在途 M 改动未破坏类型与测试。

## 二、build（electron-vite build）
- `npm run build` → **EXIT=0**，✓ built in 5.04s。
- 产物：dist/renderer/index.html 2.00 kB；assets/index-*.js 726.80 kB；assets/phaser-*.js 6,777.62 kB（Phaser 体积为主，正常）。

## 三、终检剩余项（「可分发包」前还需）
1. 在途 M 文件 8 项的归属会话收口并提交（c918-12 归属表：gameStore/saveLoad/saveGuard×2/saveLoad.test/BuildPanel/MapRenderer/BACKLOG）。
2. 一轮完整人工走查（机器侧不可替代）：开新局→立邦→首日→建造→调速→存读档。
3. 可分发包成型：dist 产物 + 版本号/清单（复用 T45 manifest 口径）+ 回滚说明。
4. verify 中已有 0 失败——此前「stats data_version 疑时敏」失败本日未再复现（kaoyan 仓数字，colony 无此件；两仓口径勿混）。

## 差距清单（归）
- 无机器侧失败项（verify/build 双绿）；差距全在人工走查与在途收口两项，均非机器可代。
