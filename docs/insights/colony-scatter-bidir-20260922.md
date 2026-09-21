# colony scatter 键×盘双向对账补强（c922-107，2026-09-22T03:49）

> 用途：登记散布素材族对账判据从**单向**改**双向**的现值与白名单裁决归属，供 c922-16 item2.3（scatter 进 manifest 权威）接续。
> 边界：**只改 1 个测试文件＋出本档**；`public/` 零触碰（复核见第五节）、不删任何资产、不动 `scatterConfig.ts` 数据（那是 c922-108 的注释域）。
> 取数 cwd `D:\code\colony-game`，起点 HEAD `918de49`。写档人：Qoder 执行班 `qoder-executor-20260922-0000-colony5`。

## 一、两个被修掉的失真

1. **标题/断言自相矛盾**：`src/renderer/data/__tests__/scatterDiskReconcile.test.ts:10` 标题写「ALL_SCATTER_IDS **共 9 键**（与磁盘 png 数一致）」，`:11` 断言却是 `toHaveLength(8)`。成因：c918-09 删 `bush_dry` 键时只改了断言数字、没回写标题。
   ⇒ 改判为「**共 8 键**（键数不绑定磁盘文件数：盘上多 1 个孤儿，由末条反向用例守）」。
   ⚠️ 原标题里「与磁盘 png 数一致」这半句本身就双重过期：c921-02 后盘上只有 `.webp`（png 已按 f0c9754 授权删除），且键数与盘数**本就不等**（8 键 vs 9 个 webp）。新标题把这两件事拆开，不再混进一条断言。
2. **对账只有单向**：本族既有 4 条判据全部是「键→盘／池→键」方向——
   - 本文件 `test.each(ALL_SCATTER_IDS)`：每个键要有实存 webp；
   - `scatterAssets.test.ts` ①：键有 webp；①b：原 png 不在盘；②：地形池引用的 id 要在 `ALL_SCATTER_IDS` 内；③：`rock_cluster` 不再被引用。
   反方向（**盘→键**）零判据 ⇒ `public/art/scatter/bush_dry.webp`（c921-02 整批转码遗留、c918-09 已删键）零引用却无人报。
   ⇒ 新增末条用例：`盘上 .webp − 引用集 == 白名单`，白名单外多一个孤儿即红。

## 二、盘 vs 键实测差集（2026-09-22）

- `public/art/scatter/` 内 `.webp` **9 个**：`bush_dry` `bush_shrub` `grass_tuft` `reed_clump` `rock_boulder` `tree_locust` `tree_mulberry` `tree_pine` `tree_willow`。
- `ALL_SCATTER_IDS`（`src/renderer/data/scatterConfig.ts:63-67`）**8 键**：上述除 `bush_dry`。
- 差集＝**恰好 `{bush_dry.webp}`** ⇒ 进白名单。
- `rg -l bush_dry` 全仓命中面：`scripts/gen_scatter_art.py`（生成器仍产该图）＋ 8 份历史 insights ＋ 本测试文件的注释；**`src/` 运行码零引用**（`rg -n "bush_dry" src/ -g '!*__tests__*'` 空）。

## 三、新用例与其判据形态

```ts
const KNOWN_SCATTER_ORPHANS: readonly string[] = ['bush_dry.webp'];

test('反向：public/art/scatter/ 上零引用的 .webp 恰等于白名单（新增孤儿即红）', () => {
  const onDisk = readdirSync(SCATTER_DIR).filter((f) => f.endsWith('.webp')).sort();
  const referenced = new Set(ALL_SCATTER_IDS.map((id) => `${id}.webp`));
  const orphans = onDisk.filter((f) => !referenced.has(f));
  expect(orphans).toEqual([...KNOWN_SCATTER_ORPHANS].sort());
});
```

用 `toEqual(集合)` 而非「孤儿数＝1」的松散写法：**白名单外的新增、以及白名单成员的消失（被授权删掉后）都会红**——后者是故意的，删件时必须同步清空白名单，否则这条档就悄悄失去守护力。

## 四、变异自证（非空洞性）

把白名单改空 → **1 例 fail 且报错点名孤儿**，随后按原始字节还原（sha256 全等，`aabe94e2d51e…`）：

```
AssertionError: expected [ 'bush_dry.webp' ] to deeply equal []
 Test Files  1 failed (1)      Tests  1 failed | 10 passed (11)
```

## 五、读数与边界复核

- 定向：`npx vitest run src/renderer/data/__tests__/scatterDiskReconcile.test.ts src/renderer/data/__tests__/scatterAssets.test.ts` ⇒ **15 passed／rc=0**（本文件 **10 → 11 例**、`scatterAssets` 4 例不变）。
- ⚠️ **任务书「原 3 例+each 8」计数有误**：本文件原为 **10 例**（3 条具名＋8 条 each，其中 each 的 8 已含在总数内），不是 11；新增后为 **11 例**。
- ⚠️ **本仓基线用例数随之变动：1337 → 1338**（+1）。常驻基线档 `docs/insights/colony-test-baseline-20260921.md` 的回写属人工/规划侧，本单未改。
- 行尾实测：`scatterDiskReconcile.test.ts` 改前改后均**纯 LF**（CRLF=0），同目录 `scatterAssets.test.ts` 是**纯 CRLF**——本族两文件行尾不同，勿按目录笼统处理。
- `public/` 零触碰：`git status --porcelain -- public/` 空；`bush_dry.webp` 仍在盘上未删。

## 六、留给主班/人工的裁决

1. **`bush_dry.webp` 去留**（本单显式不裁）：出口 A 删 `public/art/scatter/bush_dry.webp` ＋ 清空白名单；出口 B 改 `scripts/gen_scatter_art.py` 停产该图。两出口都要动资产或生成器，按 §硬规则属待人工授权项（与前浪登记的 `manifest_portraits_*.json` 四孤儿同型）。
2. **c922-16 item2.3 的接续面**：scatter 类目要进 manifest 权威时，本条反向用例是它在 manifest 侧的等价物——manifest 一旦收录散布图，白名单机制应被「manifest 列出即合法」取代，否则两处判据会各自漂移。
3. 本档未进 insights 索引（索引重建需授权）。
