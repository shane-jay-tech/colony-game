# 事件转发统一设计裁决材料单（c1025-04 · 2026-10-25）

> 性质：**材料供拍板**（零改码）。拍板现值注记：**D1025-nod #8 已按推荐落「域回调注册表」**（docs/decisions/2026-10-25-gen1025-14decisions.md）——本单为该裁决的对照材料与实施前置盘点，非重新裁决。
> 矿源：gameStore.ts 现值（story 三批 c1025-01..03 收官后）；历史参考 outbox/c1023-05.result.md（未消化，非派生依据）。

## 0. 现值盘点（2026-10-25 实测）

| 项 | 读数 | 复现 |
|---|---|---|
| gameStore 内 emitter.emit 调用点 | **73 处** | `rg -c "emitter.emit" src/renderer/state/gameStore.ts` |
| 事件种类（STATE_EVENTS 键） | **55 种** | `rg -o "STATE_EVENTS\.[A-Z_]+" -N \| sort -u \| wc -l` |
| 消费面文件数（scenes/ui/tests） | **53 个** | `rg -l "STATE_EVENTS\." --glob "!gameStore.ts" --glob "!stateEvents.ts"` |
| domains/ 内 emit | **0**（六域全经 io 回调归位 store） | `rg -c "emitter.emit" src/renderer/state/domains/*.ts` |
| 高频事件 top5 | RESOURCES_CHANGED×5 / PAUSED_CHANGED×3 / MODIFIER_REMOVED×3 / GENERALS_CHANGED×3 / EXPEDITION_RESOLVED×3 | uniq -c 排序 |

现行形态：**单一 emitter（EventEmitter3）＋字符串事件表（stateEvents.ts）＋ scenes/ui 直接订阅**；六域外迁后所有 emit 集中回 gameStore 薄委托层（io 回调闭包内）——跨域副作用面的「事件转发」事实上已收敛为「域经 io 回调 → store 单点 emit → UI 订阅」三段式。

## 1. 两案设计

### A 案：事件总线（EventBus 中央总线）

各域/system 直接持总线引用，发事件不经 GameStore：`bus.emit('resourcesChanged', payload)`；订阅方（UI/场景/跨 system）从总线订阅。GameStore 降级为普通发布者之一。

- 结构：新增 `src/renderer/state/eventBus.ts`（单例或注入）；STATE_EVENTS 表迁总线；domain 的 io 回调从「闭包回 store」改为「闭包直发总线」。
- 变更面：73 emit 点改址、53 消费文件订阅改址、gameStore 与场景间 emitter 传递链解耦。

### B 案：域回调注册表（Domain Callback Registry）——**拍板现值（D1025-nod #8）**

保持「域零 emit、副作用经 io 回调归位 store」的现行模式，把它**制度化为注册表**：每个 domain 声明其副作用接口（现有 *Io 接口族即注册项），GameStore 构造时集中装配回调表（一处注册、逐域注入）；emit 仍由 store 单点执行，事件表不变。

- 结构：`domains/registry.ts`（或 gameStore 内装配函数）集中六域 io 装配；io 接口签名已是事实标准（六域 11 个 Io 接口）。
- 变更面：零行为变更——把六批拆分中已散落在各薄委托内的闭包装配收敛为单一注册点。

## 2. 利弊对照

| 维度 | A 事件总线 | B 域回调注册表（拍板现值） |
|---|---|---|
| 行为保真 | 73 emit 改址，次序风险面大（本批 c1025-03 刚实证 EventModal 在回调内读 state 的次序敏感面） | **零行为变更**（现行模式的制度化） |
| 跨域通信能力 | 强（任意订阅者解耦通信，新系统接入零改 store） | 弱（域间通信仍需经 store 编排——但这正是「拆逻辑不拆容器」约束的刻意设计） |
| 追踪性 | 事件流难追（谁发了什么需全库扫总线 emit） | **单点 emit 可断点**（store 一处日志/断点即全量事件面） |
| 与 c1011-13 存档约束契合 | 中（域拿总线引用＝域有运行时依赖，测试面要 mock 总线） | **高**（域纯函数＋io 注入，六域 35 个直测已验证可测性） |
| 改造成本 | 73+53 文件两线改址，估 **8-12 个执行单**（含回归） | 装配收敛一处，估 **1-2 个执行单** |
| 风险 | 事件风暴/循环发布需另建防护；ad32 枚举序门禁面扩（新 emit 点分布） | 无新增风险面（注册表纯装配收敛） |
| 扩展性天花板 | 高（百事件级、多发布者场景） | 中（单 store 编排上限 ~百 emit 点；现值 73 在界内） |

## 3. 迁移成本估算（B 案实施面，供后续施工单参考）

1. registry 装配函数抽取：六域 io 闭包现散在 14 个薄委托内，收敛为 1 个装配模块（~150 行新增，gameStore 等量减行）；
2. 逐域搬移装配不改签名：六步各配域直测回归（现有 35 直测＋全量 2031 基线）；
3. 文档回写：stateEvents.ts 头注与 PLAN#3 域边界条款（c1011-12）补「注册表」口径；
4. 合计估 2 个执行单（装配收敛 1＋文档与门禁校验 1），零行为变更门：全量绿＋GameState 接口块逐行比对。

## 4. 结论（材料，非裁决）

B 案与拍板现值一致；A 案的高扩展性在当前规模（55 事件/73 emit 点/53 消费文件）未构成刚需，且与本工作区「拆逻辑不拆容器＋行为逐字保真」的拆分纪律冲突面最大。若未来事件规模破 150 种或引入第二发布源（如 worker 进程），再立 A 案复议。
