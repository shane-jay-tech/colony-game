---
id: c923-07
title: colony effects 形态判据设计稿（零值 / 同事件重复 / storyAxisDelta 键合法性，一律不比对 value 大小）
shift: qoder-executor-20260923-0022-colony4
date: 2026-09-23
status: 设计稿（不实现，零测试/生产码改动）
HEAD: fa1efe6
---

# 一、这份稿子解决什么

`c922-09-colony-storytargets.result.md` 遗留问题 4 原文（`zcode-bridge/done/`）：

> **未钉的三条（判据设计选择，非漏做）**：`value` 是否为 0（静默无操作）、同事件两选项是否给出完全相同 effects（复制粘贴痕迹）、`storyAxisDelta` 键合法性——前两条加了会变脆，第三条属另一族（隐性双轴），本单不扩范围。

本稿把这"三条"从**直觉判断**做成**可判定的设计**：每条给出命题、盘上实测现状、断言伪码、脆性来源与缓解（白名单/豁免表）、变异自证方案、用例草案，并给出**预估红数**。实现不在本单范围。

**贯穿红线**：三条判据一律**只比对形态与相等性，绝不比对 value 的数值大小、绝不把数值写进断言消息或本文档**。经济平衡数值是只读域（`CRISIS_*` / `SAVE_SLOTS` / 产出消耗常数零读零改）；修饰符消费面的「27 键只有 15 键有真读取口」缺陷已进待人工 82，**本稿不顺手接修**，只在 §五 标出与它的边界。

# 二、现有扫描件实锚（全部 2026-09-23 现取，非抄档）

| 锚点 | 实锚 | 取法 |
|---|---|---|
| 泛化扫描件（唯一） | `src/renderer/data/__tests__/storyEffectsTargets.test.ts`，320 行 / **23 例** | `wc -l` ＋ `rg -c "it\("` |
| 该目录含 "effects" 的文件 | **只有上面这一件** | `rg -ln "effects" src/renderer/data/__tests__/` |
| 键名合法性的生产判据 | `src/renderer/data/resourceRegistry.ts`（`MODIFIER_TARGETS` 27 键、`isValidModifierTarget`） | `rg -ln "isValidModifierTarget\|MODIFIER_TARGETS" src/renderer` |
| 运行时校验器 | `src/renderer/data/modifierValidator.ts:29-48` | Read |
| 双轴类型 | `src/renderer/data/schema.ts:167-170` `interface StoryAxisDelta { power?: number; production?: number }` | Read |
| 双轴唯一消费口 | `src/renderer/state/gameStore.ts:2367-2388` `pushStoryAxis`（三处调用：:1282 抉择 / :1338 国策 / :1361 朝令） | `rg -n "pushStoryAxis\("` |
| c922-09 引用的抽查桩 | `src/renderer/**state**/__tests__/v08_j3_content.test.ts:115`（`country_renown`）与 `:119`（`building_output_area`），行号 0 漂移 | `rg -n "" ...` 取 112-122 行 |

**⚠ 否证任务书前提一处（按实况收窄，不影响本单成立）**：任务书把「`storyEffectsTargets.test.ts`」与「c922-128 泛化件」写成**两个文件**（"同目录，rg -ln effects 扫描件现取"）。盘上实况：c922-128 **没有产出第二件**，它是**在同一文件内纯追加 +190 行**（`git show --stat d9249f4` → `1 file changed, 190 insertions(+)`；本档实测 `rg -ln effects` 在该目录只命中 1 件）。⇒ 本稿的"扩进现有泛化扫描件"＝**扩进 `storyEffectsTargets.test.ts` 一个文件**，草案按该文件既有 `TABLES` 登记表的写法对齐（见 §六）。

# 三、三条判据的设计

## 判据 J1「静默无操作」：恒等元探测（含 op 语义，不比大小）

**现状（探针实跑，`tmp/c923-07-probe.ts`，esbuild 打包后 node 直读运行时值）**

```
hosts 217 effectsRows 411
rowsPerTable STORY_EVENTS:134 SANDBOX_EVENTS:152 POLICIES:69 DECREES:56
[J1] add&&value===0 count 0
[J1] mul&&value===1 count 0
[J1] mul&&value<=0 count 0 | nonFinite 0
```
⇒ 四表 411 条 effects **今天零命中**，加判据当日 0 红（预估红数 **0**）。

