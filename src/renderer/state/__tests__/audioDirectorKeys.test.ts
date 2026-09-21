/**
 * c922-132：情绪选曲的**键域契约**钉桩。
 *
 * 不变量：`selectBgmKey` 在任意情绪输入下返回的 BGM 键必须 **非空** 且 **⊆ ALL_BGM_KEYS**
 * （BootScene 按这张清单加载，清单外的键＝运行期静音降级，静态阶段没人拦）。
 *
 * 为什么既有两件抓不到这条（不是重复建设）：
 *  - `audioDirector.test.ts` 逐分支钉**期望值字面量**——把 return 改成 `'bgm_disco'` 只要顺手把
 *    期望也改成 `'bgm_disco'` 就照绿，它守的是「分支序」不是「键在清单里」。
 *  - `audioKeys.test.ts`（c918-07）钉 `ALL_BGM_KEYS`／`SFX_KEYS` ↔ 磁盘音频，**完全不看选择器产出**。
 *  两条的交叉（选择器值域 ⊆ 清单）此前零守护 ⇒ 本件补这一条。
 * 与在箱 c922-14（BGM 体积画像）不同面：那是资产体量，本件是键域。
 *
 * 任务书点名的 `pickBgm` 在盘上不存在（全仓 `rg pickBgm` 零命中），情绪分支的实际载体是
 * `selectBgmKey`（`audioDirector.ts:18`，含 :28 的 ALL_BGM_KEYS 9 键、:36 的 SFX_KEYS 6 键）⇒ 按实况执行。
 */
import { describe, expect, it } from 'vitest';
import { ALL_BGM_KEYS, SFX_KEYS, selectBgmKey, type AudioDirectorInput } from '../audioDirector';

type Ending = 'gong' | 'jia' | 'huo' | null;

/** 国格档位：含越界与 NaN——现状必须兜底到繁荣床且不得吐清单外键（只钉现状不改行为）。 */
const GRADES: number[] = [-1, 0, 1, 2, 3, 4, 5, 6, 99, Number.NaN];
const ENDINGS: Ending[] = [null, 'gong', 'jia', 'huo'];
const CHAPTERS: (number | null)[] = [null, 0, 1, 7, 8];
const CRISIS: boolean[] = [false, true];

/** 情绪输入全笛卡尔积（10 × 4 × 5 × 2 ＝ 400 组）。 */
function allMoodInputs(): AudioDirectorInput[] {
  const out: AudioDirectorInput[] = [];
  for (const grade of GRADES) {
    for (const ending of ENDINGS) {
      for (const storyChapter of CHAPTERS) {
        for (const crisisActive of CRISIS) {
          out.push({ grade, crisisActive, storyChapter, ending });
        }
      }
    }
  }
  return out;
}

const ALL_INPUTS = allMoodInputs();
const ALL_KEYS = new Set<string>(ALL_BGM_KEYS);
/** 枚举实际产出的键集合（值域实测，非人工抄写）。 */
const PRODUCED = new Set<string>(ALL_INPUTS.map((i) => selectBgmKey(i)));

describe('c922-132 情绪选曲键域契约（selectBgmKey 值域 ⊆ ALL_BGM_KEYS）', () => {
  it('① 清单与枚举自身自证：ALL_BGM_KEYS 9 键非空无重复，情绪枚举非空', () => {
    // 防假绿三件套：清单空集则 ⊆ 恒真，枚举空则遍历空转。
    expect(ALL_BGM_KEYS.length).toBe(9);
    expect(new Set(ALL_BGM_KEYS).size).toBe(9);
    for (const k of ALL_BGM_KEYS) expect(k.trim().length).toBeGreaterThan(0);
    expect(ALL_INPUTS.length).toBe(GRADES.length * ENDINGS.length * CHAPTERS.length * CRISIS.length);
    expect(ALL_INPUTS.length).toBe(400);
  });

  it('② 400 组情绪输入逐一过：返回键是非空字符串且落在 ALL_BGM_KEYS 内', () => {
    for (const input of ALL_INPUTS) {
      const key = selectBgmKey(input);
      expect(typeof key, JSON.stringify(input)).toBe('string');
      expect(key.trim().length, `空键 ${JSON.stringify(input)}`).toBeGreaterThan(0);
      expect(ALL_KEYS.has(key), `清单外键 ${key} ← ${JSON.stringify(input)}`).toBe(true);
    }
  });

  it('③ 值域实测恰为 7 个可达键；清单内 bgm_war/bgm_ritual 选择器不产出（现状钉桩）', () => {
    expect([...PRODUCED].sort()).toEqual([
      'bgm_crisis',
      'bgm_ending_gong',
      'bgm_ending_huo',
      'bgm_ending_jia',
      'bgm_prosper_high',
      'bgm_prosper_low',
      'bgm_prosper_mid',
    ]);
    const unreachable = ALL_BGM_KEYS.filter((k) => !PRODUCED.has(k)).sort();
    expect(unreachable).toEqual(['bgm_ritual', 'bgm_war']);
    // 值域必须是清单的**真子集**：出现清单外键即上一例红，出现"清单被值域吞满"则说明有人删了键。
    expect(PRODUCED.size).toBeLessThan(ALL_BGM_KEYS.length);
  });

  it('④ 优先级三档各自的代表键都在清单内，且结局＞危机＞繁荣床的现状序不因输入序而变', () => {
    const pick = (p: Partial<AudioDirectorInput>) => selectBgmKey({
      grade: 0, crisisActive: false, storyChapter: null, ending: null, ...p,
    });
    expect(pick({ ending: 'gong', crisisActive: true, grade: 5 })).toBe('bgm_ending_gong');
    expect(pick({ crisisActive: true, grade: 5 })).toBe('bgm_crisis');
    expect(pick({ grade: 5 })).toBe('bgm_prosper_high');
    expect(pick({ grade: 2 })).toBe('bgm_prosper_mid');
    expect(pick({ grade: 1 })).toBe('bgm_prosper_low');
    for (const e of ['gong', 'jia', 'huo'] as const) expect(ALL_KEYS.has(`bgm_ending_${e}`)).toBe(true);
  });

  it('⑤ 现状两条：storyChapter 不参与选曲；grade 为 NaN/越界一律兜底繁荣床低档', () => {
    // 文件头注释声称「故事卷动机」是优先级第三档，实现里没有 ⇒ 只钉现状，修复另单办。
    for (const ch of CHAPTERS) {
      expect(selectBgmKey({ grade: 3, crisisActive: false, storyChapter: ch, ending: null }))
        .toBe('bgm_prosper_mid');
    }
    expect(selectBgmKey({ grade: Number.NaN, crisisActive: false, storyChapter: null, ending: null }))
      .toBe('bgm_prosper_low');
    expect(selectBgmKey({ grade: -5, crisisActive: false, storyChapter: null, ending: null }))
      .toBe('bgm_prosper_low');
    expect(selectBgmKey({ grade: 999, crisisActive: false, storyChapter: null, ending: null }))
      .toBe('bgm_prosper_high');
  });

  it('⑥ 键域不撞名：ALL_BGM_KEYS 与 SFX_KEYS 互不相交且各自无重复', () => {
    const bgm = new Set<string>(ALL_BGM_KEYS);
    const sfx = new Set<string>(SFX_KEYS);
    expect(sfx.size).toBe(SFX_KEYS.length);
    expect([...bgm].filter((k) => sfx.has(k))).toEqual([]);
    expect(bgm.size + sfx.size).toBe(15); // 9 BGM ＋ 6 SFX 全局唯一
  });
});
