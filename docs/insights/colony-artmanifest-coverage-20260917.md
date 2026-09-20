# colony artManifest 三类覆盖矩阵＋path 字段消费者核验（916p-a3-006，2026-09-17，只读）

## 一、逐类三列数字（命令与数字同段）

```
$ ls public/art/buildings | wc -l → 33      $ ls public/art/generals | wc -l → 5
$ ls public/art/events   | wc -l → 10      $ ls public/art/terrain  | wc -l → 5
BUILDING_ART 字面 35 id（源文件 :26-60 逐条可数）
BootScene：:46 building 派生（35）、:64 general 派生（5）、:70 EVENT_ART 遍历（10）、:53-55 terrain 字面数组（5）
```

## 二、覆盖矩阵（4 行 × 3 列）

| 类 | manifest 条数 | 磁盘文件数 | boot 加载条数 |
|---|---|---|---|
| buildings | 35 | 33 | 35（派生，2 缺图静默跳过） |
| generals | 5 | 5 | 5（派生） |
| events | 10 | 10 | 10（EVENT_ART 遍历） |
| terrain | 3 | 5 | 5（:53-55 字面数组） |

### buildings 差集（manifest 35 − 磁盘 33 = 2）

- **bld_tin_mine**：磁盘无 png；data/buildings.ts:132/440 有定义（rg 证据）
- **bld_hemp_field**：磁盘无 png；data/buildings.ts:430/440 有定义（rg 证据）
- 反向（磁盘有 manifest 无）：0

### terrain 差集

manifest 3（plain/hills/river）vs 磁盘 5（forest/hills/mountain/plain/river）→ **manifest 欠覆盖 2**（forest/mountain 由 BootScene :53-55 字面数组补足加载）。

## 三、path 字段消费者核验

```
$ rg -n "\.path" src/renderer --glob '*.ts' --glob '!**/__tests__/**'
src\renderer\state\gameStore.ts:2137:  if (result.unified && result.path) {
src\renderer\state\gameStore.ts:2139:    sf.unifyPath = result.path;
src\renderer\state\gameStore.ts:2140:    const seed = axisSeedForPath(result.path);
src\renderer\state\gameStore.ts:2144:    this.emitter.emit(STATE_EVENTS.STORY_UNIFIED, { path: result.path });
```

- gameStore.ts:2137-2144 的 `result.path` 属 **story 统一结局路径**（无关命中，非 ART_MANIFEST.path）。
- ART_MANIFEST 条目的 `path`（assets/*.webp 形态）：**零运行时消费者**（boot 实际加载走 getBootLoadList 的 `art/**/*.png` 公共目录 URL，不走 path 字段）。

## 四、结论

1. **artManifest.path 是死数据**（仅文档性描述；真实加载 URL 由 getBootLoadList/BootScene 另行拼装）。处置候选：删字段（53 行级改动＋类型）/ 改注释标注「仅文档用途」（1 行）/ 补消费（涉及 webp/png 双轨，改动面大）。推荐改注释，影响最小。
2. **terrain manifest 与落盘不等价**（3 vs 5）：boot 加载以 :53-55 字面 5 型为准；建议 manifest 补 forest/mountain 两条（+2 行）使文档面完整。
3. **buildings 缺图 2**（tin_mine/hemp_field）：boot 派生 35 条含此 2，缺图静默跳过——补 png（2 文件）或从 manifest/buildings.ts 移除（4+ 行）。

## 验收对照

- ✅ 四类命令与三个数字同段；矩阵 4 行 3 列。
- ✅ buildings 差集逐条 id＋data/buildings.ts 定义 rg 证据。
- ✅ path 消费者命中清单与判定（gameStore.ts:2137 无关命中已说明）。
- ✅ 结论明确回答两问（path 死数据＝是；terrain manifest 与落盘不等价＝是）。
- ✅ artManifest/BootScene/png 零改动；不 push。