**为什么不能只做「value === 0」**：`mul` 的恒等元是 1 不是 0，`add` 的恒等元是 0 不是 1。只钉 `=== 0` 会漏掉 `{op:'mul', value:1}` 这条同样静默的路；而 `mul` 配 0 是「清零」不是无操作，属数值语义，**不判**。

**伪码**

```
IDENTITY = { add: 0, mul: 1 }          # 单位元表，与 op 白名单同处一张表，扩 op 必须显式补
noopRows = rows.filter(r => r.op in IDENTITY && r.value === IDENTITY[r.op])
expect(noopRows.map(r => r.who)).toEqual([])     # 消息里只有路径 who，绝不出现 value
```

**与既有判据的边界（防重复建设）**：`validateModifierEffect`（`modifierValidator.ts:42`）已经在 c922-09 的钉子二里逐条跑过，它管 **NaN**；J1 管 **恒等元**，两族不交叠。

> 🔴 **顺带量出的一个在册缺口（本稿不修，只登记）**：`modifierValidator.ts:42` 的判据是 `typeof value !== 'number' || Number.isNaN(value)`，而它自己抛的文案写的是 `value must be a finite number` —— **`Infinity` 能通过这道运行时校验**。c922-09 的用例标题「含 value 有限性」因此名大于实。实测今天 `nonFinite = 0` 条，所以这是**潜在**而非现存缺陷。修法要么把判据换成 `Number.isFinite`，要么把 c922-09 那条标题改窄——**两者都会改动已交付件语义，属新单，不在本稿范围**。

**豁免表设计**：恒等元**不留豁免位**。理由：一条合法数据里出现「写了效果但效果为 0」只可能是忘了删或忘了改值，不存在设计意图正当的情形；留豁免表等于给自己开洞。今天 0 命中，直接把 0 钉死。

## 判据 J2「同事件两选项给出完全相同 effects」：两段式（同名面 + 全等面）

这条是三条里**唯一会当场变红**的，也是 c922-09 说"加了会变脆"的那条。脆在何处——实测把它钉死：

```
[J2] 多选项事件组数 72
[J2] 键名面相同（不比 value）事件数 7
     evt_a_flood_relief . evt_a_foreign_envoy . evt_a_rebel_leader . evt_a_iron_technique
     evt_a_heir_dispute . evt_a_drought_prayer . evt_a_scholar_sect      （全在 SANDBOX_EVENTS）
[J2] 逐对 valueDiffers = true（7/7 全部 value 不同）
[J2] 键名+value 全同（最严面）事件数 0
[J2] 全 host 范围（跨事件/跨表）键名面签名重复组数 28，涉及 host 数 170
[J2]   空 effects host 数（天然 vacuous）0
```

**结论先行**：照 c922-09 直觉「只比对形态、绝不碰 value」写成**单段**判据 ⇒ **今天 7 红，且 7 条全是合法设计**（同一组 target、不同力度的两/三个选项，正是"轻惩/重惩"这类模板）。⇒ 单段同名面**不可用作门禁**。

**设计：拆成两段，脆性用白名单吸收掉**

- **J2a 同名面（不比 value）——只作登记式白名单，不当失败判据**
  ```
  SAME_SHAPE_PAIRS = new Set([            # 2026-09-23 实测 7 事件，逐名钉桩
    'SANDBOX_EVENTS.evt_a_flood_relief', 'SANDBOX_EVENTS.evt_a_foreign_envoy', …])
  hits = events.filter(g => 两选项 target/op 多重集相同).map(g => g.key)
  expect(hits.filter(h => !SAME_SHAPE_PAIRS.has(h))).toEqual([])   # 新增同名对即红
  expect(hits.every(h => SAME_SHAPE_PAIRS.has(h))).toBe(true)     # 白名单不许长僵尸
  ```
  价值：把「同轴不同力度」这个模板**从巧合升级为显式契约**，同时第二条断言防白名单里的事件被改名后悄悄失效。预估红数 **0**（白名单预置现值）。
