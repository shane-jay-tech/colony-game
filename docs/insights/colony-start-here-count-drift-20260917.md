# colony START_HERE 测试计数漂移订正（916p-a3-003，2026-09-17）

## 实测（命令与数字同段）

```
$ npm.cmd test
Test Files  91 passed (91)
     Tests  1145 passed (1145)
```

## 四处订正（原文行号 → 改后）

| 行 | 改前 | 改后 |
|---|---|---|
| 4 | 1140 测试绿…（2026-09-15 实测：90 文件 / 1140 用例全绿） | 1145 测试绿…（2026-09-17 实测：`npm test` → 91 文件 / 1145 用例全绿） |
| 25 | vitest，1140 条必须全绿 | vitest，1145 条必须全绿 |
| 38 | type-check && 1140 测试 | type-check && 1145 测试 |
| 50 | 1140 测试 + type-check 干净（2026-09-15 实测…） | 1145 测试…（2026-09-17 实测：91 文件 / 1145 用例全绿） |

## 复验

```
$ rg -n "1140" docs/design/00_上手须知_START_HERE.md   → 无输出（exit 1）✓
$ rg -n "1145" docs/design/00_上手须知_START_HERE.md   → 4 处命中 ✓
$ npm.cmd run type-check                                → exit 0 ✓
```

## 验收对照

- ✅ npm test 数字同段（91/1145）。- ✅ rg 1140 空 / rg 1145 ≥3。- ✅ type-check exit 0。- ✅ 精确路径提交；不 push。
