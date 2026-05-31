export const SEASON_NAMES: readonly string[] = ['spring', 'summer', 'autumn', 'winter'];

export function dayToCalendar(day: number): { year: number; season: 0 | 1 | 2 | 3; dayOfSeason: number } {
  const totalDays = Math.max(0, Math.floor(day));
  const year = Math.floor(totalDays / 120);
  const dayInYear = totalDays % 120;
  const season = Math.floor(dayInYear / 30) as 0 | 1 | 2 | 3;
  const dayOfSeason = dayInYear % 30;
  return { year, season, dayOfSeason };
}
