# colony package.json scripts 与文档一致性核对（c918-28 / 只读，零改动）

> 2026-09-19｜执行班 sweep-20260918-2300。

## 全表
- package.json scripts 实有 **27 键**（test/verify/build/dev/start/electron:build:win/type-check/gen-icon/pack-sprites/postprocess-png/backup 系/audit 系/repair 系等）。
- 文档引用（`npm run X` 形态，docs/**/*.md 全扫）：**26 个引用键**，分布在 decisions/design/insights/upgrade 各文档。

## 对照结论
- **过期引用＝0**：初扫报「missing」的条目（如 `type-check\`：零错误。`、`electron:build:win\``、`build\``）全是正则把反引号/标点后缀并入了命令名——剥离装饰字符后全部命中实存 scripts 键（type-check/electron:build:win/verify/build/test）。**文档引用的 npm 命令无一悬空**。
- scripts 中未被文档引用的 7 键：build/preview/electron:build/gen-icon/pack-sprites/postprocess-png/test——均为工程内部键（构建/图标/贴图后处理），不入文档属正常；其中 `test` 引用形态为 `npm.cmd test`/`npm test`（不带 run），已被单独 grep 覆盖。

## 抽验
- `npm run verify`（本班 c918-27 已跑）→ EXIT=0 ✓ 与文档「verify = type-check + test」描述一致。
- `npm test`（本班多次）→ 105-107 文件全绿 ✓。

## 遗留问题
- 无过期引用。可选改进：START_HERE 增列「常用 scripts 速查」（gen-icon/pack-sprites 等内部键目前仅 package.json 可查）。
