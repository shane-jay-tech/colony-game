// c923-29：故事章节表 storyChapters 的**结构**不变量（chapterAt clamp 三态 ＋ 叙述表完整性）。
//
// 动因（卷宗锚点，2026-09-23 磁盘逐条复验）：
//   - `storyChapters.ts:167` 的 `chapterAt` 自述 clamp 语义：「索引越界先 clamp 到 [0, 末章]，
//     避免 n>7 误回退到序章（dwell=0 致卡死）」——而这条语义**在全仓测试里从不被真跑**：
//     `ui/__tests__/StoryBar.test.ts:29` 用 `vi.mock` 把 chapterAt 换成了
//     `(n) => CHAPTERS[n] ?? CHAPTERS[0]`，**那个替身恰恰是被 clamp 消灭掉的旧 buggy 写法**
//     （越界回序章）。于是 StoryBar 的绿只证明"它调了个叫 chapterAt 的东西"。
//   - `state/__tests__/storyContent.test.ts` 四面（悬空事件引用 / 35 条剧情事件 / 双选双轴 /
//     三结局可达）全在 **STORY_EVENTS 内容面**，`STORY_CHAPTERS` 只在其中当 id 来源被读一次；
//     章节表自身的 chapter 序、id、goal 形态、三键叙述表**零结构断言**。
//
// 🔴 红线口径：不碰任何章节**文案内容**（title/intro/旁白句子一个字都不比对），
//   也不比任何**数值目标**（`advanceAfterDays`、`goal.days` 只断"有没有/是不是有限数"，
//   绝不写等于几）。为此下面的行集根本不带数值字段（末块把它钉成用例）。
//
// 与在册守卫的分工（逐面对照写在 result 的「验收情况」④）：
//   storyContent.test.ts 判 `advanceGoal.eventIds` 里的 id **是否真实存在**（内容面）；
//   本件判 goal 的 **kind 分布与字段互斥形态**（结构面），不重复查存在性。
//
// ⚠ 本目录门禁：`dataLayerBoundary.test.ts` 文件头立了字面判据
//   `rg -n '\.\./state/' src/renderer/data/__tests__/` → 0 命中。
//   故本件**刻意不 import `state/storyDriver`**（`checkEnding` 返回值域 ≡ ENDING_NARRATION 键集
//   这条跨源断言属 state 侧，见 result「遗留问题」）。
//
// 零生产码改动：本文件只 import，不改 storyChapters.ts 一个字符。
import { describe, expect, it } from 'vitest';
import type { ChapterDef } from '../storyChapters';
import {
  chapterAt,
  DYNASTY_TRANSITION_NARRATION,
  ENDING_NARRATION,
  STORY_CHAPTERS,
} from '../storyChapters';

const LAST_CHAPTER_INDEX = STORY_CHAPTERS.length - 1;
const chapterIds = new Set<string>(STORY_CHAPTERS.map((c) => c.id));

/** 行结构刻意只含结构字段（who/kind），无 days / advanceAfterDays / 文案正文——见文件头红线口径。 */
type GoalRow = { who: string; kind: string };
const GOAL_ROWS: GoalRow[] = STORY_CHAPTERS.map((c) => ({
  who: `STORY_CHAPTERS.${c.id}`,
  kind: c.advanceGoal?.kind ?? '<none>',
}));

/** 取一次 chapterAt，返回值必须是表内某章（永不为 undefined）。 */
function clampTarget(n: number): ChapterDef | undefined {
  const got = chapterAt(n);
  return STORY_CHAPTERS.find((c) => c === got);
}

