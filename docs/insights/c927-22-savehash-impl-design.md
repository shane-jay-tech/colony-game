# c927-22 存档校验和·三落点实现设计（e29e 遗留1 → 落地前置）

> 来源：`zcode-bridge/done/20260925-154159-e29e.result.md` 遗留 1——存档链路 0 处哈希（E7：blob 顶层三键 `schemaVersion/savedAt/state`，主进程只写 `<slot>.json/.json.tmp/.json.bak`）。
> 「三落点」＝`docs/insights/colony-migration-v10-guard-20260916.md` §一清单（常量/迁移表/fixture）；用例规范配套 `colony-v10-guard-spec-20260915.md` §二。
> 复核基线 HEAD `8a9eaea`。**升级硬触发域：本档只出设计不落码**；零写入仓库。

## 0. 现状锚点（复核于 8a9eaea，与 e29e/guard 稿一致）

```
$ sed -n '19p;122p' src/renderer/state/saveLoad.ts        ← 19: SAVE_SCHEMA_VERSION = 9；122: migrations 表头
$ sed -n '155,158p' src/renderer/state/__tests__/saveMatrix.test.ts
157:    expect(SAVE_SCHEMA_VERSION).toBe(9);               ← 恒等断言（设计内有意变红）
$ sed -n '307,311p' src/renderer/state/saveLoad.ts
307: export function serialize(state…): SerializedSave {   ← 顶层三键：schemaVersion/savedAt/state
$ ls src/renderer/state/__tests__/__fixtures__/save-v9.json  ← e29e ①：唯一真档夹具 35 223 B 在盘
```

## 1. hash 算法选型（非加密即可）

| 案 | 算法与落位 | 优点 | 缺点 | 判定 |
|---|---|---|---|---|
| **A（推荐）** | **SHA-256 @ IO 边界**：`crypto.subtle.digest('SHA-256', …)`（Chromium/Electron 内建，零依赖），hex 串 | 抗碰撞性能余量大；零自绘代码；`saveToSlot`(:847)/`loadFromSlot`(:858) **本来就是 async**，异步 digest 无缝；`deserialize`/`serialize` 保持同步纯函数不动 | `crypto.subtle` 依赖 secure context（Electron renderer file:// 属 secure，但需运行时探测）；同步路径（若未来有人在 deserialize 内验）用不了 | **选 A**，带 B 作降级 |
| B（降级） | FNV-1a 32-bit 自绘（~15 行纯函数，sync） | 同步可用、零依赖、无 secure context 问题 | 32 位碰撞面对 35 KB 档够用但弱；自绘即自维护 | 仅当运行时探测 `crypto.subtle` 缺失时启用，且**验算改软警告**（见 §5 矩阵 M6） |

**关键设计决策：验算放 IO 边界，不放 serialize/deserialize 内**。理由：① deserialize 是同步纯函数且被迁移链/测试高复用，塞异步 hash 会污染整条签名；② 损坏发生在「盘↔内存」的边界上，边界守门语义最准；③ 与 e29e「主进程只写三件套」的原子写面（tmp→rename）正交，不碰原子性。

## 2. 顶层字段定义

```ts
// SerializedSave 增一个可选键（blob 顶层，不入 state）：
checksum?: string | null;   // sha256 hex（64 字符小写）；null＝迁移自无校验和老档；缺键＝v9 及以前
```

**canonical 口径（验算可复现的关键）**：

```ts
const canonical = JSON.stringify({
  schemaVersion: blob.schemaVersion,
  savedAt: blob.savedAt,
  state: blob.state,
});                       // 字面量固定键序 ⇒ 不依赖盘上字节序；JSON.parse→stringify 数值最短表示稳定
checksum = sha256hex(canonical);
```

- 只包三业务键，**不含 checksum 自身**（自指）；`savedAt` 包入（写档时刻参与，防同体换时间戳无法感知）。
- 规范化只用「显式字面量键序」，禁止 `Object.keys` 排序法（性能无谓损耗且语义绕）。

## 3. migrations[9] 步骤草案（三落点之二）

```ts
// saveLoad.ts migrations 表尾（:196 后）新增：
9: (blob) => {
  // v9→v10：校验和引介档。老档无 checksum，注入 null 显式标记「未经校验和引介」，
  // 与「v10 原生档 checksum 必为 64 位 hex」形成可判别两态（§5 矩阵 M2/M3 分流的依据）。
  // sync 迁移链内不计算 hash（WebCrypto 异步、且迁移产物还要继续被链尾消费）——
  // 首次 saveToSlot 落盘时补算真值。
  (blob as { state: Record<string, unknown>; checksum?: unknown }).checksum = null;
  (blob as { schemaVersion: number }).schemaVersion = 10;
  return blob;
},
```

同步落点（三落点之一）：`saveLoad.ts:19` `SAVE_SCHEMA_VERSION = 9` → `10`。
fixture 落点（三落点之三）：**零新增**——`blobAt()`（saveMatrix.test.ts:9-21）已参数化，bump 后 `blobAt(9)` 自动成为旧档输入；真档夹具 `__fixtures__/save-v9.json` 复测延续。

## 4. 恒等断言改法（e29e 点名的「有意变红」处）

```
saveMatrix.test.ts:156-158
- it(`SAVE_SCHEMA_VERSION 恒为 9（bump 版本号时必须同时给 migrations[N]，组 A 会在漏写时变红）`, () => {
-   expect(SAVE_SCHEMA_VERSION).toBe(9);
+ it(`SAVE_SCHEMA_VERSION 恒为 10（bump 版本号时必须同时给 migrations[N]，组 A 会在漏写时变红）`, () => {
+   expect(SAVE_SCHEMA_VERSION).toBe(10);
```

