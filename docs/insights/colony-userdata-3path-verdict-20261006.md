# 包内本机绝对路径三案裁决材料（c1004-13，2026-10-06，只读）

- 承 b461 遗留 2。**现值**：src/main/index.ts:6-8 三常量（D_DRIVE_USER_DATA/TEMP/LOGS = `D:/colony-game/user-data*`）＋:21-26 setPath 六路（userData/temp/logs/crashDumps/cache/sessionData 全指 D 盘）＋:11-30 ensureDDrivePaths（D 盘试挂失败 fallback %APPDATA% 邦国录＋console.warn）。**注释意图逐字**：「用户硬性要求 D 盘存储；但极个别 Windows 环境无 D 盘（笔记本单 SSD）…fallback」——即 D 盘是**产品需求**（DeepSeek 二审 major F1 已确认并补 fallback）。
- 差异注：c1002-17 订正文档死路径，本单裁**运行时 userData 落点**（不同面）。

## 三案对照（矿源候选，各带 commit 行数与跨玩家档风险）

| 案 | 做法 | commit 行数 | 对「D 盘硬性要求」注释意图 | 跨玩家档风险 |
|---|---|---|---|---|
| (a) app.getPath(appData) 显式覆盖 | 三常量换 `join(app.getPath('appData'), '邦国录')` | ~3 行 | **违背**——D 盘需求被静默改为 APPDATA（注释与实现立即矛盾，须同笔改注释） | 低（APPDATA 本就按用户隔离） |
| (b) 加用户命名空间 | `D:/colony-game/user-data/<os.userInfo().username>` | 2-3 行 | **符合**（仍 D 盘，只是加层） | 中——**正是本案要解的「跨玩家档」形态**：多玩家共机时存档互相可见/覆盖；username 含中文/特殊字符时 mkdir 与路径长度需验证；**同一玩家换 Windows 账号名即「丢档」**（视角上） |
| (c) --user-data-dir 设置项覆盖 | CLI switch 或设置 UI | ~15-30 行（含 UI/文档） | 符合（D 盘仍默认） | 低（默认不变，高级玩家自选）；属新功能 |

## 评估与建议

- **b461 遗留 2 的真实痛点**=「包内本机绝对路径」对**多玩家共机/换机**不友好。本产品为单玩家桌面（README 信任模型单人），共机场景=家庭共享——(b) 的 username 层正是解此。
- **推荐 (b)**：最小行数满足注释意图＋解决共机；**前置验证**：`os.userInfo().username` 在中文用户名（常见）下 mkdir 的编码路径——Windows Node 处理 Unicode 路径成熟，风险低，但落码单须含一个中文用户名形态的 mkdir 冒烟。
- (a) 违背硬性需求直接排除；(c) 价值/成本比最低，留作远期。
- 红名单：无既有例钉 D 盘路径字面量（`rg -n "D:/colony-game" tests/` 现取 0——路径常量无测试锚），落码单红名单近零。

## 零码改自证

rg/sed 读码；src/main 零触碰。