describe('c923-29 钉子一：chapterAt 的 clamp 三态（真函数直测，不 mock）', () => {
  it('负数态：-1 / -8 / -0.5 / -MAX 一律钳到序章（chapter 0），不回绕', () => {
    for (const n of [-1, -8, -0.5, -Number.MAX_SAFE_INTEGER, -Infinity]) {
      const hit = clampTarget(n);
      expect(hit, `chapterAt(${n}) 返回了表外对象`).toBeDefined();
      expect(hit?.chapter, `chapterAt(${n}) 应钳到 0`).toBe(0);
      expect(hit?.id).toBe('prologue');
    }
  });

  it('超末章态：8 / 99 / MAX_SAFE_INTEGER / +Infinity 一律钳到末章（第 7 章），**不得回退序章**', () => {
    for (const n of [8, 99, 1e9, Number.MAX_SAFE_INTEGER, Infinity]) {
      const hit = clampTarget(n);
      expect(hit, `chapterAt(${n}) 返回了表外对象`).toBeDefined();
      expect(hit?.chapter, `chapterAt(${n}) 应钳到末章 ${LAST_CHAPTER_INDEX}`).toBe(LAST_CHAPTER_INDEX);
      // 这条是 docstring 的原始动机：越界若退回 0，dwell=0 会让章节卡死
      expect(hit?.id === 'prologue', `chapterAt(${n}) 竟回退到序章（clamp 失效）`).toBe(false);
    }
  });

  it('浮点态：走 Math.floor 取整（2.7→2 / 6.999→6 / 0.5→0），不是四舍五入也不是抛错', () => {
    const floorTo = (n: number): number => chapterAt(n).chapter;
    expect(floorTo(2.7)).toBe(2);
    expect(floorTo(2.9999)).toBe(2);
    expect(floorTo(6.999)).toBe(6);
    expect(floorTo(0.5)).toBe(0);
    expect(floorTo(3.2)).toBe(3);
    // 反向鉴别：真函数不得用 Math.round（2.7 round 成 3 ⇒ 这条把"floor vs round"钉住）
    expect(chapterAt(2.7).id).toBe('ch2_steles');
  });

  it('边界与全域扫描：-50..50 每个整数／半点都落在表内某章，永不 undefined、永不越表', () => {
    let previous = -1;
    for (let i = -100; i <= 100; i++) {
      const got = clampTarget(i / 2);
      expect(got, `chapterAt(${i / 2}) 不在表内`).toBeDefined();
      expect(chapterIds.has(got!.id), `chapterAt(${i / 2}) 返回表外 id ${got?.id}`).toBe(true);
      expect(got!.chapter, `chapterAt(${i / 2}) chapter 越界`).toBeGreaterThanOrEqual(0);
      expect(got!.chapter).toBeLessThanOrEqual(LAST_CHAPTER_INDEX);
      // 单调不减：clamp 后的 chapter 随入参非递减（跳跃只允许"停在末章"）
      expect(got!.chapter >= previous, `chapterAt(${i / 2}) 相对前值回退了`).toBe(true);
      previous = got!.chapter;
    }
    expect(chapterAt(0).chapter).toBe(0);
    expect(chapterAt(LAST_CHAPTER_INDEX).chapter).toBe(LAST_CHAPTER_INDEX);
  });

  it('返回值恒为表内**同一对象引用**（chapterAt 不得克隆/新建章节对象）', () => {
    for (const c of STORY_CHAPTERS) expect(chapterAt(c.chapter)).toBe(c);
  });

  it('clamp 上限与表尾同源：加章即自动跟（现值末章 index = 表长 − 1 = 7）', () => {
    const tail = STORY_CHAPTERS[LAST_CHAPTER_INDEX]!;
    expect(chapterAt(9999)).toBe(tail);
    expect(LAST_CHAPTER_INDEX).toBe(7); // 条数 canary（结构量，非平衡数值）
    // 表内最大 chapter 必须就是末章的 chapter，否则 clamp 会钳到一个不存在的序
    const maxChapter = Math.max(...STORY_CHAPTERS.map((c) => c.chapter));
    expect(maxChapter).toBe(tail.chapter);
  });
});

