# colony 仓根 0 字节误入库文件 `=` 处置（916p-a3-001，2026-09-17）

## 取证（命令与输出同段）

```
$ git ls-tree HEAD -- "="
100644 blob e69de29bb2d1d6434b8b29ae775ad8c2e48c5391	=
$ git cat-file -s e69de29bb2d1d6434b8b29ae775ad8c2e48c5391
0                                  ← 0 字节确认
$ git log --oneline -- "="
e190158 fix: 邦交冷却拆分 + ZoomControl 定时器清理 + winChance NaN 兜底   ← 误入库提交
```

## 消费者反查（零消费者实证）

```
$ rg -n "\"=\"|'='" src scripts tests package.json
scripts\gen_music.py:40:  if line.startswith("#") or "=" not in line:      ← 字符串操作（= 字符判定），非文件引用
scripts\gen_music.py:42:  k, _, v = line.partition("=")                     ← 同上
（tests 目录不存在致 rg exit 2；src/scripts/package.json 无任何指向名为 "=" 文件的引用）
```

## 处置（命令与输出同段）

```
$ git rm "=" && git commit -m "chore(hygiene): 移除误入库的 0 字节 = 文件（e190158 误提交，零消费者）" -- "="
（pre-commit 钩子自动跑 type-check + 全量测试：91 文件 1145 tests 全绿后提交）
commit 50b2925
 = | 0
 1 file changed, 0 insertions(+), 0 deletions(-)
$ git ls-tree HEAD -- "="   → 输出为空 ✓
$ ls "="                    → No such file or directory（工作树与索引一并移除）✓
```

## 恢复方式

如需找回（0 字节无内容，仅占位）：`git revert 50b2925` 或 `git checkout e190158 -- "="`。

## 验收对照

- ✅ 提交后 ls-tree 输出为空（同段）。- ✅ log -1 --stat：1 file changed、删除动作。- ✅ rg 零消费者实证（gen_music 两处为字符串操作非文件引用）。- ✅ 报告含 e190158 与 blob e69de29 原文＋恢复方式。- ✅ 仅提交 `=` 一条路径；不 push。
