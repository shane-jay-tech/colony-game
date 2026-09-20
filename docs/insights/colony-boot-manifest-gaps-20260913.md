# colony 散布/音频/UI_ART 入 boot 清单差异核查（c-19，2026-09-13，零改码）

## 三清单一表对账

| 清单 | 在 manifest？ | 在 boot 清单？ | 有消费点？ | 结论 | 证据 |
|---|---|---|---|---|---|
| 散布（SCATTER_IDS，scatterConfig.ts:61） | ❌ 无 scatter 类目（artManifest.ts 全文无 scatter 定义） | ✅ BootScene.ts:58-60 `load.image('scatter_'+id, ...)` | ✅ MapRenderer 散布绘制（缺图静默跳过） | **有意不入**——BootScene.ts:57 注释明载「manifest 无 scatter 类目，保留原清单」（h912-11 批次口径） | BootScene.ts:5,57-60 |
| 音频（ALL_BGM_KEYS/SFX_KEYS，audioDirector.ts:29/:36） | ❌ manifest 无 audio 类目（ArtAssetDef category 类型不含 audio，artManifest.ts:17） | ✅ BootScene.ts:76-81 `load.audio` | ✅ AudioManager 经 `cache.audio.exists(key)` 静音降级（BootScene.ts:74-75 注释） | **有意不入**——音频与图片资产生命周期不同（mp3/wav 缺文件属常态静默），入图类 manifest 反而破坏类型 | BootScene.ts:4,73-81 |
| UI_ART（artManifest.ts:69） | ✅ 在 manifest（并入 ART_MANIFEST:92） | ❌ BootScene 不加载（BootScene.ts 全文无 UI_ART 引用） |
| **2026-09-14 复核（d914-10）** | **UI_ART 条目已删除**（人工授权单 20260913-180934-afbc 执行；artManifest.ts 无 UI_ART 定义、ART_MANIFEST 59→53、BootScene/全库代码引用 0） | 防回潮断言在 artManifest.test.ts（category==="ui" 恒 0）；本行上方原「✅ 在 manifest」表述为**历史快照**，以本行为准 | ❌ 无消费点（artManifest.ts+其测试外全库无引用） | **缺载/未消费候选**——manifest 里有、boot 不载、无人用：既非「有意不入」的注释口径，也无运行时消费，属需拍板的清理项（删条目或补消费） | artManifest.ts:69,92；BootScene.ts 全文反查 |

## 结论：缺载 vs 有意不入

- 散布、音频：**有意不入**（均有 BootScene 内注释说明批次口径/降级设计），不建议扩 manifest；
- UI_ART：**真缺口**（三无：manifest 有/boot 不载/无消费点）——建议下批二选一：删除 UI_ART 条目与定义，或补 UI 层消费（若 ui/ 面板改走 Phaser 纹理时启用）。

## 证据方法

- `grep -rn "UI_ART" src`（反查消费点）；`sed -n` BootScene.ts:46-81 加载循环逐段核对；artManifest.ts:17 category 类型定义反证音频无法入 manifest。
- 零改码 ✓；未扩 manifest 条目 ✓。
