/**
 * c922-104：迁移断链报错档位语义对齐（No migration path 报「实际缺档」而非只报原始档）。
 *
 * 现场事实：`runMigrations` 的 while 循环里 `version` 是本次查表缺掉的 `migrations[N]`，
 * `fromVersion` 是档案自带版本——链中段断档时两者并不相同（v2 档缺 migrations[7] 时旧串
 * 只报 “from schema version 1→9” 里的 2，定位误导）。本文件把新串的两条判据钉住：
 *  ① 运行时可判：消息同时含原始档、`missing: migrations[缺档]`、`current: 当前版`；
 *  ② 静态模板判：缺档字段插的是循环变量 `version` 而不是 `fromVersion`。
 * ②是不得已：`migrations` 为模块私有、任务书明令「测试内不真实禁用迁移表」，
 * 故「v2 档缺第 7 步」这一**判别性场景**无法在运行时构造，只能钉模板。此处如实留痕。
 * 只改消息拼装，控制流（`if (!migrate)` 判据、抛出时机、迁移顺序）一字未动。
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { SAVE_SCHEMA_VERSION, SaveLoadError, deserialize, serialize } from '../saveLoad';
import { GameStore, type GameState, type IEventEmitter } from '../gameStore';

const GAP_OLD_PREFIX = 'No migration path from schema version';
const CURRENT_SUFFIX = `current: ${SAVE_SCHEMA_VERSION})`;

function gapMessage(blob: unknown): string {
  try {
    deserialize(blob);
  } catch (err) {
    expect(err).toBeInstanceOf(SaveLoadError);
    return (err as Error).message;
  }
  throw new Error('expected the gap branch to throw');
}

describe('断链消息补缺档定位（运行时真触发）', () => {
  it('schemaVersion 0 无迁移项：消息含原始档 0 ＋ missing: migrations[0] ＋ current 当前版', () => {
    const msg = gapMessage({ schemaVersion: 0, state: { rngSeed: 1, speed: 1 } });
    expect(msg).toContain(`${GAP_OLD_PREFIX} 0 to ${SAVE_SCHEMA_VERSION}`);
    expect(msg).toContain(`(missing: migrations[0], ${CURRENT_SUFFIX}`);
  });

  it('浮点 5.5（与 saveGuard3 同型输入）：旧前缀不回退，新双字段追加在尾部', () => {
    const msg = gapMessage({ schemaVersion: 5.5, state: { rngSeed: 1, speed: 1 } });
    // 在途/存量守护：saveGuard3.test.ts:79 断言 /No migration path from schema version 5\.5/
    expect(msg).toMatch(/No migration path from schema version 5\.5/);
    expect(msg).toContain('missing: migrations[5.5]');
    expect(msg).toContain(CURRENT_SUFFIX);
  });

  it('断链时仍报原始档（fromVersion 信息未被替换掉，只追加）', () => {
    const msg = gapMessage({ schemaVersion: -3, state: { rngSeed: 1, speed: 1 } });
    expect(msg).toContain('from schema version -3');
    expect(msg).toContain('missing: migrations[-3]');
  });
});

describe('断链消息与 future-version 消息字段口径一致', () => {
  const futureMessage = (version: number): string => {
    try {
      deserialize({ schemaVersion: version, state: {} });
    } catch (err) {
      return (err as Error).message;
    }
    throw new Error('expected future-version branch to throw');
  };

  it('future-version 既有格式一字不回退（saveLoadIo.test.ts:46 依赖其前缀）', () => {
    expect(futureMessage(10)).toBe(
      `Save created with future schema version 10 (current: ${SAVE_SCHEMA_VERSION})`,
    );
  });

  it('两处消息字段顺序一致：主句报该档，括号收尾报 current', () => {
    const pair: ReadonlyArray<readonly [string, string]> = [
      [gapMessage({ schemaVersion: 5.5, state: { rngSeed: 1, speed: 1 } }), '5.5'],
      [futureMessage(10), '10'],
    ];
    for (const [msg, origin] of pair) {
      const originAt = msg.indexOf(`schema version ${origin}`);
      const currentAt = msg.indexOf('current:');
      expect(originAt).toBeGreaterThan(-1);
      expect(currentAt).toBeGreaterThan(originAt); // 原始档在前、当前版在后
      expect(msg.endsWith(CURRENT_SUFFIX)).toBe(true);
    }
  });
});

describe('消息拼装静态模板判据（判别性场景只能静态钉）', () => {
  const src = readFileSync('src/renderer/state/saveLoad.ts', 'utf8');
  const start = src.indexOf('function runMigrations');
  const end = src.indexOf('\n}\n', start);
  if (start === -1 || end === -1) throw new Error('runMigrations not found in saveLoad.ts');
  const fn = src.slice(start, end);

  it('缺档字段插循环变量 version，而不是原始档 fromVersion', () => {
    expect(fn).toContain('migrations[${version}]');
    expect(fn).not.toContain('migrations[${fromVersion}]');
  });

  it('消息仍保留原始档与两个版本号（只追加不删除既有字段）', () => {
    expect(fn).toContain('from schema version ${fromVersion} to ${SAVE_SCHEMA_VERSION}');
    expect(fn).toContain('current: ${SAVE_SCHEMA_VERSION}');
  });

  it('控制流未动：判据仍是 !migrate、迁移顺序与 version++ 原样保留', () => {
    expect(fn).toContain('if (!migrate) {');
    expect(fn).toContain('current = migrate(current);');
    expect(fn.match(/version\+\+/g)?.length).toBe(1);
    expect(fn.match(/throw new SaveLoadError/g)?.length).toBe(1);
  });
});

/**
 * 存档兼容夹具（升级硬触发取证）：不手写样例，直接用**当前 serialize() 的真实产物字节**，
 * 再把 schemaVersion 逐档降为 1..8 喂回 deserialize——证明改消息后老档全链仍读得开、
 * 玩家数值不丢、且不会因为新判据误报断链。
 */
function realSaveBytes(): Record<string, unknown> {
  const store = new GameStore(new EventEmitter() as unknown as IEventEmitter);
  const base = store.getState();
  return serialize({
    ...base,
    resources: { grain: 137, wood: 61, gold: 25 },
    currentDay: 42,
    rngSeed: 999,
  } as GameState) as unknown as Record<string, unknown>;
}

describe('向后兼容：真实序列化字节逐档降级仍可迁回最新', () => {
  const bytes = realSaveBytes();

  for (let v = 1; v < SAVE_SCHEMA_VERSION; v++) {
    it(`v${v} 老档（真实字节降档）可无异常迁到 ${SAVE_SCHEMA_VERSION}，不误报断链`, () => {
      const oldBlob = JSON.parse(JSON.stringify({ ...bytes, schemaVersion: v })) as unknown;
      const restored = deserialize(oldBlob) as unknown as Record<string, unknown>;
      expect((restored as { schemaVersion?: number }).schemaVersion ?? SAVE_SCHEMA_VERSION).toBe(
        SAVE_SCHEMA_VERSION,
      );
      const resources = restored['resources'] as Record<string, number>;
      expect(resources['grain']).toBe(137);
      expect(resources['wood']).toBe(61);
    });
  }

  it('断链判据未被写宽：完整链下逐档 deserialize 都不抛 SaveLoadError', () => {
    let thrown: string | null = null;
    try {
      deserialize(JSON.parse(JSON.stringify({ ...bytes, schemaVersion: 8 })) as unknown);
    } catch (err) {
      thrown = err instanceof Error ? err.message : String(err);
    }
    expect(thrown).toBeNull();
  });
});
