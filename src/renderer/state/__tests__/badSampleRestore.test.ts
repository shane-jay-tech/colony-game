/**
 * 20260925-120418-82c6（A/test）：坏档样例的恢复面与错误提示。
 *
 * 卷宗四类样例：①截断 ②缺字段 ③错类型 ④未知版本。两条验收：
 *   甲「不会覆盖原存档」乙「失败时给出可行动信息」。
 *
 * 与在册件的分工（避免重复建设）：
 *   saveGuard/2/3 钉的是 deserialize 的**逐字段拒载清单**；saveMatrix 钉迁移链连通性；
 *   saveLoadIo 钉 loadFromSlot 的四条分支；SaveLoadPanel.test 钉「读空槽不替换状态」。
 *   本件补三处**此前零覆盖**的面：
 *     A. 端到端「读坏档 ⇒ 盘上一字未动」——用 Map 建模假磁盘，任何一次读档若走写路径即红；
 *     B. 四类样例的失败面**可机检**（instanceof SaveLoadError ＋ 消息带定位符），
 *        把「裸 TypeError 逃逸统一通道」这一类输入永久钉死（本次实测抓到 activeExpeditions 一条，
 *        已按 020c 口径补 shape 校验：见 saveLoad.ts 的 deserializeActiveExpeditions）；
 *     C. 失败后**在内存里的进度**也不被半截状态污染（store 状态字节全等）。
 *
 * 登记为现状（未改产品码，见 result 遗留问题）：deserialize 对**传入的 blob 对象**是就地注入
 *   迁移字段的（migrations 直接改 data.state）。假磁盘面证的是「盘不被覆盖」，不等于「入参不被改」，
 *   故另立一条现状钉桩，防止有人把「deserialize 是纯函数」当默认前提。
 *
 * 全程在内存 Map ＋ mock window.colonyApi 上做，不读写仓内 save/、不碰 D:/colony-game/user-data。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import {
  SAVE_SCHEMA_VERSION,
  SaveLoadError,
  deserialize,
  loadFromSlot,
} from '../saveLoad';
import { GameStore, type IEventEmitter } from '../gameStore';

// ---------- 假磁盘：Map<slot, 字节>，读只读、写才变 ----------

/** 假磁盘句柄；api 的具体 Mock 类型由工厂函数推断（写死成 `ReturnType<typeof vi.fn>` 会被
 *  tsc 判 mockImplementation 参数逆变不兼容 ⇒ 用 ReturnType 派生，与 SaveLoadPanel.test 同法）。 */
function mountDisk(initial: Record<string, string>) {
  const files = new Map(Object.entries(initial));
  const writes: string[] = [];
  const saveGame = vi.fn(async (slot: string, json: string) => {
    writes.push(slot);
    files.set(slot, json);
    return true;
  });
  const loadGame = vi.fn(async (slot: string) => files.get(slot) ?? null);
  const api = { saveGame, loadGame, getSaveMeta: vi.fn().mockResolvedValue(null) };
  (globalThis as Record<string, unknown>)['window'] = { colonyApi: api };
  return { files, writes, api };
}

type FakeDisk = ReturnType<typeof mountDisk>;

function diskSnapshot(disk: FakeDisk): string {
  return JSON.stringify([...disk.files.entries()].sort((a, b) => a[0].localeCompare(b[0])));
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>)['window'];
  vi.restoreAllMocks();
});

// ---------- 样例夹具 ----------

/** 一条形状合法的 v9 档（只给 deserialize 需要的最小面） */
function goodSave(day = 42, grain = 137): string {
  return JSON.stringify({
    schemaVersion: SAVE_SCHEMA_VERSION,
    savedAt: 1790018417706,
    state: {
      resources: { grain, wood: 61, gold: 25, people: 30 },
      buildings: [], policies: [], activeModifiers: [], activeDecrees: [],
      eventHistory: [], pendingEventId: null, pendingEventDayStart: null,
      productionCarry: {}, tutorialStepId: null, seenJitHints: [], lastEventDay: 0,
      lastSeenTimestamp: 12345678, currentDay: day, rngSeed: 999, speed: 1,
      worldMap: smallMap(),
    },
  });
}

