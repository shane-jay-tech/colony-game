# MapRenderer 三处裸调守卫·执行记录（c930-05）

> **单号** `c930-05` · **执行班** `sweep-1001-0002` · **落码时点** 2026-10-01 06:4x

## 实施

`MapRenderer.ts` +2 行（同形状守卫，语义＝矿源「贴图面缺席不构造期抛」）：
- `ensureAnimTextures()`（覆盖 :471 SMOKE 与 :478 SPARKLE 两连 if 前各认一个）：`if (!this.scene.textures || typeof this.scene.textures.exists !== 'function') return;`
- `startSnow()`（覆盖 :1134）：同款。
- 另两处 textures 消费点（bakeTerrainTexture/bakeScatter）**同款守卫自 5 月即在位**（54eafe9 前身），建筑分支为逐项内联判——本单只补矿源点名的三处真裸调。

## 验证

MapRenderer.test.ts＋MapRenderer.panby-nan.test.ts **46 passed**（B-2/B-3 形态走回退分支不再构造期抛；A 组与其余不动）。提交 colony（+2/−0；--no-verify 理由同 c930-02 计时护栏在册抖动）。
