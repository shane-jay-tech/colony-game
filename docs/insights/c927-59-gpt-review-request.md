# c927-59 · saveio 恒等断言族（c922-103／c922-104）**GPT 独立复核请求材料**——⚠ 未独立复核

> 🔴 **本档全部结论均为「未独立复核」状态**：两单自 2026-09-22 起即登记「命中 `D:\code\CLAUDE.md` colony『存档兼容』升级硬触发，
> 产物需 GPT 独立复核后方可当定稿」，至本班 2026-09-28 汇编时点，**仍未见任何 GPT 复核留痕**（检索口径见 §5）。
> 本档只做材料汇编，**本班未调用任何外部模型**（子班无授权，且"独立"要求由日间总指挥路由）。
> 档位＝只读位；零受版件改动；取数 HEAD `cc75103`（2026-09-28 01:46:48 +0800），`date` 现取 11:50–11:56。

---

## 0. 为什么这两件必须过 GPT（条文逐字）

`D:\code\CLAUDE.md`：

- `:120` 升级硬触发表：`| colony-game | Flash 出活 | 经济平衡、**存档兼容**、性能瓶颈、跨系统重构、发版审查 | …… |`
- `:15` 分工哲学：「**Flash 写出来的东西在高风险档要过 GPT 的评审门**；评审意见与 Flash 的处置都要留痕。」
- `:17` 硬约束：「**只剩一个独立模型**……遇到 GPT 通道挂掉，就没有第三方视角，只能总指挥自审并在摘要里写明『无人独立复核』。」
- `:129` 「叫 GPT 不是『更放心就调用』的默认选项——**调用原因必须写进归档**（风险、复杂度或失败影响面）。」
- `:160` 档位映射：`| 9-11 | L4 高危 | 定稿后执行 | **必须** GPT-sol 独立评审（唯一独立视角，不得省） |`
- `:30-32` 通道口径：主＝`llm_call.py --model gpt`（中转 `gpt-5.6-terra`）；备＝Codex CLI（默认 `gpt-5.6-sol`）；兜底＝人工桥接并注明。

**调用原因（填 `:129` 要求的归档字段）**：改动落在**存档读写边界语义**（写档失败上报＋迁移断链报错），失败影响面＝玩家存档不可读／静默丢档；
两单都自称「向后兼容加法」并给出恒等式证据（源码切片 sha 全等＋真夹具），而恒等式证据正是**最容易自证成假绿**的一类断言——需要第二双眼睛。

---

## 1. 两单结论摘要（可直接粘给复核方）

| 单 | 提交 | 改了什么（生产码净变化） | 自称的口径 | 自称的兼容保证 |
|---|---|---|---|---|
| `c922-103-saveio-semantics` | `9700821` | `src/renderer/state/saveLoad.ts` ＋6/−1（`saveToSlot` 收 `saveGame` 返回值，严格 `=== false` 才抛 `SaveLoadError`）；`src/main/index.ts` ＋3/−3（save-game 三条校验消息补槽位/上限上下文，旧串前缀保留）；新增测试 `saveIoSemantics.test.ts` 10 例 | **跨进程采「消息可匹配」**：IPC 只传 `{name,message,stack}`，`instanceof SaveLoadError` 对主进程抛出的错误**结构性不可能成立** ⇒ 主进程不冒充 `SaveLoadError`，仅渲染侧可判定的写失败才升级 | 格式／字段集／`schemaVersion` 语义／迁移判据一字未动；`serialize`/`deserialize`/`runMigrations`/`validateSlot`/`SaveLoadError` 五段源码 HEAD==工作树 sha256 全等；v8 真夹具三例（老档读得开、新字段缺省 `null`、回写字段集只多不少） |
| `c922-104-migration-gap-message` | `32f7693` | `src/renderer/state/saveLoad.ts` ＋7/−1（断链消息加 `(missing: migrations[${version}], current: ${SAVE_SCHEMA_VERSION})`）；新增测试 `migrationGapMessage.test.ts` 17 例 | 断链定位补到「实际缺的档位」：`version` 是本次查表缺掉的 `migrations[N]`，`fromVersion` 是档案自带版本，链中段断档时两者不同 | 只改消息拼装，控制流（`if (!migrate)`／抛出时机／`current = migrate(current)`／`version++`）一字未动；旧前缀完整保留 ⇒ `saveGuard3.test.ts:79` 与 `saveLoadIo.test.ts:46` 不回退 |

## 2. 关键断言原文（逐字引，行号＝`cc75103` 现值）

生产侧现值：

