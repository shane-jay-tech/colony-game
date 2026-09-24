// c922-12：state/calendar 纯函数钉桩。
// 锚点复核后的磁盘实况（与任务书有出入，逐条留痕）：
//   - calendar.ts:3 dayToCalendar ✓ 确在第 3 行；消费点 gameStore.ts:942、GameScene.ts:191 ✓ 均在；
//   - 「57 个 state 测试文件 0 引用」**不成立**：state/__tests__ 确有 57 个 .test.ts，
//     但 timeSystem.test.ts:15-31 已有 describe('dayToCalendar')，钉掉 day 0/29/30/120 四点；
//   - 因此本文件的增量是：day 119（旧四点里唯一缺的年内末点）、负数、小数、SEASON_NAMES 顺序、
//     以及「30 天一季 / 120 天一年」的不变量与跨文件季名漂移探测。生产码零改动。
import { describe, expect, it } from 'vitest';
import { dayToCalendar, SEASON_NAMES as SEASON_NAMES_VIA_CALENDAR } from '../calendar';
import { SEASON_NAMES } from '../../data/dslCore'; // 唯一事实源（c922-131 去重）在 data 侧
import { dayToCalendar as viaTimeSystem } from '../timeSystem'; // timeSystem.ts:4 的再导出，应与本源同一函数

type Cal = { year: number; season: 0 | 1 | 2 | 3; dayOfSeason: number };

describe('c922-12 dayToCalendar 边界钉桩', () => {
  it('① 纯函数自证 + SEASON_NAMES 顺序与跨文件一致', () => {
    expect(SEASON_NAMES).toEqual(['spring', 'summer', 'autumn', 'winter']); // 顺序即 season 索引语义
    expect(SEASON_NAMES).toHaveLength(4);
    // 四季名表自 c922-131 起只剩 data/dslCore.ts 一份，state/calendar.ts 是再导出 ⇒
    // 原「逐项相等」断言比的是同一个对象、永不失败（在册假绿，c922-131 result 已记护栏失效面）。
    // c923-10 改为身份断言：只要 state 侧敢再另立第二份字面量表（漂移复发），这一条当场红。
    expect(SEASON_NAMES_VIA_CALENDAR).toBe(SEASON_NAMES);
    const a = dayToCalendar(45);
    const b = dayToCalendar(45);
    expect(b).toEqual(a);                       // 同输入同输出
    expect(a).not.toBe(b);                      // 每次新建对象（防日后缓存成共享可变对象）
    expect(viaTimeSystem).toBe(dayToCalendar);  // 兼容再导出未 fork 实现
  });

  it('② 任务书点名的边界日逐个钉死（含旧测试缺的 day 119）', () => {
    const cases: Array<[number, Cal]> = [
      [0, { year: 0, season: 0, dayOfSeason: 0 }],      // 开局即春 0
      [28, { year: 0, season: 0, dayOfSeason: 28 }],
      [29, { year: 0, season: 0, dayOfSeason: 29 }],    // 春季最后一日
      [30, { year: 0, season: 1, dayOfSeason: 0 }],     // 夏始
      [59, { year: 0, season: 1, dayOfSeason: 29 }],
      [60, { year: 0, season: 2, dayOfSeason: 0 }],     // 秋始
      [89, { year: 0, season: 2, dayOfSeason: 29 }],
      [90, { year: 0, season: 3, dayOfSeason: 0 }],      // 冬始
      [119, { year: 0, season: 3, dayOfSeason: 29 }],   // 年第 120 日：旧测试未钉
      [120, { year: 1, season: 0, dayOfSeason: 0 }],     // 跨年回春
      [121, { year: 1, season: 0, dayOfSeason: 1 }],
      [149, { year: 1, season: 0, dayOfSeason: 29 }],
      [150, { year: 1, season: 1, dayOfSeason: 0 }],
    ];
    for (const [day, want] of cases) expect({ day, got: dayToCalendar(day) }).toEqual({ day, got: want });
  });

  it('③ 30 天一季 / 120 天一年的结构不变量（连续 0..239 全扫）', () => {
    const seasonDays = new Map<number, number>();
    for (let d = 0; d < 240; d++) {
      const c = dayToCalendar(d);
      expect(c.year).toBe(Math.floor(d / 120));
      expect(c.season).toBe(Math.floor((d % 120) / 30));
      expect(c.dayOfSeason).toBe(d % 30);
      expect(c.dayOfSeason).toBeGreaterThanOrEqual(0);
      expect(c.dayOfSeason).toBeLessThanOrEqual(29);
      expect(c.season).toBeGreaterThanOrEqual(0);
      expect(c.season).toBeLessThanOrEqual(3);
      expect(SEASON_NAMES[c.season]).toBeDefined(); // 索引永不越界（越界即 undefined 渲染进 UI）
      seasonDays.set(c.season, (seasonDays.get(c.season) ?? 0) + 1);
    }
    expect([...seasonDays.entries()].sort()).toEqual([[0, 60], [1, 60], [2, 60], [3, 60]]); // 4 季各 60 天（2 年）
  });

  it('④ 负数与小数的语义实况：小数走 floor、负数被 clamp 到 0（不回绕）', () => {
    // 小数 = Math.floor：29.9 仍是春季最后一日，30.0 才换季
    expect(dayToCalendar(29.9)).toEqual({ year: 0, season: 0, dayOfSeason: 29 });
    expect(dayToCalendar(0.999)).toEqual({ year: 0, season: 0, dayOfSeason: 0 });
    expect(dayToCalendar(30.5)).toEqual({ year: 0, season: 1, dayOfSeason: 0 });
    expect(dayToCalendar(119.99)).toEqual({ year: 0, season: 3, dayOfSeason: 29 });
    expect(dayToCalendar(120.5)).toEqual({ year: 1, season: 0, dayOfSeason: 0 });
    // 负数：Math.max(0, floor(day)) —— 任务书写的是「负数（floor 语义）」，
    // 磁盘实况是 clamp 而非 floor 回绕：-1 不会落到「上一周期冬 29」，而是钳到开局日。
    for (const d of [-0.5, -1, -29, -30, -120, -1000]) {
      expect({ day: d, got: dayToCalendar(d) }).toEqual({ day: d, got: { year: 0, season: 0, dayOfSeason: 0 } });
    }
  });

  it('⑤ NaN 现状钉桩（记录缺陷，不是认可）', () => {
    // Math.max(0, NaN) === NaN，返回值里三个字段全 NaN；
    // 签名上的 `as 0 | 1 | 2 | 3` 只是断言，编译期不会拦。
    // 上游把脏 day 喂进来时这里仍无任何守卫（订正来源 c923-11 §7，逐字照抄后半句）：
    // saveLoad 侧 `MAX_SAVE_CURRENT_DAY` 只保证有限非负且**不保证整数**；tick 侧 `Math.min` 只截上界。
    const c = dayToCalendar(Number.NaN);
    expect(Number.isNaN(c.year)).toBe(true);
    expect(Number.isNaN(c.season)).toBe(true);
    expect(Number.isNaN(c.dayOfSeason)).toBe(true);
    expect(SEASON_NAMES[c.season as number]).toBeUndefined();
    expect(Number.isFinite(dayToCalendar(Number.POSITIVE_INFINITY).year)).toBe(false);
  });
});
