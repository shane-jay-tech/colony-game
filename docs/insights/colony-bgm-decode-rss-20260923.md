# colony BGM 解码内存实测：606.06 MiB 推算值成立，真机口径是 659.47 MiB（c923-23）

- 班：`qoder-executor-20260923-0022-colony9`（Qoder 执行手）／created 2026-09-23T13:12+08:00
- 单：`zcode-bridge/inbox/c923-23.task.md`（软预算 30–35 分钟，只读出报告，**不改任何 `src/`**）
- 上游：`zcode-bridge/done/c922-14-colony-bgm-profile.result.md` 遗留问题③「606.06 MiB 解码量是推算值，未实测 RSS」
- 机器口径：Windows_NT 10.0.26200 x64／13th Gen Intel Core i5-13500H／16 cpus／物理内存 16,107.9 MiB（探针启动时 `os.freemem()`＝**2,043.6 MiB**（offline 轮）／**2,493.0 MiB**（live 轮）——freemem 受本机其它进程影响，只是量级注记，不是门槛）
- 运行时口径：**Electron 28.2.5 / Chromium 120.0.6099.291 / Node 18.18.2（renderer 内）/ V8 12.0.267.19-electron.0 / uv 1.44.2**；仓侧 `node --version` 为 v24.15.0（未用于本实测）。探针开关：`enable-precise-memory-info`、`js-flags=--expose-gc`、`disableHardwareAcceleration`、`show:false`

## 一、结论（三条，全部可复算）

1. **606.06 MiB 推算值成立**：9 条 BGM 在 **44.1 kHz 原生率**解码后 PCM 实测量 **635,315,256 B = 605.88 MiB**，与推算值 635,498,640 B = 606.06 MiB 差 **−183,384 B（−0.175 MiB，−0.029%）**。⇒ c922-14 那句「按帧参数推算、未实测」的数，**按实测坐实**。差额来源：c922-14 用 MP3 帧头累出的时长 1801.30 s，解码器实际交出的总帧数是 1800.76 s（少 0.54 s＝编码器 padding／尾部不完整帧被丢弃）。
2. **但推算值是下界**：`decodeAudioData` 把音频**重采样到 AudioContext 的设备率**。本机设备率 **48 kHz** ⇒ 实测 PCM **659.47 MiB ＝ 推算值 × 1.08844（恰为 48000/44100），比 606.06 高 8.8%**。`src/renderer/main.ts:29` 是 `type: Phaser.AUTO` ⇒ 生产走的就是 WebAudio 这条重采样路径，所以**游戏里的真实常驻是 659 MiB 量级，不是 606**。设备率随机器变（插 44.1 kHz 声卡的机器才等于推算值），故报告按两率并列。
3. **它是常驻、不是解码瞬时峰值**：9 条解完持有引用后，renderer RSS 峰值 **740.88 MiB**（offline）／**792.28 MiB**（live）；把 9 个 AudioBuffer 引用清空＋多轮 `gc()` 后落回 **147.48 / 150.82 MiB**，即 **593.41 / 641.45 MiB 随 AudioBuffer 生灭**（占 PCM 的 97.9% / 97.3%，余下是分配器碎片与基线漂移）。基线 RSS（未解码任何一条）69.0 / 67.2 MiB。

⇒ **c922-14 的「降码不省运行内存」在实测下更硬**：PCM 只由「时长 × 采样率 × 声道 × 4 B」决定，与 mp3 码率完全无关（128k/96k 两档省的是 54.97 MiB 磁盘／dist，一点也省不到这 606~659 MiB）。若要把内存变成可谈的约束，只有三条路：**换 WebAudio 之外的播放后端**、**改成流式／分曲按需解码**（即 `BootScene.ts:78` 的全量 boot 预载本身要重做），或**缩短时长**。这三条都属产品决定，本单不裁决。

## 二、逐条实测表（offline＝44.1 kHz 原生率，与推算同口径）