- **J2b 全等面（真正的复制粘贴探测器）**
  ```
  sigFull  = effects.map(x => `${x.target}/${x.op}/${x.value}`).sort().join(' ; ')
  dupPairs = 同事件内 sigFull 相等的选项对
  expect(dupPairs).toEqual([])            # 今天 0 命中 ⇒ 直接钉死，不留豁免位
  ```
  **口径声明（写进用例注释）**：J2b 判的是**相等性**，不是**数值大小**——它不断言任何 value 是多少、不比 `>`/`<`、不参与平衡；且**失败消息只回显两处的 `who` 路径，绝不回显 value 明文**，否则测试文件会变成经济数值的第二事实源（这正是"零读值"红线的实质）。若主班要求连"相等性"也不许触 value，退路是把 `sigFull` 换成 `sha256(sigFull).slice(0,8)`，判据等价而明文不落盘。
- **跨 host 面（28 组 / 170 host）本稿刻意不判**：它是"模板化写作"的正常产物（一个 sigLen=2 的键名签名被 29 个 host 共用），钉它＝钉掉整套事件模板的可复用性。只在此登记规模，供将来评估。

## 判据 J3「storyAxisDelta 键合法性」：价值不在键名，在被忽略的两个面

```
[J3] axis 站点总数（扫描面）205 | 带 storyAxisDelta 字段的站点数 113
[J3] 按表分布 STORY_EVENTS:70 SANDBOX_EVENTS:0 POLICIES:32 DECREES:11
[J3] 非法键站点数 0
[J3] 观测到的键全集 power,production
[J3] 空对象 {} 站点数 0 | 全零值站点数 0
[J3] 只用 power 58 | 只用 production 13 | 双轴 42
```

**实况修正 c922-09 的定位**：第三条被记为"属另一族"，但它的**字面版本（键 ∈ {power, production}）几乎是空判**——`StoryAxisDelta` 是 TS 接口（`schema.ts:167-170`），三处生产写入（`storyEvents.ts` 字面量、`policies.ts:622-625`、`decrees.ts:416-419`）都是类型化字面量，非法键在 `npm run type-check` 阶段就红，运行时钉子是**重复建设**。今天 0 命中也印证它抓不到东西。⇒ **不建议单独实现字面版**。

真正没人看守的是这两面：

- **J3-a 键集与 schema 同源（防"第三轴"腐烂）**：测试里硬编码 `['power','production']` 就是第二个事实源，将来加 `legitimacy` 轴时钉子会**假绿**。正解：像 `dataLayerBoundary.test.ts:42` 那样 `readFileSync('src/renderer/data/schema.ts')`，用正则取出 `interface StoryAxisDelta { … }` 块里的键名集，与判据白名单**互相钉**（`expect(LEGAL_FROM_SOURCE).toEqual(['power','production'])` 之外再加 `expect(whitelist).toEqual(LEGAL_FROM_SOURCE)`）。取源码文本在本仓**已有先例**（`rg -ln readFileSync src/renderer/data/__tests__` 命中 `dataLayerBoundary.test.ts`、`artManifestEvtArtUsage.test.ts`）。预估红数 **0**。
- **J3-b 配置表的 id 面（静默死配置）——本稿认为最值钱的三条之一**：`policies.ts:582` 与 `decrees.ts:402` 都写成 `Record<string, StoryAxisDelta>`，`if (a) x.storyAxisDelta = a`。`Record<string, …>` **抹掉了编译期穷尽检查**：把 `decree_hegemony` 打成 `decree_hegemoney`，tsc 不红、运行时不抛、该朝令的双轴**静默消失**——与待人工 82 的「7 键有数据无读取」同型，只是发生在配置侧。今天实测：
  ```
  DECREES 12 withAxis 11 无 axis 的 decree: decree_envoy_mission
  POLICIES 39 withAxis 32
  POLICY_AXIS 表条目数 32（policies.ts:582-621 文本计数）
  ```
  ⇒ 两表**今天无死 id**（条目数＝命中数，双射成立）。设计三条断言：① `表 id ⊆ 实体 id 全集`（死配置，今天 0 红）；② `无 axis 的实体逐名钉桩`（今天 1 条 `decree_envoy_mission`，现状只写在 `decrees.ts:414` 的**注释**里——注释不是判据，改名即失效）；③ `表键集 ⊆ 消费口读到的键集`（把 `pushStoryAxis` 读的 `power`/`production` 与数据侧出现的键并集对撞，即 J3-a 的数据侧）。预估红数 **0**（前提是把 `decree_envoy_mission` 预置进豁免表并写理由"中立，不推轴"）。
