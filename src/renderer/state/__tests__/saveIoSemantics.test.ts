/**
 * c922-103：写档（saveToSlot）与主进程 save-game 校验的异常语义统一 + 存档兼容夹具。
 *
 * 背景：读档链路语义齐全（null 缺档 / SaveLoadError 损坏），写档链路两处不一致——
 *  ① saveToSlot 把 colonyApi.saveGame 的 Promise<boolean> 返回值整行丢弃，写盘失败静默；
 *  ② 主进程 ipcMain('save-game') 校验失败裸抛无槽位/上限上下文的 Error。
 * 口径（本单选定的统一方案，务必连测试一起读）：
 *  - 渲染进程本地可判定的写失败（saveGame 返回 false）→ 升级为 SaveLoadError（instanceof 可用）。
 *  - 主进程抛出的校验错经 Electron IPC 序列化后只保留 {name,message,stack}，
 *    **跨进程 instanceof 不可能成立**，故其口径为「消息可匹配」：保留旧串前缀 + 追加槽位/上限上下文。
 *  本文件用 `rejects.not.toBeInstanceOf(SaveLoadError)` 把这条口径钉死，防止后人「顺手」包装成第三种语义。
 * 红线：只改写档异常语义，存档格式/字段/schemaVersion 语义一字未动（旧档可读，见末尾夹具组）。
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'eventemitter3';
import { SaveLoadError, deserialize, saveToSlot, serialize } from '../saveLoad';
import { GameStore, type GameState, type IEventEmitter } from '../gameStore';

function makeStore(): GameStore {
  const store = new GameStore(new EventEmitter() as unknown as IEventEmitter);
  const base = store.getState();
  store.replaceState({
    ...base,
    resources: { grain: 137, wood: 61, gold: 25 },
    currentDay: 42,
    rngSeed: 999,
  } as GameState);
  return store;
}

function installApi(saveGame: ReturnType<typeof vi.fn>): void {
  (globalThis as Record<string, unknown>)['window'] = {
    colonyApi: { saveGame, loadGame: vi.fn(), getSaveMeta: vi.fn() },
  };
}

afterEach(() => {
  delete (globalThis as Record<string, unknown>)['window'];
  vi.restoreAllMocks();
});

describe('saveToSlot 写档失败不再静默（返回值语义）', () => {
  it('saveGame 返回 false → rejects SaveLoadError（原实现整行丢弃返回值，静默成功）', async () => {
    installApi(vi.fn().mockResolvedValue(false));
    await expect(saveToSlot('save_1', makeStore())).rejects.toBeInstanceOf(SaveLoadError);
  });

  it('false 分支消息含槽位名，可定位到具体槽', async () => {
    installApi(vi.fn().mockResolvedValue(false));
    await expect(saveToSlot('slot_42', makeStore())).rejects.toThrow(/slot "slot_42"/);
  });

  it('真实成功路径（返回 true）零变化：resolve undefined 且只调一次 api', async () => {
    const api = vi.fn().mockResolvedValue(true);
    installApi(api);
    await expect(saveToSlot('save_1', makeStore())).resolves.toBeUndefined();
    expect(api).toHaveBeenCalledTimes(1);
    const [slot, json] = api.mock.calls[0] as [string, string];
    expect(slot).toBe('save_1');
    expect((JSON.parse(json) as { schemaVersion: number }).schemaVersion).toBe(9);
  });

  it('undefined（老 preload 未返回布尔）不得被误判为失败——只认严格 false', async () => {
    installApi(vi.fn().mockResolvedValue(undefined));
    await expect(saveToSlot('save_1', makeStore())).resolves.toBeUndefined();
  });
});

describe('主进程 save-game 校验消息带槽位/上限上下文（静态源码钉桩）', () => {
  const mainSrc = readFileSync('src/main/index.ts', 'utf8');
  const start = mainSrc.indexOf("ipcMain.handle('save-game'");
  const end = mainSrc.indexOf("ipcMain.handle('load-game'", start);
  if (start === -1 || end === -1) throw new Error('save-game handler not found in src/main/index.ts');
  const body = mainSrc.slice(start, end);

  it('save-game handler 内三条校验消息均已补齐上下文，无裸 Error 残留', () => {
    expect(body).toContain('invalid slot for save-game');
    expect(body).toContain('must match [a-z0-9_-]{1,32}');
    expect(body).toContain('save data exceeds 10 MB cap for slot');
    expect(body).toContain('${json.length}');
    expect(body).toContain('${MAX_SAVE_BYTES}');
    expect(body).not.toContain("throw new Error('invalid slot')");
    expect(body).not.toContain("throw new Error('invalid json')");
    expect(body).not.toContain("throw new Error('save data exceeds 10 MB cap')");
  });

  it('IPC 拒绝（模拟 10MB 超限）在渲染侧按「消息可匹配」口径处理，且不是 SaveLoadError', async () => {
    installApi(
      vi.fn().mockRejectedValue(
        new Error('save data exceeds 10 MB cap for slot "save_1": 12582912 bytes > 10485760 bytes'),
      ),
    );
    const err = await saveToSlot('save_1', makeStore()).catch((e: unknown) => e as Error);
    expect(err).toBeInstanceOf(Error);
    // 口径钉桩：跨 IPC instanceof SaveLoadError 不成立，调用方只能按消息匹配。
    expect(err).not.toBeInstanceOf(SaveLoadError);
    expect(err?.message).toMatch(/save data exceeds 10 MB cap/);
    expect(err?.message).toMatch(/slot "save_1"/);
  });

  it('旧消息前缀仍可匹配（向后兼容：不改写既有 catch 分支的判据）', async () => {
    installApi(vi.fn().mockRejectedValue(new Error('invalid slot')));
    await expect(saveToSlot('save_1', makeStore())).rejects.toThrow(/invalid slot/);
  });
});

/**
 * 存档兼容夹具（升级硬触发取证用）：下面这份 JSON 是 **真实 serialize() 产物字节**——
 * 用 c922-103 改动前的 saveLoad.ts 跑一个 8x8 无 worldMap 状态导出，再把
 * schemaVersion 降为 8 并删去 8→9 迁移注入的 wrathUltimatumEndDay（savedAt 换成常量以可复现）。
 * 它代表「上一个版本发布时落在磁盘上的老档」，本组用例证明改动后老档仍读得开、新字段缺省合理。
 */