| # | key | mp3 B | dur(s) | 帧数 | PCM MiB | ΔRSS MiB | Δexternal MiB | ΔusedJSHeap MiB | decode ms |
|---|---|---|---|---|---|---|---|---|---|
| 1 | bgm_prosper_low | 7,174,082 | 224.12 | 9,883,791 | 75.41 | +93.08 | +6.84 | +6.87 | 737 |
| 2 | bgm_prosper_mid | 5,882,588 | 183.76 | 8,103,915 | 61.83 | +74.04 | +5.61 | +5.61 | 612 |
| 3 | bgm_prosper_high | 6,550,487 | 204.64 | 9,024,723 | 68.85 | +69.45 | −6.20 | −6.21 | 704 |
| 4 | bgm_crisis | 6,685,070 | 208.84 | 9,209,943 | 70.27 | +83.11 | +6.38 | +6.38 | 1,087 |
| 5 | bgm_war | 5,851,659 | 182.80 | 8,061,579 | 61.50 | +60.11 | −7.04 | −7.03 | 2,839 |
| 6 | bgm_ritual | 6,531,261 | 204.04 | 8,998,263 | 68.65 | +81.29 | +6.23 | +6.23 | 3,051 |
| 7 | bgm_ending_gong | 6,220,299 | 194.32 | 8,569,611 | 65.38 | +64.88 | −5.88 | −5.95 | 2,665 |
| 8 | bgm_ending_jia | 6,342,343 | 198.12 | 8,737,191 | 66.66 | +78.98 | +6.05 | +6.05 | 2,458 |
| 9 | bgm_ending_huo | 6,405,873 | 200.12 | 8,825,391 | 67.33 | +66.68 | −5.87 | −5.86 | 2,902 |
| — | **合计** | **57,643,662** | **1,800.76** | **79,414,407** | **605.88** | **+671.61** | 锯齿 ±7.04 | 同 external | 17.0 s |

（mp3 合计 57,643,662 B = **54.97 MiB**，与 c922-14 逐字节复现 ⇒ 资产源未变。）

live（48 kHz 设备率）同一批的第二列 PCM：82.08／67.30／74.94／76.48／66.94／74.72／71.16／72.55／73.29 = **659.47 MiB**；ΔRSS 合计 **+724.77 MiB**，峰值 792.28 MiB。逐件严格等比 1.08844（`decodeAudioData` 只改率不改时长／声道），故不再单列全表；原文见 `tmp/c923-23/out-live.json`。

## 三、附带实测到的「验收失明面」：这 606~659 MiB 在 JS 堆指标里根本看不见

解码全程 `process.memoryUsage().arrayBuffers` 增量恒为 **0**、`external` 与 `performance.memory.usedJSHeapSize` 只跟着 ±6~7 MiB 的**编码字节瞬时锯齿**走（表里正负交替就是它）。⇒ 9 条解完，**OS 层 RSS 涨 670~725 MiB，而 JS 堆侧读数几乎不动**。

推论（供后续任何「内存类验收」用）：

- 用 DevTools Memory／`usedJSHeapSize`／`heap snapshot` 去验 BGM 内存，会得出「内存没涨」的**假绿**——AudioBuffer 的 channel data 是 Blink 在 V8 堆外分配的。
- 唯一可靠的口径是**进程级 RSS**（renderer 自己 `process.memoryUsage().rss`，Electron 主进程 RSS **不含** renderer，故必须在 renderer 内读，且需 `nodeIntegration`）。
- 这也解释了为什么这条约束一直没进过任何门：`tickPerf.test.ts` 那类件只看耗时。

## 四、复现命令（内联，无需安装任何东西）

探针两件在 `tmp/c923-23/`（`tmp/` 已 gitignore，不入库）：`main.cjs`（Electron 主进程，offscreen window ＋ 开关）＋ `probe.html`（renderer 探针：`fs.readFileSync` 9 条 mp3 → `decodeAudioData` → 逐件采 RSS/external/usedJSHeap → 清空引用＋`gc()` 复采）。键表在探针里与 `audioDirector.ts:29-33` 的 `ALL_BGM_KEYS` 逐字对齐（探针不 import 生产码，避免打包路径问题；两侧一致性由本文件第五节的键数自证）。

```bash
cd D:/code/colony-game
C923_MODE=offline node node_modules/electron/cli.js tmp/c923-23/main.cjs   # 44.1 kHz 原生率口径
C923_MODE=live    node node_modules/electron/cli.js tmp/c923-23/main.cjs   # 设备率口径（本机 48 kHz）
# 读数落在 tmp/c923-23/out-{offline,live}.json；stdout 逐件一行
# ⚠ 本机 rg 可用但 python 里 subprocess.run(['npx',…]) 会 FileNotFoundError（npx 是 .cmd）⇒ 用 bash 驱动
```

