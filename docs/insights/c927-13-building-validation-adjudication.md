# c927-13 buildings 校验缺口裁决材料：defId 不验注册 / 坐标不验界内 → 建筑静默消失

> 来源：`zcode-bridge/done/20260925-120444-913e.result.md` 遗留 1；与 c927-10 裁决台 R-2 条同根，本档补齐该条缺的「实证样例＋风险量化＋最小实现草案」。
> 复核基线：HEAD `8a9eaea`（2026-09-28）。**零码改动**——复现件全部落在 `tmp/c927-13/`（`.gitignore:25` 覆盖），仓库足迹零。

## 1. 样例档与复现（完成标准①）

### 1.1 现状代码锚点（复测，与 913e 一致）

- `src/renderer/state/saveLoad.ts:762` `validateBuildingsArray`：只验 defId **非空串**、position **整数**、status 枚举、tier 1–4、progress 有限、modifiers 串数组；**不查** `BUILDING_REGISTRY.has(defId)`，**不查** 界内性。
- `src/renderer/render/MapRenderer.ts:675`（复测 ：1058 第二处仍在）：`const def = getBuildingDef(b.defId); if (!def) continue;` —— 查无即静默跳过，无日志无计数。

### 1.2 复现件（tmp，gitignored）

| 件 | 路径 |
|---|---|
| 复现测试 | `tmp/c927-13/repro.test.ts`（五断言，见 1.3） |
| 临时 vitest 配置 | `tmp/c927-13/vitest.c92713.config.ts`（root 指回仓根，include 只放行本目录——根配置 `vitest.config.ts:18` 锁死 `src/**`，不覆写跑不到 tmp） |
| 样例档 | 由复现件现场生成：`new GameStore(ee)` 默认档 → `serialize()` → 深拷贝后向 `state.buildings` 注入两条毒条目（**存档形状全部合法**，只踩未校验维度）。毒①`defId:'ghost_hut'`（注册表查无）；毒②`defId:'bld_farm'`（真 id）＋`position:{x:9999,y:9999}`（整数、远界外——地图 80×80） |

> 「存得下」腿说明：以 `serialize()` 产物为存档本体（与 `saveToSlot` 写盘前的字节同源）；不落真实用户目录文件（A 档红线，`atomicSaveCrash.test.ts:8` 同口径）。

### 1.3 复现命令与读数（实跑）

```
$ npx vitest run --config tmp/c927-13/vitest.c92713.config.ts
✓ tmp/c927-13/repro.test.ts (1 test) 21ms
Test Files  1 passed (1)   Tests  1 passed (1)
```

五断言全中，即「存得下、读得回、但建筑静默消失」实证成立：

| # | 断言 | 读数 |
|---|---|---|
| A | `deserialize(毒档)` **不抛** | 校验全放行（不拒载） |
| B | 读得回 | `out.buildings` 长度 2，`ghost_hut`/`x:9999` 原样渗透 |
| C | 渲染器视角 | `getBuildingDef('ghost_hut') === undefined` ⇒ `MapRenderer:675` 将 `continue`（**静默不画**） |
| D | 界外不拦 | `worldMap.width/height`（80）< 9999，校验面无界内检查 |
| E | 对照组 | `getBuildingDef('bld_farm')` 正常返回 ⇒ 同档一画一吞，玩家只见「农场不见了」 |

## 2. 两案影响清单（完成标准②）

### 案① 校验侧：`validateBuildingsArray` 加「注册表可解析＋界内」两条，违者 `SaveLoadError` 拒载

