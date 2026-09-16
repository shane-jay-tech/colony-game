/**
 * d914-51：loadFromSlot 损坏分支回归测试。
 *
 * 补齐 loadFromSlot 对「磁盘存档损坏」场景的零覆盖（saveGuard3.test.ts:48-49 过期 TODO）。
 * 全部 mock window.colonyApi，不读写磁盘存档。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { SaveLoadError } from '../saveLoad';
import { loadFromSlot } from '../saveLoad';

const fakeApi = {
  saveGame: vi.fn(),
  loadGame: vi.fn(),
  getSaveMeta: vi.fn(),
};

function install(): void {
  (globalThis as any).window = { colonyApi: fakeApi };
}

afterEach(() => {
  delete (globalThis as any).window;
  vi.restoreAllMocks();
});

describe('loadFromSlot 损坏/异常分支', () => {
  it('截断 JSON → SaveLoadError 含 "not valid JSON"', async () => {
    install();
    fakeApi.loadGame.mockResolvedValue('{"schemaVersion":9,"state":{"rngSeed":7,"speed":2,"resou');
    await expect(loadFromSlot('save_1')).rejects.toThrow(SaveLoadError);
    await expect(loadFromSlot('save_1')).rejects.toThrow(/not valid JSON/);
  });

  it('loadGame 返回 null → 返回 null（空槽正常路径）', async () => {
    install();
    fakeApi.loadGame.mockResolvedValue(null);
    const result = await loadFromSlot('save_empty');
    expect(result).toBeNull();
  });

  it('schemaVersion 超前 → SaveLoadError 含 "future schema version"', async () => {
    install();
    fakeApi.loadGame.mockResolvedValue(
      JSON.stringify({ schemaVersion: 999, state: {} }),
    );
    await expect(loadFromSlot('save_future')).rejects.toThrow(/future schema version/);
  });

  it('非法 slot 名（路径穿越）→ SaveLoadError 且不调 loadGame', async () => {
    install();
    fakeApi.loadGame.mockClear();
    await expect(loadFromSlot('..')).rejects.toThrow(SaveLoadError);
    expect(fakeApi.loadGame).not.toHaveBeenCalled();
  });
});