function smallMap(badTerrainAt = -1): Record<string, unknown> {
  const tiles: unknown[] = [];
  for (let i = 0; i < 4; i++) {
    tiles.push(i === badTerrainAt
      ? { terrain: 'void_lava', buildable: true, walkable: true }
      : { terrain: 'plain', buildable: true, walkable: true });
  }
  return { width: 2, height: 2, seed: 7, tiles, resourceNodes: [] };
}

function validExpedition(): Record<string, unknown> {
  return {
    config: { target: 'raid', npcId: 'yan', units: { infantry: 30 }, grainAllocated: 90 },
    daysRemaining: 2, totalDays: 4, morale: 70, eventTriggered: false,
  };
}

function stateWith(extra: Record<string, unknown>): string {
  const parsed = JSON.parse(goodSave()) as { state: Record<string, unknown> };
  return JSON.stringify({ ...parsed, state: { ...parsed.state, ...extra } });
}

/** 四类样例：每类给「样例名 + 盘上字节 + 消息里必须出现的定位符」 */
const SAMPLES: ReadonlyArray<{ key: string; name: string; klass: string; raw: string; locator: RegExp }> = [
  {
    key: 'truncated', name: '截断到一半的 JSON', klass: '截断',
    raw: '{"schemaVersion":9,"state":{"rngSeed":7,"speed":2,"resou',
    locator: /slot "bad_truncated"[^\n]*not valid JSON/,
  },
  {
    key: 'missing_state', name: '整块 state 缺失', klass: '缺字段',
    raw: JSON.stringify({ schemaVersion: 9, savedAt: 1 }),
    locator: /missing state field/,
  },
  {
    key: 'no_progress', name: '建筑缺 constructionProgress（必填字段被摘掉）', klass: '缺字段',
    raw: stateWith({ buildings: [{ defId: 'farm', position: { x: 0, y: 0 }, status: 'idle', tier: 1, modifiers: [] }] }),
    locator: /buildings\[0\]\.constructionProgress/,
  },
  {
    key: 'res_string', name: 'resources 值写成字符串', klass: '错类型',
    raw: stateWith({ resources: { grain: '很多' } }),
    locator: /resources must be a record of finite numbers/,
  },
  {
    key: 'tile_terrain', name: '瓦片 terrain 是未知字符串（带下标）', klass: '错类型',
    raw: stateWith({ worldMap: smallMap(3) }),
    locator: /worldMap\.tiles\[3\]\.terrain/,
  },
  {
    key: 'expedition_units', name: '出征记录缺 config.units（曾逃逸为裸 TypeError）', klass: '错类型',
    raw: stateWith({ activeExpeditions: [{ daysRemaining: 1, totalDays: 1, morale: 5, eventTriggered: false }] }),
    locator: /activeExpeditions\[0\]\.config/,
  },
  {
    key: 'future_v12', name: '未来版本 v12', klass: '未知版本',
    raw: JSON.stringify({ schemaVersion: 12, state: {} }),
    locator: /future schema version 12 \(current: 9\)/,
  },
  {
    key: 'gap_v0', name: '无迁移项的 v0', klass: '未知版本',
    raw: JSON.stringify({ schemaVersion: 0, state: { currentDay: 1 } }),
    locator: /No migration path from schema version 0 to 9 \(missing: migrations\[0\], current: 9\)/,
  },
  {
    key: 'float_v55', name: '浮点版本号 5.5', klass: '未知版本',
    raw: JSON.stringify({ schemaVersion: 5.5, state: { currentDay: 1 } }),
    locator: /No migration path from schema version 5\.5/,
  },
  {
    key: 'string_version', name: '版本号写成字符串 "9"', klass: '未知版本',
    raw: JSON.stringify({ schemaVersion: '9', state: {} }),
    locator: /schemaVersion must be a number/,
  },
];

/** 按键取样例原文（SAMPLES 是元组式常量表，直接下标会被 tsc 判 possibly-undefined） */
function rawOf(key: string): string {
  const hit = SAMPLES.find((x) => x.key === key);
  if (hit === undefined) throw new Error(`no such sample: ${key}`);
  return hit.raw;
}

