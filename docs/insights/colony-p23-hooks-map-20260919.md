# colony P2-3 操作反馈钩子盘点（s918-13 / 只读缺口表，零改动）

> 2026-09-19｜执行班 sweep-20260918-2300。

## 锚点复验
- GameScene.ts:337 `?.show(\`已拆除${name}，返还半数材料\`, 'info')` ✓（:459 同款第二处）。
- OPTIMIZATION_BACKLOG.md:51 P2-3 操作反馈条目 ✓ 在案。

## 缺口矩阵（rg 复跑计数一致；GameScene+UIScene 合并口径）

| 事件类型 | toast.show 命中 | 音效（sfx/audioDirector）命中 | 判定 |
|---|---|---|---|
| 建筑放置 | **0** | **0** | 无反馈（放置成功静默） |
| 建筑完工 | **0**（拆除 toast :337/:459 属拆除类，非完工） | **0** | 无反馈 |
| 资源不足 | **0** | **0** | 无反馈 |
| 国格晋升 | **0** | **0** | 无反馈 |
| 危机时刻 | **0** | **0** | 无反馈（文案关键词零命中） |

汇总（rg 实测）：GameScene toast 相关 10 行／UIScene 30 行（均为拆除/通用提示，非五事件语义）；GameScene+UIScene 音效调用（playSfx/SFX/audioDirector）＝ **0**；audioDirector.ts 定义了 9+6 音效键但**两个场景零接线**。

## 判定
五类事件在场景层**全部缺反馈钩子**——SFX_KEYS（sfx_place/sfx_warn/sfx_gong 等）早已定义并被 T35/S4 对账守卫，但没有任何调用点。P2-3 的实际工作量＝给五类事件各接一处 toast/sfx（toast 侧已有 registryGet(toast) 模式可复制），属小改动批量。

## 遗留
- 落地批次建议顺序：危机 warn → 资源不足 info → 放置/完工 place → 晋升 bell（音频文件均已实存，接线即用）。
