# learning / colony 离线构建与依赖可复现性核对（c-48，2026-09-13）

| 仓 | 锁文件 | 依赖目录 | 验证命令 | 退出码 | 结果 | PLAN 基线 | 差异 |
|---|---|---|---|---|---|---|---|
| learning-system | 无 package.json/lock（Python 系：pytest 直跑，无 pip freeze 锁定文件在仓） | 无 node_modules；无 .venv（用系统 python） | `python -m pytest -q` | 0 | **349 passed, 7 skipped**（Rscript 缺装跳过 1+6） | plan.md:33 记 304 passed/7 skipped | **+45 passed**（9/12–13 工效修复批/学习曲线新增用例所致，正向漂移） |
| colony-game | package-lock.json ✓ | node_modules ✓ | `npm test`（vitest） | 0 | **86 文件 / 1120 passed, 0 failed**（20.5s） | PLAN 工作项 1 记 1120+ tests | **一致（1120=1120）** |

## 结论

- 两仓离线验证全绿、可复现：learning 无第三方运行时依赖风险（纯标准库+pytest），colony 依赖目录完整、锁文件在位；
- 缺装项：learning 的 Rscript（跳过 7 条，既有已知）；g++ 未核（learning plan 注记同类跳过）；
- learning 基线 304→349 属测试数自然增长（本班 a-37/38 等同类改动在 quant；learning 增量来自 9/12-13 学习曲线批），非回归；
- 全程无联网、无安装 ✓。
