# colony BGM 音频体积画像（c922-14，只读，2026-09-22T00:20 取数）

> 用途：c921-09 判定「美术瘦完后产物体积第一杠杆是 BGM」后的决策材料。
> 边界：**零资产改动、零删除、未跑任何编码器、未发任何网络请求、未读 .env.local**。public/ 未被写入（复核见第六节）。
> 取数 cwd `D:\code\colony-game`，HEAD `5205cd3`（脏工作树 7 件在途＋1 未跟踪目录，非本班产物，见第六节）。

## 一、结论速览

1. **9 条 BGM 全部同构**：MPEG-1 Layer III / 44.1 kHz / **CBR 256 kbps** / joint-stereo / 无 ID3 标签。合计 **57,643,662 B = 54.97 MiB**，总时长 **1801.30 s（30.02 min）**，平均每条 200.1 s，最长 bgm_prosper_low 224.18 s、最短 bgm_war 182.86 s。
2. **c921-09 锚点逐位成立**：其「mp3 54.97 MiB 占 74.4%」本次复算得 54.97 MiB / **74.37%**（对 `dist` 77,506,017 B）。且 `dist/renderer/audio/*.mp3` 与 `public/audio/*.mp3` **9/9 md5 全同**，`HEAD` 里 9 个 blob 大小也与磁盘逐字节相等 ⇒ 只有一处资产源，降码收益 1:1 传导到产物与仓库对象。
3. **两档体积收益**（CBR 下体积与码率严格线性，由实测时长直接换算，不需试跑编码）：

   | 档位 | BGM 合计 | 省 | 产物 dist 预测 | 相对 c921-09 基线 |
   |---|---|---|---|---|
   | 现状 256k | 54.97 MiB | — | 73.92 MiB | — |
   | **128k** | 27.49 MiB | −27.49 MiB（−50.0%） | **46.43 MiB** | −37.2% |
   | **96k** | 20.61 MiB | −34.36 MiB（−62.5%） | **39.56 MiB** | −46.5% |

   对账历史口径：c921-02 遗留第 4 条「55.2→≤23 MiB」＋ c921-09「落地后约 42 MiB」相当于 **≈107 kbps** 的隐含档位，落在本次两档实测端点之间；今后引用请以 **96k / 128k 两行实数**为准，别再引「≤23 MiB」这句估计。
4. **降码率不省运行内存**（这条容易预期错）：`src/renderer/scenes/BootScene.ts:77-78` 在 boot 期一次性 `this.load.audio` 全部 9 条，`src/renderer/main.ts:29` 是 `type: Phaser.AUTO` ⇒ 音频走 WebAudio 全量解码，解码后 PCM（Float32 双声道）≈ 1801.30 s × 44100 × 2 × 4 B = **606.06 MiB**，**与 mp3 码率无关**。要动运行内存得动时长／声道数／采样率或改 `html5Audio`，不是 bitrate。⚠️ 本条是按帧参数算出的量，**未实测进程 RSS**（跑应用不属本单范围），运行面复核请另开单。
5. **母带面 7/9 有、2/9 无**：`art-library/audio/music/<key>/track_*.wav` 存着 7 条母带（PCM 44.1 kHz / 16 bit / 双声道，1411 kbps，7 条合计 230.11 MiB；`art-library/audio` 全量 348.23 MiB）。缺母带的是 **bgm_crisis** 与 **bgm_prosper_low** —— 正是 `scripts/gen_all_bgm.sh` 首行注释「聚落低/危机已有」那两条早批产物。有母带者重编码＝**单代有损**；无母带者从 256k mp3 再压＝**第二代有损**，取舍需人裁决（重新生成要上游 API 费用，本单未碰凭据）。

## 二、逐文件实测表（9 条 BGM，帧走查所得）