## 五、机器可复算的核对点

```bash
# 1) 锚点：BootScene 的 boot 全量预载（本单前 4 处引用都指它）
rg -n 'this\.load\.audio\(key, `audio/\$\{key\}\.mp3`\)' src/renderer/scenes/BootScene.ts
#   → 78:      this.load.audio(key, `audio/${key}.mp3`); // BGM：Mureka 生成的 mp3     ✓ 行号未漂
rg -n 'Phaser\.AUTO' src/renderer/main.ts        # → 29: type: Phaser.AUTO,            ✓
rg -n "ALL_BGM_KEYS: readonly" -A4 src/renderer/state/audioDirector.ts   # → :29，9 键
# 2) 资产侧：9 条 BGM、合计 57,643,662 B = 54.97 MiB（与 c922-14 逐字相同）
python -c "import glob,os;f=sorted(glob.glob('public/audio/bgm_*.mp3'));print(len(f),sum(map(os.path.getsize,f)))"
# 3) 推算式复算（不跑探针也能对上一条）：时长 × 44100 × 2ch × 4B
python -c "print(1801.30*44100*2*4, 1801.30*44100*2*4/1048576)"   # 635498640  606.06
# 4) 实测口径（跑完探针后读）：frames × 8
python -c "import json;d=json.load(open('tmp/c923-23/out-offline.json',encoding='utf-8'));f=sum(r['frames'] for r in d['rows']);print(f, f*8, f*8/1048576, f*8-635498640)"
#   → 79414407  635315256  605.88  -183384
python -c "import json;d=json.load(open('tmp/c923-23/out-live.json',encoding='utf-8'));f=sum(r['frames'] for r in d['rows']);print(f, f*8/1048576, (f*8)/635315256)"
#   → 86437443  659.4727…  1.08843…（= 691,499,544 B）
# 5) 零改动自证：本单不动受版件（新档是未跟踪产物，不进 diff）
git diff --stat | wc -l      # 0
git status --porcelain       # 只有在册 3 项 ＋ 本单 ?? docs/insights/colony-bgm-decode-rss-20260923.md ＋ ?? src/.../saveMatrix.test.ts(他单 c923-22)
```

## 六、口径边界与未覆盖（别把这页数当跨机器常数）

1. **设备率依赖**：659.47 MiB 是**本机 48 kHz** 的读数。换 44.1 kHz 输出设备的机器实测会落回 605.88；换 96 kHz 专业声卡会到 ~1,319 MiB。⇒ 结论写成「≥606 MiB，且大概率 659 MiB 量级」，不要写死 659。
2. **Chromium 版本依赖**：Electron 28 = Chromium 120（2024-01）。AudioBuffer 的分配策略在 Blink 侧改过（partitioned alloc），换版本 ΔRSS/PCM 比（实测 1.108 offline、1.099 live）可能小幅漂移，但 **PCM 本体不会变**。
3. **只测了 WebAudio 解码路径**，未测 Phaser 自身在 `load.audio` 里是否另存一份副本（`AudioManager`／cache.audio 的实现细节未逐行读）。若 Phaser 另有持有，真实常驻**只会更高**，本单是下界而非精确值。
4. **单进程口径**：Electron 主进程＋GPU 进程等的内存在本读数之外（`show:false`＋`disableHardwareAcceleration` 已尽量收窄）；renderer 基线 RSS 67–69 MiB 已从读数里减掉。
5. **未测 SFX**：`SFX_KEYS` 6 条 wav 合计 **254,278 B = 0.242 MiB**（磁盘即 PCM，无解码膨胀），与 BGM 的 606~659 MiB 差三个数量级，本单未纳入。
6. **未裁决的事**：BGM 全量 boot 预载是否要改成按需／流式、128k/96k 降码档位、`art-library/` 母带留存地——三条都超出「实测内存」授权，本单零动作，见 c922-14 遗留问题①②与待人工台账。
7. **索引欠账（按派单未补列）**：本档是 `docs/insights/` 第 107 份 md，**未改 `colony-insights-index-*`**（派单令：新增 insights 先别改索引，欠账统一补列）。已核本仓**不存在**校验 insights 索引的测试件（`rg -ln "insights" scripts/ src/` 只命中 `audit-dead-exports.mjs` 与其只读测试、以及 4 处测试注释），故不会造成哨兵红。
