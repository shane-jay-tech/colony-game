# colony Phaser 音频缓存副本核验：Phaser **不另存第二份解码副本**，`cache.audio` 是唯一持有者；SFX 段「磁盘即 PCM 无解码膨胀」的说法被否证（实测 2.17 倍）（c924-21）

- 班：`qoder-executor-20260924-0955-colony23`（Qoder 执行手）／created 2026-09-24
- 单：`zcode-bridge/inbox/c924-21.task.md`（软预算 30 分钟，**node_modules 只读走查**）
- 上游：`zcode-bridge/done/c923-23.result.md:96`「未逐行读 Phaser `cache.audio`/`WebAudioSoundManager` 是否另存副本。若 Phaser 另持有一份，真实常驻更高」＋同档 §六.3
- 走查对象：`node_modules/phaser` **3.90.0**（`python -c "import json;print(json.load(open('node_modules/phaser/package.json',encoding='utf-8'))['version'])"`）
- 🔴 **本单零生产码改动**：不碰 `src/`、不碰 `public/`、不删任何音频文件；产出只有本档。

## 一、结论（四条）

1. **上游客诉「Phaser 是否另存一份解码副本」＝否证。** Phaser 3.90 的 WebAudio 路径上，解码后的 `AudioBuffer` **只有一份**，持有者是 `game.cache.audio` 这个 `BaseCache` 的 `Map`。`WebAudioSound` 拿的是**引用**，不是拷贝；`AudioBufferSourceNode.buffer` 也是**引用**。⇒ **c923-23 的 606.06 / 659.47 MiB 不再是「下界」，它就是常驻本体**（除本档 §三 那两个小项）。
2. **但解码瞬时确有第二份**（一次性、非常驻）：`AudioFile` 以 `responseType:'arraybuffer'` 取回**压缩字节**，再把它交给 `decodeAudioData`。解码期间「压缩字节 ＋ 正在成形的 AudioBuffer」并存 ⇒ boot 全量预载的**瞬时峰值≈ 55.22 MiB（磁盘）＋ PCM**。规范上 `decodeAudioData` 会 **neuter（detach）传入的 ArrayBuffer**，解完即释放，所以这 55.22 MiB **不落常驻**。
3. **SFX 6 条 wav 并入总常驻口径（本档 §二）**：合计 **0.4845 MiB（原生 44.1 kHz）／0.5273 MiB（本机 48 kHz 设备率）**，占音频总常驻的 **0.080%**，与 BGM 差 3 个数量级 ⇒ 「SFX 可以忽略」这个判断成立，但**给出的数不是磁盘的 0.242 MiB**。
4. 🔴 **卷宗要求 SFX 段标「磁盘 PCM 无解码膨胀」——按磁盘头实测否证，本档不写这句假话。** 6 条 sfx wav 是 **44.1 kHz / 单声道 / 16-bit PCM**；`AudioBuffer` 声道数据恒为 **Float32（4 B/样本）** ⇒ 光是位深就 **2.00 倍**，再叠 48 kHz 设备率重采样 **1.0884 倍** ⇒ **合计 2.1746 倍**（254,278 B → 552,956 B）。见 §四 复算命令。

⇒ **对口径表影响的净结论**：`音频总常驻 = 606.37 MiB（44.1 kHz 机）／659.99 MiB（48 kHz 机）`，其中 BGM 占 **99.92%**。c923-23 那句「若 Phaser 另有持有，真实常驻只会更高」在此**关闭**：没有更高，除了 §三 两项可忽略的按实例开销。

## 二、音频总常驻口径表（BGM ＋ SFX 两行，本单交付物②）

| 段 | 件数 | 磁盘字节 | 原生率 PCM（44.1 kHz） | 设备率 PCM（本机 48 kHz） | 与磁盘之比 | 膨胀来源 | 读数级别 |
|---|---|---|---|---|---|---|---|
| **BGM**（`bgm_*.mp3`） | 9 | 57,643,662 B ＝ 54.9733 MiB | 635,315,256 B ＝ **605.8838 MiB** | 691,499,544 B ＝ **659.4654 MiB** | 11.02× / 12.00× | MP3 压缩 → Float32 ＋ 44.1→48 kHz 重采样 | **实测**（c923-23 探针，帧数×8） |
| **SFX**（`sfx_*.wav`） | 6 | 254,278 B ＝ 0.2425 MiB | 508,028 B ＝ **0.4845 MiB** | 552,956 B ＝ **0.5273 MiB** | **2.00× / 2.17×** | 容器内已是 PCM（**无压缩膨胀**），但 **16-bit→Float32 翻倍** ＋ **48 kHz 重采样 ×1.0884** | 44.1 kHz 列＝**头字段推算**（无损可算）；48 kHz 列＝乘 c923-23 **实测**比值 1.08844 |
| **合计** | 15 | **57,897,940 B ＝ 55.2158 MiB** | **635,823,284 B ＝ 606.3683 MiB** | **692,052,500 B ＝ 659.9927 MiB** | — | — | — |