describe('c923-29 钉子二：STORY_CHAPTERS 表完整性（序 / id / 必填字段）', () => {
  it('8 章，chapter 序恰为 0..7 连续无重，id 唯一且逐名钉桩', () => {
    expect(STORY_CHAPTERS.length).toBe(8);
    expect(STORY_CHAPTERS.map((c) => c.chapter)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const ids = STORY_CHAPTERS.map((c) => c.id);
    expect(new Set(ids).size, `重复 id：${ids.filter((v, i) => ids.indexOf(v) !== i).join(', ')}`).toBe(ids.length);
    expect(ids).toEqual([
      'prologue',
      'ch1_blood_dike',
      'ch2_steles',
      'ch3_temper',
      'ch4_iron_fire',
      'ch5_sea_lamp',
      'ch6_awaken',
      'ch7_roots',
    ]);
  });

  it('chapter 与数组下标一致（chapterAt 靠 find(chapter===n)，两者错开即静默跳章）', () => {
    STORY_CHAPTERS.forEach((c, i) => expect(c.chapter, `下标 ${i} 处 chapter=${c.chapter}`).toBe(i));
  });

  it('title / subtitle / era / intro 四字段皆为非空、无首尾空白的字符串（只判形状，不判文案）', () => {
    const bad: string[] = [];
    for (const c of STORY_CHAPTERS) {
      for (const field of ['title', 'subtitle', 'era', 'intro'] as const) {
        const v = c[field];
        if (typeof v !== 'string' || v.trim() === '' || v !== v.trim()) {
          bad.push(`${c.id}.${field}=${JSON.stringify(v)}`);
        }
      }
    }
    expect(bad, `文案字段形状非法：\n${bad.join('\n')}`).toEqual([]);
  });
});

describe('c923-29 钉子三：advanceGoal 两型分布与字段互斥（结构面，不读数值）', () => {
  it('kind 分布恰为 story_events × 7 / days × 0 / 无 goal × 1（无 goal 者即序章，靠统一推进）', () => {
    const byKind = new Map<string, string[]>();
    for (const r of GOAL_ROWS) {
      const list = byKind.get(r.kind);
      if (list) list.push(r.who);
      else byKind.set(r.kind, [r.who]);
    }
    expect([...(byKind.get('story_events') ?? [])].sort()).toEqual(
      ['ch1_blood_dike', 'ch2_steles', 'ch3_temper', 'ch4_iron_fire', 'ch5_sea_lamp', 'ch6_awaken', 'ch7_roots']
        .map((id) => `STORY_CHAPTERS.${id}`),
    );
    expect(byKind.get('days'), '现表内不得出现 kind=days 的章节（有即须回来复核本分布）').toBeUndefined();
    expect(byKind.get('<none>')).toEqual(['STORY_CHAPTERS.prologue']);
  });

  it('goal 字段互斥：story_events 必带非空 eventIds 且不带 days；days 型必带有限 days 且不带 eventIds', () => {
    const bad: string[] = [];
    for (const c of STORY_CHAPTERS) {
      const goal = c.advanceGoal;
      if (goal === undefined) {
        if (c.chapter !== 0) bad.push(`${c.id} 非序章却无 advanceGoal`);
        continue;
      }
      if (typeof goal.hint !== 'string' || goal.hint.trim() === '') bad.push(`${c.id} hint 空`);
      if (goal.kind === 'story_events') {
        const ids = goal.eventIds;
        if (!Array.isArray(ids) || ids.length === 0) bad.push(`${c.id} story_events 型缺 eventIds`);
        for (const id of ids ?? []) {
          if (typeof id !== 'string' || id.trim() === '') bad.push(`${c.id} 含非法 eventId ${JSON.stringify(id)}`);
        }
        const dup = new Set(ids ?? []);
        if (ids !== undefined && dup.size !== ids.length) bad.push(`${c.id} eventIds 有重复`);
        if (goal.days !== undefined) bad.push(`${c.id} story_events 型却带 days 字段`);
      } else if (goal.kind === 'days') {
        if (typeof goal.days !== 'number' || !Number.isFinite(goal.days)) bad.push(`${c.id} days 型缺有限 days 值`);
        if (goal.eventIds !== undefined) bad.push(`${c.id} days 型却带 eventIds`);
      } else {
        bad.push(`${c.id} kind=${JSON.stringify(goal.kind)} 不在两型枚举内`);
      }
    }
    // 注：只判"有没有/是不是有限数"，**不判是几天**——推进阈值是平衡数值，属只读域。
    expect(bad, `goal 形态非法：\n${bad.join('\n')}`).toEqual([]);
  });

  it('advanceAfterDays 存在性：序章无（靠统一推进），1..7 章皆有限数（值一概不比）', () => {
    for (const c of STORY_CHAPTERS) {
      if (c.chapter === 0) {
        expect(c.advanceAfterDays, '序章按 schema.ts:22 注释不该带 advanceAfterDays').toBeUndefined();
        continue;
      }
      expect(typeof c.advanceAfterDays, `${c.id} advanceAfterDays 类型`).toBe('number');
      expect(Number.isFinite(c.advanceAfterDays as number), `${c.id} advanceAfterDays 非有限`).toBe(true);
    }
  });
});

describe('c923-29 钉子四：三结局与建朝过场叙述表完整性', () => {
  it('ENDING_NARRATION 恰 gong / jia / huo 三键（不多不少；键名是 GameScene.ts:132 的运行时守卫枚举源）', () => {
    expect(Object.keys(ENDING_NARRATION).sort()).toEqual(['gong', 'huo', 'jia']);
  });

  it('每键皆行数 > 0、每行为非空且无首尾空白的字符串（行数刻意不钉死：纯文案细化不该弄红结构门）', () => {
    for (const key of ['gong', 'jia', 'huo'] as const) {
      const lines = ENDING_NARRATION[key];
      expect(Array.isArray(lines), `${key} 不是数组`).toBe(true);
      expect(lines.length, `${key} 结局旁白为空`).toBeGreaterThan(0);
      const blank = lines.map((l, i) => ({ i, l })).filter((r) => typeof r.l !== 'string' || r.l.trim() === '' || r.l !== r.l.trim());
      expect(blank.map((r) => `${key}[${r.i}]=${JSON.stringify(r.l)}`), `${key} 含空行`).toEqual([]);
    }
    const totalRows = (['gong', 'jia', 'huo'] as const).reduce((n, k) => n + ENDING_NARRATION[k].length, 0);
    expect(totalRows).toBeGreaterThanOrEqual(3);
  });

  it('DYNASTY_TRANSITION_NARRATION 非空、每行非空串（统一→建朝全屏过场的最低形状）', () => {
    expect(Array.isArray(DYNASTY_TRANSITION_NARRATION)).toBe(true);
    expect(DYNASTY_TRANSITION_NARRATION.length).toBeGreaterThan(0);
    const blank = DYNASTY_TRANSITION_NARRATION.filter((l) => typeof l !== 'string' || l.trim() === '');
    expect(blank).toEqual([]);
  });

  it('三结局键与章节表互不越界：章节 id 不得混进 ENDING_NARRATION，反之亦然', () => {
    for (const key of Object.keys(ENDING_NARRATION)) expect(chapterIds.has(key), `${key} 串进了章节表`).toBe(false);
    for (const id of chapterIds) expect(Object.keys(ENDING_NARRATION)).not.toContain(id);
  });
});

describe('c923-29 钉子五：红线结构自证——本件的行集根本拿不到数值目标', () => {
  it('goal 行集字段集恰为 {kind, who}，不含 days / advanceAfterDays / 文案正文', () => {
    const keys = [...new Set(GOAL_ROWS.flatMap((r) => Object.keys(r)))].sort();
    expect(keys).toEqual(['kind', 'who']);
    expect(GOAL_ROWS.length).toBe(8);
    // 本文件出现的数字只有：章节下标 0..7、表长 8、跳数扫描范围 ±100/±50、
    // 以及 9999/1e9/MAX_SAFE_INTEGER/Infinity 这类"必然越界"的探针量；
    // 没有一个来自 advanceAfterDays / goal.days 的实际值。
  });
});
