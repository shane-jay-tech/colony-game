# registry 键共现扫描材料（运行时耦合面）——c1023-27，2026-10-24

> 性质：**口径扩展材料单，零工具改动**（c1011-12 遗留锚点：静态 import 度不含 `registryGet(registry, KEY)` 运行时服务定位——本单补全耦合面底稿，供主班裁决是否立项为扫描口径扩展）。
> 扫描口径：`rg registryGet/registrySet` 调用点提取（含 `REGISTRY_KEYS[expr]` 动态面联查）；旁证 raw-string bypass 与事件监听面。

## 一、registryGet 全清单（量纲）

- `rg -n "registryGet" src scripts` → **63 行命中**（含 import/类型/注释行）。
- `-o` 提取 `registryGet(…)` 调用文本 **45 处**＝在役 40＋测试 4（registry.test.ts）＋注释伪命中 1（`AudioManager.ts:141`，c919-03 说明文字，非调用）。
- 在役 40 处按文件：HUD 14、GameScene 11、UIScene 3、IntroScene 2、BootScene/Toast/SaveLoadPanel/PolicyTreePanel/MilitaryPanel/MegaProjectPanel/JitHintManager/InfluencePanel/DiplomacyPanel/BuildPanel 各 1。
- `registrySet(…)` 调用 **41 处**＝在役 38（UIScene 26、PolicyTreePanel 3、IntroScene 3、ModeSelectScene 2、GameScene 2、main.ts 2）＋测试 3（registry.test.ts）。

## 二、键共现矩阵（22 键 × 产/消面）

REGISTRY_KEYS 共 **22 键**（registry.ts:29-52）。产（registrySet）/消（registryGet）全映射：

| 键 | 产方（在役 set） | 消方（在役 get） | 异常注记 |
|---|---|---|---|
| `store` | main.ts ×1 | UIScene、IntroScene、GameScene 各×1 | — |
| `buildMode` | main.ts ×1 | UIScene、GameScene | — |
| `gameMode` | ModeSelectScene ×2（'story'/'sandbox'） | IntroScene ×1 | — |
| `introDone` | IntroScene ×1 | BootScene ×1 | 测试面另有 3 读 2 写 |
| `treePanelOpen` | PolicyTreePanel ×3（true/false）＋UIScene ×1（false） | GameScene ×3 | 三写点单读点 |
| `mapRenderer` | GameScene ×2（set＋undefined 拆除） | UIScene ×1 | — |
| `audioManager` | UIScene ×2（set＋拆除） | HUD ×4、GameScene、Toast | — |
| `toast` | UIScene ×2（set＋拆除） | **GameScene ×5＋BuildPanel/DiplomacyPanel/InfluencePanel/JitHintManager/MegaProjectPanel/MilitaryPanel/PolicyTreePanel/SaveLoadPanel 各×1（共 12 调用点/9 文件）** | 全仓最宽消费面 |
| `policyTreePanel` | UIScene ×2（set＋拆除） | HUD 动态 ×1（同一调用点循环） | §三动态面 |
| `diplomacyPanel` | 同上 | 同上 | §三动态面 |
| `militaryPanel` | 同上 | 同上 | §三动态面 |
| `megaProjectPanel` | 同上 | 同上 | §三动态面 |
| `influencePanel` | 同上 | 同上 | §三动态面 |
| `populationPanel` | UIScene ×2 | HUD 静态 ×1 | — |
| `productionPanel` | UIScene ×1 | HUD 静态 ×1 | — |
| `gradePanel` | UIScene ×1 | HUD 静态 ×1 | — |
| `scoreCardPanel` | UIScene ×1 | HUD 静态 ×1 | — |
| `saveLoadPanel` | UIScene ×2 | HUD 静态 ×2 | — |
| `settingsPanel` | UIScene ×2 | HUD 静态 ×2 | — |
| `codexPanel` | UIScene ×2 | HUD 静态 ×1 | — |
| `countryName`（'introCountryName'） | IntroScene ×1 | **在役零 get**（仅 IntroScene.test/keyboardThreeEntries.test/registry.test 断言读） | set-only（测试外死写） |
| `identity`（'introIdentity'） | IntroScene ×1 | **零 get（含测试面仅 IntroScene.test 断言 1 处）** | set-only（近死写） |

