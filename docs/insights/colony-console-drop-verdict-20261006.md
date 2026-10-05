# console 剥离方案材料（c1004-14，2026-10-06，只读）

- **现值订正**：任务书「包内 16 处」实测：src 生产面（非测试）**21 处**（main 6/preload 1/renderer 14）；测试面另有 15 处（esbuild drop 不触及 tests 的 vitest 运行，无影响）。electron.vite.config.ts 三 build 段（main/preload/renderer）**现均无 esbuild drop 配置**（renderer.build 只有 outDir/assetsInlineLimit/manualChunks）。

## 生产面 21 处分布清单

| 文件 | error | warn | debug | 说明 |
|---|---|---|---|---|
| main/index.ts | 3（render gone/crash limit/child gone） | 3（D 盘 fallback×1/unresponsive 等） | 0 | **fallback 告警族所在**（:28 D 盘回退 warn——c1004-13 交叉面） |
| preload/index.ts | 1（contextBridge FATAL） | 0 | 0 | 致命初始化错误 |
| renderer/main.ts | 1（[CRASH]） | 0 | 0 | 渲染崩溃转发 |
| render/MapRenderer.ts | 2 | 1 | 0 | 越界跳过/未知资源统计 |
| render/mapColors.ts | 0 | 2 | 0 | 未知 terrain/node |
| scenes/BootScene.ts | 2 | 1 | **1**（sprite missing 刻意 debug 不污染 error——:35 注释明示） | 静态校验 |
| scenes/GameScene.ts | 2 | 0 | 0 | modifier 未标注/store 缺失 |
| scenes/UIScene.ts | 1 | 0 | 0 | 同上 |
| state/buildMode.ts | 1 | 0 | 0 | listener 抛错 |

## 两案对照

### 案 全 drop（esbuild: { drop: ['console'] } 三段全配）

- asar 验证：`npx asar extract-file win-unpacked/resources/app.asar out/main.js && grep -c "console\." out/main.js` → 预期 **0**（renderer 同理对 dist/assets/*.js）。
- **代价**：main/index.ts:28 的 **D 盘 fallback warn 被剥**——用户在无 D 盘机器上失去「存档落 APPDATA」的唯一告知（c1004-13 交叉面：fallback 发生时用户不知道档在哪）；crash/child-gone 的 error 也被剥（进程级排障失明）。
- 红名单：BootScene.runtime-error.test 若断言 console 调用（esbuild drop 不影响 vitest——vitest 不走 electron.vite build ⇒ **测试零红**）；但运行时可观测性全灭。

### 案 只 drop log/debug（drop: ['log','debug']）

- asar 验证同命令：预期 console.log/debug=0、**console.warn/error 保留**（fallback 告警+崩溃族存活）。
- 盘面实数：生产面 log **0 处**、debug **1 处**（BootScene sprite missing——本就刻意降级）⇒ 本案**实际剥除量=1 行**，其余 20 处 warn/error 全保留。
- 红名单：零（无测试钉 debug；BootScene:35 注释与 drop 语义一致）。

## 建议

**只 drop log/debug**——当前生产面本就纪律良好（0 log/1 debug/20 warn-error 全是有意告警），全 drop 会把 D 盘 fallback 与崩溃族一起灭掉（负收益）；顺带登记：drop 配置落地时 BootScene:35 注释补一句「构建期 debug 被 drop，开发期可见」。