// ---------- 甲：读坏档绝不覆盖原存档 ----------

describe('甲 坏档恢复不覆盖原存档（端到端假磁盘）', () => {
  it('十枚坏档逐个读入失败后，盘上字节与好档逐位未变且零次写盘', async () => {
    const seed: Record<string, string> = { save_1: goodSave(42, 137), save_2: goodSave(7, 5) };
    for (const s of SAMPLES) seed[`bad_${s.key}`] = s.raw;
    const disk = mountDisk(seed);
    const before = diskSnapshot(disk);

    for (const s of SAMPLES) {
      await expect(loadFromSlot(`bad_${s.key}`)).rejects.toBeInstanceOf(SaveLoadError);
    }
    // 坏档读完后，连好档也照样读得开（证「失败没有把盘上的可读物一起带走」）
    const stillGood = await loadFromSlot('save_1');
    expect(stillGood?.currentDay).toBe(42);

    expect(diskSnapshot(disk)).toBe(before);
    expect(disk.writes).toEqual([]);
    expect(disk.api.saveGame).not.toHaveBeenCalled();
  });

  it('同一枚坏档连读三次：三次都是同一个拒载结论（不自我修复、不逐次漂移）', async () => {
    const disk = mountDisk({ bad_1: rawOf('expedition_units') });
    const msgs: string[] = [];
    for (let i = 0; i < 3; i++) {
      await loadFromSlot('bad_1').then(() => 'NO_THROW', (e: Error) => e.message).then(m => msgs.push(m));
    }
    expect(msgs[0]).toBe(msgs[1]);
    expect(msgs[1]).toBe(msgs[2]);
    expect(msgs[0]).toMatch(/activeExpeditions\[0\]\.config/);
    expect(disk.writes).toEqual([]);
  });

  it('读档失败后内存进度不被半截状态覆盖：store 全字段字节全等', async () => {
    const store = new GameStore(new EventEmitter() as unknown as IEventEmitter);
    const base = store.getState();
    store.replaceState({
      ...base,
      resources: { grain: 137, wood: 61, gold: 25 },
      currentDay: 42,
      rngSeed: 999,
    });
    const before = JSON.stringify(store.getState());
    const disk = mountDisk({ bad: rawOf('res_string') });

    await expect(loadFromSlot('bad')).rejects.toBeInstanceOf(SaveLoadError);
    // 面板口径（SaveLoadPanel.onButton）：抛错即 return，replaceState 只在成功分支被调用
    expect(JSON.stringify(store.getState())).toBe(before);
    // 同一条坏档既没写盘也没被读成状态：假磁盘保持零写入
    expect(disk.writes).toEqual([]);
  });
});

// ---------- 乙：失败时给出可行动信息 ----------

