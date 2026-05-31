/**
 * 故事模式章节定义（Phase 2 骨架）。
 *
 * 内容正源 = 小说《天下人书记》（docs/design/_tianxiaren_source.md），逐卷剧情事件 = Phase 3。
 * 本轮只填 序章 + 第一章「血堤」占位（banner + 一句取材小说意象的引子）。
 * 铁律：文案半文半白禁偏字；不喊口号、用情节演绎；社会形态一律用 公天下/家天下/货天下。
 */

export interface ChapterDef {
  /** 0=序章，1..7=七卷 */
  chapter: number;
  id: string;
  /** 卷名（带"序章/第一章"前缀） */
  title: string;
  /** 通俗副标题（降低理解门槛） */
  subtitle: string;
  /** 时代标签 */
  era: string;
  /** 进入本章时顶栏 banner + 引子 Toast 文案（半文半白） */
  intro: string;
}

export const STORY_CHAPTERS: ChapterDef[] = [
  {
    chapter: 0,
    id: 'prologue',
    title: '序章 · 立邦',
    subtitle: '白手起家，统一天下',
    era: '春秋 · 青铜 · 小邦',
    intro: '草庐数十，炊烟初起。或以兵威、或以信义，且看你如何把这一隅小邦，做成天下共主。',
  },
  {
    chapter: 1,
    id: 'ch1_blood_dike',
    title: '第一章 · 血堤',
    subtitle: '破土——在旧秩序的裂缝里采集新火种',
    era: '邦国初成',
    // 取材卷一"江堤溃决查贪 + 组建教导队"，不喊口号、用情节起手
    intro: '王朝立国已久，堤决而万民溺，库银却不知所踪。有人说该查，有人说该压。你坐在大殿上，第一次觉得这把椅子硌人。',
  },
];

/** 统一→建朝的跳变旁白（全屏过场，时间快进、王朝渐腐，为第一章铺垫）。 */
export const DYNASTY_TRANSITION_NARRATION = [
  '于是天下一统，你受推为王，立宗庙、定都邑，是为开国之君。',
  '岁月流转，数百年如水。你立下的规矩渐渐成了世家的家业，仓廪的粮渐渐进了少数人的囤，当年"谁种地谁吃饱"的话，没人再提。',
  '你阖目又睁眼，已是几百年后——同一血脉的后人坐在同一把椅子上，看着自己理想建起的国，烂成了最痛恨的模样。',
  '该有人，革自己祖宗的命了。',
];

export function chapterAt(n: number): ChapterDef {
  return STORY_CHAPTERS.find(c => c.chapter === n) ?? STORY_CHAPTERS[0]!;
}
