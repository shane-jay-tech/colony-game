# colony P1-4 散布／音频清单权威化设计稿（BootScene 第二事实源收口 · c922-110，2026-09-22T04:1x）

> 性质：**设计＋落地评估级，本单不实施**（`git diff src/` → 0，复验见 §八）。
> 判据不新造：盘↔键对账沿用 `scatterDiskReconcile.test.ts`（c922-107）与 `bootLoadList.test.ts` 双轨守卫（c922-04），
> 残余面口径沿用 `colony-plan-ledger-20260922.md` §2.3／§R5（c922-16）。本稿只做「怎么收、收了会红什么、值不值」。

## 〇、锚点复核（先按磁盘实况修正，再动手）

| 任务书锚点 | 磁盘现值 | 判定 |
|---|---|---|
| `BootScene.ts:58` `for (const id of SCATTER_IDS) {` | **:58**（循环体 :59、闭括号 :60；注释块 :55-57） | 未漂 |
| `BootScene.ts:77` `for (const key of ALL_BGM_KEYS) {` | **:77**（体 :78）；SFX 循环 **:80**（体 :81），`preload` 收尾 :83 | 未漂 |
| `artManifest.ts:115` 「地形已等价描述…散布/音频 manifest 未等价描述」 | **:115** | 未漂（措辞见 §一之 3） |
| `category` 联合类型定义行（任务书要求锚此行） | **`artManifest.ts:19`**：`category: 'building' \| 'general' \| 'event' \| 'ui' \| 'terrain';` | 新锚 |
| c922-16 给的残余行号 `:55-59`／`:77-81` | 实为 `:55-60`／`:75-82`（BGM :77-79、SFX :80-82） | **漂移 2 处**（各差 1 行尾），本稿一律用内容定位 |
| c922-16 称 audio 源在 `state/audioDirector.ts:29` | **:29-33** `ALL_BGM_KEYS`、**:36** `SFX_KEYS` | 未漂 |

## 一、残余两面现状（为什么它们算「第二事实源」）

1. **scatter**：键与地形池在 `data/scatterConfig.ts`（`ALL_SCATTER_IDS` :63-67、`SCATTER_KEY_PREFIX='scatter_'` :60），
   **URL 模板在 `BootScene.ts:59`**（`art/scatter/${id}.webp`），纹理键拼装**第三处**在 `MapRenderer.ts:599/602`（`SCATTER_KEY_PREFIX + id`）。
   ⇒ 同一事实三段散在三个模块，其中两段（模板、键拼装）在 manifest 之外。c921-02 转码时正是 :57 注释自述的那种「只改一轨」风险兑现过一次。
2. **audio**：键在 `state/audioDirector.ts:29/36`，**URL 模板与扩展名在 `BootScene.ts:78/81`**，
   且**两循环扩展名不同构**（BGM `.mp3`／SFX `.wav`）⇒ 任何「统一容器」的想法都会同时动两处。
3. `artManifest.ts:115` 的自述现在只说对了一半：地形／事件／建筑／将领四类已派生，
   但它没写「scatter 的键在 scatterConfig、只是没在 manifest 里」——**scatter 并非无权威源，而是权威源不在这张表**。
   这个区别决定了本稿推荐形态（§三）：scatter 收口＝**让 manifest 描述既有权威**，不是新建一份清单。
4. **本稿新发现的第三面**：`BootScene.ts:69-72` 的 EVENT_ART 循环虽然读 manifest 键，但 URL 是**本地重拼模板**
   （`art/events/${name}.webp`）而**没走 `asset.path`**；`getBootLoadList` (:133/:138) 同理。
   即：manifest 的 `path` 字段在生产码里**只有 TERRAIN_ART（:51-53）真被消费**。P1-4 若只收 scatter/audio，这条仍然漏着。

## 二、类型扩展点与硬约束（不满足就落不了地）