- 🔴 「无解码膨胀」这半句**只对了一半**：SFX 没有 *压缩格式* 带来的膨胀（wav 直存 PCM），但有 **位深** 与 **设备率** 两重。写口径表时若只留「无解码膨胀」四个字，会少算 **1.24 倍**。
- 磁盘合计 57,897,940 B 与 `zcode-bridge/done/c923-24.result.md:11` 钉桩基线**逐字节相同**（15 件，无第三类文件）⇒ 资产源自上次读数未变，两档口径可互相印证。
- 设备率依赖照抄 c923-23 §六.1：**不要写死 660**。插 44.1 kHz 输出设备的机器落回 606.37；96 kHz 专业声卡约 1,320 MiB。

## 三、Phaser 侧的持有面（源码走查，本档交付物①：文件:行号）

**A. 解码发生在 loader 的 `AudioFile`，产物直接就是 cache 里的值**

| 位置 | 读数 |
|---|---|
| `node_modules/phaser/src/loader/filetypes/AudioFile.js:55` | `cache: loader.cacheManager.audio` —— 目标缓存是 audio 桶 |
| `…/AudioFile.js:57` | `responseType: 'arraybuffer'` —— XHR 交回的是**压缩字节** |
| `…/AudioFile.js:81` | `this.config.context.decodeAudioData(this.xhrLoader.response, …)` |
| `…/AudioFile.js:84` | `_this.data = audioBuffer;` —— File 的 `data` **改指向解码后的 AudioBuffer** |
| `…/AudioFile.js:80` | 官方注释 `interesting read https://github.com/WebAudio/web-audio-api/issues/1305` —— 正是「传入的 ArrayBuffer 被 neuter」这件事 |
| `node_modules/phaser/src/loader/File.js:541`（`pendingDestroy` 内） | `this.loader.flagForRemoval(this);` ⇒ 进 `_deleteQueue` |
| `node_modules/phaser/src/loader/LoaderPlugin.js:1109-1110` | `file.addToCache(); file.pendingDestroy();` |
| `node_modules/phaser/src/loader/LoaderPlugin.js:1151-1153` | `this._deleteQueue.iterateLocal('destroy'); this._deleteQueue.clear();` —— 在 `loadComplete` 里执行 |

**B. `cache.audio` 是裸 `BaseCache`（3.90 已无专门的 `AudioCache` 类）**

| 位置 | 读数 |
|---|---|
| `node_modules/phaser/src/cache/CacheManager.js:95` | `this.audio = new BaseCache();` |
| `node_modules/phaser/src/cache/BaseCache.js:67` | `this.entries.set(key, data);` —— **存引用** |
| `node_modules/phaser/src/cache/BaseCache.js:118` | `return this.entries.get(key);` —— **返回同一引用，不拷贝** |
| `node_modules/phaser/src/cache/BaseCache.js:103` | `return this.entries.has(key);` —— 即本项目 `AudioManager.ts:65` 的静音降级判据 |

**C. 播放实例只持引用，销毁时也只是断引用**

| 位置 | 读数 |
|---|---|
| `node_modules/phaser/src/sound/webaudio/WebAudioSound.js:44` | `this.audioBuffer = manager.game.cache.audio.get(key);` —— **本单主证据：一行搞定，没有 `.slice()`／`new AudioBuffer()`／`copyToChannel`／`getChannelData`**（`grep -n "slice(\|new ArrayBuffer\|copyToChannel\|getChannelData" src/sound/webaudio/WebAudioSound.js` → **0 命中**） |
| `…/WebAudioSound.js:410-412` | `var source = this.manager.context.createBufferSource(); source.buffer = this.audioBuffer;` —— 节点侧仍是引用 |
| `…/WebAudioSound.js:672` | `destroy:` 内 `this.audioBuffer = null;` —— **只断引用，cache 仍持有**（这是正解：BGM 淡出后重建不能丢字节） |
| `…/src/sound/webaudio/WebAudioSoundManager.js:216-218` | `add: function (key, config) { var sound = new WebAudioSound(this, key, config); this.sounds.push(sound); … }` —— 🔴 **3.90 的 `add` 是二参**，所以 `AudioManager.ts:102` 的 `sound.add(key, { loop: true, volume: 0 })` 是把 config 当 config，**不会误触发二次解码**（`decodeAudio` 是另一个方法，见 `:247`，本项目未调用） |
| `…/src/sound/BaseSoundManager.js:326-328` | `var sound = this.add(key); sound.once(Events.COMPLETE, sound.destroy, sound);` —— `play()` 每次新建实例、**播完自毁** |
| `…/src/sound/BaseSoundManager.js:675-681` | `for (var i = this.sounds.length - 1; i >= 0; i--) { if (this.sounds[i].pendingRemove) this.sounds.splice(i, 1); }` —— 每 `PRE_STEP` 清扫，⇒ **SFX 频繁触发不会让 `sounds` 数组累积**（曾疑为泄漏，实测有清扫环，关闭） |
| `…/WebAudioSoundManager.js:339-378` | `unlock()` 只挂 5 个 body 事件监听 ＋ `context.resume()`，**不分配任何 AudioBuffer** |