| # | 文件（public/audio/） | 字节 | MiB | 时长 s | 帧数 | 码率 kbps | 采样率 | 声道模式 | ID3 | Xing/Info | 本地母带 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | bgm_prosper_low.mp3 | 7,174,082 | 6.84 | 224.18 | 8582 | 256.0 | 44100 | joint-stereo | 无 | Info vbr-flag=1（实际逐帧 256k） | **无** |
| 2 | bgm_crisis.mp3 | 6,685,070 | 6.38 | 208.90 | 7997 | 256.0 | 44100 | joint-stereo | 无 | 同上 | **无** |
| 3 | bgm_prosper_high.mp3 | 6,550,487 | 6.25 | 204.70 | 7836 | 256.0 | 44100 | joint-stereo | 无 | 同上 | 有 |
| 4 | bgm_ritual.mp3 | 6,531,261 | 6.23 | 204.09 | 7813 | 256.0 | 44100 | joint-stereo | 无 | 同上 | 有 |
| 5 | bgm_ending_huo.mp3 | 6,405,873 | 6.11 | 200.18 | 7663 | 256.0 | 44100 | joint-stereo | 无 | 同上 | 有 |
| 6 | bgm_ending_jia.mp3 | 6,342,343 | 6.05 | 198.19 | 7587 | 256.0 | 44100 | joint-stereo | 无 | 同上 | 有 |
| 7 | bgm_ending_gong.mp3 | 6,220,299 | 5.93 | 194.38 | 7441 | 256.0 | 44100 | joint-stereo | 无 | 同上 | 有 |
| 8 | bgm_prosper_mid.mp3 | 5,882,588 | 5.61 | 183.82 | 7037 | 256.0 | 44100 | joint-stereo | 无 | 同上 | 有 |
| 9 | bgm_war.mp3 | 5,851,659 | 5.58 | 182.86 | 7000 | 256.0 | 44100 | joint-stereo | 无 | 同上 | 有 |
| — | **合计** | **57,643,662** | **54.97** | **1801.30** | 69,156 | 256.0 | 44100 | joint-stereo | — | — | 7/9 |

口径说明：`码率 kbps` 是「帧头声明码率的按帧均值」；另有独立算法「文件字节×8÷时长」同得 256.0（全集合计 256.01），两式一致才判 CBR。`Xing/Info vbr-flag=1` 是编码器写的头标记，但**逐帧实测码率全为 256k**，故按 CBR 处理（线性换算成立的前提就是这条实测）。

非 BGM 的音频（本单一并采参数，但不计入收益）：`public/audio/sfx_*.wav` 6 条，全部 PCM 44.1 kHz / 16 bit / **单声道**，时长 0.10–1.30 s，合计 0.24 MiB（占 dist 0.3%）——量级上不值得排工。

## 三、每文件两档估算（@128k / @96k，单位 MiB）

| 文件 | 现状 | @128k | 省 | @96k | 省 |
|---|---|---|---|---|---|
| bgm_prosper_low | 6.84 | 3.42 | 3.42 | 2.57 | 4.28 |
| bgm_crisis | 6.38 | 3.19 | 3.19 | 2.39 | 3.98 |
| bgm_prosper_high | 6.25 | 3.12 | 3.12 | 2.34 | 3.90 |
| bgm_ritual | 6.23 | 3.11 | 3.11 | 2.34 | 3.89 |
| bgm_ending_huo | 6.11 | 3.05 | 3.05 | 2.29 | 3.82 |
| bgm_ending_jia | 6.05 | 3.02 | 3.02 | 2.27 | 3.78 |
| bgm_ending_gong | 5.93 | 2.97 | 2.97 | 2.22 | 3.71 |
| bgm_prosper_mid | 5.61 | 2.81 | 2.81 | 2.10 | 3.51 |
| bgm_war | 5.58 | 2.79 | 2.79 | 2.09 | 3.49 |
| **合计** | **54.97** | **27.49** | **27.49** | **20.61** | **34.36** |

## 四、口径与判别力（这些数不是抄来的，四路互证＋两条负控）

本机 **没有** ffprobe / ffmpeg / mediainfo，也没有 mutagen：

```
$ which ffprobe ffmpeg mediainfo      → 三者均 "no ... in (...)"
$ python -c "import mutagen"          → ModuleNotFoundError: No module named 'mutagen'
```

