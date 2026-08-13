/**
 * P3-4 文案铁律守护：半文半白、禁偏字——非历史专业玩家一遍要能看懂。
 * 扫描静态内容文案，任何禁用字命中即红，防未来内容悄悄回退。
 */
import { describe, it, expect } from 'vitest';
import { BUILDINGS } from '../buildings';
import { POLICIES } from '../policies';
import { DECREES } from '../decrees';
import { RELIC_CHAINS } from '../../state/relicSystem';
import { pickEndgameWave } from '../../state/endgameEscalation';

/** 铁律禁偏字（START_HERE 第 3 节 + 本批新增） */
const BANNED_CHARS = ['畿', '耒', '耜', '胄', '黔', '嵎', '泌', '镞', '鏖', '诰', '敕', '漕', '窳', '筚', '沤'] as const;

function violationsOf(texts: (string | undefined)[]): string[] {
  const out: string[] = [];
  for (const t of texts) {
    if (!t) continue;
    for (const ch of BANNED_CHARS) {
      if (t.includes(ch)) out.push(`${t} → 含禁字「${ch}」`);
    }
  }
  return out;
}

describe('P3-4 文案禁偏字', () => {
  it('建筑文案无禁偏字', () => {
    const bad = BUILDINGS.flatMap(b => violationsOf([b.name, b.tierName, b.description, b.descPlain]));
    expect(bad).toEqual([]);
  });

  it('国策/朝令文案无禁偏字', () => {
    const p = POLICIES.flatMap(x => violationsOf([x.name, x.description, x.descPlain]));
    const d = DECREES.flatMap(x => violationsOf([x.name, x.description, x.descPlain]));
    expect([...p, ...d]).toEqual([]);
  });

  it('古迹/终局文案无禁偏字', () => {
    const r = RELIC_CHAINS.flatMap(c => [
      c.name,
      ...c.stages.flatMap(s => [s.title, s.desc, s.descPlain, ...s.choices.flatMap(x => [x.text, x.textPlain, x.summary])]),
    ]);
    const e = [0, 1, 2].map(i => pickEndgameWave(i, 1).text);
    expect(violationsOf([...r, ...e])).toEqual([]);
  });
});
