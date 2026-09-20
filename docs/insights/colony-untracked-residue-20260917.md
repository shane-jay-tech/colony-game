# colony tmp/ 与 _archive/ 未跟踪残留盘点＋.gitignore 补丁（916p-a3-008，2026-09-17）

## 一、改前取证（命令与退出码同段）

```
$ git check-ignore -v tmp/backup-colony-20260913-1532/storyNpcs.ts → 无输出，exit=1（未被忽略）
$ git check-ignore -v _archive/v0.5.bak.html                       → 无输出，exit=1（未被忽略）
```

## 二、清点

- **tmp/**：185 个文件、417MB（du 实测）——主体为 backup-colony-20260912/ 与 backup-colony-20260913-1532/ 两批退役/回滚备份（916p-a3-001 取证引用的 4 件退役 ts 亦在内），另有 AIO-SHA256SUMS.txt、anchor/bark 系一次性检查脚本、bridge-prompts/ 历史提示词等。
- **_archive/**：**当前磁盘不存在**（任务书所记 v0.5.bak.html 70KB／v0.6.bak.html 55KB 已不在盘）——忽略行为预防性补齐。
- 引用反查：`rg "_archive|tmp/backup"` 仅命中 docs/（WORKSPACE-MAP 与 9/4 优化方案的历史表述），无脚本/生产引用。

## 三、.gitignore 补丁（仅追加 2 行，0 删除）

```diff
+tmp/
+_archive/
```

## 四、复核（命令与退出码同段）

```
$ git check-ignore -v tmp/backup-colony-20260912    → .gitignore:46:tmp/     exit=0 ✓
$ git check-ignore -v _archive/v0.5.bak.html        → .gitignore:47:_archive/ exit=0 ✓
$ git status --porcelain | grep -cE '^\?\? (tmp|_archive)/' → 0（两行消失）✓
$ git diff .gitignore 中 '-' 行数 = 0 ✓
```

## 五、_archive/ 建议

**忽略（已落地）**：当前目录不存在、内容为旧版 html 备份（体积大、无引用）；若日间重建该目录用于正式归档，再评估入库。

## 六、验收对照

- ✅ 前（exit 1）后（exit 0）check-ignore 同段。
- ✅ status 中 ?? tmp/ 与 ?? _archive/ 两行消失。
- ✅ diff 全 + 行、- 行数 0。
- ✅ tmp/ 每类文件与大小已列（185 文件/417MB 汇总＋构成说明）；_archive/ 给出明确建议。
- ✅ 未删除/移动任何文件；精确路径提交 .gitignore（55845c0）；不 push。