任务书写的是「ffprobe（如本机可用）」，不可用即换路径；本仓不许装依赖，故改为**自写 MPEG 帧头走查**（无第三方库），并用四条独立通道互证：

1. **双实现互证**：完整版解析器（含 ID3／Xing／声道／padding 处理）与下面第六节的 13 行紧凑版，对 9 个文件的 `frames / dur / kbps` 三列 **9/9 逐位相同**（例：bgm_crisis 两者都是 frames=7997, dur=208.90s, kbps=256.0）。
2. **外部解码器对照**：Windows Shell 属性系统（PowerShell `Shell.Application` + `ExtendedProperty('System.Audio.EncodingBitrate'/'System.Audio.SampleRate')`，即系统自带 MEP 解码器，与本仓代码零共享）对 9 个文件报 `bps=256000 sr=44100` ×9。它的 Duration 属性返回空，所以时长由第 3 条定。
3. **母带时长交叉**：7 条有母带的文件，mp3 走查时长 − WAV PCM 时长 = **恒定 +0.06 s**（194.38−194.32、200.18−200.12、198.19−198.12、204.70−204.64、183.82−183.76、204.09−204.04、182.86−182.80）。恒定偏移＝编码器 delay/padding，说明帧计数没有 off-by-N；若解析器多算或少算整段，偏移会散开。
4. **内部自洽**：9/9 `frame_walk_coverage = 1.0000`（帧体字节之和 == 音频区总字节，且无 ID3 前后缀）⇒ 既没丢帧也没把噪声当帧。

负控（证明用例／证明工具真咬得住）：

```
$ head -c 3000000 public/audio/bgm_crisis.mp3 > tmp/trunc_crisis.mp3   # 只留 45% 字节
$ python tmp/mp3walk.py tmp/trunc_crisis.mp3
trunc_crisis.mp3  bytes=3000000 frames=3588 dur=93.73s kbps=256.1 cov=0.9998   # 时长按比例塌，不是回显属性
$ python tmp/mp3walk.py public/audio/sfx_click.wav                     # 异格式负控
sfx_click.wav     bytes=8864   frames=0    dur=0.00s  kbps=0.0  cov=0.0000    # 不会把任意字节流凑成帧
```

## 五、影响面（真要执行降码会碰到什么，本单都没动）

- **测试零影响**：`src/renderer/state/__tests__/audioKeys.test.ts:22-26` 对 BGM 只断 `existsSync(public/audio/bgm_<key>.mp3)`；`src/renderer/state/audioDirector.ts:29-32` 只有键名与选曲逻辑。**同文件名替换字节 ⇒ 现 1295 例零转红**（全仓 grep `.mp3` 于 `*.test.ts`／`*.mts`／`*.mjs` 仅命中那一条存在性断言，无字节/md5/时长钉桩）。这条是本档最实用的结论：**体积动作不会惊动门禁**。
- **构建面**：vite 原样复制 `publicDir`，dist 内不做二次编码 ⇒ 换 public 文件 + 重跑 build 即传导。
- **git 面（净增成本，别只算省下多少）**：仓根无 `.gitattributes`、**未用 LFS**，9 条 mp3 以裸 blob 存在 HEAD，占 54.97 MiB；`.git` 现 387.85 MiB。换档会把新旧两代都留在历史里（新对象再 +20.6~27.5 MiB），除非按授权改写历史／清理解除——那是 c922-08 已点名「不得代删」的历史件域，本单未碰。
- **生成面**：`scripts/gen_music.py` 走上游 `https://api.mureka.cn/v1`（key 从 `.env.local:MUREKA_API_KEY` 读，**本单未读该文件**）；仓内脚本里**没有任何 bitrate 参数**——256k 是上游返回件的属性，不是本仓设定。故改档位需要在 `cp` 到 `public/audio/` 之前插一步显式转码，这一步目前不存在。
- **磁盘面**：母带在 `.gitignore` 的 `art-library/`（`.gitignore:24`）里 ⇒ **7 条母带只存在于本机**，仓库不带。任何「从母带重编码」的方案都依赖一台不可复现的机器，排单时应同时决定母带留存地。