| # | 约束 | 锚点 | 影响 |
|---|---|---|---|
| C1 | `data/**` 不得 `import '../state/**'`，命中数恒 0（且扫描非空才算数） | `dataLayerBoundary.test.ts:29-38` | **audio 清单必须落在 data 层**（`artManifest.ts` 或新 `data/audioManifest.ts`），由 `state/audioDirector.ts` **反向 import** data（合法方向）。把 `ALL_BGM_KEYS` import 进 artManifest ＝ 直接撞门禁 |
| C2 | `path` 必须匹配 `^art/${category}s?/`（**动态正则、逐条目判**） | `bootLoadList.test.ts:86-96` | `category:'audio'` ＋ `path:'audio/bgm_war.mp3'` **必红**（缺 `art/` 前缀）。三选一：① 改判据（放开 audio 走 `audio/` 根）② 把 58 MiB 资产迁到 `public/art/audio/`（牵动 BootScene＋`audioKeys.test.ts:10` 的 AUDIO_DIR）③ audio **不进 ART_MANIFEST**，另立 `AUDIO_MANIFEST`（见 §五方案 B） |
| C3 | 全表 `path.endsWith('.webp')`（例外仅 NO_OWN_ART 两型，且例外集**逐名锁定**） | `artManifest.test.ts:49-60`、`:75-82` | `.mp3`／`.wav` 进 ART_MANIFEST **当场红**；`required` 计数 53→76、非 required 集必须仍等于那 2 键 ⇒ 该断言也得同步 |
| C4 | `ART_MANIFEST.length` ＝ 四个子数组之和 | `artManifest.test.ts:39`、`bootLoadList.test.ts:74-77` | 两处字面和式都要扩项（55→78） |
| C5 | `category==='ui'` 恒 0 条目 | `artManifest.test.ts:31` | 联合类型里 `'ui'` 是**休眠类目**（0 条），新增 `scatter`/`audio` 不冲突；但也说明「加了类目没人钉」是这张表的既成风格 ⇒ 新类目必须自带断言 |
| C6 | `getBootLoadList(category: 'building' \| 'general')` | `artManifest.ts:129` | 若沿用该函数需**拓宽签名**；但 scatter/audio 无 `BUILDING_ART_REUSE` 这种「键≠文件」需求 ⇒ **建议照 TERRAIN_ART 的直取 `asset.path` 模式**，让 :129 保持二类目（改动面更小） |
| C7 | 散布纹理键的唯一活体拼装方是 `MapRenderer`（他班**在途 M**件） | `MapRenderer.ts:599/602` | 收口**不得**要求 MapRenderer 改键来源，故 manifest 的 `key` 必须是 `scatter_<id>` 全名（含前缀），令 :599 的 `SCATTER_KEY_PREFIX + id` 与之同值；本稿 diff 对 MapRenderer **零改动** |

## 三、目标形态（推荐：批一 scatter「描述既有权威」，批二 audio 另表）

### 批一 · SCATTER_ART（派生自 scatterConfig，manifest 只补「路径＋实存」语义）

```ts
// artManifest.ts（新增；置于 TERRAIN_ART 之后、ART_MANIFEST 之前）
import { ALL_SCATTER_IDS, SCATTER_KEY_PREFIX } from './scatterConfig';   // 同层 data/，不触 C1

/** c922-1xx：散布资产清单——键与地形池的权威仍在 scatterConfig，本表只把「加载 URL」收进 manifest，
 *  使 BootScene 不再自带模板（消灭 c921-02 那类「改扩展名只改一轨」）。required=true 依 c921-01 口径＝path 实存。 */
export const SCATTER_ART: ArtAssetDef[] = ALL_SCATTER_IDS.map(id => ({
  key: `${SCATTER_KEY_PREFIX}${id}`,
  path: `art/scatter/${id}.webp`,
  category: 'scatter' as const,
  required: true,
}));
```

BootScene 侧 diff 草案（**本单不落地**）：

