// audioSizeSentinel——`public/audio` 合计字节体积哨兵（c923-24）。
//
// 补的缺口出自 `zcode-bridge/done/c922-14-colony-bgm-profile.result.md` 第五节②：
// 「体积哨兵测试不存在：现门禁不拦音频体积增长」。本件即那枚被点名未做的钉桩。
//
// 判据方向是**单向**的：只有「合计字节 > 上限」才红。⇒ 加音频必须显式抬上限，
// 删音频／降码不会让它红（降码档位由 c922-14 的 128k/96k 两档等着人工裁决，
// 本件刻意不设下限，免得变成「禁止瘦身」的反向门禁）。
//
// ── 上限调整流程（要动这个数字，按这四步走，别只改一个数）────────────────
//  1. 现值必须当次实测，不许手填：
//       node -e "const f=require('node:fs'),p=require('node:path');const d='public/audio';let t=0,n=0;for(const e of f.readdirSync(d,{withFileTypes:true})){const x=p.join(d,e.name);if(e.isFile()){t+=f.statSync(x).size;n++}}console.log(n,t)"
//     → 15 57897940（本仓无 tsx，别照抄别仓的 `npx tsx -e`；本仓在册教训：计数口径要先验字符类覆盖度）
//     ⚠ **不要用 `du -sb public/audio`**：它少算 8,864 B（现读 57,889,076）——`sfx_click.wav` 与
//       `sfx_warn.wav` 是**同一 inode 的硬链接**（nlink=2、md5 相同），du 默认对硬链接去重，而体积门要按
//       「仓库里两份路径各占一份字节」计。两式互验时请以此为准。
//  2. 改下面的 `BASELINE_BYTES` 为第 1 步读数，`MAX_TOTAL_BYTES` 同步改成
//     `Math.ceil(BASELINE_BYTES * 11 / 10)` 的结果（**整数式**——`* 1.1` 会被 IEEE754
//     抬 1 字节：57,897,940×1.1 实算 63,687,734，`Math.ceil(BASELINE*1.1)` 给 63,687,735）。
//     用例 ② 就是钉「上限 == 基线 ×1.10」这条规则同源，只改一个数字会当场红。
//  3. 在 `MAX_TOTAL_BYTES` 上方注释里写清**谁批准的增长**（单号或决策档）＋新旧字节数；
//     只有「抬上限」而无来由的改动，评审时应按绕过门禁处理。
//  4. 顺带在 `docs/insights/` 留一句体积口径变化（BGM 的**运行内存**另有一档：
//     见 `colony-bgm-decode-rss-20260923.md`，那 606~659 MiB 与本字节数**不同源**、
//     降码不省它，别把两个口径混着写进同一份验收）。
//
// 红线自查：这是**字节体积**门禁，不是经济平衡数值，也不是统计结论／鉴权／医疗内容。
// 与同族哨兵的分工：`audioKeys.test.ts`（c918-07）钉键↔磁盘存在性、
// `audioDirectorKeys.test.ts`（c922-132）钉 selectBgmKey 值域，**两者都不看字节数**。
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const AUDIO_DIR = join(__dirname, '..', '..', '..', '..', 'public', 'audio');

/** 当次实测基线（c923-24，2026-09-23，15 件 = 9 BGM mp3 + 6 SFX wav）。 */
const BASELINE_BYTES = 57_897_940;
/** 钉桩上限 ＝ 基线 ×1.10（整数式取上整）＝ 63,687,734 B；余量 5,789,794 B。 */
const MAX_TOTAL_BYTES = 63_687_734;

/** 递归量 public/audio 下所有**文件**字节数（子目录里的也算，目录本身不算）。 */
function totalBytes(dir: string): number {
  let sum = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) sum += totalBytes(p);
    else sum += statSync(p).size;
  }
  return sum;
}

function fileEntries(dir: string): { name: string; size: number }[] {
  const out: { name: string; size: number }[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...fileEntries(p));
    else out.push({ name: entry.name, size: statSync(p).size });
  }
  return out;
}