## 六、复现配方

13 行紧凑帧走查（假设 MPEG-1 L3 / 44.1 kHz —— 本仓 9 条恰好全是，跨此范围请改用 ffprobe）；存 `tmp/mp3walk.py`（`tmp/` 已 gitignore，`.gitignore:25`）：

```python
import sys
BR = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
SR = [44100, 48000, 32000]
for p in sys.argv[1:]:
    b = open(p, 'rb').read(); o = 0; n = 0; ab = 0
    while o + 4 <= len(b):
        if b[o] == 0xFF and (b[o + 1] & 0xE6) == 0xE2:            # MPEG-1 Layer III 同步字
            br = BR[(b[o + 2] >> 4) & 15]; sri = (b[o + 2] >> 2) & 3
            if br and sri < 3:
                flen = 144 * br * 1000 // SR[sri] + ((b[o + 2] >> 1) & 1)   # + padding
                if flen < 4 or o + flen > len(b): break
                n += 1; ab += flen; o += flen; continue
        o += 1
    dur = n * 1152 / SR[0]                                        # 1152 样点/帧
    print(f'{p.split("/")[-1]:<26} bytes={len(b):>9} frames={n:>6} dur={dur:8.2f}s '
          f'kbps={len(b)*8/dur/1000 if dur else 0:6.1f} cov={ab/max(1,len(b)):6.4f}')
```

对照通道（各自只读）：

```bash
python tmp/mp3walk.py public/audio/bgm_*.mp3                       # 本仓自算
for f in public/audio/bgm_*.mp3; do md5sum "$f" "dist/renderer/audio/$(basename $f)"; done   # public↔dist 同源
for f in public/audio/bgm_*.mp3; do git cat-file -s $(git rev-parse HEAD:$f); done            # 磁盘↔HEAD blob
powershell -NoProfile -ExecutionPolicy Bypass -File tmp/shellprobe.ps1                         # 系统解码器旁证
python tmp/wavprobe.py    # WAV 容器头解析（母带与 sfx 用；与 mp3 时长互证）
```

完整版解析器（ID3v2/v1 与 Xing 分支）本次留在 `tmp/mp3probe.py`，属会话产物、不入库；上文第二、四节已把它的全部判据（含 coverage 与 Xing vbr-flag 实况）写进本档，故它消失不影响复现。

## 七、建议排单形态（只列，不在本单执行）

1. **先定听感档位再动字节**：96k 与 128k 的体积差 6.88 MiB，属人耳可辨域；本档不作听感结论，需一次 A/B 试听裁决（游戏 BGM 属背景铺底，但 `bgm_ritual`／`bgm_ending_*` 有长音与铃类高频，最容易暴露预回声伪影）。
2. **优先重编码有母带的 7 条**（单代有损，占 mp3 41.75 MiB／75.9%）；`bgm_crisis` ＋ `bgm_prosper_low` 2 条（合计 13.22 MiB／24.1%）另议：走 API 重生成（花钱）或接受第二代有损。
3. **若要一次到位**，可考虑同时决定运行内存那 606 MiB：只有 `html5Audio` 或缩短循环段或降采样率能动它，bitrate 改了没用的这点应在排单时写进验收标准，防止「降码后内存没变」被当执行缺陷回报。
4. **门禁无需扩面**：现有测试面不会因音频字节变化而红（第五节）；若希望体积可守，需**新写**一个「`public/audio` 合计字节 ≤ 上限」的哨兵测试——那是新增生产门禁，不属本单，留给放行后的执行单。

## 八、零改动自证

```
$ git status --short            → 与开工前同一批 8 行（他人 7 在途 ＋ ?? .audit-b151-tmp/），本单只新增下面 2 个文档路径
$ git status --short -- public/ → 空
$ ls -la public/audio/          → 9 mp3 ＋ 6 wav，mtime 仍为 Jun 1 03:50–09:20 / Sep 4 23:54（未被本单写入）
$ md5sum public/audio/bgm_*.mp3 → 9/9 与第二节表、与 dist 副本一致（读操作不改哈希）
```
