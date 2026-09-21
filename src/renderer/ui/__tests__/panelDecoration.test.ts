// c922-129：panelDecoration.ts 的**首份**测试（改前实测零用例，同 courtFormat 一条命令取证）。
// 口径更正（按磁盘实况，非降格）：派单把本件与 courtFormat 并列称「纯函数、桩成本为零」，
//   实测本件**不是纯函数**——它是带副作用的绘制函数（唯一导出 drawDecorativePanelFrame，
//   import Phaser 类型面 ＋ palette 常量，靠向 Graphics 发命令产生效果，无返回值）。
//   因此本文件的桩＝复用已入库共享 fakeScene.makeFakeGraphics()（c922-125 定型的唯一定义处），
//   判据从"返回值"改成"**发出去的绘制命令序列与参数**"。桩成本约 10 行，仍属最廉档。
// 期望数字全部**硬编码**，不从实现里的 Math.max/Math.min/floor 反算——照抄公式就是自反式假绿。
// 经济平衡数值零接触：本件只碰几何与 palette 颜色常量，不读任何资源数值。
import { describe, expect, it, vi } from 'vitest';
import { drawDecorativePanelFrame } from '../panelDecoration';
import { COLORS, UI } from '../palette';
import { makeFakeGraphics } from './fakeScene';

type Gfx = Record<string, unknown>;
type Fn = ReturnType<typeof vi.fn>;
const callOf = (g: Gfx, name: string): Fn => g[name] as Fn;
const circles = (g: Gfx) =>
  callOf(g, 'fillCircle').mock.calls.map((c: unknown[]) => ({ x: c[0] as number, y: c[1] as number, r: c[2] as number }));
const strokes = (g: Gfx) =>
  callOf(g, 'strokeCircle').mock.calls.map((c: unknown[]) => ({ x: c[0] as number, y: c[1] as number, r: c[2] as number }));
const paths = (g: Gfx, name: string) => callOf(g, name).mock.calls.map((c: unknown[]) => [c[0], c[1]]);

/** 几何常量（palette.ts:105-108 实值：cornerOrnamentSize 24 / rivetSize 6 / panelBorderWidth 2 / panelGoldLineWidth 1）。 */
const INSET = 4;
const CORN = 24;
const RIVET_R = 3;
const PAD = 60;

const draw = (g: Gfx, x: number, y: number, w: number, h: number, side: 'left' | 'right') =>
  drawDecorativePanelFrame(g as unknown as Parameters<typeof drawDecorativePanelFrame>[0], x, y, w, h, side);

describe('c922-129 panelDecoration 钉子一：绘制契约与底板', () => {
  it('本函数自身不调 clear()——文件头注释把 clear 责任交给调用方，须钉住防双重清屏', () => {
    const g = makeFakeGraphics();
    draw(g, 0, 0, 200, 400, 'right');
    expect(callOf(g, 'clear').mock.calls.length).toBe(0);
  });
  it('木底恰一次：fillStyle(WOOD, 0.88) ＋ fillRect(x, y, w, h) 逐参钉桩', () => {
    const g = makeFakeGraphics();
    draw(g, 10, 20, 300, 500, 'right');
    expect(callOf(g, 'fillStyle').mock.calls[0]).toEqual([COLORS.WOOD, 0.88]);
    expect(callOf(g, 'fillRect').mock.calls).toEqual([[10, 20, 300, 500]]);
  });
  it('颜色只走 palette 三常量（金线 GOLD_DIM／金饰 GOLD／描边 WOOD），无字面十六进制', () => {
    const g = makeFakeGraphics();
    draw(g, 0, 0, 200, 400, 'left');
    const used = new Set([
      ...callOf(g, 'fillStyle').mock.calls.map((c: unknown[]) => c[0]),
      ...callOf(g, 'lineStyle').mock.calls.map((c: unknown[]) => c[1]),
    ]);
    expect([...used].sort((a, b) => (a as number) - (b as number)))
      .toEqual([COLORS.WOOD, COLORS.GOLD, COLORS.GOLD_DIM].sort((a, b) => a - b));
  });
});