## 三、HUD/面板互拉面（锚点点名域）

1. **HUD → 12 面板（单向拉取）**：`layoutFunctionToolbar`（HUD.ts:455-460）按钮描述符 `reg: 'policyTreePanel'|'diplomacyPanel'|'militaryPanel'|'megaProjectPanel'|'influencePanel'` 经 `registryGet(this.scene.registry, REGISTRY_KEYS[d.reg])`（:493）动态拉取并 `panel?.toggle?.()`——5 键共用 1 个调用点，静态 rg 逐键计数会**低估**此面；另 7 枚面板键为 HUD 静态 get（saveLoad/settings 各×2、population/production/grade/scoreCard/codex 各×1）。
2. **面板 → 服务（反向拉取）**：8 枚面板/管理件拉 `toast`（7 面板各×1＋JitHintManager）、HUD/Toast/GameScene 拉 `audioManager`——产方全部是 UIScene（集中供给），无第三产方。
3. **面板 → GameScene（状态回报）**：PolicyTreePanel 开合写 `treePanelOpen`，GameScene 轮询读 ×3——唯一的「UI 写、Scene 读」逆向边。
4. **耦合形态判定**：全图呈「UIScene 单点产、HUD/面板消费」的**星型**，仅 `treePanelOpen` 一条逆向边；**无 get→set 同键闭环**（无环）。零事件监听（`registry.events/changedata/on` 在役零命中）——纯轮询取用面，无回调耦合。

## 四、异常清单与口径扩展建议（材料，不代决）

- **set-only 键 2 枚**：`identity`（零消费）、`countryName`（消费仅存于测试断言）——IntroScene:566-567 写入后无在役读者，属运行时耦合面的死写候选；若主班裁删，两键可作扫描口径扩展落地后的首批试验例（删后 intro 流程测试 4 断言需同笔收口）。
- **扩展建议**（均不动在役工具本体）：
  1. 新增 AST 级 registry 共现扫描（或并入 dead-exports 审计扩展项）：提取 registryGet/registrySet 调用 → 键×文件矩阵＋set-only/get-only 异常表；本单 rg -o 口径（45+40 调用点全量可提取）已验证可脚本化。
  2. 必配三旁查：raw-string bypass（`\.registry\.(get|set)\(`——现值在役零命中，仅 buildingRegistry.ts:30 的同名 Map.set 伪命中与 2 处测试读）；事件面（现值零命中）；动态键面（`REGISTRY_KEYS[expr]`——需描述符联合类型联查，AST 才能稳定覆盖）。
  3. 若 c1023-16 dead-exports 案 B 落地，registry 面可同笔挂守卫（建议只挂 set-only 异常，避免 toast/panel 高频面误报）。

## 五、证据命令

```
$ rg -n "registryGet" src/ scripts/ | wc -l
63
$ rg -o "registryGet\([^)]*\)" src --no-heading -N | sort | uniq -c | sort -rn   # 45 处（明细见 §一/§二）
$ rg -o "registrySet\([^)]*\)" src --no-heading -N | sort | uniq -c | sort -rn   # 40 处（明细见 §二）
$ rg -n "reg: " src/renderer/ui/HUD.ts   # 动态键面 5 键：policyTree/diplomacy/military/megaProject/influence
$ rg -n "registry\.(on|events|remove|removeAll|once)" src/renderer --no-heading | grep -v __tests__   # 零命中
$ rg -n "registry\.(get|set)\(" src/renderer --no-heading | grep -v registryGet | grep -v registrySet   # 仅测试 2 处＋buildingRegistry Map.set 伪命中
```

## 六、锚点与漂移留痕

- c1011-12 遗留原文（done/c1011-12.result.md:49）复核有效：口径扩展项至今未立项，本单为材料补全。
- 漂移修正：AudioManager 在 c1011-12 时代语境的「registryGet 消费文件」名单按现值修正——其 :141 命中为注释非调用，真实消费面以本档 §二为准。