- **J3-c axis 的恒等元（J1 的双轴类比）**：`gameStore.ts:2372-2373` 写的是 `if (delta.power)`——**真值判断**，所以 `{power: 0}` 与 `{}` 一样静默无操作。今天实测 `{}` 0 站点、全零 0 站点 ⇒ 钉 0 红。这条与 J1 同一把刀，实现时**合并进 J1 的一个 describe**即可，不另立族。

# 四、预估红数汇总（今天 / 白名单预置后）

| 判据 | 裸写（无白名单） | 本稿设计（含白名单/豁免表） | 白名单条目 |
|---|---|---|---|
| J1 恒等元（add 0 / mul 1 / mul≤0 / 非有限） | 0 | **0** | 不留豁免位 |
| J2a 同事件同名面 | **7 红（全为误伤）** | 0 | 7 个 `evt_a_*` 事件 id |
| J2b 同事件全等面 | 0 | **0** | 不留豁免位 |
| J1' 同 host 内同 target 重复 | **1 红** | 0 | 1 条 `DECREES.decree_cast_ding.stages[1]`（同 stage 内 `country_military_power` 出现两次：一条 `add` 一条 `mul`，键名面实测 `["country_military_power/add","country_morale/add","country_military_power/mul","country_diplomacy_weight/add"]`） |
| J3-a/3-b/3-c | 0 | **0** | 1 条 `decree_envoy_mission` |
| **合计（新增例数 → 新增红数）** | 8 | **0** | 9 条豁免（逐名、带理由） |

⇒ 三条判据今天**全绿**（白名单预置后）。**全绿即新风险**：一条永不红的判据无法证明它会咬，所以落地单必须附**变异自证**（照 c922-09 的做法，当场改数据→跑→还原→`md5sum` 与 `git status` 双复验）：
- J1 变异：把任一 `add` 的 value 改为 0 → J1 必须红；
- J2a 变异：新增一个不在白名单的事件让两选项同名 → 必须红；
- J2b 变异：把某事件第二选项的 value 全改成第一选项的值 → J2b 必须红、J2a 不应变化（两段的分工要能分别验证）；
- J3-b 变异：在 `DECREE_AXIS` 里把一个 id 多打一个字母 → J3-b① 必须红（这条**只有**新增判据能抓，tsc 抓不到——正是它的存在理由）。

# 五、与在册缺陷/他单边界（勿顺手做）

1. **修饰符消费面「27 键只有 15 键有真读取口、7 键有数据无读取」已进待人工 82**——与本稿 J1/J2 相邻但不同族：J1 问「写了效果而效果为恒等元」，82 问「效果键有数据而无消费口」。**本稿不接修、不重做盘点**；J3-b 只是把同型缺陷在**配置表 id 面**的看守补上，二者不重叠。
2. `c922-128` 遗留问题 2 已登记的「注册表 5 键四表皆不消费」属 82 线，本稿不重复。
3. **不碰** `calendar.test.ts:21` 恒真断言（与台账回放少 1 条同源）。
4. J2b 若要落地，需主班明确一句：**允许判据以"相等性"方式读 value**（且断言消息零数值明文）。若不允许，改走 §三 的哈希退路；再不允许，则 J2 整族只保留 J2a＋白名单，本稿判其价值折半。⇒ **此为需裁决项**。

# 六、用例草案（扩进 `storyEffectsTargets.test.ts`；本单不实现）

沿用该文件既有约定：行集只带键名面、`TABLES` 集中登记 canary、`who` 路径点名。新增段落建议 4 个 describe / **9-11 例**。

