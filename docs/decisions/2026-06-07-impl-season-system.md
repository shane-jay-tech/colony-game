# A-3 季节机制绑定 + 视觉

**日期**: 2026-06-07  
**类型**: /implement  
**档位**: quick（辅助视觉模块，非核心架构）

## 需求

按 FULL_DEVELOPMENT_ROADMAP.md A-3，实现季节机制绑定 + 季节视觉反馈：
1. 四季 modifier 影响经济/建筑/人口
2. 散布层色调随季节变化
3. 冬季雪花粒子（max 50）

## 实现

### 机制层（seasonSystem.ts）

- `SEASON_EFFECTS` 定义四季效果：
  - 春：粮产×1.3 + 建造速度×1.2
  - 夏：人口增长×1.5
  - 秋：全资源产出×1.2~1.3
  - 冬：建造速度×0.67 + 粮耗×1.2 + 外交权重×1.3
- `makeSeasonModifier(season)` → remainingDays: -1 永久修饰符
- `applySeasonTransition()` → 原子性移除旧季+注入新季
- 注入时机：`startNewGameNpcs()`（新游戏）+ `replaceState()`（存档读取，无条件 strip+re-inject 防叠加漏洞）

### gameStore 集成

- `tickDay()` 中季节切换移到建筑建造循环之前（保证当天建造用新季节速度）
- 建造速度：`applyModifiers(1, 'building_construction_speed', ...)` 乘到 progress
- 人口增长：`applyModifiers(1, 'country_population_growth', ...)` 乘到 effectiveCfg
- 季节切换发射 MODIFIER_REMOVED + MODIFIER_ADDED 事件

### 视觉层（MapRenderer + GameScene）

- `SEASON_TINTS`: 春=0xd4f0c0 / 夏=0xf0e8a0 / 秋=0xf0c070 / 冬=0xc8d8e8
- `setSeasonTint(season)` 应用到所有 scatterImages + 控制雪花开关
- `startSnow()` — 生成 6×6 白点纹理，frequency=80ms，maxParticles=50，lifespan=4s
- `stopSnow()` — 销毁粒子发射器
- GameScene.create() 初始化时调用 `setSeasonTint` 确保载入即有正确色调
- GameScene 监听 SEASON_TICK 事件实时切换

## DeepSeek 审查摘要（5 维度）

### 功能正确性
- 发现：replaceState 如果不做无条件 strip，存档加载后可能残留旧季节 modifier 导致叠加 → **已修**

### 边界/防御
- 发现：constructor 注入 modifier 会破坏所有不期望 modifier 的单测 → **已修**（改到 startNewGameNpcs + replaceState）
- 发现：effects 浅拷贝可能跨实例污染 → **已修**（deep copy `.map(e => ({...e}))`)

### 安全
- 无发现（纯客户端游戏逻辑）

### 性能
- 发现：每 tick 都计算 constructionSpeedMul 即使无建造中建筑 → **已修**（hasConstructing 短路）
- 发现：季节切换发生在建造循环之后导致当天仍用旧速度 → **已修**（移到循环前）

### 可读性
- 发现：MODIFIER_REMOVED 事件缺失导致 UI 无法追踪 modifier 变化 → **已修**

**二轮 cross-critique**: 跳过（DeepSeek 无 critical 级别未修复项）

## 测试

- seasonSystem.test.ts: 11 tests（makeSeasonModifier / isSeasonModifier / applySeasonTransition / coverage）
- gameStore.test.ts: 91 tests（含季节相关的建造/人口/存档测试）
- 全套 689 tests 绿

## 仲裁

DeepSeek 5 条发现全部采纳修复。视觉层（tint + snow）属轻量视觉反馈，无需深档审查。
