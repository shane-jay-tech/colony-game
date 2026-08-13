/**
 * P2 目标感 · 三幕大事件时间轴（对标群星危机阶梯的春秋化：时间轴 + 玩家行为共同驱动）。
 *
 * 8h 沙盒切三幕，每幕改变列国行为参数 + 幕启叙事 banner——给开放式沙盒一个
 * 「天下大势」的节拍（HOI4 世界紧张度的叙事化版本），防中后期无事可做。
 * 纯数据 + 纯函数；参数是初版锚点，待 playtest 校准。
 */

export interface ActNpcParams {
  /** 蛮夷犯边概率乘数（base ≈ 0.15 + aggression*0.25） */
  tribalRaidMul: number;
  /** 非蛮夷 NPC 两两结盟概率加值（base 0.5；clamp 到 [0, 1]） */
  allianceBias: number;
  /** 联军压境概率乘数（base ≈ 0.2 + aggression*0.2） */
  assaultMul: number;
}

export interface ActDef {
  id: 'act_barbarians' | 'act_hegemony' | 'act_collapse';
  /** 幕名（HUD 顶栏显示） */
  name: string;
  /** 幕启 banner（半文白，禁偏字） */
  subtitle: string;
  /** 起始日（含） */
  startDay: number;
  params: ActNpcParams;
}

export const ACT_TIMELINE: readonly ActDef[] = [
  {
    id: 'act_barbarians',
    name: '第一幕 · 群狼环伺',
    subtitle: '草创之邦，四邻未定。蛮夷屡屡南下犯边，劫粮掠民——先求自保，再图远略。',
    startDay: 0,
    params: { tribalRaidMul: 1.6, allianceBias: 0, assaultMul: 0.8 },
  },
  {
    id: 'act_hegemony',
    name: '第二幕 · 诸侯会盟',
    subtitle: '邦势渐强，列国侧目。会盟与合纵并举，强则众邦联手制你，弱则沦为他人棋盘——天下正在站队。',
    startDay: 240,
    params: { tribalRaidMul: 1.0, allianceBias: 0.15, assaultMul: 1.3 },
  },
  {
    id: 'act_collapse',
    name: '第三幕 · 末世裂变',
    subtitle: '旧秩序分崩离析，大国裂而群雄再起。合纵之网愈密，四方之敌愈强——撑过此世，方见新天。',
    startDay: 480,
    params: { tribalRaidMul: 0.8, allianceBias: 0.25, assaultMul: 1.6 },
  },
] as const;

/** 按当前日取幕（越界取最后一幕；越早取第一幕）。 */
export function actFor(day: number): ActDef {
  let cur = ACT_TIMELINE[0]!;
  for (const act of ACT_TIMELINE) {
    if (day >= act.startDay) cur = act;
  }
  return cur;
}

/** 幕 id → 幕名（UIScene banner 复用）。 */
export function actName(id: string): string {
  return ACT_TIMELINE.find(a => a.id === id)?.name ?? id;
}