配套（同一 diff 内，防红窗）：
- 组 C 配套（:161-，n916x-34）自动跟随常量，无需改；
- 组 A 收尾（:41-42 版本常量派生）自动扩展到 v9→10；
- 新增两用例（guard-spec §二 形态延续）：⑴ v9 真档夹具 → 迁移后 `checksum === null` 且业务字段不变（deepEqual 面抽 grain/名册）；⑵ v10 档篡改 `state.resources.grain` → `loadFromSlot` 抛 `SaveLoadError('checksum mismatch…')`。

## 5. 老档无 hash 的兼容行为矩阵

| # | 档形态 | 读入行为 | 依据 |
|---|---|---|---|
| M1 | v≤9 真老档（无 checksum 键） | 迁移链逐级 → migrations[9] 注入 `checksum:null` → **正常载入**＋一次性 `console.info('[saveLoad] legacy save without checksum, will be sealed on next save')` | 迁移链语义＝「升级不拒老档」（102c65d 同口径：只拦当版缺载荷） |
| M2 | v10 且 `checksum === null`（迁移产物未重存） | **正常载入**＋软警告（同 M1 文案）；下次 saveToSlot 补算真值封印 | 迁移链无法算异步 hash 的必然中间态 |
| M3 | v10 且 `checksum` 为 64-hex | 重算 canonical → 逐字节比对：**一致→载入；不一致→拒载** `SaveLoadError('checksum mismatch: save corrupted or edited outside game')` | 校验和的存在意义；拒载方向与 102c65d 用户裁决一致 |
| M4 | v9 及以前版本号＋盘上恰有杂散 checksum 键 | 迁移链先跑（低版不拦），migrations[9] 覆写为 null（原杂散值弃用） | 手改档不得借旧版本号绕过校验 |
| M5 | v11+（未来档） | 既有 future-version 拒载（:388-392）不变，验算不执行 | 现行护栏 |
| M6 | 运行时 `crypto.subtle` 不可用（探测失败） | 写：`checksum:null`＋warn；读：M3 分流降级为软警告过＋warn（**验算缺席必须留痕，不得静默**）；若案 B 降级已实现则改走 FNV 双通道 | 环境防御，防「验算依赖」反向变成拒载误伤源 |
| M7 | checksum 键类型非法（非 string/null） | 视同 M3 不一致拒载（错误消息注明 malformed checksum） | 防半吊子手改 |

## 6. 逐文件 diff 草案（全部触点）

**① `src/renderer/state/saveLoad.ts`**（~35 行净增）
- :19 常量 9→10；
- migrations 表尾增 `9:` 步（§3 原文）；
- 新增 `async function computeChecksum(blob: …): Promise<string>`（~8 行：canonical + subtle.digest + hex 编码）与 `function hex(buf: ArrayBuffer): string`（~4 行）；
- `SerializedSave` 接口增 `checksum?: string | null`；
- `saveToSlot`(:847)：`serialize` 产物 → `computeChecksum` → 携 checksum 交主进程原子写（**写面顺序固定：先算后写，tmp→rename 流程零改动**）；
- `loadFromSlot`(:858)：读盘 → `deserialize` 前置验算分流（§5 矩阵 M2/M3/M6/M7）→ 通过才进 `deserialize`。

**② `src/renderer/state/__tests__/saveMatrix.test.ts`**
- :156-158 恒等断言 9→10＋描述同步（§4）；
- 新增 §4 两用例（真档迁移软封印／篡改拒载）；
- 其余组零改（派生式自动跟随）。

**③ 主进程写面（若有独立 io 模块）**：零改动——checksum 在 renderer 侧入 blob，主进程仍只收完整 JSON 写三件套（tmp/bak/rotate 原状）。

## 7. 落地检查清单（并 guard 稿 §三）

1. 三落点三动作（§3/§4）；2. §6 两文件 diff；3. `npx vitest run src/renderer/state/__tests__/saveMatrix` 全绿；4. `npm run type-check` 0 error；5. 全量 `npm test` failed=0；6. **手改档实测**：拿真档改一个字节 → 读档拒载截图/日志留痕（升级硬触发域的验收本位）。

## 8. 零码改动自证

本档为设计稿：`git status --porcelain` 零新增（本档自身 untracked 交主班代提交）；全部锚点为只读 `sed`/`ls` 读数，命令原文见 §0；树上在途脏项未碰。

## 9. 遗留问题

1. **免 bump 简案**（供主班对照裁）：若 checksum 定为「可选字段＋有则验」，可不 bump 版本、零迁移——代价是 M2 永远合法（从未封印的档永远软过），守护强度降一档。本档按 e29e 前提（bump 路线）出全量设计；若主班选简案，§3/§4 整节作废、§6 缩到 saveLoad.ts 单文件。
2. M6 降级链的「FNV 双通道」需在两种算法间切换校验口径，若实现则 checksum 串需带算法前缀（`fnv1a-` / 裸 hex＝sha256）——本档默认不实现双通道，M6 只软警告（更简单、防误伤优先）。
3. `save-v9.json` 真档夹具含玩家字段名册（e29e ①），用例⑴的 deepEqual 面以此为准；若该夹具在并行班被改，以 e29e 04 报告的 35 223 B 版本为仲裁。
