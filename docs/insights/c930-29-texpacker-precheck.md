# free-tex-packer 退役联动预检·执行记录（c930-29，只读零落笔）

> **单号** `c930-29` · **执行班** `sweep-1001-0002` · **盘点时点** 2026-10-01 05:5x（实测）

## ① 盘态三读数

**a. package.json scripts 现值（10 键）**：dev/build/preview/electron:build/electron:build:win/gen-icon/type-check/art:exists-check（c930-21）/test/verify——**pack-sprites 与 postprocess-png 两键已不在** ⇒ 案 B 的「npm 键删除」已由主班落地。

**b. 两脚本/依赖 porcelain**：
- `scripts/pack-sprites.mjs`：**tracked、clean、未 git rm**（末笔 15769cb Initial）——本体退役腿未执行；
- `scripts/postprocess-ai-png.mjs`：在盘（postprocess-png 键的指向本体，同样未 rm）；
- `free-tex-packer-core`：package.json **:29 仍在 dependencies**＋package-lock.json :19/:3913 两处 ⇒ **npm uninstall 未执行**。

**c. 文档行现值**：
- `README.md:10`：「- free-tex-packer 精灵图打包、脚本化图标与素材后处理」——原句在；
- `docs/design/00_上手须知_START_HERE.md:124`：`| pack-sprites | 打包精灵图 |`、`:125`：`| postprocess-png | AI 生成 PNG 后处理 |`——**两行教的 npm 键已不存在＝文档漂移已成立**（c927-63 的"必须同删"预警应验）；`:123` gen-icon 行活（electron:build 依赖）。

## ② 同笔方案（腿 A＋收尾逐处行级改法；执行时序＝全部同笔，防"文档教不存在命令"窗口延长）

| # | 处 | 精确改法 |
|---|---|---|
| 1 | `git rm scripts/pack-sprites.mjs` | 本体退役（src/ 零引用已核） |
| 2 | `scripts/postprocess-ai-png.mjs` | **独立裁决项**：它是 AI PNG 后处理本体（与 free-tex-packer 打包无依赖关系），**不建议随本批 rm**——只随动删它的 npm 键（已删） |
| 3 | `npm uninstall free-tex-packer-core` | package.json :29＋lock :19/:3913 自动重锁 |
| 4 | `README.md:10` | 案甲（机械）＝整行删；案乙（文案裁决，需人工点头）＝改「- 脚本化图标与素材后处理」 |
| 5 | `START_HERE.md:124` | **删行**（pack-sprites 键已不存在） |
| 6 | `START_HERE.md:125` | **删行或改指**：postprocess-ai-png.mjs 本体若保留，可改「postprocess 处理（无固定命令，见 scripts/postprocess-ai-png.mjs）」——文案裁决 |
| 7 | 在册注记 | c927-01 系文档无涉；c927-63 产出档补一行「腿 A 落地态见本档」 |

**同笔清单（一次 commit）**：#1＋#3＋#5 必做；#4 择文案案；#2/#6 捆绑裁决。

## 自证

只读：node -e 读 scripts、grep、git log/status、sed 读行——`git diff` 零改动；未执行 git rm/npm uninstall/文档落笔。
