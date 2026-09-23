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
