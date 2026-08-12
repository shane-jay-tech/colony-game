# 2026-06-15 /review — 邦国录项目整体健康/进度体检

## 触发
用户要求"用协作系统检查邦国录现在的情况"。Opus 先采客观证据，再派 DeepSeek(代码健康)+Kimi(进度对照)双维审查，综合成状态报告。模式 quick。health_check 三方全绿。

## 客观证据（Opus 实测）
- 版本 v0.8.0；~157 源文件 / ~30K LOC；Electron+TS+Phaser；有 git、56 测试文件。
- **vitest：900 测试 / 56 文件 全绿（3.85s）。**
- **`npm run type-check`：红**（exit 2，约 40 处错误跨 ~10 文件；含源码错误）。
- 近期 git：等距(isometric)地图渲染重做 + 多轮 playtest 反馈修 resize 崩溃。

## DeepSeek（代码健康，Verdict: do-not-ship）—— finding 要点
- **F-01 BLOCKER** `seasonSystem.ts:62` 季节 modifier 缺 `visualBadge`（每30天高频路径，若 validateModifierInstance 严格会运行期报错/徽章渲染错）。修：`visualBadge: null`。
- **F-02 BLOCKER** `breathingSystem.ts:106/107/125/126` `pick` 可能 undefined + undefined/null 合约违反 → 呼吸提示可能静默失效。修：`if(!pick) return {entry:null,...}`。
- **F-03 BLOCKER** `buildings.ts:538/610/664` tier:4 超出 `BuildingTier=1|2|3` → tier 穷举/金边渲染/存档校验隐患。修：扩 BuildingTier 或降 tier。
- **F-04 MAJOR（结构性）** vitest 走 esbuild 不做类型检查 → "900 测试绿"对类型安全零背书，3 个 BLOCKER 可在测试不挂的情况下合入。**铁律"测试绿+type-check"名存实亡。修：把 `type-check` 设为提交/CI 必过门控（最高优先，1小时）。**
- **F-05 MAJOR** `MapRenderer.ts:375-391` rebuildAfterResize 漏重烘焙 scatter/terrainTexture → resize 后树/贴图错位（resize 崩溃家族未关全）。
- F-06 MODERATE rerenderBuildings sigil/image 双池共享计数器，扩展易错位。
- F-07 ~30 条 test fixture 类型债（接口演进未同步 fixture）。
- 判断：**能跑，但不宜继续叠功能，须先还债。** 最该先修 3 件：CI 门控 → 3 个生产 type 错误 → resize 散布层。

## Kimi（进度对照路线图）
- **项目已大幅领先(过时的)文档**：Phase A-E 多数数据层已落地；国格阶梯/动态邻国/故事模式(七卷23事件+56报文)/手感(散布/季节/呼吸历史官)/引导 —— START_HERE 仍标 🔴 但**实际已完成**。
- **最大暗雷"从没 playtest"仍未解、且被持续延后**：decisions 无任何真人试玩记录；"待试玩校准"清单在涨。
- **音乐仍静音(A-1 未接入)**：9 首 BGM 已用 Mureka 生成，但接入游戏代码不见 → 单项最大体验缺口。
- **核心模式风险**："系统大爆炸 + 可玩性从未验证"——加系统飞快，没验证好不好玩。
- **文档严重脱节**：501 vs 900 测试、v1.0 vs v0.8.0、建筑 20 vs 32、事件 ~14 vs 40+、状态速览整段过时。

## Opus 综合仲裁 —— 状态结论
邦国录现在是**"骨架与内容都很厚、但从没被真人玩过、且刚触了自己的质量铁律(type-check 红)"**的状态。两条线指向同一判断：**先还债 + 先 playtest，别再叠系统**。

三档清单：
- **必修**：① type-check 设为必过门控(否则铁律失效)；② 修 3 个 BLOCKER 生产 type 错误(visualBadge/pick/tier4)；③ resize 散布层重烘焙。
- **建议修**：④ 接入音乐(A-1，BGM已就绪)；⑤ 安排一次 2-4h 沙盒自测 playtest，按"待试玩校准"清单记录；⑥ 清 test fixture 类型债。
- **可不修(暂)**：rerenderBuildings 双池耦合(F-06，下次大改渲染前处理)；文档同步(START_HERE/9.1 状态/版本/测试数)——重要但不阻塞运行。

## 风险 / 反方 / 置信度
- 风险：(a) type-check 红说明已有真实类型漏洞被测试绿掩盖；(b) 可玩性零验证，继续叠系统会让校准债爆炸。
- 反方：也可认为"趁手熟先把内容铺完再统一 playtest+还债"，但 DeepSeek/Kimi 一致反对——验证越晚返工越贵。
- 置信度：高(测试/type-check 实测；进度据 decisions 与设计稿交叉验证)。不确定项：type-check 全量错误条数(我截屏只见末尾12条，DeepSeek 复跑约40)、音乐 A-1 是否真未接入(decisions 无记录但不排除未归档)。

## 给用户的摘要
见对话。