const V8_ON_DISK_FIXTURE =
  '{"schemaVersion":8,"savedAt":1790018417706,"state":{"resources":{"grain":137,"wood":61,"gold":25},"buildings":[],"policies":[],"activeModifiers":[],"activeDecrees":[],"eventHistory":[],"pendingEventId":null,"pendingEventDayStart":null,"productionCarry":{},"tutorialStepId":"tut_welcome","seenJitHints":[],"lastEventDay":0,"lastSeenTimestamp":12345678,"currentDay":42,"rngSeed":999,"speed":1,"panelCollapsed":{"left":false,"right":false},"completedDecreeIds":[],"npcCountries":[],"playerMorale":50,"playerMilitaryPower":30,"publicWrath":0,"lastWrathDemandDay":null,"worldWariness":20,"lastWarinessReason":null,"lastPropagandaDay":null,"relicSites":[],"endgameAscendDay":null,"endgameLastWaveDay":null,"grade":0,"gradeReached":0,"tianxiaAcknowledged":false,"dualZeroDays":0,"crisisActive":false,"crisisRecoverDays":0,"mode":"sandbox","populationCarry":0,"crisisCount":0,"vassalOf":null,"storyFlags":null,"populationClasses":{"farmer":0,"worker":0,"soldier":0,"scholar":0},"conversionQueue":[],"grainNegativeDays":0,"factionState":{"active":false,"lastEventDay":-1,"nextEventDay":-1,"activeDemand":null,"acceptedDemands":[],"rejectedDemands":[]},"megaProjects":[],"exclusivePolicies":[],"generals":[],"activeExpeditions":[],"defenseAlerts":[]}}';

describe('向后兼容：v8 老档字节仍可读出、缺省字段合理、回写不破坏格式', () => {
  const restored = deserialize(JSON.parse(V8_ON_DISK_FIXTURE) as unknown);

  it('老档不抛错读出，玩家数值原值保留（grain/wood/gold、currentDay、rngSeed）', () => {
    expect(restored.resources['grain']).toBe(137);
    expect(restored.resources['wood']).toBe(61);
    expect(restored.resources['gold']).toBe(25);
    expect(restored.currentDay).toBe(42);
    expect(restored.rngSeed).toBe(999);
  });

  it('8→9 新增字段按缺省注入 null，不是 undefined 也不是抛错', () => {
    expect((restored as unknown as Record<string, unknown>)['wrathUltimatumEndDay']).toBeNull();
  });

  it('老档回写仍是 schemaVersion 9、字段集不缩水（写档路径改动未碰格式）', () => {
    const again = serialize(restored);
    expect(again.schemaVersion).toBe(9);
    const oldKeys = Object.keys(
      (JSON.parse(V8_ON_DISK_FIXTURE) as { state: Record<string, unknown> }).state,
    ).sort();
    const newKeys = Object.keys(again.state as unknown as Record<string, unknown>).sort();
    // 只允许「多」不允许「少」：向后兼容的加法。
    expect(oldKeys.filter((k) => !newKeys.includes(k))).toEqual([]);
    expect(newKeys).toContain('wrathUltimatumEndDay');
  });
});
