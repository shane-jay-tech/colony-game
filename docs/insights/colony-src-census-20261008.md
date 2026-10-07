# colony 源码面普查（2026-10-08）· as any 7 处／TODO 现值／死资产剩余面（c1007-37）

> 三表全量 rg 复现；零改码。基线：grep -c "as any"（2026-10-07）＝7 处；TODO 17 处在册（n1004-76）；死资产清单＝c1007-07/11 已执行部分。

## 表一：`as any` 7 处逐处分型

| # | file:line | 面 | 分型 | 处置建议 |
|---|---|---|---|---|
| 1 | state/__tests__/populationClass.test.ts:27 | 测试 | Partial<GameState> 覆盖注入（`{ worldMap, ...overrides } as any`）——测试工厂合法逃逸 | 保留（测试夹具惯例；改造收益低） |
| 2 | state/__tests__/saveLoad.test.ts:538 | 测试 | 损坏档对抗喂入（`deserialize(blob as any)`——故意喂非法形状） | 保留（对抗测试本体即非法形状） |
| 3-4 | ui/__tests__/BuildPanel.test.ts:246/:321 | 测试 | Phaser Scene mock 双逃逸（`scene as never, buildMode as never ... as any`——Phaser 类型面重，mock 惯例） | 保留（Phaser mock 成本＞收益） |
| 5-6 | state/__tests__/saveLoadIo.test.ts:18/:22 | 测试 | globalThis.window 环境桩（node 环境装/卸 window） | 保留（vitest node 环境必需桩） |
| 7 | ui/__tests__/EventModal.test.ts:148 | 测试（注释内） | 注释叙述「private 取值」的备选方案记录，非实际 as any 代码 | 保留（注释） |

**结论：7/7 全测试面，生产面 `as any` ＝ 0**（rg 生产面排除 __tests__ 后零命中）——类型卫生现状健康，无需处置批。

## 表二：TODO 现值复点（n1004-77 执行后残余）

生产面（排除 __tests__）TODO 字样命中 4 处，**全部为「已完成事项的历史叙述」而非活欠账**：

| file:line | 内容 | 判型 |
|---|---|---|
| saveLoad.ts:22 | c919-04 TODO①：currentDay 存档上界护栏 | ✅ 已落地（叙述保留作溯源） |
| saveLoad.ts:472 | c919-04 TODO①：[0, MAX] 校验 | ✅ 已落地 |
| gameStore.ts:976 | c919-04 TODO①：tick clamp | ✅ 已落地 |
| shared/palette.ts:11 | c922-16/c923-16 白名单两条 TODO 收口对象 | ✅ 已收口（renderUiBoundary 白名单已清空账） |

测试面余字样（buildingRefs.test.ts:63「只记不改」陶窑 upgradesTo 一目标多来源、renderUiBoundary 数条叙述）＝**登记型叙述**非欠账。**活 TODO＝0**（与 c1007-34 saveGuard 系订正同口径互证）。

## 表三：死资产剩余面

- `tmp/` 现值 **153MB／226 项**（c1007-07 时点 130MB/223——增量＝l1007_22_vis 7 件 Top10 热图（c1007-28 新产）＋杂项）。清理单仍待 c1007-27 的 attic 差异（sfx 两 wav）主班裁决后一次执行。
- `dist-out/win-unpacked/` 旧包（Aug 13，c1007-26 实证含未剥除 debug/log）——主班重打包后可清。
- colony-dead-exports-20260914.json（在途 M）+ dead-field-trio-verdict-20261007.md（untracked，他班）——收编时并三枚死字段清单（c1007-36 已删 walkable、lastTick 暂缓、priority 待裁）。
- src 生产面：无新增死文件候选（c1007-07/11 已执行面之外 rg 无新孤儿）。

## rg 复现

$ grep -rn "as any" src --include="*.ts" | wc -l → 7
$ grep -rn "as any" src --include="*.ts" | grep -v "__tests__" → （空＝生产面 0）
$ grep -rn "TODO" src scripts --include="*.ts" --include="*.mts" | grep -v "__tests__" → 4（全历史叙述）
$ du -sh tmp/ && ls tmp/ | wc -l → 153M / 226