```diff
-    // W4：2.5D 散布素材（树/石/灌木/芦苇；缺则 MapRenderer 跳过散布）。
-    // h912-11：manifest 无 scatter 类目，保留原清单。
-    // c921-02：……属「manifest 之外的第二事实源」，改扩展名时必须与本行一起改（c921-01 报告第四节已登记）。
-    for (const id of SCATTER_IDS) {
-      this.load.image(`scatter_${id}`, `art/scatter/${id}.webp`);
+    // W4：2.5D 散布素材。P1-4 收口：URL 模板已上收到 artManifest.SCATTER_ART，此处只消费 key/path
+    // （同 TERRAIN_ART 模式），BootScene 不再持有第二事实源。缺图仍 loaderror 静默 → MapRenderer 跳过散布。
+    for (const asset of SCATTER_ART) {
+      this.load.image(asset.key, asset.path);
     }
```

净效果：BootScene 里 `art/scatter/` 字面量 **2 → 0**；`import { ALL_SCATTER_IDS as SCATTER_IDS }`（:5）随之删除（唯一消费点即 :58，实测排除定义面后仅 BootScene 两处命中）。

### 批二 · audio：不进 ART_MANIFEST，另立 `AUDIO_ART`（仍放 data 层）

因 C2＋C3 两条判据都以「`art/` 前缀 ＋ `.webp`」为契约，硬把 15 条音频塞进 `ArtAssetDef` 要**同时放宽两条全局断言**
——那是为了一个类目的便利去削弱其余 55 条的守卫，方向不对。推荐：

```ts
// 新 src/renderer/data/audioManifest.ts（与 data/audio.ts 同层，后者已承载 AUDIO_CUES）
export interface AudioAssetDef { key: string; path: string; kind: 'bgm' | 'sfx'; required: boolean }
export const AUDIO_ART: AudioAssetDef[] = [ /* 9 bgm_*.mp3 + 6 sfx_*.wav，逐条实存 */ ];
```

```diff
-    for (const key of ALL_BGM_KEYS) {
-      this.load.audio(key, `audio/${key}.mp3`); // BGM：Mureka 生成的 mp3
-    }
-    for (const key of SFX_KEYS) {
-      this.load.audio(key, `audio/${key}.wav`); // 音效：本地合成的短 wav
-    }
+    for (const asset of AUDIO_ART) {
+      this.load.audio(asset.key, asset.path);   // 扩展名逐条自带，两循环合一
+    }
```

`audioDirector.ts` 改为**派生**（方向合法：state → data），保持导出面不变以免惊动 `audioKeys.test.ts` 之外的消费点：

```ts
export const ALL_BGM_KEYS: readonly string[] = AUDIO_ART.filter(a => a.kind === 'bgm').map(a => a.key);
export const SFX_KEYS:     readonly string[] = AUDIO_ART.filter(a => a.kind === 'sfx').map(a => a.key);
```

代价点名：派生后「磁盘有 9 mp3」这一事实从**独立判据**退化为**与清单同源**，
所以 `audioKeys.test.ts:22-35` 的 `existsSync` 轨必须保留（它现在同时钉住了 `required=true` 的实存性），
并在该文件头注明「长度断言已改为派生自 AUDIO_ART，实存断言不得删，否则本族失去唯一的外部校验」。

## 四、翻桩测试清单（收了必红什么，逐条给现值→预期）

**先取现值（实跑，2026-09-22T04:1x）**：

```
$ npx vitest run src/renderer/data/__tests__/bootLoadList.test.ts
 Test Files  1 passed (1)
      Tests  10 passed (10)
```
（该文件 10 例；`63` 不是用例数，是 `:168` 的 `expect(total).toBe(63)` 这条**硬条目数**——
由 `LOAD_SOURCES` 五源复刻 35+5+8+5+10 而来。美术族 9 文件合计恰为 63 例，与这条 `63` 数字巧合、语义不同，引数别混。）