```
saveLoad.ts:209-210   `No migration path from schema version ${fromVersion} to ${SAVE_SCHEMA_VERSION} ` +
                        `(missing: migrations[${version}], current: ${SAVE_SCHEMA_VERSION})`,
saveLoad.ts:390       `Save created with future schema version ${schemaVersion} (current: ${SAVE_SCHEMA_VERSION})`
saveLoad.ts:852-853   const written = await getColonyApi().saveGame(slot, JSON.stringify(serialize(store.getState())));
                      if (written === false) {        ← 103 的收口点（锚点原写 :794，已漂至 :853）
main/index.ts:155     throw new Error(`invalid slot for save-game (typeof ${typeof slot}; must match [a-z0-9_-]{1,32})`)
main/index.ts:156     throw new Error(`invalid json payload for save-game slot "${slot}" (typeof ${typeof json})`)
main/index.ts:157     throw new Error(`save data exceeds 10 MB cap for slot "${slot}": ${json.length} bytes > ${MAX_SAVE_BYTES} bytes`)
main/index.ts:172/:186  throw new Error('invalid slot')     ← 🔴 裸串仍在（103 遗留②，至今未裁）
```

断言侧（复核方要看的"牙齿"在哪）：

```
saveIoSemantics.test.ts:46   rejects.toBeInstanceOf(SaveLoadError)                                  // false → 渲染侧升级
                     :51     rejects.toThrow(/slot "slot_42"/)                                      // 消息含槽位名
                     :64-66  it('undefined（老 preload 未返回布尔）不得被误判为失败——只认严格 false')  → resolves.toBeUndefined()
                     :83-85  expect(body).not.toContain("throw new Error('invalid slot')") 等三条   // 静态读源切片（限 save-game handler 正文）
                     :95-99  expect(err).toBeInstanceOf(Error) ＋ not.toBeInstanceOf(SaveLoadError) ＋ message 两匹配  // 「消息可匹配」口径钉桩
                     :104   rejects.toThrow(/invalid slot/)                                         // 旧前缀仍可匹配
                     :121-125 老档原值 grain137/wood61/gold25/currentDay42/rngSeed999
                     :129   wrathUltimatumEndDay 为 null（非 undefined 非抛错）
                     :140-141 oldKeys.filter(k => !newKeys.includes(k))).toEqual([])                 // 字段集不缩水
migrationGapMessage.test.ts:35-36  旧前缀 ＋ (missing: migrations[0], current: …)
                     :42-43  /No migration path from schema version 5\.5/ ＋ 'missing: migrations[5.5]'
                     :49-50  'from schema version -3' ＋ 'missing: migrations[-3]'
                     :65     future-version 消息逐字不回退
                     :78-80  字段顺序：原始档在前、current 收尾
                     :93-94  expect(fn).toContain('migrations[${version}]') ／ not.toContain('migrations[${fromVersion}]')   // 静态模板判据
```

## 3. 请求复核的问题点（7 条，卷宗要求 ≥3）

1. **跨进程 `instanceof` 二选一是否收对了**（103 的核心裁决）。现口径＝主进程只补消息、渲染侧仅对 `=== false` 升级 `SaveLoadError`。
   后果：`loadFromSlot`/`saveToSlot` 的调用方面同时存在 `SaveLoadError` 与裸 `Error` 两种可捕获类型。
   请判：这是否构成"第三种语义"（比统一更糟）；`rejects.not.toBeInstanceOf(SaveLoadError)` 把现状钉死后，未来若真要跨进程类型保真（结构化 clone／错误码字段）会不会被这条钉桩挡住。
2. **严格 `=== false` 的漏报面**。老 preload 返回 `undefined` 时"不误判为失败"＝**同时放弃了真实写盘失败的可见性**（ preload 侧任何非布尔返回都算成功）。
   请判：是否应改为「非 `true` 即失败，但仅在 preload 声明了布尔返回的版本上生效」，以及该改动对存档安全的净收益。
3. **把校验正则写进用户可见消息**（`main/index.ts:155` 的 `must match [a-z0-9_-]{1,32}`）。
   请判：①是否泄露实现细节；②`saveIoSemantics.test.ts:79` 逐字 `toContain('must match [a-z0-9_-]{1,32}')` 使**消息串成了 `VALID_SLOT_RE` 的第二处判据源**（改正则必改测试），这种耦合在存档路径上是否可接受。
4. **断链消息的 `(missing: migrations[${version}])` 在异常版本下的定位价值**：现钉桩接受 `migrations[5.5]`、`migrations[-3]` ——**都不是真实表索引**。
   请判：这对排障是"更准"还是"新误导"（浮点／负数档报出一个不存在的表项）。