| 影响面 | 读数/分析 |
|---|---|
| 老档「能读→拒读」风险量化 | **合法档误伤面 ≈ 0**：①迁移链 v1→v9 八步（`saveLoad.ts` MIGRATIONS 1–8）**无一触碰 buildings/defId**，建筑 id 从未改名；②`DEFAULT_MAP_SIZE` 自初版提交（15769cb）从未变更，不存在「地图缩界甩出老建筑」；③建筑只能经 UI/registry 产生，正常游玩不可能写出未注册 defId。⇒ 拒载只打击**真损坏档/手改档/mod 档** |
| 拒载误伤的真实场景 | mod 或未来版本若**新增/改名** defId、**缩界**地图：老档在升级后第一次读档即拒。处置＝当版口径（同 102c65d：迁移链负责补齐，校验只拦当版）＋「改名/缩界必须同步改校验或迁移」的耦合登记 |
| 行为收益 | 坏数据在门口死：界外建筑还会被 `runProductionTick`（`gameStore.ts`）当正常建筑参与产出结算——**不止视觉消失，经济面也在静默吃坏数据**（案②治不了这条） |
| 成本 | 校验 ~15–20 行＋saveMatrix 兼容例 2–3 条 |

### 案② 渲染侧：把 skip 变可观测（一次性 warn／计数器）

最小实现草案（`MapRenderer.ts:675` 处，≈6 行）：

```ts
// 循环外声明
let skippedUnknown = 0; const unknownDefIds = new Set<string>();
// 替换 if (!def) continue;
if (!def) { skippedUnknown++; unknownDefIds.add(b.defId); continue; }
// 循环后（每帧渲染收尾处）一次性输出
if (skippedUnknown > 0) {
  console.error(`[MapRenderer] ${skippedUnknown} building(s) skipped, unknown defId: [${[...unknownDefIds].join(', ')}]`);
}
```

| 影响面 | 读数/分析 |
|---|---|
| 收益 | 「无日志无红」→ 每帧（或去重后）可见；defId 直接点名，损坏档可诊断 |
| 边界 | 治标：坏建筑仍在档、仍参与生产结算（经济面毒②不解决）；`console.error` 每帧刷屏需节流（Set 去重后每档只打一次的口径即可） |
| 成本 | ≈ 6 行，零行为面变化，无兼容风险 |

## 3. 推荐（完成标准③）

**推荐两案同批各取一半，顺序＝先①后②**（若主班限定单选：选①）：

1. **案①为主刀**：`validateBuildingsArray` 加「当版存档 defId 须注册＋界内」拒载——本档量化后，913e 担心的「老档从能读变拒读」误伤面实测 ≈ 0（迁移链不碰建筑 id＋地图从未缩界），且 102c65d（9/27 用户裁决）已为「静默渗透＝换轨风险，拒载优先」付过用户信任；界外建筑还污染经济结算，案②治不了。
2. **案②为保险丝**：渲染侧两处 `continue`（:675/:1058）同步补一次性点名日志——覆盖「低版档走迁移链后」与未来口径缝隙，成本 6 行。
3. 与 c927-10 裁决台 R-2 条的合并口径：本档即 R-2 的深化材料；两单若并批，验收标准直接抄 §3.1/§3.2。

## 4. 零码改动自证（完成标准④）

```
$ git status --porcelain | grep -v "^ M\|^ D"
?? docs/insights/c927-13-building-validation-adjudication.md   ← 本档（唯一新增，untracked 交主班代提交）
$ git diff --name-only -- src | wc -l
0
$ git check-ignore -v tmp
.gitignore:25:tmp/	tmp                                        ← 复现件零仓库足迹
```

（树上既有在途脏项 `OPTIMIZATION_BACKLOG.md`、`colony-dead-exports-20260914.json`、`.bak` 删除、`colony-suite-timings-20260921.json` 非本班所动，一字未碰。）

## 5. 遗留问题

1. 案①落地时的耦合登记：未来**建筑 id 改名/地图缩界**必须同步改校验或迁移链，否则升级档首读即拒——建议写进 102c65d 同款提交信息口径。
2. `MapRenderer:1058` 第二处 `continue` 属同族，案②草案应两处同改（本档草案以 :675 为例）。
3. 复现件为 tmp 一次性证据，不入 `src/**/__tests__`；若主班想把五断言收编为常驻回归，需裁「tmp 证据转正」口径（新开实现单，非本单范围）。
