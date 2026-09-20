# colony 构建产物体积基线（c921-09）

> 实测时刻：**2026-09-21 00:36–00:37**（文件名沿用任务书指定的 `20260920`，实际取数在次日凌晨，以此行为准）。
> 环境：branch `codex/architecture-hardening`，HEAD `27350ed`，工作树含他人 19:39 在途 7 件未提交改动（见第五节口径）。

## 〇、复跑命令（基线必须可复现）

```
cd D:\code\colony-game
npm.cmd run build            # = electron-vite build，产出 dist/{main,preload,renderer}
node -e "<本文件第六节 census 一行式>"
```

## 一、总量基线

| 项 | 值 |
|---|---|
| 文件数 | **86** |
| 总字节 | **77,506,017 B** |
| 总体积 | **73.92 MiB** |
| 构建耗时 | renderer 7.80s（127 modules）／main 119ms／preload 15ms，整条 `npm run build` exit 0 |

| 子目录 | 文件 | 体积 |
|---|---|---|
| `dist/main` | 1 | 0.01 MiB |
| `dist/preload` | 1 | 0.00 MiB |
| `dist/renderer` | 84 | 73.91 MiB |

## 二、资源类型分布（按体积降序）

| 扩展名 | 文件数 | 体积 | 占比 |
|---|---|---|---|
| `.mp3` | 9 | 54.97 MiB | **74.4%** |
| `.webp` | 62 | 11.46 MiB | 15.5% |
| `.js` | 3 | 7.23 MiB | 9.8% |
| `.wav` | 6 | 0.24 MiB | 0.3% |
| `.json` | 4 | 0.00 MiB | 0.0% |
| `.html` | 1 | 0.00 MiB | 0.0% |
| `.mjs` | 1 | 0.00 MiB | 0.0% |

## 三、最大 5 件

| # | 文件 | 体积 |
|---|---|---|
| 1 | `dist/renderer/audio/bgm_prosper_low.mp3` | 6.84 MiB |
| 2 | `dist/renderer/assets/phaser-CWlhwGg6.js` | 6.46 MiB |
| 3 | `dist/renderer/audio/bgm_crisis.mp3` | 6.38 MiB |
| 4 | `dist/renderer/audio/bgm_prosper_high.mp3` | 6.25 MiB |
| 5 | `dist/renderer/audio/bgm_ritual.mp3` | 6.23 MiB |

Top5 合计 32.16 MiB ＝ 全包的 **43.5%**，其中 4 个是 BGM。

## 四、基线判读（本档唯一需要后人记住的结论）

1. **音频已是产物体积的第一杠杆，美术不是。** `.mp3` 54.97 MiB 占全包 74.4%，是 `.webp`（11.46 MiB）的 **4.8 倍**。c921-02 把 art 压掉 80.86 MiB 之后，「资产瘦身」的剩余空间几乎全在 BGM——c921-02 遗留第 4 条（BGM 降码率，预期 55.2 → ≤23 MiB，需 ffmpeg 授权）若落地，全包将从 73.92 MiB 降到 **约 42 MiB**，一举再砍 43%。反过来说：**今后对 art 目录做增删，对产物体积的边际影响已经小于对 audio 做一次降码。**
2. **代码侧当前不构成压力**：三个 `.js` 合计 7.23 MiB（9.8%），其中 `phaser-CWlhwGg6.js` 6.46 MiB 是引擎本体，业务包 `index-9DOBpPPC.js` 只有 728.70 kB。

## 四b、与旧产物的对照（顺带得到，非任务要求但价值高）

本次构建**前**磁盘上留有一份 9/19 05:21 的旧 `dist/`（资产瘦身之前），实测 86 文件 / 162,294,005 B = **154.78 MiB**：

| | 文件数 | 体积 |
|---|---|---|
| 旧 dist（2026-09-19 05:21，含原 png） | 86 | 154.78 MiB |
| 新 dist（2026-09-21 00:37，webp） | 86 | 73.92 MiB |
| 差 | 0 | **−80.86 MiB（−52.2%）** |

**交叉验证**：−80.86 MiB 与 c921-02 声明的 art 减量（92.32 → 11.46 MiB ＝ 省 80.86 MiB）**逐位相同**。这说明产物体积的变化被美术这一项完全解释，构建过程中没有夹带其他增减。文件数同为 86 是因为 62 个 png→62 个 webp 一一对应，`public/art` 的 66 件（62 webp ＋ 4 portrait json）在新 dist 中 66/66 逐文件字节数相等（`mismatch=0`）。

## 五、口径与坑（复跑前必读）

1. **`dist/` 属 gitignore（`.gitignore:2`），构建不脏工作树**——本次 `git status --porcelain` 构建前后均 8 行同内容。
2. **⚠️ mtime 不能当 dist 的新鲜度信号。** 本包 86 件里有 **81 件 mtime 是 2026-09-20 12:40–12:4x**（即 `public/art` 源文件的转码时刻）——vite 复制 publicDir 时保留源时间戳。真正由本次构建写入的只有 5 件代码产物（`dist/main/index.js` 00:36:53、`dist/preload/index.mjs` 00:36:53、`dist/renderer/index.html`／`assets/index-9DOBpPPC.js`／`assets/phaser-CWlhwGg6.js` 00:37:01）。**判断「这份 dist 是不是刚构建的」要看这 5 件，或看 png 残留是否为 0**，不要看 `ls -la dist` 的目录时间。
3. **基线是在他人在途改动之上取得的**：工作树含 `MapRenderer.ts`、`BuildPanel.ts`、`OPTIMIZATION_BACKLOG.md`、`colony-dead-exports-20260914.json(.bak)`、两个 save 测试与 `.audit-b151-tmp/`（均系 2026-09-20 19:39 他方产物，早于本班 claim）。若那批代码回退，`index-9DOBpPPC.js`（728.70 kB）会随之变化，但 **73.92 MiB 这个量级不受影响**（音频与美术占 90%）。复跑基线请连 `git status` 一起留档。
4. **未清缓存**：按任务书「构建缓存不动」，本单未执行任何 `rm -rf dist`／`.vite` 清理，直接增量覆盖构建。

## 六、census 一行式（复跑用）

```
node -e "const fs=require('fs'),p=require('path');const all=[];const w=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const x=p.join(d,e.name);if(e.isDirectory())w(x);else all.push([x.split(p.sep).join('/'),fs.statSync(x).size])}};w('dist');const B=all.map(a=>a[1]).reduce((a,b)=>a+b,0);console.log('dist_files='+all.length,'dist_bytes='+B,'dist_MiB='+(B/1048576).toFixed(2));const byExt={};for(const [f,s] of all){const e=(f.indexOf('.')>=0?'.'+f.split('.').pop():'(none)').toLowerCase();if(!byExt[e])byExt[e]=[0,0];byExt[e][0]++;byExt[e][1]+=s}for(const k of Object.keys(byExt).sort((a,b)=>byExt[b][1]-byExt[a][1]))console.log(k,'n='+byExt[k][0],(byExt[k][1]/1048576).toFixed(2)+' MiB',((byExt[k][1]/B)*100).toFixed(1)+'%');console.log('--- top5 ---');for(const [f,s] of all.slice().sort((a,b)=>b[1]-a[1]).slice(0,5))console.log((s/1048576).toFixed(2)+' MiB',f)"
```