**D. 因此「每实例额外开销」才是 Phaser 另加的面（可忽略，但列出以免被当成漏算）**

- 每个存活 `WebAudioSound` ≈ 2 个 `GainNode`（`muteNode`/`volumeNode`）＋ 播放期 1~2 个 `AudioBufferSourceNode`（`source` ＋ gapless loop 的 `loopSource`，`WebAudioSound.js:372/394`）。节点对象是 KB 级、**不含 PCM**。
- 本项目同时存活的 BGM 实例：`AudioManager.ts:97-105` 换曲时旧曲 900 ms 淡出（`fadeOutAndStop`）＋新曲 ⇒ **峰值 2 个 BGM 实例引用两个不同 key**，仍是 2 份已在表内的 PCM，**无新增**。
- SFX：`AudioManager.ts:142` 走 `scene.sound.play(key, …)`，播完自毁；同 key 并发时多个实例**共享同一 AudioBuffer**。

## 四、复算命令（全部只读，无需跑探针）

```bash
cd D:/code/colony-game
# 1) 走查对象版本
python -c "import json;print(json.load(open('node_modules/phaser/package.json',encoding='utf-8'))['version'])"   # → 3.90.0

# 2) 主证据三行（cache.audio 存引用 / WebAudioSound 拿引用 / 3.90 的 add 是二参）
rg -n 'this\.audio = new BaseCache'                    node_modules/phaser/src/cache/CacheManager.js            # → :95
rg -n 'this\.audioBuffer = manager\.game\.cache\.audio\.get' node_modules/phaser/src/sound/webaudio/WebAudioSound.js   # → :44
rg -n '^\s+add: function \(key, config\)'               node_modules/phaser/src/sound/webaudio/WebAudioSoundManager.js # → :216

# 3) 否证「另存副本」：WebAudioSound 全文没有任何拷贝原语
rg -n 'slice\(|new ArrayBuffer|copyToChannel|getChannelData|new AudioBuffer' node_modules/phaser/src/sound/webaudio/WebAudioSound.js   # → 0 命中

# 4) SFX 头字段（本档 §一.4 的 2.17 倍出处；逐条打印 rate/ch/bits/frames）
python - <<'PY'
import struct,glob,os
tn=t48=td=0
for p in sorted(glob.glob('public/audio/sfx_*.wav')):
    b=open(p,'rb').read(); i=12; fmt=dsize=None
    while i+8<=len(b):
        cid=b[i:i+4]; sz=struct.unpack('<I',b[i+4:i+8])[0]
        if cid==b'fmt ': fmt=struct.unpack('<HHIIHH',b[i+8:i+24])
        if cid==b'data': dsize=sz
        i+=8+sz+(sz&1)
    _,ch,rate,_,_,bits=fmt
    fr=dsize//(ch*bits//8); tn+=fr*ch*4; t48+=round(fr*48000/rate)*ch*4; td+=os.path.getsize(p)
    print(os.path.basename(p),rate,ch,bits,fr)
print('disk',td,'PCM44.1',tn,'PCM48',t48,'x=%.4f'%(t48/td))
PY
#   → 六条全部 44100 / 1ch / 16bit ；disk 254278  PCM44.1 508028  PCM48 552956  x=2.1746

# 5) 口径表合计（BGM 两列取 c923-23 实测帧数，SFX 两列取上一步）
#    ⚠ 标签刻意用 ASCII：本机 console 编码会把中文打成乱码，数字不受影响但易被误读
python -c "
b=(57643662,635315256,691499544); s=(254278,508028,552956); M=1048576
for i,l in enumerate(('disk','PCM@44.1k','PCM@48k')):
    t=b[i]+s[i]; print(l, t, '%.4f MiB'%(t/M), ' SFX_share=%.4f%%'%(100*s[i]/t))
"   # → 55.2158 / 606.3683 / 659.9927 MiB；SFX 占常驻 0.0799%

# 6) 零改动自证（交付物③）
git diff --name-only src/ | wc -l      # ⚠ 本单写作时读 1，但那 1 个文件属他班在途（见下），本单自身 0
git status --porcelain src/ public/    # → 只可能列出 colony22 在途件；本单不新增测试件、不碰 public/
# 归因（并发窗况，按纪律「同窗读数不可归因」必须逐笔点名）：
#   本单收班时 src/ 唯一的 M 是 src/renderer/state/__tests__/audioSizeSentinel.test.ts
#   （`git diff --stat` = 123 insertions(+)，文件头注释自陈 "c924-22 扩面"，mtime 22:51:55）
#   ⇒ 那是兄弟班 `...-colony22` 的 c924-22 写位产出，与本单无关，本单全程未打开该文件。
#   本单自己的 src/public 净改动 = 0，唯一产物是未跟踪的 docs/insights/ 本档。
python -c "import subprocess as s;d=s.run(['git','diff','--name-only','src/'],capture_output=True,text=True).stdout.split();print([f for f in d if 'audioSizeSentinel' not in f])"   # → []
```

