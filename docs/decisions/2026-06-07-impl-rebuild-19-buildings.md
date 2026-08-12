# Implement: 建造菜单缩略图 + 重做其余 19 栋建筑(剪影统一)

Date: 2026-06-07

## 原始需求
> 继续任务，这一轮全部完成再通知我（→ 按规划：建造菜单图标 + 重做建筑）

## 做了两块

### 1) 建造菜单缩略图(纪元式图标驱动)
BuildPanel 每行左侧加 34px 建筑缩略图(def.assetKey 等比缩放)：ButtonRow 加 thumb 字段；buildRows 建图(缺贴图则 null)；layout 定位+文字右移；refreshAffordance 按可建度调透明(买不起 0.45)；beginExpandFade 含 thumb；折叠/未解锁/滚动时隐藏。

### 2) 重做其余 19 栋建筑 → "纯建筑无地台"剪影
旧建筑美术带方形地台(色块感)，只有民居 V7 是剪影。用 gen_buildings_redo.py(D:\code\scripts)批量重做 19 栋：
- building-only 剪影 STYLE（NO base/ground，foundation meets black）+ 春秋历史约束（夯土墙/灰瓦/生木/无琉璃无飞檐无朱漆）+ masterpiece 质量；每栋一句功能描述。
- 并发限 4 + submit 重试（避 HTTP 429）。19/19 成功。
- key_black_bg 抠透明 → 覆盖 public/art/buildings/<id>.png（原图备份 art-library/buildings_backup/）。
- 重跑 gen_building_anchors.py 重测全部锚点（剪影锚点 anchorY≈0.88-0.92/footW≈0.83-0.86，与旧带座图不同，必须重算才对齐）。

建造菜单缩略图自动用上新剪影（同 assetKey）。

## 验证
type-check 干净；`npm test` **647 passed**；`electron:build:win` 成功。
纯美术 + 数据(锚点)，无逻辑改动、不走多模型协作。

## 待眼验/待续
- 19 栋一次性生成、未逐栋精修；个别若不满意可单独 re-roll（gen_buildings_redo.py 改对应 desc 重跑 + key + 重测锚点）。
- 个别建筑(如农田/桑园这类"地块型")剪影里仍可能有小块地面（井屋有地板），尚可接受。
- 剩余规划：河流软边 → 地形本体贴图(iso 畸变风险,谨慎) → 剧情/音乐/平衡专门阶段。

## 给用户摘要
建造菜单图标化了；全部 20 栋建筑统一成"纯建筑无地台"剪影(质量对齐民居)，锚点重测，菜单图标同步升级。