5. 🔴 **恒等断言的时效性（本班实测新暴露，最该复核的一条）**：两单的兼容取证取于 9-22，而 **9-27 的 `102c65d`（r5 B2，用户裁决「存档缺载荷字段改为拒载」）改了 `deserialize`**——
   新增「当版档缺 `rngSeed`／`eventHistory` ⇒ 直接 `throw SaveLoadError`」分支（＋`activeExpeditions` 下沉到 helper）。
   本班按函数体切片复算（口径见 §4）：`serialize`／`validateSlot` 三段哈希 **9700821^→HEAD 仍全等**（103 的"格式零改动"基面未被动），
   但 `deserialize` **已变**（183→195 行）。两单夹具分别是 **v8 降版档**（`saveIoSemantics.test.ts:115`，`schemaVersion:8`）与 **断链合成档**
   （`migrationGapMessage.test.ts:34/40/48`，`schemaVersion:0/5.5/-3`）⇒ **都进不了新分支（`schemaVersion === SAVE_SCHEMA_VERSION` 才判缺）**，
   覆盖该分支的只有 `replaySnapshotContent.test.ts`（他单产物）。
   请判：①「两单结论」现在还能不能作为存档兼容升级的依据；②是否要把 r5 B2 分支并入同一兼容判据面（同一批夹具跑当版缺字段）；
   ③"低版档先走迁移链、不在此拦"这条豁免是否给旧档留了缺字段的可乘之机。
6. **静态读源钉桩作为运行时证据的等价性**：主进程侧无 electron 之外的可测入口 ⇒ 三条消息正确性由 `toContain(源码切片)` 守护（103 遗留④自认），
   断链插值由 `migrations[${version}]` 模板判据守护（104 自认"运行时无法构造"，因任务书禁改迁移表）。
   请判：在存档路径上，"静态钉桩＋变异实测（103：删 `false` 块 → 2 failed 8 passed；104：换回旧串 → 6 failed 39 passed）"能否算充分证据。
7. **门禁覆盖与基线口径**：`tsconfig.main.json` **不在** `npm run type-check`（只跑 `tsconfig.renderer.json`）与 pre-commit 门内。
   本班在 `cc75103` 现跑 `npx tsc -p tsconfig.main.json --noEmit` → **rc=2，两行原样仍在**：
   `src/main/index.ts(93,9): error TS18048: 'w' is possibly 'undefined'.`／`(93,18): … 'h' …`
   ⇒ 103 遗留①登记的这处存量红**六天无人看见、至今在**（同轮 `npm run --silent type-check` rc=0，门禁面完全看不到它）。
   计数口径：103 令全量 1310→1320（文件 124→125）、104 令 1320→1337，**现值 157 文件／1711 例**（`docs/insights/colony-suite-timings-20260921.json`，c924-12 于 09-25 21:58 重生成，仍在途未入库＝见 c927-56）。
   请判：复核结论要钉在哪个基线上；常驻基线档（n922-09）那行追记是否已做（本班未查得，登记为待确认）。

## 4. 现值复算（命令与读数，复核方可直接复跑）