## 五、本单否证／收窄的上册读数（下传用）

| 在册说法 | 出处 | 本单实测 |
|---|---|---|
| 「Phaser 可能另存一份 ⇒ 真实常驻更高，本单是**下界**」 | `colony-bgm-decode-rss-20260923.md:84`、c923-23 result:96 | **否证**：无第二份，606/659 MiB 即常驻本体（±§三.D 的 KB 级节点） |
| 「SFX 254,278 B＝0.242 MiB，**磁盘即 PCM、无解码膨胀**」 | `colony-bgm-decode-rss-20260923.md:86`、c923-23 result:98、**本卷宗完成标准②** | **部分否证**：16-bit→Float32 恰 **2.00×**，叠 48 kHz **×1.0884** ⇒ **2.1746×**，真实常驻 **0.5273 MiB**。数量级结论（可忽略）不变，**绝对值错 1.24 倍** |
| 「SFX 与 BGM 差三个数量级」 | 同上 | **成立**：0.5273 vs 659.4654 MiB ＝ **0.080%**，仍是 3 个数量级 |
| 「`public/audio` 15 件＝57,897,940 B」 | c923-24 result:11 | **成立**：本单独立复算逐字节相同 |
| 「BootScene:78 是 BGM 全量 boot 预载」 | 本卷宗锚点 | **成立**：行号未漂，`rg` 精确命中；同行的 SFX 循环在 `:81` |

## 六、遗留问题（本单不动手，交人工裁决）

1. 🔴 **口径表要不要写进 `OPTIMIZATION_BACKLOG`**：那是他班在册件（`docs/design/OPTIMIZATION_BACKLOG.md` 当前 ` M`），本单**未碰**。合并动作需主班或 backlog 责任班做。
2. **c923-23 §六.3 的挂账可以销了**：本档即为销账证据；但那档正文里「本单是下界而非精确值」的措辞在册未改，**是否回改上游文档**交人工（执行手不自改他班已入库结论）。
3. **瞬时峰值未实测**：§一.2 的「压缩字节 ＋ PCM 并存」是源码＋规范推导，**没有跑探针取数**（本波与 `...-colony22` 同仓并发，按纪律 §四.2 不取计时/内存类读数）。若要一个 boot 峰值的确切 MiB，需独占窗口复跑 c923-23 探针，**且同窗 Duration 一律不入册**。
4. **附带发现（只报不改）**：`src/renderer/main.ts:88` 把含 `decodeAudioData`／`Unable to decode audio` 的 rejection **静默吞掉**，而 `AudioFile.js:91` 解码失败正是 `console.error('Error decoding audio: …')` ＋ `onProcessError()` ⇒ **一条 BGM 解码失败会表现为「无声 ＋ 无提示」，且 cache 里没这个 key（`AudioManager.has()` 走静音降级）**。这是有意的 UX 止血还是把真故障也吞了，交人工判。本单零动作。
5. **索引欠账（按派单未补列）**：本档是 `docs/insights/` 新增件，**未改任何 `colony-insights-index-*`**（派单令：索引不自己补，欠账统一补列）。
6. **存档兼容影响：无。** 本单只新增本文档、未改任何 `src/`，不涉及存档结构／序列化字段。
7. **改动面行数**：新增 1 文件（本档），**修改 0 行、删除 0 行**；`src/`、`public/`、测试件、配置件全部 0 改动。