describe('乙 四类样例的失败面可机检（统一通道 + 定位符）', () => {
  for (const s of SAMPLES) {
    it(`${s.klass} · ${s.name} → SaveLoadError 且消息带定位符`, async () => {
      mountDisk({ [`bad_${s.key}`]: s.raw });
      const err = await loadFromSlot(`bad_${s.key}`).then(
        () => null,
        (e: unknown) => e as Error,
      );
      expect(err, '坏档必须被拒载，不能静默返回状态').not.toBeNull();
      expect(err).toBeInstanceOf(SaveLoadError);
      // 可行动：既说清坏在哪个字段/哪个版本，也不能是一句裸栈话术
      expect(err!.message).not.toMatch(/Cannot read properties of|is not a function|undefined \(reading/);
      expect(err!.message).toMatch(s.locator);
    });
  }

  it('截断样例额外带槽位名（多槽并存时能定位到文件）', async () => {
    mountDisk({ save_3: rawOf('truncated') });
    await expect(loadFromSlot('save_3')).rejects.toThrow(/slot "save_3"/);
  });
});

// ---------- 现状登记 ----------

describe('现状钉桩（20260925-120418-82c6 登记，未改产品码）', () => {
  it('deserialize 对传入 blob 就地注入迁移字段：v1 档跑完全链后入参自称 v9', () => {
    const blob: Record<string, unknown> = {
      schemaVersion: 1,
      state: {
        rngSeed: 7, speed: 2, resources: { people: 30 }, buildings: [], policies: [],
        activeModifiers: [], activeDecrees: [],
      },
    };
    const before = JSON.stringify(blob);
    deserialize(blob);
    expect(JSON.stringify(blob)).not.toBe(before);
    expect(blob['schemaVersion']).toBe(SAVE_SCHEMA_VERSION);
  });

  it('同一条链的坏侧：迁移先跑完、字段校验后拒载 ⇒ 入参已被改写却什么都没返回', () => {
    const blob: Record<string, unknown> = {
      schemaVersion: 1,
      state: {
        rngSeed: 7, speed: 2, resources: { people: 30 },
        buildings: [{ defId: 'farm', position: { x: 1.5, y: 0 }, status: 'idle', tier: 1, constructionProgress: 0, modifiers: [] }],
        policies: [], activeModifiers: [], activeDecrees: [],
      },
    };
    expect(() => deserialize(blob)).toThrow(/buildings\[0\]\.position\.\{x,y\} must be integers/);
    // 拒载并不回滚：入参已被升到当版（"调用方若还持有这份对象，它已不是它读到的那份档"）
    expect(blob['schemaVersion']).toBe(SAVE_SCHEMA_VERSION);
    expect(Object.keys(blob['state'] as object)).toContain('wrathUltimatumEndDay');
  });

  it('loadFromSlot 每次重新 JSON.parse ⇒ 上述就地改写在盘面上不可见（本单甲项判据成立的原因）', async () => {
    const raw = JSON.stringify({
      schemaVersion: 1,
      state: { rngSeed: 7, speed: 2, resources: { people: 30 }, buildings: [], policies: [], activeModifiers: [], activeDecrees: [] },
    });
    const disk = mountDisk({ old: raw });
    const s1 = await loadFromSlot('old');
    const s2 = await loadFromSlot('old');
    expect(s1).not.toBeNull();
    expect(JSON.stringify(s2)).toBe(JSON.stringify(s1));
    expect(disk.files.get('old')).toBe(raw);
  });
});

// ---------- 正向对照：修 shape 校验没把合法档一起拒掉 ----------

describe('出征记录读入的正反对照（补校验不改变合法档语义）', () => {
  it('合法出征记录读得开，且 config/units 是深拷贝（改读入状态不污染 blob）', () => {
    const blob = JSON.parse(stateWith({ activeExpeditions: [validExpedition()] })) as {
      state: { activeExpeditions: Array<{ config: { units: Record<string, number> } }> };
    };
    const st = deserialize(blob);
    expect(st.activeExpeditions).toHaveLength(1);
    st.activeExpeditions[0]!.config.units.infantry = 999;
    expect(blob.state.activeExpeditions[0]!.config.units.infantry).toBe(30);
  });

  it('空数组 / 字段缺失照旧兜底为空（旧档零回归）', () => {
    expect(deserialize(JSON.parse(stateWith({ activeExpeditions: [] }))).activeExpeditions).toEqual([]);
    // goodSave() 根本没有 activeExpeditions 键（v1..v8 旧档同形）⇒ 必须兜底成空数组而不是抛错
    expect(deserialize(JSON.parse(goodSave())).activeExpeditions).toEqual([]);
  });

  it('非数组的 activeExpeditions 拒载为 SaveLoadError（不再是 map is not a function）', () => {
    expect(() => deserialize(JSON.parse(stateWith({ activeExpeditions: 'nope' })))).toThrow(SaveLoadError);
    expect(() => deserialize(JSON.parse(stateWith({ activeExpeditions: 'nope' })))).toThrow(/must be an array/);
  });

  it('元素为 null / 字符串 时带下标定位', () => {
    expect(() => deserialize(JSON.parse(stateWith({ activeExpeditions: [validExpedition(), null] })))).toThrow(/activeExpeditions\[1\] is not an object/);
    expect(() => deserialize(JSON.parse(stateWith({ activeExpeditions: ['x'] })))).toThrow(/activeExpeditions\[0\] is not an object/);
  });
});
