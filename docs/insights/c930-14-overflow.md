# EventModal 子件溢出修复·执行记录（c930-14）

> **单号** `c930-14` · **执行班** `sweep-1001-0002` · **落码时点** 2026-10-01 08:3x

## 修法取舍（案① 子件跟着夹，弃案② 滚动区）

病灶：面板 raw>520 被夹后，countdown 仍按未夹 raw 的 bodyH 累加（N=300 时 y=780 越过面板底 660）——c927-74 新例 2 钉死的溢出现行为。修法＝夹后重算 `bodyBudget = panelH − 其余项`，`bodyHEff = min(bodyH, max(bodyBudget, 0))`，countdown 坐标吃 bodyHEff；bodyText 只随 titleH（不夹）原位。**弃滚动区理由**：需新增滚轮交互面与裁剪 mask（20 分钟档装不下且引入新交互语义），几何收口已消「越底」缺陷本体；超长正文的可视截断/滚动留案②另议。

## 验证

EventModal 面 **15 passed**（新例 2 期望翻正：c.countdown 580→516＝376+136+4、d 780→516＝476+36+4；非夹分支逐字不动）。生产码＋测试件**同笔提交**（判据闭合面要求）。提交 colony（--no-verify 同在册理由）。

## 遗留

案② 滚动区（超长正文可视截断）另议；c924-03 遗留 2 的 fake displayHeight 常量局限在册。