| 档:行 | 断言现值 | 批一（scatter）后 | 批二（audio，方案见 §五）后 |
|---|---|---|---|
| `bootLoadList.test.ts:168` | `expect(total).toBe(63)` | **仍 63**（scatter 8 条本就在内，只换来源） | 加 audio 源 → **78**（63＋9＋6）；不加源则维持 63 但 audio 无守卫＝**假绿面扩大** |
| `bootLoadList.test.ts:144-153` `LOAD_SOURCES` | 5 源，:142 刻意「重拼模板而非复用 getBootLoadList」 | **⚠️ 本档头号风险**：scatter 源若改成读 `SCATTER_ART.path`，而 BootScene 也读 `SCATTER_ART.path` ⇒ 不变量二（:171-184 `path↔loadUrl 同义`）**退化为 path 自比＝自反式假绿** | 同型，且 audio 连不变量二都没有可挂的 `ART_MANIFEST` 条目（另表时） |
| `artManifest.test.ts:39` | `toHaveLength(35+5+10+5)` = 55 | `+8` → 63 | 方案 A 再 `+15` → 78；方案 B 保持 63 |
| `artManifest.test.ts:49-60` | 全表 `.webp` ＋ 实存，例外 2 键逐名锁定 | 通过（scatter 全 `.webp` 且实存） | **方案 A 必红**（`.mp3`/`.wav` 撞 C3）；方案 B 不触 |
| `artManifest.test.ts:75-82` | `required` = 53、非 required 集 = 2 键 | 53→**61** | 方案 A →76 |
| `bootLoadList.test.ts:86-96` | `path` 匹配 `^art/${category}s?/` | 通过（`art/scatter/` 合式，`s?` 恰好容忍单数） | **方案 A 必红**（撞 C2） |
| `scatterSourceGuard.test.ts:12-15` | `toContain("ALL_SCATTER_IDS as SCATTER_IDS")` ＋ `toContain("for (const id of SCATTER_IDS)")` | **必红 2 条**（这两句正是钉住旧硬编码循环的） | — |
| `scatterSourceGuard.test.ts:17-24` | :22-23 用「&& 未被 SCATTER_IDS 循环豁免」的复合判据 | 判据整体作废（:58 循环消失后 :23 的 `!/for \(const id of SCATTER_IDS\)/` 恒真，:22 的 `(?!\$\{)` 面也随之失真）⇒ **须重写为「BootScene 不得出现 `art/scatter/` 字面量」** | — |
| `scatterSourceGuard.test.ts:26-29` | SCATTER_IDS 唯一来源＝scatterConfig | :27 的 `const \w*SCATTER\w* =` 禁令会**打到新增的 `SCATTER_ART`**（同为 `SCATTER` 字样赋数组）⇒ 放宽为「仅禁止 BootScene.ts 内」或改判 `SCATTER_ART` 只允许出现在 artManifest.ts | — |
| `scatterAssets.test.ts:23/28` ①①b | 8 键逐条有 `.webp`、原 png 已删 | 与 SCATTER_ART 的 `existsSync` 重复 ⇒ 保留（盘↔清单双向的另一半）或改指 `SCATTER_ART`，**别删**：它同时钉 ①b 的「png 不许回潮」 | — |
| `scatterDiskReconcile.test.ts:10/:37` | 8 键；反向＝盘上零引用 `.webp` 恰等 `['bush_dry.webp']` | 不受影响（读 `ALL_SCATTER_IDS` 不读 manifest）⇒ **c922-107 的白名单判据与本稿正交，不重复建设**（c922-109 §四亦已证同） | — |
| `audioKeys.test.ts:23/:31` | `ALL_BGM_KEYS.length===9`／`SFX_KEYS.length===6` | — | 值不变但语义变（字面→派生）；`:25/:33` 的 `existsSync` **必须留**，否则 audio 全盘失守 |
| `audioKeys.test.ts:37-41` | `AUDIO_CUES` 的 assetKey ⊆ SFX_KEYS | — | 不变（AUDIO_CUES 在 data 层，方向合法） |
| `tmp/art-exists-check.mts`（一次性探针，**未进 CI**） | `manifestKeys=55`、`unresolved=2`、`diskArtFiles=66`、`orphansArtFiles=13` | `manifestKeys→63`、**`orphans 13→5`**（8 件 scatter 假孤儿被声明；余 4 件 `manifest_portraits_*.json` ＋ `bush_dry.webp`） | 方案 A：`manifestKeys→78`、`unresolved` 仍 2；audio 不在 `public/art` walk 内 ⇒ 孤儿面不变 |
| `colony-scatter-bidir-20260922.md`（c922-107 档） | 自述「盘→键方向只有 scatter 目录」 | 需在收口提交里补一行口径更新（他班档，**由落地单负责并留痕**，本设计单不改） | — |

