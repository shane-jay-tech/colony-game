// 四季名表唯一事实源在 data/dslCore.ts 的 SEASON_NAMES（c922-131 去重；c923-10 去掉 _DSL 后缀）。
// 原此处是第二份重复表且类型为 readonly string[]（无字面量类型，「索引 0..3 对应四季」只靠断言守）。
// 复用方向由 c922-11 边界门禁决定：data 不得上引 state ⇒ 表留 data 侧、state/calendar 引 data。
export { SEASON_NAMES } from '../data/dslCore';

export function dayToCalendar(day: number): { year: number; season: 0 | 1 | 2 | 3; dayOfSeason: number } {
  const totalDays = Math.max(0, Math.floor(day));
  const year = Math.floor(totalDays / 120);
  const dayInYear = totalDays % 120;
  const season = Math.floor(dayInYear / 30) as 0 | 1 | 2 | 3;
  const dayOfSeason = dayInYear % 30;
  return { year, season, dayOfSeason };
}
