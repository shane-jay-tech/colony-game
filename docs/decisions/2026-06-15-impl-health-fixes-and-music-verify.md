# 2026-06-15 /implement — 邦国录健康修复（type-check 归零 + 渲染解耦 + 门控 + 文档同步）

## 触发
承接当日 /review 体检（见 2026-06-15-review-project-health-check.md）。用户要求把"必修+建议修+可不修"全部修掉。

## 改了什么（全部已验证：type-check 0 错 / 901 测试绿 / 生产构建 OK）

### 必修
1. **3 个生产代码 type 错误**
   - `schema.ts`：`BuildingTier` `1|2|3` → **`1|2|3|4`**（禁军府/太庙/九鼎本就是 tier:4，原类型漏了；唯一消费点 `MapRenderer def.tier>=3` 金边、`gameStore tier:def.tier` 拷贝，无穷举 switch，扩 union 安全）。
   - `seasonSystem.ts:makeSeasonModifier` 补 `visualBadge: null`（ModifierInstance 必填）。
   - `breathingSystem.ts` 两处 `const pick=pool[...]` 后加 `if(!pick) return {entry:null,reason:'no_match'}`（满足 noUncheckedIndexedAccess）。
2. **31 个 test fixture 类型债清零**：populationClass.test（坏掉的 newStore 泛型签名改回 `Record<string,unknown>` + `[0]!`）、generals.test（数组下标 `[n]!`）、eventTempo.test（npc fixture 字段过时 → 新建 `npc()` helper 给全 NpcCountryState 默认值）、resourceSystem.test（makeState 补 populationClasses/conversionQueue/grainNegativeDays/factionState/megaProjects/exclusivePolicies）、seasonSystem.test（fakeModifier 补 visualBadge + `[0]!`）。
3. **type-check 提交门控**：`package.json` 加 `verify` 脚本（type-check && test）；新增 git `pre-commit` 钩子（type-check + test 红则拦截提交）。修复了"vitest 走 esbuild 不做类型检查 → 测试绿对类型安全零背书"的铁律漏洞。

### 建议修
4. **音乐 A-1：核实为【早已接好，非静音】** —— AudioManager(已在 UIScene 实例化) + audioDirector(动态选曲) + BootScene(preload ALL_BGM_KEYS) + public/audio/ 9 首 BGM + 6 音效全在。**Kimi 上一轮"音乐仍静音/A-1 未接入"是误判**（它只读 decisions 文档、没读代码，"无归档=没做"的推断错了）。无需改代码，补本归档即是其缺失的记录。
5. **文档同步**：`00_上手须知_START_HERE.md` 更新 501→900+ 测试、v1.0→v0.8.0、建筑20→32、事件~14→40+、状态速览整段重写（国格阶梯/动态邻国/故事/手感/引导/音乐 由 🔴 改 🟢，🔴 仅留"从没真人 playtest"+美术稀缺）。

### 可不修（也修了）
6. **F-06 rerenderBuildings 双池解耦**：buildingImages 从共用 per-building 的 `sigilIdx` 改为独立 `imgIdx`（仅 hasSprite 时自增）。修掉"有图/无图建筑交错时 buildingImages push 增长却按 sigilIdx 索引→错位"的潜伏 bug。MapRenderer 41 测试仍绿。

### 判定为误报 / 不改
7. **F-05（rebuildAfterResize 漏 bakeScatter/bakeTerrainTexture）= 误报**。`recenter()`(1028/1030行) 已在每次 resize 按 dx/dy 平移 scatterImages 与 terrainTexLayers，设计是"烘焙一次+recenter平移"。若按原建议加 bakeScatter 反而会重随机散布、浪费热路径。DeepSeek 复审确认此"不改"判断正确。

## DeepSeek 复审（高风险 diff 复查，命中 CLAUDE.md 新规）—— 抓到 1 个我漏的 BLOCKER
- **`saveLoad.ts:541` `VALID_BUILDING_TIER = new Set([1,2,3])` 未含 4**：类型系统抓不到的运行期白名单。建了 tier:4 建筑后**读档校验抛 SaveLoadError、存档加载失败**。已修为 `[1,2,3,4]`，并补回归测试 `saveLoad.test.ts: 'tier 4 building passes deserialize'`（测试数 900→901）。
- 其余 3 处改动（visualBadge / pick 守卫 / imgIdx 解耦）DeepSeek 确认无回归；F-05 不改判断确认正确。

## 验证
- `npm run type-check`：0 错误。
- `npm test`：901 passed / 56 files。
- `npm run build`（electron-vite）：OK（8.58s）。
- 未跑 `electron:build:win` 全量打包（耗时长，交互流程跳过）；未提交（工作区有大量他人未提交 WIP，只动了本次相关文件）。

## 未做（需用户/真人）
- **真人 playtest**（最大暗雷）：我无法替玩，仍待用户安排 2-4h 自测。
- electron:win 全量打包 .exe（铁律要求每次落地后做，建议用户在本机跑一次 `npm run electron:build:win`）。

## 反方 / 残留风险
- 改动虽小但触及类型契约(BuildingTier)与渲染热路径；已用 type-check+901测试+构建+DeepSeek复审四重把关，但渲染的真实视觉表现仍需真人开图确认（自动化测不到像素）。
- 未提交：本次改动与既有 WIP 混在工作区，建议用户自行 review 后挑拣提交。

## 置信度：高
四重验证全过 + 独立复审抓到并修掉了类型系统盲区的 saveLoad BLOCKER。唯一无法自动覆盖的是渲染视觉与"好不好玩"，需真人。
