# colony docs/insights 与 README/索引一致性（n915-78，只读）

- 任务：n915-78-colony-insights-index（created 2026-09-15T23:39:01，软预算 ≤20 分钟）
- 执行：sweep-20260915-2300（GLM-5.3-Flash），2026-09-16 03:1x
- **insights 共 19 个 md；README/OPTIMIZATION_BACKLOG 明文引用仅 1 个（savegame-compat-audit-20260905），18 个未被引用。**

## 未引用清单（18）

colony-aegis-cadence-20260915（本班新产）／colony-boot-manifest-gaps-20260913／colony-hills-naming-20260913／colony-manifest-authority-batch1-20260912／colony-manifest-equivalence-20260913／colony-registry-keys-20260913／colony-save-v3-test-20260913／colony-saveguard2-20260911／colony-saveload-ui-gap-20260913／colony-shared-visual-constants-20260913／colony-storynpcs-terrain-reachability-20260913／colony-typed-events-20260913／colony-ui-adapter-guard-20260913／colony-ui-webp-reuse-20260914／colony-v10-guard-spec-20260915（本班新产）／cross-build-deps-20260913／economy-params-inventory-20260905／savegame-compat-audit-20260905（被引用✓故不计）。

## 判读与建议

- 未引用 ≠ 缺陷：insights 属夜班只读报告沉淀（map/README 无义务逐份引用）——与根仓 docs/insights 同形态；
- 可选改进（不建议自动做）：README 加「docs/insights 索引」一节列 18 份（人工维护成本 > 收益，建议以目录列表自足）。

## 声明

未改 README/backlog；不 push。

## 遗留问题

无。


## 2026-09-17 重算（916p-a3-004）

- 实际份数：29 份（索引旧值 19 份为 9/15 快照）。
- 被引用（README.md / docs/design/*.md rg 命中）：1 份；未引用 28 份。
- 9/16 新增 5 份已补登：colony-hardcoded-inventory-20260916, colony-kiln-market-semantics-20260916, colony-migration-v10-guard-20260916, colony-savematrix-extend-20260916, colony-retired-module-residual-20260916。
- 本日另入库：dead-exports JSON（916-16, fa63ff0）、retired-render/outarg/cwd 清单等 916p 批报告。

### 逐份引用面表（29 行）

| # | 文件 | 被引用（README/design） |
|---|---|---|
| 1 | colony-aegis-cadence-20260915.md | 未引用 |
| 2 | colony-boot-manifest-gaps-20260913.md | 未引用 |
| 3 | colony-hardcoded-inventory-20260916.md | 未引用 |
| 4 | colony-hills-naming-20260913.md | 未引用 |
| 5 | colony-insights-index-20260915.md | 未引用 |
| 6 | colony-kiln-market-semantics-20260916.md | 未引用 |
| 7 | colony-manifest-authority-batch1-20260912.md | 未引用 |
| 8 | colony-manifest-equivalence-20260913.md | 未引用 |
| 9 | colony-migration-v10-guard-20260916.md | 未引用 |
| 10 | colony-registry-keys-20260913.md | 未引用 |
| 11 | colony-retired-module-residual-20260916.md | 未引用 |
| 12 | colony-retired-render-20260917.md | 未引用 |
| 13 | colony-save-v3-test-20260913.md | 未引用 |
| 14 | colony-saveguard2-20260911.md | 未引用 |
| 15 | colony-saveload-ui-gap-20260913.md | 未引用 |
| 16 | colony-savematrix-extend-20260916.md | 未引用 |
| 17 | colony-shared-visual-constants-20260913.md | 未引用 |
| 18 | colony-start-here-count-drift-20260917.md | 未引用 |
| 19 | colony-storynpcs-terrain-reachability-20260913.md | 未引用 |
| 20 | colony-stray-eq-file-20260917.md | 未引用 |
| 21 | colony-typed-events-20260913.md | 未引用 |
| 22 | colony-ui-adapter-guard-20260913.md | 未引用 |
| 23 | colony-ui-webp-reuse-20260914.md | 未引用 |
| 24 | colony-unreachable-resourceSystem-20260912.md | 被引用 |
| 25 | colony-untracked-tests-intake-20260917.md | 未引用 |
| 26 | colony-v10-guard-spec-20260915.md | 未引用 |
| 27 | cross-build-deps-20260913.md | 未引用 |
| 28 | economy-params-inventory-20260905.md | 未引用 |
| 29 | savegame-compat-audit-20260905.md | 未引用 |
