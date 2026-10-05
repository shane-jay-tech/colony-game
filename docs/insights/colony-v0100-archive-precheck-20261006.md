# v0.10.0 归档三件只读预检清单（c1004-17，2026-10-06，零 git 写操作）

## 三件现值读数

### ① tag 打点

- `git tag -l` → **空**（tags=0，v0.10.0 未打）。
- 版本号位核对：docs/CHANGELOG.md:4 引 `docs/release-notes-v0.10.0.md`（版本号位 `ebb37db`，2026-08-13）；`git log --oneline -1 ebb37db` → `ebb37db chore(release): v0.10.0 —— 版本/README/文档同步（P1-P3 已落地状态）` **可达且在册**。
- 打点参考命令：`git tag -a v0.10.0 ebb37db -m "v0.10.0 release (P1-P3 landed)"`（annotate 可选）。

### ② 包体重跑

- 盘上包体：dist-out/邦国录-0.10.0-{x64,portable}-x64.exe，mtime **2026-08-14 01:51**（=ebb37db 时点构建）；
- HEAD（1fea8ac）距 ebb37db **343 commits** ⇒ 包体对应代码落后 HEAD 约 343 笔，「当前 HEAD 的包」需重跑打包（命令按仓内 release 流程，归档时人工执行）。

### ③ CHANGELOG 版本位

- CHANGELOG.md 窗口 2026-09-05→09-25（188 笔）＝v0.10.0 **之后**的变更，尚无 v0.11 版本位——归档若打 v0.10.0 tag 于 ebb37db，则 CHANGELOG 覆盖的是「下一版」内容，**版本位不冲突**（eb37db 是上一版号位）。

## 归档步骤清单（执行留人工）

1. `git tag -a v0.10.0 ebb37db -m "v0.10.0"`（前置：确认 tag 对象选 ebb37db 而非 HEAD——包体是 ebb37db 构建的）；
2. 重跑打包（若交付物要求当前 HEAD，则 tag 需重议打 HEAD 还是 ebb37db——**两选一需先定**：tag=代码点 ebb37db 与包体自洽；tag=HEAD 则须重打包）；
3. 归档注记：dist-out 包体 mtime 与 tag 对象写入 release-notes。