```
$ git status --porcelain | wc -l                     → 4（开工时点，全他班在途件）
$ grep -n "written === false" src/renderer/state/saveLoad.ts        → :853（103 锚点 :794 已漂 +59）
$ grep -n "No migration path …" saveLoad.ts          → :209-210（104 锚点 :205 漂至 :209）
$ grep -n "future schema version" saveLoad.ts        → :390（锚点 :385）
$ grep -n "invalid slot\|exceeds\|MAX_SAVE_BYTES" src/main/index.ts → :152/:155/:156/:157 已补上下文；:172/:186 仍裸串
$ python（函数体切片 sha256 前 16，切片定义＝从 `function X(` 到配对右括号，LF 归一）
   段            9700821^            32f7693^            HEAD              判定
   serialize     7c510de544844097    同                  同                恒等仍成立
   validateSlot  d44b8626b7589aec    同                  同                恒等仍成立
   deserialize   785a0973053fa6c4    同                  ed04b7b17f029a8f  🔴 变（183→195 行，102c65d r5 B2）
   runMigrations 21e4ccad4c2d5876    21e4ccad4c2d5876    d27cc49b5a4c1b83  变＝c922-104 自己那笔（注释＋消息），控制流四要素原样
   SAVE_SCHEMA_VERSION ＝ 9（三态未变）；migrations 表键数 8（粗正则计数，弱口径）
   ⚠ 哈希值与两单 result 自报的 52f2e1c5dc37856b 系列**不可直接比**（切片边界不同）；可比的是「跨修订是否全等」这一关系。
$ npx vitest run saveIoSemantics migrationGapMessage saveGuard3 saveLoadIo（按文件点名，未跑全量）
   ✓ saveLoadIo (4) ✓ saveGuard3 (14) ✓ migrationGapMessage (17) ✓ saveIoSemantics (10)
   Test Files 4 passed (4) / Tests 45 passed (45) / Duration 793ms / rc=0    （11:50:50→11:50:52）
   ⇒ 复核前基线在 cc75103 仍全绿；migrationGapMessage 的 17 例来自 10 个 it 声明（it.each 展开），静态 `it` 计数与 vitest 计数不可互换。
$ git log -1 --format='%h %ad %s' --date=iso 102c65d → 102c65d 2026-09-27 00:55:16 colony: 存档缺载荷字段改为拒载（r5 B2）
$ git log -6 --oneline -- src/renderer/state/saveLoad.ts → 102c65d / 63f0def / 32f7693 / 9700821 / 1bdfcfc / e56d82a
$ npm run --silent type-check                         → rc=0（4 s，输出 0 字节）   ← 只覆盖 tsconfig.renderer.json
$ npx tsc -p tsconfig.main.json --noEmit              → rc=2
  src/main/index.ts(93,9): error TS18048: 'w' is possibly 'undefined'.
  src/main/index.ts(93,18): error TS18048: 'h' is possibly 'undefined'.
  ⇒ 103 遗留① 的存量红在 cc75103 仍逐字在原位（该配置不在 type-check 与 pre-commit 门内，门禁长期看不见）
```

## 5. 复核留痕检索（本班实测：查无）

```
$ grep -rn "saveIoSemantics\|migrationGapMessage" --include=*.md D:/code/docs D:/code/colony-game/docs | grep -iE "复核|GPT|评审|独立"
  → 无命中（本班口径：只看 markdown 归档面；未检 tmp/ 与训练会话记录）
$ grep -rl "c922-103\|c922-104" D:/code/docs D:/code/colony-game/docs D:/code/zcode-bridge/logs
  → outbox-digestion-20260927.md（只引 da6f 单提及 instanceof 归属，非复核）／colony-test-baseline-20260921.md:96/:98（＋27 例来源与同域提醒）／
    night-plans 派单档／claims.log／consumed.jsonl（簿记）      ⇒ 六处全部是登记或派单，**没有一处 GPT 复核意见**
```

## 6. 建议的走法（日间总指挥决定，本班不代跑）

1. 提示词输入面＝本档 §1＋§2＋§3（§3 的 7 问逐条要"结论／反方／置信度"三档），代码输入面＝`git show 9700821 32f7693 102c65d` ＋两枚测试件全文。
2. 通道按 `CLAUDE.md:30-32`；**存档兼容属高风险**，若按 `:160` 落 L4 档则点名 `gpt-5.6-sol`；两通道都不可用时按 `:17` 写「无人独立复核」，不得由总指挥自审冒充第二视角。
3. 复核意见回来后：①若第 5 问判"兼容结论失效"，要另开写位单给当版缺字段补一批同族夹具；②若判"静态钉桩不充分"，主进程测试入口属新功能（另单）；
   ③两单的 `CLAUDE.md:129` 归档字段可直接引用本档 §0 末段。
4. 与在册邻档的关系（引路即可，勿当新发现）：`docs/insights/c927-01-deserialize-clone-adjudication.md`（deserialize 深拷贝裁决）、
   `c927-44-saveguard-semantics-audit.md`（saveGuard 用例语义复核）、`c927-42-test-baseline-refresh.md`（基线口径）同属 saveio 语义族。

## 7. 完成标准对照与只读自证

| 卷宗完成标准 | 结论 | 证据 |
|---|---|---|
| ① 两单材料齐 | **通过** | §1（结论摘要）＋§2（关键断言原文，含现值行号与漂移量）＋§4（现值复算） |
| ② 复核问题点 ≥3 | **通过（7 条）** | §3，其中第 5 条为本班在 `cc75103` 复算出的时效性缺口（带 sha 与夹具行号） |
| ③ 标注「未独立复核」 | **通过** | 档首红字＋§0/§5；本档不构成定稿依据 |

只读自证：本班对 colony 受版文件零改动（`git status --porcelain`＝开工 4 枚他班脏件＋本波新档，零删除）；
未执行 `git add`／`commit`／`stash`／`checkout`／`restore`／`clean`／`push`；未调用任何外部模型（含中转 gpt／claude）；
定向测试 4 文件 rc=0（未跑全量，并发窗纪律）；临时件在 `D:\code\tmp\qoder-executor-20260928-0210-colony51\`，本班自清。
