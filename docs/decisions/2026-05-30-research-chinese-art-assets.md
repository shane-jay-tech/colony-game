# 2026-05-30 Research: 中国风游戏开源素材调研

## 任务背景
邦国录游戏（个人非商用），CC-BY-NC 许可可接受，调研 A/B/C/D 四类素材

## 调研方法
- 主力：DeepSeek V4 Pro（Kimi 本次全部返回空，已知 relay 健康但任务 exit 6）
- 补充验证：DeepSeek 对各 URL 置信度评估

## DeepSeek 主要调研结果

（见下方整理后的报告正文）

## URL 置信度评估（DeepSeek 自评）
- opengameart.org/content/ancient-chinese-rpg-tileset (thekingphoenix): 高
- opengameart.org/content/chinese-pattern-pack (thekingphoenix): 高
- opengameart.org/content/isometric-chinese-buildings (Yar): 中
- opengameart.org/content/chinese-ui-menus (Buch): 中（URL slug 可能有差异）
- opengameart.org/content/chinese-resource-icons (Buch): 低（需人工验证）
- opengameart.org/content/chinese-tileset: 低（通用 slug，可能不对）

## 决策
核心资产：以 thekingphoenix 的 ancient-chinese-rpg-tileset 为主力（A+B），Buch 的 CC0 UI/图标包为界面层。
