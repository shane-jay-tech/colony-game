# colony assets 体积与重复文件普查（c920-15，只读，零删除）

- 复测时点：2026-09-20 06:3x；口径：public/ + resources/ + src/assets 全量 walk，md5 内容级重复检测
- 复跑命令（python 脚本随本报告思路可重写）：du/find 等价统计；脚本核心＝os.walk + size 聚类 + md5 分组

## 总量

- **147.9 MiB / 155,079,233 bytes**

## 子目录体积 Top

| 目录 | 体积 | 文件数 |
|---|---|---|
| public/art | 92.3 MiB（96,811,223 B） | 66 |
| public/audio | 55.2 MiB（57,897,940 B） | 15 |
| resources（icon.ico） | 361 KB | 1 |

## >500KB 大文件 Top10（全部为音频/美术大件）

| 体积 | 文件 |
|---|---|
| 7.17 MB | public/audio/bgm_prosper_low.mp3 |
| 6.68 MB | public/audio/bgm_crisis.mp3 |
| 6.55 MB | public/audio/bgm_prosper_high.mp3 |
| 6.53 MB | public/audio/bgm_ritual.mp3 |
| 6.41 MB | public/audio/bgm_ending_huo.mp3 |
| 6.34 MB | public/audio/bgm_ending_jia.mp3 |
| 6.22 MB | public/audio/bgm_ending_gong.mp3 |
| 5.88 MB | public/audio/bgm_prosper_mid.mp3 |
| 5.85 MB | public/audio/bgm_war.mp3 |
| 2.70 MB | public/art/buildings/bld_barracks.png |

## 重复文件（md5 内容级）

| 组 | 文件 | 冗余 |
|---|---|---|
| 1 | public/audio/sfx_click.wav ≡ public/audio/sfx_warn.wav（逐字节相同） | 8,864 B |

## 瘦身建议（删除/改码留日间）

1. **sfx_click.wav ≡ sfx_warn.wav 完全同内容**：两键语义不同（点击/警告）但文件相同——可保留同名双键映射到同一实体文件（或接受 8.6KB 冗余），收益极小。
2. **BGM 9 首 mp3 合计 ~57MB**：建议统一转码降码率（如 320k→128k，预计 -60%）；属资产重生成，留日间。
3. **public/art 92MB（66 文件 png）**：png→webp 转码（配合 c920-14 的 manifest 断链修复一并做）预计 -50%~70%。
4. icon.ico 361KB 正常保留。

## 零删除声明

本普查只读；未删未改任何文件。
