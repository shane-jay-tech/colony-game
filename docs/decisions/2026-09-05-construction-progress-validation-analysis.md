# constructionProgress 语义范围校验分析（决策支撑，2026-09-05/06 夜）

- 对应：saveGuard2.test.ts 留下的 TODO「constructionProgress 只验 finite，未约束语义范围」。
- 本报告只读产出证据与规则草案，不落地代码；是否实现归日间拍板。
- 全仓引用 81 处；写点集中在 `src/renderer/state/gameStore.ts`，校验点唯一在 `src/renderer/state/saveLoad.ts:708-709`。

## 一、语义域枚举（全部读写点，带 文件:行号）

| 点 | 位置 | 语义 |
|---|---|---|
| 类型定义 | src/renderer/data/schema.ts:131 | `constructionProgress: number`（BuildingInstance，百分比 0–100） |
| 存档校验 | src/renderer/state/saveLoad.ts:708-709 | 仅要求 `Number.isFinite`（NaN/Infinity 拒），**无值域/无跨字段校验**；:727 原样透传 |
| 新建 | src/renderer/state/gameStore.ts:776 | 初始 0，status='constructing' |
| 升级重置 | src/renderer/state/gameStore.ts:868 | upgradingTo 设定后 progress 重置 0、status='constructing' |
| 瞬时建造 | src/renderer/state/gameStore.ts:1010-1013 | time≤0 时直接置 100 + status='working' |
| 逐 tick 推进 | src/renderer/state/gameStore.ts:1017 | `+= (100/time) × constructionSpeedMul` |
| 浮点兜底闸门 | src/renderer/state/gameStore.ts:1019-1023 | ≥99.999 → 置 100 + 'working'（DeepSeek findings：防 99.9999 卡住） |
| UI/渲染读取 | src/renderer/ui（进度条）与测试 fixtures（MapRenderer.test.ts:348-356 用 100） | 只读展示 |

**实际取值域（由写点归纳）**：[0, 100]；随 constructing 单调不减；升级启动瞬间合法回退到 0；100 与 status='working' 配对出现。

## 二、等价类分析（无历史样本存档，按写点等价类）

| 类 | 值 | 现行 loader 行为 | 下游后果 |
|---|---|---|---|
| E1 合法建造中 | 0 ≤ cp < 100, status='constructing' | 通过 | 正常 |
| E2 合法完成 | cp=100, status='working' | 通过 | 正常 |
| E3 恶意/损坏 <0 | cp=-42 | **通过（缺口）** | 进度条负值；tick 从负数继续累加 |
| E4 恶意/损坏 >100 | cp=1e9 | **通过（缺口）** | UI 溢出展示；若未来逻辑用 100-cp 计算剩余会出负数 |
| E5 NaN/±Infinity | — | 拒（:708 已挡） | — |

## 三、校验规则建议（草案，含误报评估）

1. **值域规则**：`0 ≤ cp ≤ 100`，越界按 clamp 处理（<0→0；>100→100），status 保持原值。
   - 误报风险：极低——全仓写点均在 [0,100]；唯一越界来源是损坏存档。
   - 边界例：99.999（兜底闸门前状态）合法；0（新建/升级重置）合法。
2. **跨字段规则 A**：`cp ≥ 99.999 ⇒ status='working'`（与 gameStore 闸门语义对齐，修复"卡在 99.999 但 status 恒 constructing"的损坏档）。
   - 误报风险：低——正常流 99.999 即翻 working。
3. **跨字段规则 B**：`status='working' ⇒ cp=100`（working 的定义即建成）。
   - 误报风险：需核对——'working' 是否只由建造完成/瞬时建造进入（grep 显示两处入口均先置 100 再翻 working）✓；建议实现前全量跑一遍存档兼容 fixture 确认无"working 且 cp<100"的合法历史档。
4. **不建议做单调性校验**：升级重置（868 行）是合法回退到 0，载入单快照也无从判断历史轨迹；只作文档说明。

## 四、钉桩测试实现草案（vitest，不进 tests/，是否落地归日间）

```ts
// 建议追加到 saveGuard2.test.ts（或独立 saveProgress.test.ts）
import { deserialize } from '../saveLoad';

function withBuilding(cp: number, status = 'constructing') {
  const v = validV9(); // 复用 saveGuard2 的最小档工厂
  (v.state as any).buildings = [validBuilding({ constructionProgress: cp, status })];
  return deserialize(v);
}

it('E3 负值 clamp 到 0', () => {
  expect(withBuilding(-42).buildings[0].constructionProgress).toBe(0);
});
it('E4 超百 clamp 到 100', () => {
  expect(withBuilding(1e9).buildings[0].constructionProgress).toBe(100);
});
it('规则A cp>=99.999 → status working', () => {
  expect(withBuilding(99.999).buildings[0].status).toBe('working');
});
it('规则B working → cp=100', () => {
  expect(withBuilding(37, 'working').buildings[0].constructionProgress).toBe(100);
});
it('NaN/Infinity 仍被拒（既有行为回归）', () => {
  expect(() => withBuilding(NaN)).toThrow(SaveLoadError);
  expect(() => withBuilding(Infinity)).toThrow(SaveLoadError);
});
```

（规则 A/B 为 loader 内行为变更；若日间选择"仅报告不实现"，本草案可直接作为验收用例。）

## 五、结论

- loader 缺口真实存在（E3/E4 通过），但下游 tick 逻辑对负值/超百最终会被 100-cap/≥99.999 闸门部分吸收——**风险评级：中低**（UI 显示污染 + 剩余时间计算可能的负值）。
- 推荐方案：loader 增加规则 1+2+3（三行改动级），配上述 5 条钉桩用例；实现与否归日间拍板。