```ts
// —— 复用泛化段已有的 TABLES；J1 需要 value，故另建一张【只含恒等元判定】的行集，
//    并且刻意不把它并入 Object.keys 钉子五的字段集断言（那条会因新增 value 字段而红，
//    落地时必须同步把钉子五的期望集改为 ['op','table','target','value','who'] 并留注释）。
type EffValueRow = { table: string; who: string; target: string; op: string; value: number };
const IDENTITY: Record<'add' | 'mul', number> = { add: 0, mul: 1 };

describe('c923-07(设计) J1：恒等元=静默无操作（只判单位元，绝不判大小）', () => {
  it('411 条 effects 无一命中 op 的单位元（add 0 / mul 1），零值豁免位刻意不设', ...);
  it('mul 配负数/零不属"无操作"族，本族不判（防判据越界成数值审查）——钉当前 0 命中', ...);
});

describe('c923-07(设计) J2：同事件两选项不得给出同一套 effects', () => {
  it('J2a 同名面命中集合逐名钉桩（现状 7 个 evt_a_*，新增须显式登记）', ...);
  it('J2a 白名单不得长僵尸：登记的事件若已不再同名即红', ...);
  it('J2b 键名+op+value 全等对 = 0（复制粘贴探测器；消息只回显 who）', ...);
});

describe('c923-07(设计) J1b：同一 host 内同 target 不得出现两次', () => {
  it('现状唯一豁免 DECREES.decree_cast_ding.stages[1]（country_military_power add+mul 混用）', ...);
});

describe('c923-07(设计) J3：storyAxisDelta 键合法性与配置表 id 面', () => {
  it('J3-a 合法键集 == schema.ts 的 StoryAxisDelta 接口键集（源码文本同源，非硬编码）', ...);
  it('J3-b① POLICY_AXIS / DECREE_AXIS 的 id 必须命中实体（防 Record<string,..> 抹掉穷尽检查后的静默死配置）', ...);
  it('J3-b② 无 axis 的实体逐名钉桩（现状仅 decree_envoy_mission，理由=中立不推轴）', ...);
  it('J3-c {} 与全零 axisDelta = 0 站点（if(delta.power) 真值门槛 ⇒ 0 即静默）', ...);
});
```

⚠ 草案里那条注释是**本稿实测出来的连带影响**，不是套话：`storyEffectsTargets.test.ts:313-320` 的钉子五把「泛化段行集字段集恰为 `{op,table,target,who}`」钉成了红线自证用例。J1/J2b 一旦需要 value，**必然**让钉子五变红 ⇒ 落地单要在同一批里改那条期望集，并在注释里写清"value 仍只用于单位元与相等性判定"。**改已交付件的字段集断言属跨单动作，需主班点头。**

# 七、验收对照（本单自己的）

| 完成标准（任务书原文） | 结论 | 证据 |
|---|---|---|
| ① 三条判据各有伪码与"不比对 value"声明 | **通过** | §三 J1/J2/J3 各段伪码；J1 声明"不判大小、mul≤0 不属本族"；J2b 声明"判相等性不判语义、消息零数值明文"并给哈希退路；J3 声明字面版属重复建设、改判三个真缺口 |
| ② 含现有扫描件实锚（storyEffectsTargets.test.ts 与 c922-128 泛化件名，rg 现取） | **通过（前提已按实况收窄）** | §二 实锚表：`rg -ln effects` 该目录只命中 `storyEffectsTargets.test.ts`（320 行/23 例）；c922-128 泛化**在同一文件内 +190 行**（`git show --stat d9249f4` = 1 file changed），"第二件"不存在 ⇒ 已在 §二 否证留痕 |
| ③ `git diff --stat = 0`（零测试/生产码改动） | **通过（本单口径）** | ⚠ 该标准在本仓**字面不可达**：他班 3 件在册在途本身就占着 diff（开工前实测 `git diff --numstat` = `5 5 docs/design/OPTIMIZATION_BACKLOG.md` / `6 6 docs/insights/colony-dead-exports-20260914.json` / `0 830 …json.bak`）。可复算的正解是**本单前后逐行相同**：本单产出 `docs/insights/colony-effects-shape-judges-design-20260923.md` 为**未跟踪新件**（`??`，不进 `git diff`），探针落 gitignored `tmp/`（`git check-ignore -v tmp/c923-07-probe.ts` → `.gitignore:25:tmp/`），`git diff --cached --numstat` 恒 0 行 |

# 八、落地建议（若主班放行）

1. **一单做 J2a+J2b+J1**（都在 `storyEffectsTargets.test.ts` 内，需同批改钉子五的字段集，风险要一起看）。
2. **另一单做 J3**：它要读 `schema.ts` 源码文本，与 `dataLayerBoundary.test.ts`（c923-09 正在动）同族不同件，**别和 c923-09 合批**——同一批里改两件 `data/__tests__` 会让 c923-09 的"字面 0 引用"自证失效。
3. 变异自证按 §四 四条各跑一次，探针落 `tmp/`（`git check-ignore -v tmp/x.ts` → `.gitignore:25:tmp/` 已核，不入库）。
