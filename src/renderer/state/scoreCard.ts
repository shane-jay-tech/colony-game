/**
 * 终局记分牌（P2 目标感系统 · 对标群星多维胜利分 + HOI4 胜利点）。纯函数、无副作用。
 *
 * 给玩家一个「可量化的一生功业」：沙盒登顶 / 故事结局时结算一次，平时随时可查（HUD「记」）。
 * 权重为初版锚点，待 playtest 校准——原则：里程碑事件 > 存量数字（国格/大工程/盟邦 > 人口/存续）。
 */

export type EndingId = 'gong' | 'jia' | 'huo';

export interface ScoreInput {
  grade: number;
  gradeReached: number;
  population: number;
  buildingCount: number;
  /** 盟友数（stance ≥ 60） */
  allyCount: number;
  /** 通好邦数（stance ≥ 20） */
  friendlyCount: number;
  /** 打服/吞并的邦数（军力 ≤ 20） */
  subjugatedCount: number;
  /** 低谷危机挺过次数 */
  crisisCount: number;
  relicsDone: number;
  relicsTotal: number;
  megaProjectsDone: number;
  megaProjectsTotal: number;
  endgameWavesSurvived: number;
  /** 故事结局（沙盒 null） */
  ending: EndingId | null;
  /** 是否登顶天下共主 */
  tianxia: boolean;
  /** 存续天数 */
  days: number;
}

export interface ScoreItem {
  label: string;
  /** 玩家可读数值（如「第 2 格 · 邦国」「3 / 4」） */
  valueText: string;
  points: number;
}

export interface ScoreCard {
  total: number;
  items: ScoreItem[];
  /** 头衔（按总分给一句半文白评语） */
  verdict: string;
}

export const GRADE_NAMES = ['聚落', '城邑', '邦国', '诸侯', '霸主', '天下共主'] as const;

export function computeScoreCard(input: ScoreInput): ScoreCard {
  const items: ScoreItem[] = [];
  const add = (label: string, valueText: string, points: number): void => {
    items.push({ label, valueText, points: Math.round(points) });
  };

  const gradeName = GRADE_NAMES[Math.max(0, Math.min(GRADE_NAMES.length - 1, input.gradeReached))] ?? '聚落';
  add('国格', '第 ' + input.gradeReached + ' 格 · ' + gradeName, input.gradeReached * 200);
  if (input.tianxia) add('天下共主', '九鼎既铸，名动天下', 1000);
  add('人口', String(input.population) + ' 口', input.population * 2);
  add('城建', input.buildingCount + ' 栋', input.buildingCount * 5);
  add('盟邦', input.allyCount + ' 邦', input.allyCount * 150);
  add('通好', input.friendlyCount + ' 邦', input.friendlyCount * 50);
  add('慑服', input.subjugatedCount + ' 邦', input.subjugatedCount * 300);
  add('低谷挺过', input.crisisCount + ' 次', input.crisisCount * 80);
  if (input.relicsTotal > 0) {
    add('古迹探毕', input.relicsDone + ' / ' + input.relicsTotal, input.relicsDone * 120);
  }
  if (input.megaProjectsTotal > 0) {
    add('大业功成', input.megaProjectsDone + ' / ' + input.megaProjectsTotal, input.megaProjectsDone * 200);
  }
  if (input.endgameWavesSurvived > 0) {
    add('终局风浪', '扛过 ' + input.endgameWavesSurvived + ' 波', input.endgameWavesSurvived * 150);
  }
  if (input.ending) {
    const endPoints = input.ending === 'gong' ? 500 : input.ending === 'jia' ? 200 : 300;
    const endName = input.ending === 'gong' ? '公天下' : input.ending === 'jia' ? '家天下' : '货天下';
    add('结局 · ' + endName, '一生功业，终有所归', endPoints);
  }
  add('存续', Math.floor(input.days / 10) * 10 + ' 日', Math.floor(input.days / 10));

  const total = items.reduce((s, i) => s + i.points, 0);
  return { total, items, verdict: verdictFor(total, input) };
}

/** 总分评语（半文白，禁偏字；阈值初版锚点待校准）。 */
function verdictFor(total: number, input: ScoreInput): string {
  if (input.ending === 'gong') return '大道之行，天下为公。这一生，山河记住了你。';
  if (input.ending === 'jia') return '为一代明君，守住了江山，也守住了循环。';
  if (input.ending === 'huo') return '国强而人心凉。富了天下，却丢了当年的自己。';
  if (input.tianxia) return '九鼎已铸，功业圆满。史书当为君单开一卷。';
  if (total >= 1500) return '一方强藩，列国侧目。再进一步，便是名动天下。';
  if (total >= 800) return '立国已稳，百业渐兴。守成与进取，君自权衡。';
  if (total >= 300) return '初具规模，民有温饱。创业维艰，来日方长。';
  return '草创之时，筚路蓝缕。每一粒粮都算数。';
}