describe('c923-24 public/audio 体积哨兵（合计字节 ≤ 当次实测 ×1.10）', () => {
  it('① 上限门：public/audio 合计字节 ≤ MAX_TOTAL_BYTES（超限即红）', () => {
    const total = totalBytes(AUDIO_DIR);
    expect(
      total,
      `public/audio 合计 ${total.toLocaleString('en-US')} B 超过钉桩上限 ${MAX_TOTAL_BYTES.toLocaleString('en-US')} B`
        + '（基线钉在 c923-24 当次实测；要加音频请按文件头「上限调整流程」四步走，勿只改数字）',
    ).toBeLessThanOrEqual(MAX_TOTAL_BYTES);
    expect(total).toBeGreaterThan(0);
  });

  it('② 规则同源：MAX_TOTAL_BYTES 必须等于 BASELINE_BYTES ×1.10 的整数式上整', () => {
    // 判别力：只手改上限数字（把门放宽）而不同步基线 ⇒ 这条当场红
    expect(MAX_TOTAL_BYTES).toBe(Math.ceil((BASELINE_BYTES * 11) / 10));
    // 且刻意用整数式而非 *1.1：后者在本基数上会多抬 1 字节（在册浮点坑，头注第 2 步记着）
    expect(Math.ceil((BASELINE_BYTES * 11) / 10)).not.toBe(Math.ceil(BASELINE_BYTES * 1.1));
    // 余量必须是 +10% 量级，防止有人把门做成恒红（上限==基线）或恒绿（上限改成天文数字）
    expect(MAX_TOTAL_BYTES).toBeGreaterThan(BASELINE_BYTES);
    expect(MAX_TOTAL_BYTES - BASELINE_BYTES).toBeGreaterThanOrEqual(Math.floor(BASELINE_BYTES / 10));
  });

  it('③ 测量完整性：逐件可加和 == 合计，且目录内文件全落在 bgm_/sfx_ 两桶内', () => {
    const files = fileEntries(AUDIO_DIR);
    const total = totalBytes(AUDIO_DIR);
    expect(files.length).toBeGreaterThan(0);
    expect(files.reduce((a, f) => a + f.size, 0)).toBe(total);
    expect(total).toBeGreaterThan(0);
    const bgm = files.filter((f) => /^bgm_.*\.mp3$/.test(f.name));
    const sfx = files.filter((f) => /^sfx_.*\.wav$/.test(f.name));
    const uncategorized = files.filter(
      (f) => !/^bgm_.*\.mp3$/.test(f.name) && !/^sfx_.*\.wav$/.test(f.name),
    );
    // 在册坑（camelCase 文件名被字符类静默漏计那条）⇒ 漏计必须显式暴露，而不是让合计少一截
    expect(uncategorized.map((f) => f.name)).toEqual([]);
    expect(bgm.length + sfx.length).toBe(files.length);
    expect(bgm.length).toBe(9); // 键集↔磁盘存在性由 audioKeys.test.ts 钉，这里只钉件数口径
    expect(sfx.length).toBe(6);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// c924-22 扩面：dist 侧联动 + BGM/SFX 分桶上限（以上三例逐字未动，本行以下为纯新增）
//
// 补的两处缺口出自 `zcode-bridge/done/c923-24.result.md` 的自陈遗留：
//  遗留①（本文件新增例 ④）：「哨兵只量 public/audio，未量 dist/renderer/audio
//    （c922-14 实测两侧 md5 逐对相同 ⇒ 目前同源）。若打包链以后加了转码／拷贝差异，
//    本件看不到。」
//  遗留②（本文件新增例 ⑤）：「若要按类别分桶限额（BGM ≤ X、SFX ≤ Y），需另开单，
//    本件③的 `uncategorized == []` 已为分桶预留口径。」
//
// 分桶基线为当次实测（2026-09-24，口径同文件头第 1 步：逐件 statSync 求和，按桶分堆）：
//   9 件 BGM = 57,643,662 B ／ 6 件 SFX = 254,278 B ／ 合计 57,897,940 B
//   ⇒ 两桶相加与 c923-24 的 `BASELINE_BYTES` **逐位吻合**，分桶没有另起口径。
//
// ⚠ 用例② 那条「整数式 != *1.1 浮点式」的断言**不可照抄到分桶上**：浮点抬 1 字节只在
//   合计基数 57,897,940 上发生；两桶基数上实测整数式与浮点式**相等**
//   （BGM 63,408,029 == 63,408,029、SFX 279,706 == 279,706），照抄即恒红。
//   本例只钉「上限 == 基线 ×1.10 的整数式上整」这条规则本身。
//
// 与既有分工不重叠：`audioKeys.test.ts` 钉键↔磁盘存在性、`audioDirectorKeys.test.ts`
// 钉 selectBgmKey 值域，两者都不看字节；本例只新增「dist 是否同源」与「单桶是否被放宽」。
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

/** 打包产物侧音频目录（`npm run build` 才有；缺目录时例 ④ 放行不判红）。 */
const DIST_AUDIO_DIR = join(__dirname, '..', '..', '..', '..', 'dist', 'renderer', 'audio');

/** BGM 桶当次实测基线（9 件 mp3）。上限走同一整数式规则，见例 ⑤。 */
const BGM_BASELINE_BYTES = 57_643_662;
const MAX_BGM_BYTES = 63_408_029; // = Math.ceil(57_643_662 × 1.10 整数式)；余量 5,764,367 B
/** SFX 桶当次实测基线（6 件 wav，含 sfx_click/sfx_warn 那对硬链接各计一份）。 */
const SFX_BASELINE_BYTES = 254_278;
const MAX_SFX_BYTES = 279_706; // = Math.ceil(254_278 × 1.10 整数式)；余量 25,428 B

const BGM_NAME_RE = /^bgm_.*\.mp3$/;
const SFX_NAME_RE = /^sfx_.*\.wav$/;

/** dist 侧 skip 守卫：**只**认「目录不存在」这一件事，参数化以便例内自证不是恒绿／恒跳。 */
function distAudioMissingFor(dir: string): boolean {
  return !existsSync(dir);
}

/** 整件 md5（与 c922-14 的 dist↔public 同源比对口径一致）。 */
function md5OfFile(path: string): string {
  return createHash('md5')
    .update(readFileSync(path))
    .digest('hex');
}

describe('c924-22 体积哨兵扩面：dist 侧同源联动 + BGM/SFX 分桶上限', () => {
  it('④ dist 同源联动：dist/renderer/audio 与 public/audio md5 逐对相同（dist 缺目录则放行不红）', () => {
    // ── skip 守卫自证（完成标准③）：守卫必须双向可信，否则「打包链偷偷转码」会被静默放过 ──
    // 真在册目录必判「不缺」⇒ 守卫不是恒 true（恒 true 等于把整例做成空壳）；
    // 假目录必判「缺」⇒ 守卫不是恒 false（恒 false 会让未打包的工作树当场红，且缺目录时无人知晓）。
    expect(distAudioMissingFor(AUDIO_DIR)).toBe(false);
    expect(distAudioMissingFor(join(__dirname, '..', '..', '..', '..', 'dist', 'renderer', 'c924-22-no-such-audio-dir'))).toBe(true);

    if (distAudioMissingFor(DIST_AUDIO_DIR)) return; // 未 build 的工作树 ⇒ 缺目录分支：放行（口径选择，同 c923-24 遗留①）

    const pub = fileEntries(AUDIO_DIR).map((f) => f.name).sort();
    const dis = fileEntries(DIST_AUDIO_DIR).map((f) => f.name).sort();
    // 先钉件名集合：件名不齐时 `toEqual` 的红名比逐件 md5 更可归因（少了谁、多了谁一眼可见）
    expect(dis).toEqual(pub);
    const drifted: { name: string; publicMd5: string; distMd5: string }[] = [];
    for (const name of pub) {
      const publicMd5 = md5OfFile(join(AUDIO_DIR, name));
      const distMd5 = md5OfFile(join(DIST_AUDIO_DIR, name));
      if (publicMd5 !== distMd5) drifted.push({ name, publicMd5, distMd5 });
    }
    // 逐对同源：非空即「打包链引入了转码／拷贝差异」，本仓从没测过这条路 ⇒ 红名要能指出是哪件
    expect(drifted).toEqual([]);
  });

  it('⑤ 分桶上限：BGM／SFX 各桶合计 ≤ 各自基线 ×1.10（整数式），且无文件逃出两桶', () => {
    // ── 规则同源（完成标准②）：上限必须等于「该桶基线 ×1.10 的整数式上整」，只手改数字即红 ──
    expect(MAX_BGM_BYTES).toBe(Math.ceil((BGM_BASELINE_BYTES * 11) / 10));
    expect(MAX_SFX_BYTES).toBe(Math.ceil((SFX_BASELINE_BYTES * 11) / 10));
    // 分桶必须与 c923-24 的合计基线自洽：两桶就是那 15 件，不许另起一套口径
    expect(BGM_BASELINE_BYTES + SFX_BASELINE_BYTES).toBe(BASELINE_BYTES);
    // 沿用②的防篡改护栏：上限既不能被做成恒红（== 基线），也不能被做成恒绿（天文数字）
    for (const [max, base] of [
      [MAX_BGM_BYTES, BGM_BASELINE_BYTES],
      [MAX_SFX_BYTES, SFX_BASELINE_BYTES],
    ] as const) {
      expect(max).toBeGreaterThan(base);
      expect(max - base).toBeGreaterThanOrEqual(Math.floor(base / 10));
    }

    // ── 实测面：按桶求和后各自过门 ──
    const files = fileEntries(AUDIO_DIR);
    const bgm = files.filter((f) => BGM_NAME_RE.test(f.name));
    const sfx = files.filter((f) => SFX_NAME_RE.test(f.name));
    // uncategorized 判空沿用③，但在这里它是**分桶门的成立前提**：逃出两桶的文件不受任何
    // 单桶上限约束（仍受例①的合计门），必须显式暴露而不是让桶悄悄少装一件。
    expect(
      files
        .filter((f) => !BGM_NAME_RE.test(f.name) && !SFX_NAME_RE.test(f.name))
        .map((f) => f.name),
    ).toEqual([]);
    expect(bgm.length).toBe(9);
    expect(sfx.length).toBe(6);

    const bgmBytes = bgm.reduce((a, f) => a + f.size, 0);
    const sfxBytes = sfx.reduce((a, f) => a + f.size, 0);
    // 桶基线本身也必须当场对得上盘（钉桩数字与磁盘同源，同用例①的单向判据方向）
    expect(bgmBytes, `BGM 桶当次实测 ${bgmBytes} B 与基线 ${BGM_BASELINE_BYTES} B 不同源（增删／换档要按文件头四步走）`).toBe(
      BGM_BASELINE_BYTES,
    );
    expect(sfxBytes, `SFX 桶当次实测 ${sfxBytes} B 与基线 ${SFX_BASELINE_BYTES} B 不同源`).toBe(SFX_BASELINE_BYTES);
    expect(
      bgmBytes,
      `BGM 桶 ${bgmBytes.toLocaleString('en-US')} B 超过单桶上限 ${MAX_BGM_BYTES.toLocaleString('en-US')} B`
        + '（合计门没拦到、只有分桶能拦的「单曲变长」形态）',
    ).toBeLessThanOrEqual(MAX_BGM_BYTES);
    expect(
      sfxBytes,
      `SFX 桶 ${sfxBytes.toLocaleString('en-US')} B 超过单桶上限 ${MAX_SFX_BYTES.toLocaleString('en-US')} B`,
    ).toBeLessThanOrEqual(MAX_SFX_BYTES);
    // 两桶合计必须回到例①③ 的合计量纲：同一批文件既不能被数两次，也不能漏一件
    expect(bgmBytes + sfxBytes).toBe(totalBytes(AUDIO_DIR));
  });
});
