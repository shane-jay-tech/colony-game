# 邦国录 · 接手开发者上手须知（START HERE）

> 你接手的是一款**春秋立国题材的策略经营游戏**（Electron + TypeScript + Phaser）。
> 当前 = v1.0，一个**能跑、501 测试绿的机械骨架**；完整愿景在设计稿里，绝大部分待你落地。
> 先花 30 分钟读完本页，再动手。

---

## 1. 先读什么（按顺序）

1. **本页**（上手须知）。
2. **`docs/design/GAME_DESIGN_LIFECYCLE.md`** ← **设计圣经，最重要**。10 节玩法 + 1 节非玩法质量，带文件路径锚点、验收标准、4 期路线图。
   - 第 0 节有"给实现 agent 的说明"；第 9.1 节是"v1.0 已有 vs 待建"的**完成度差距地图**（先看这个建立全局认知）；第 10 节是**分期路线图（从这开干）**。
3. **`docs/design/_tianxiaren_source.md`** = 故事模式剧本源（小说《天下人书记》七卷），故事内容直接取材于此。
4. **`docs/decisions/`** = 历次决策/团队压测归档（想知道"为什么这么定"时查）。
5. 根目录 **`CLAUDE.md`**（如有）= 协作与项目规则。

---

## 2. 怎么跑起来

```bash
npm install            # 装依赖
npm run dev            # 开发模式（electron-vite，热更新）
npm test               # 跑测试（vitest，501 条必须全绿）
npm run type-check     # TS 类型检查
npm run electron:build:win   # 打包 Windows 桌面 exe → dist-out/win-unpacked/邦国录.exe
```

技术栈：Phaser 3.70（游戏渲染）/ Electron 28 / electron-vite / TypeScript。
源码在 `src/`（`main` 主进程 / `preload` / `renderer` 游戏本体）。

---

## 3. 铁律（不可违反，违反必被打回）

1. **501 测试不破**：改完跑 `npm test` 全绿；新功能补测试。
2. **每次代码落地后**跑 `npm run electron:build:win`，让 `D:\colony-game\dist-out\win-unpacked\邦国录.exe` 始终最新（桌面 .lnk 不用改）。
3. **文案半文半白**：保留古典韵味但**禁偏字**——玉圭/卿大夫/贵胄/弑/无嗣/耒耜/王畿/方伯/泗水/海岱 等一律不用，非历史专业玩家要一遍看懂。
4. **地图无格线**：渲染层必须像《纪元 1800》，底层可方格但视觉上**完全无格线**（已明确否决"小作坊"程序化色块）。
5. **美术质量基线**：单看一帧不能让人判断成简陋小作坊（参照纪元气质）。生成管线见 `D:\code\scripts\gen_wanxiang_batch.py`（通义万相 wan2.7-image-pro，1664²，春秋校正 prompt）。
6. **Windows 编码**：`.bat` 必须 GBK + CRLF（UTF-8/LF 会崩中文）；**console 输出禁 emoji**（GBK 码页不支持，用 ASCII 标记，emoji 只放 markdown）。
7. **删缓存/二进制目录前先 grep tests/scripts/CI**（运行时依赖常只在测试出现）。

---

## 4. 当前状态速览（详见设计稿 9.1）

- 🟢 **已跑通**：资源/建筑(20)/国策(23)/朝令(12)/事件(~14)/邦交(3 NPC)/存档，501 测试。
- 🟢 **存档扎实**：`saveLoad.ts` 有版本号 + 迁移 + 校验，8h 地基稳。
- 🟢 **美术方向对**：3-4 栋建筑 baseline 质量好（民居/兵营/祖庙），但仅约 10-15% 覆盖，其余建筑是占位。
- 🔴 **几乎全待建**：国格阶梯、动态邻国、8h 重平衡、整个故事模式、音乐(全静音)、手感(世界全静止)、引导(仅3步)。
- 🔴 **最大暗雷**：从没 playtest，"好不好玩"未验证。

---

## 5. 从哪开始（路线图 Phase 1 · 沙盒先行）

按设计稿第 10 节，**先做出"能玩的 8 小时沙盒切片"尽早 playtest**：
国格阶梯系统 → 8h 经济重平衡 → NPC 动态成长 → 失败模型重写（去肉鸽，见第 7 节）→ 模式选择外壳。
验收：能从聚落爬到天下共主、8h 不崩盘不无聊、501 测试适配后全绿。

> 故事模式 / 音乐 / 美术大批量都排在后面的 Phase，别一上来全吃。

---

## 6. 关键文件地图

| 要改什么 | 去哪 |
|---|---|
| 资源/Modifier 注册 | `src/renderer/data/resourceRegistry.ts` |
| 建筑 / 国策 / 朝令 / 事件 / 邦交 / 失败 | `src/renderer/data/{buildings,policies,decrees,events,npcCountries,defeat}.ts` |
| 核心循环/状态/各 System | `src/renderer/state/`（gameStore/timeSystem/*System.ts） |
| 渲染 / 场景 / UI | `src/renderer/{render,scenes,ui}/` |
| 美术资产 | `public/art/`、`art-library/` |
| 音乐生成脚本 | `scripts/gen_music.py`（已验证可用） |

---

## 7. 外部服务 / 密钥

- **音乐 = Mureka**（昆仑万维 `api.mureka.cn`，国内支付）。key 在 **`.env.local` 的 `MUREKA_API_KEY`**（已 gitignore，勿提交）。
  - 生成：`POST /v1/instrumental/generate`；查询：`GET /v1/instrumental/query/{id}`；脚本 `scripts/gen_music.py`。
  - 商用授权 ✓；**水印在音频尾部**（合规标识，**别强删**）——循环 BGM 设循环点避开结尾即可，玩家听不到。
  - 曲目清单见设计稿 11.A.1。
- **音效 = Freesound.org**（免费 CC 素材）；**公版古曲**打底。

---

**一句话**：读 `GAME_DESIGN_LIFECYCLE.md`（尤其 9.1 差距地图 + 第 10 节路线图）→ 守住第 3 节铁律 → 从 Phase 1 沙盒切片动手 → 尽早 playtest。