**翻桩次序规矩**（沿 c922-101/c922-105  precedent）：批一、批二**各自一提交**，每提交内「生产码＋翻桩断言」同改同交，
禁止先改码后补测试（会让中间态全绿但守卫空转）。批一优先，因为它不触 C2/C3 两条全局判据。

## 五、`audio` 进哪张表的三方案（这是 P1-4 唯一真需要人拍板的地方）

| 方案 | 形态 | 优点 | 代价 |
|---|---|---|---|
| **A 并入 ART_MANIFEST** | 扩 `category: \| 'bgm' \| 'sfx'`，`path: 'audio/x.mp3'` | 一张表统管全部启动资产，`getArtByCategory` 直接可用 | 必改 C2（:93 动态正则）＋C3（:56 `.webp` 全局契约）＋`ArtAssetDef` 的 docstring 资产约定（`artManifest.ts:6-13` 明写 `public/art/<类别>/*.webp`）＝**为一个类目放宽两条跨类目守卫**，且「Art」语义与 mp3 长期别扭 |
| **B 另立 AUDIO_ART（推荐）** | 新 `data/audioManifest.ts`，`kind: 'bgm'\|'sfx'` | 不动任何既有全局判据；扩展名逐条自带，合一两循环；audio 的「容器可换（mp3→ogg／降码率）」演进不牵动美术面 | 清单变两张表，`orphans` 类反向哨兵需各写一条（可照 `scatterDiskReconcile:37` 范式，属重复范式而非重复判据） |
| **C 只收 audio 进 ART_MANIFEST 的「派生面」** | 键仍留 audioDirector，BootScene 用 `AUDIO_KEYS.map(k=>({key:k,url:\`audio/${k}.mp3\`}))` | 最小改动 | **等于没收**：URL 模板还在 BootScene，c921-02 型风险原样保留；不推荐 |

scatter 侧无此分歧（`art/scatter/*.webp` 天然合 C2/C3），故**批一可直接实施**。

## 六、与 c922-14 BGM 体积画像的衔接（画像先行、清单后收）

`colony-bgm-audio-profile-20260922.md` 的两条结论直接决定次序：

1. 该档 §五点名：**同文件名替换字节 ⇒ 现 1295 例零转红**（全仓测试里 `.mp3` 只命中 `audioKeys.test.ts` 的一条存在性断言，无字节/md5/时长钉桩）。
   ⇒ **降码率（128k／96k）不依赖 P1-4**，可独立先行。体积以该档两行实数为准：现状 256k **54.97 MiB** → 128k **46.43 MiB** 产物预测 / 96k **39.56 MiB**。
   本单独立复算与 c922-14 逐位相符：`public/audio` 9 条 mp3 求和 **57,643,662 B = 54.97 MiB**，6 条 wav 254,278 B（0.24 MiB）
   ——**数字引自该档与本单复算，非本单新增结论**（经济/统计数值红线，只读）。
2. 但**换容器**（`.mp3` → `.ogg`/`.m4a`）会同时打红 `BootScene.ts:78` 模板、`audioKeys.test.ts:25-26` 的双探路 `existsSync`、
   （方案 A 时）`artManifest.test.ts:56` 的扩展名契约 ⇒ **正是 P1-4 要消灭的那类「改一轨」面**。