describe('c922-129 panelDecoration 钉子二：双线门框与四角铜角', () => {
  it('两次 strokeRect：外框原尺寸 ＋ 内嵌 4px 的 w-8/h-8', () => {
    const g = makeFakeGraphics();
    draw(g, 10, 20, 300, 500, 'right');
    expect(callOf(g, 'strokeRect').mock.calls).toEqual([
      [10, 20, 300, 500],
      [14, 24, 292, 492],
    ]);
  });
  it('两条金线宽度取 UI.panelBorderWidth(2) 与 UI.panelGoldLineWidth(1)，透明度 1 与 0.65', () => {
    const g = makeFakeGraphics();
    draw(g, 0, 0, 200, 400, 'right');
    expect(callOf(g, 'lineStyle').mock.calls[0]).toEqual([UI.panelBorderWidth, COLORS.GOLD_DIM, 1]);
    expect(callOf(g, 'lineStyle').mock.calls[1]).toEqual([UI.panelGoldLineWidth, COLORS.GOLD_DIM, 0.65]);
    expect([UI.panelBorderWidth, UI.panelGoldLineWidth]).toEqual([2, 1]);
  });
  it('四角 L 形：beginPath/strokePath/moveTo 各恰 4 次，lineTo 8 次（每角 1 起 2 走）', () => {
    const g = makeFakeGraphics();
    draw(g, 0, 0, 200, 400, 'right');
    expect(callOf(g, 'beginPath').mock.calls.length).toBe(4);
    expect(callOf(g, 'strokePath').mock.calls.length).toBe(4);
    expect(callOf(g, 'moveTo').mock.calls.length).toBe(4);
    expect(callOf(g, 'lineTo').mock.calls.length).toBe(8);
  });
  it('左上与右下角坐标逐点钉桩（inset=4、铜角边长=cornerOrnamentSize=24）', () => {
    const g = makeFakeGraphics();
    draw(g, 100, 200, 400, 800, 'right');
    // 左上 moveTo(104,228)／右上 moveTo(472,204)／左下 moveTo(104,972)／右下 moveTo(472,996)
    expect(paths(g, 'moveTo')).toEqual([[104, 228], [472, 204], [104, 972], [472, 996]]);
    expect(paths(g, 'lineTo').slice(0, 2)).toEqual([[104, 204], [128, 204]]);
    expect(paths(g, 'lineTo').slice(6, 8)).toEqual([[496, 996], [496, 972]]);
    expect(CORN).toBe(UI.cornerOrnamentSize);
  });
});

describe('c922-129 panelDecoration 钉子三：铆钉链计数边界（3-7 钳位）', () => {
  const RIVET_CASES: [number, number][] = [
    [0, 3], [119, 3], [120, 3], [230, 3], [340, 3], [449, 3], [450, 4], [560, 5], [670, 6], [779, 6], [780, 7], [2000, 7],
  ];
  it('面板高度 → 铆钉颗数全表钉桩（下界 3、上界 7，两支拐点分别在 449/450 与 779/780）', () => {
    for (const [h, count] of RIVET_CASES) {
      const g = makeFakeGraphics();
      draw(g, 0, 0, 200, h, 'right');
      expect(callOf(g, 'fillCircle').mock.calls.length, `h=${h}`).toBe(count);
    }
  });
  it('fillCircle 与 strokeCircle 一一成对，颗数相等且半径恒为 UI.rivetSize/2', () => {
    for (const h of [120, 450, 780]) {
      const g = makeFakeGraphics();
      draw(g, 0, 0, 200, h, 'right');
      const f = circles(g);
      const s = strokes(g);
      expect(s.length).toBe(f.length);
      expect(f.map((c) => c.r)).toEqual(Array(f.length).fill(RIVET_R));
      expect(s.map((c) => c.r)).toEqual(Array(f.length).fill(RIVET_R));
      expect(RIVET_R).toBe(UI.rivetSize / 2);
    }
  });
  it('退化高度（h=0 与 h<120）：usable 被钳到 0，3 颗铆钉全部重合在 y+60 且**无 NaN 坐标**', () => {
    for (const h of [0, 61, 119]) {
      const g = makeFakeGraphics();
      draw(g, 10, 20, 200, h, 'right');
      const f = circles(g);
      expect(f.length).toBe(3);
      for (const c of f) {
        expect(Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.r)).toBe(true);
        expect(c.y).toBe(80); // y(20) + PAD(60)
      }
    }
  });
  it('铆钉沿高度等距：首颗 y+60、末颗 y+h-60，中间间距一致', () => {
    const g = makeFakeGraphics();
    draw(g, 0, 1000, 200, 670, 'right'); // usable=550, count=6 → 间距 110
    const ys = circles(g).map((c) => c.y);
    expect(ys[0]).toBe(1060);
    expect(ys[ys.length - 1]).toBe(1610);
    const gaps = ys.slice(1).map((v, i) => v - (ys[i] as number));
    expect(gaps.every((v) => Math.abs(v - 110) < 1e-9)).toBe(true);
  });
});

describe('c922-129 panelDecoration 钉子四：mapSide 决定铆钉列与色序', () => {
  it('mapSide=right 列在 x+w-14，mapSide=left 列在 x+14（inset 4 ＋ innerOffset 10）', () => {
    const right = makeFakeGraphics();
    draw(right, 100, 0, 400, 500, 'right');
    expect([...new Set(circles(right).map((c) => c.x))]).toEqual([486]);
    const left = makeFakeGraphics();
    draw(left, 100, 0, 400, 500, 'left');
    expect([...new Set(circles(left).map((c) => c.x))]).toEqual([114]);
  });
  it('lineStyle 总次数 = 3 条固定线 ＋ 每颗铆钉一次木色描边', () => {
    for (const [h, count] of [[120, 3], [780, 7]] as [number, number][]) {
      const g = makeFakeGraphics();
      draw(g, 0, 0, 200, h, 'left');
      expect(callOf(g, 'lineStyle').mock.calls.length).toBe(3 + count);
      expect(callOf(g, 'fillStyle').mock.calls.length).toBe(1 + count); // 木底 1 ＋ 每颗铆钉 1
      expect(callOf(g, 'lineStyle').mock.calls[3 + count - 1]).toEqual([1, COLORS.WOOD, 1]);
    }
  });
});
