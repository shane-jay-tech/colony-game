# colony 孤儿交付物族 B（saveLoad +4 例 ＋ saveGuard3 TODO 退役）归位核验记录 · 2026-09-23

- 任务：`c923-05`　班：`qoder-executor-20260923-0022-colony3`　cwd `D:\code\colony-game`
- 开工 HEAD：`c7171e9`（01:50 现场取）
- **结论：核验通过（两文件 diff 与上游描述实质吻合、注释断言逐条为真、门禁全绿），但按约束本单零提交 → status partial，交主班代提交。**

## 一、为什么没提交

与族 A 同因，两条上位约束一致禁止子班提交这两件：纪律档 §三「子班一律不 commit/add」＋ colony2 下传「7 项在途全是他班的，`saveLoad.test.ts`／`saveGuard3.test.ts` 在列 ⇒ 禁碰禁提交，要动其中某件先落 partial 交主班」。

## 二、核验记录

### 2.1 `saveLoad.test.ts` = **+4 例，45 → 49**（吻合）

| 项 | 读数 | 命令 |
|---|---|---|
| 磁盘 `it(` 数 | **49** | `git grep --no-index -c -E "^\s*it\(" -- src/renderer/state/__tests__/saveLoad.test.ts` |
| HEAD `it(` 数 | **45** | `git show HEAD:src/.../saveLoad.test.ts` → python `re.findall(r'^\s*it\(', t, re.M)` |
| diff 形状 | 3 hunk、**+49 / -0**（纯新增，零删除）| `git diff --numstat` |

⇒ c922-08「族 B = saveLoad.test.ts +4 例」**成立**。本机无 `rg`，`rg -c` 口径一律换 `git grep --no-index -c`。

新增 4 例点名（均为存档兼容回归）：
- `d913c-22/d914-17` 系：`迁移入口（v2→current）遇畸形存档抛 SaveLoadError 而非 TypeError`
- `c22 schema v3 compat read` describe 块 3 例：v3 读取成功补默认值 / v3 speed 钳制 / v3 `state:null` 迁移中抛错

### 2.2 `saveGuard3.test.ts` = **纯注释行，零断言变化**（吻合），但**动作方向与上游描述相反**

`git diff --numstat` → **+1 / -2**，1 个 hunk（:45 一带）。全部 3 行都是 `//` 注释：

```
-    // TODO(日间): loadFromSlot(saveLoad.ts:771) 的 JSON.parse 不包异常，真·截断档
-    // 从磁盘路径会裸抛 SyntaxError——若要收敛需包一层 SaveLoadError（本测试不钉该路径）。
+    // 磁盘路径的损坏档已于 saveLoadIo.test.ts 钉住（020c 已收敛为 SaveLoadError）。
```

⇒ 这是**一条 TODO 的退役**（删 2 增 1），不是上游说的「加 2 行注释」。语义上更重（撤销了一个在册缺陷标记），所以本单把它的真伪逐条查了：

| 注释断言 | 核实 | 证据 |
|---|---|---|
| 「磁盘路径损坏档已于 `saveLoadIo.test.ts` 钉住」 | **真** | 该文件存在且**已跟踪**（`git ls-files --error-unmatch` 通过），`:27` 正是 `it('截断 JSON → SaveLoadError 含 "not valid JSON"')`；其文件头自述 `d914-51：补齐 loadFromSlot 对「磁盘存档损坏」场景的零覆盖（saveGuard3.test.ts:48-49 过期 TODO）` —— 与被删的两行号精确对上 |
| 「020c 已收敛为 SaveLoadError」 | **真** | `src/renderer/state/saveLoad.ts:811-819`：`// 020c：截断/损坏档不再裸抛 SyntaxError，统一 SaveLoadError 通道` ＋ `try { JSON.parse } catch → throw new SaveLoadError(...)`。且该文件 `git diff --quiet` 干净 ⇒ 收敛已在 HEAD，不依赖本笔 |

⇒ **删这条 TODO 是正确的、有出处的**，不是丢账。上游只说「2 行注释」会让人低估它的含金量。

### 2.3 用例数跳变：现场重取为 **1391 → 1395**（任务书明令勿抄旧值）

- 现盘态全量：`npx vitest run` → **130 文件 / 1395 例 / 0 失败**（01:46 取）。
- 脏树里唯一的测试**用例数**增量就是本族 saveLoad 的 +4（saveGuard3 是注释、MapRenderer/BuildPanel 无测试；porcelain 无任何 `??` 测试件）。
- ⇒ HEAD 口径 = 1395 − 4 = **1391**，提交族 B 后回到 **1395**。
- **否证**：c922-08 写的「1268→1272」已过期 **123 例**（那是 9 月中的口径）。若照抄会当场造出一个假基线。

## 三、门禁实测

| 门 | 命令 | 读数 |
|---|---|---|
| type-check | `npm run type-check`（`tsc -p tsconfig.renderer.json --noEmit`）| **rc=0，0 错误** |
| 定向（完成标准②）| `npx vitest run .../saveLoad.test.ts .../saveGuard3.test.ts .../saveLoadIo.test.ts` | 3 文件 **67 例全绿**，其中 saveLoad **49**、saveGuard3 14、saveLoadIo 4 |
| pre-commit 全量门 | `npx vitest run` | **130 / 1395 / 0 failed** |

## 四、交主班的代提交件（精确路径 + 建议 message）

```
git add -- src/renderer/state/__tests__/saveLoad.test.ts src/renderer/state/__tests__/saveGuard3.test.ts
git commit -m "test(save): 族 B 孤儿交付物归位（d913c-22 + d914-17 补交）

saveLoad.test.ts +4 例（45→49 it）：畸形 v2 存档走迁移入口必须抛 SaveLoadError
而非裸 TypeError；c22 schema v3 兼容读取 3 例（补默认值 / speed 钳制 / state:null 抛错）。
saveGuard3.test.ts 退役一条过期 TODO：其磁盘路径缺陷已由 saveLoadIo.test.ts(d914-51)
钉住、020c 已在 saveLoad.ts:811-819 收敛为 SaveLoadError，纯注释改动零断言变化。

⚠ 用例数跳变（现场重取，勿抄旧档 1268→1272）：全量 1391 → 1395（+4）。
盘态门禁实测：type-check 0 错 + vitest 130 文件/1395 例全绿。"
```

## 五、遗留问题

1. **`:679` 是一枚刻意松掉的断言，会把已知缺陷钉成"正确行为"**：
   `expect(() => deserialize({ schemaVersion: 3, state: null, worldMap: null })).toThrow();`
   —— 裸 `.toThrow()` 只要求"抛了点什么"，实测抛的是原生 `TypeError` 而**不是** `SaveLoadError`；其上方注释自认「非 SaveLoadError 类型，修复另批」。
   ⇒ 这笔提交**本身没问题**（它诚实标注了现状），但**它给未来的修复埋了一个假绿**：哪天 020c 类收敛做完了，这条仍然绿。建议主班另开一单把它收紧成 `toThrow(SaveLoadError)`。**本单不改**（改他班在途测试件＝越界，且属"收紧判据"）。
2. `:1` 新增 `import assert from 'node:assert'`、`:113` 用 `assert.fail()` —— 在 vitest 文件里混用 node:assert。功能无碍（vitest 会捕获），但风格与本仓其余断言不一致，一并交主班裁。
3. 「禁碰禁提交」与本单「须提交」冲突需主班裁决，同族 A 第五条。