⇒ 落地建议次序：**批一 scatter 收口 → （体积档由人工定）96k/128k 换字节 → 若将来换容器，先有 AUDIO_ART 再动**。
本稿采「画像先行、清单后收」的原序，并把「换容器」这一格显式标为收口才安全的前提。
（注意：体积数字属只读引用，本单未跑任何 ffprobe；口径以其档内自写帧走查为准。）

## 七、工作量与风险估计（落地单照此排）

| 项 | 面 | 估 |
|---|---|---|
| 批一生产码 | `artManifest.ts` 新增 ~10 行 ＋ `ART_MANIFEST` 扩 1 行 ＋ `category` 联合 ＋1 ＋ `BootScene.ts` 循环替换 −4/+3 ＋ import 调整 | 4 个 hunk，零行为改动面（键与 URL 逐条同值） |
| 批一翻桩 | `scatterSourceGuard.test.ts` **3 例全改**（本档 §四 已列具体行）、`artManifest.test.ts` 2 处计数、`bootLoadList.test.ts` LOAD_SOURCES 1 处 | 5 档 8 处 |
| 批二生产码（方案 B） | 新 `data/audioManifest.ts`（15 条）＋ `audioDirector.ts` 两常量改派生 ＋ `BootScene.ts` 两循环合一 | 3 档 |
| 批二翻桩 | `audioKeys.test.ts` 头注释＋（若加 audio 源）`bootLoadList.test.ts:168` 63→78 | 2 档 |
| 主要风险 | ①**自反式假绿**（§四 首行 ⚠️）：守卫与被守卫方读同一常量后，不变量二失去外部性——必须换成「字面期望表」或「BootScene 源码正则禁止项」两种独立判据之一；②`scatterSourceGuard` 与 `bootLoadList` 都对 **BootScene.ts 源码文本**做正则，注释里出现 `art/scatter/` 字样也会打红，改注释需同步；③`MapRenderer` 是他班在途件，本稿 diff 刻意不触其 :599/:602 | 中 |
| 非空洞性自证 | 落地单须做变异：往 `ALL_SCATTER_IDS` 加一个假 id ⇒ `scatterAssets①`／`SCATTER_ART` 实存断言／`bootLoadList①` 三处至少各红一次；还原按纪律四步字节级（禁 `git checkout --`） | — |

## 八、本单自证（零实施）

```
$ git diff src/ | wc -l
0
$ npx vitest run            # 本档写作前后各一次
 Test Files  126 passed (126)      Tests  1338 passed (1338)
$ npm run type-check        → exit 0（pre-commit 同 gate）
```

现值登记：`ART_MANIFEST` 55 条 / `manifestKeys=55`、`LOAD_SOURCES` 63 条、`ALL_SCATTER_IDS` 8 键、
`ALL_BGM_KEYS` 9 键、`SFX_KEYS` 6 键、`public/audio` 盘上 9 mp3＋6 wav（与键集 1:1，无多余文件）、
`public/art/scatter` 盘上 9 webp（8 引用＋1 白名单孤儿）。

## 九、交人工／主班裁决点（本单不代决定）

1. audio 走 §五 **A / B / C** 哪一条（推荐 B；A 需授权「为单一类目放宽两条跨类目守卫」）。
2. 批二是否把 audio 加入 `LOAD_SOURCES`（加 ⇒ `total` 63→78 且 audio 上守卫；不加 ⇒ P1-4 名义收口但 audio 仍无盘校验，
   与 c922-109 的「根目录 JSON 无守护」同型失明）。
3. 是否顺手收 §一之 4 的 **EVENT_ART／getBootLoadList 的 URL 重拼面**（P1-4 未点名，但它是同一病灶的第三处；
   不收则「BootScene 无第二事实源」这句话仍不成立）。
4. `bush_dry.webp` 与 `manifest_portraits_*.json` 四件的处置（c922-109 已备三案表，等授权），与本单的次序耦合：
   **先合批一再处置孤儿**可让 `orphansArtFiles` 走 13→5→1，解释成本只付一次。
