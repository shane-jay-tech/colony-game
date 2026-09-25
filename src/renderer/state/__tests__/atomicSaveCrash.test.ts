/**
 * 20260925-120420-e89f（A/test）：写临时文件 / 替换 / 断电模拟 / 多次保存。
 * 两条验收：甲「不会出现半写 JSON」乙「恢复前后版本可辨识」。
 *
 * 被测面的取法（先把口径说白，避免假承重）：
 *   写盘四步在 **src/main/index.ts 的 ipcMain('save-game') handler** 里；该模块 import 期就会跑
 *   `ensureDDrivePaths()` 往 D:/colony-game/user-data 真建目录，直调要整套 electron mock
 *   ⇒ 越「A 档不得往用户目录写真文件」的线。本仓既有先例（saveIoSemantics.test.ts:71-89）对同一段
 *   主进程码用的是**源码静态钉桩**。本件把两面都做：
 *     组 1：**真文件系统**（os.tmpdir() 下 mkdtemp，afterAll 只删自己那一个目录）跑四个失败点注入——
 *            写盘序列是 handler 正文的逐字复刻（writeFile tmp → existsSync? copyFile target→bak → rename tmp→target）。
 *     组 2：直接读 src/main/index.ts 字节，钉住「顺序 / 命名 / 不许对 target 直写 / 上限校验先于写盘」，
 *            让组 1 的复刻件一旦与产品码漂移即红。
 *   已知限制（写进 result 遗留问题）：组 2 钉的是**顺序与名字**，不是整段控制流；
 *   若产品码在四步之间插入新语句（如 fsync），复刻件不会自动跟进，需人复核。
 *   隔离自证：本班**不 import** src/main/index.ts（只 readFileSync 取字节），真用户数据目录全程不存在。
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { copyFile, rename, writeFile } from 'node:fs/promises';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// ---------- 组 1 被测件：主进程写盘序列的逐字复刻 ----------

type FailurePoint = 'before-any-write' | 'torn-tmp-write' | 'after-tmp-write' | 'after-bak-copy';

interface SeqResult {
  crashed: Error | null;
}

/**
 * 断电点：
 *   before-any-write —— 进了 handler 就死（什么都没落盘）
 *   torn-tmp-write   —— tmp 只落半截 JSON（掉电最现实的形态：块写了一半）
 *   after-tmp-write  —— tmp 完整、尚未 rename（卷宗点名的「写完 tmp 未 rename」）
 *   after-bak-copy   —— 旧档已复制成 .bak、尚未 rename
 */
async function saveGameSequence(
  savesDir: string,
  slot: string,
  json: string,
  crashAt: FailurePoint | null = null,
): Promise<SeqResult> {
  const target = join(savesDir, `${slot}.json`);
  const tmp = join(savesDir, `${slot}.json.tmp`);
  const bak = join(savesDir, `${slot}.json.bak`);
  const boom = (label: string): SeqResult => ({ crashed: new Error(`simulated power loss at ${label}`) });
  try {
    if (crashAt === 'before-any-write') return boom('before-any-write');
    if (crashAt === 'torn-tmp-write') {
      writeFileSync(tmp, json.slice(0, Math.max(1, Math.floor(json.length / 2))), 'utf-8');
      return boom('torn-tmp-write');
    }
    await writeFile(tmp, json, 'utf-8');
    if (crashAt === 'after-tmp-write') return boom('after-tmp-write');
    if (existsSync(target)) await copyFile(target, bak);
    if (crashAt === 'after-bak-copy') return boom('after-bak-copy');
    await rename(tmp, target);
    return { crashed: null };
  } catch (err) {
    return { crashed: err as Error };
  }
}

/** load-game / list-saves 的读取面（与 handler 同口径：只认 `<slot>.json`，列表只收 `.json` 后缀） */
function loadGameBytes(savesDir: string, slot: string): string | null {
  const fp = join(savesDir, `${slot}.json`);
  return existsSync(fp) ? readFileSync(fp, 'utf-8') : null;
}

function listSaves(savesDir: string): string[] {
  return readdirSync(savesDir).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
}

function saveFor(day: number, savedAt: number): string {
  return JSON.stringify({
    schemaVersion: 9,
    savedAt,
    state: { currentDay: day, resources: { grain: day * 3 }, buildings: [] },
  });
}

const parseOf = (bytes: string | null): SaveLite => JSON.parse(String(bytes)) as SaveLite;
interface SaveLite {
  schemaVersion: number;
  savedAt: number;
  state: { currentDay: number };
}

let root = '';
let saves = '';

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'colony33-e89f-'));
  saves = join(root, 'saves');
  mkdirSync(saves, { recursive: true });
});

afterAll(() => {
  const probe = root;
  if (probe) rmSync(probe, { recursive: true, force: true });
  expect(existsSync(probe)).toBe(false);
});

// ---------- 甲：任何断电点都不留下半写 JSON ----------

describe('甲 断电模拟：恢复点读到的永远是完整可解析的一代', () => {
  it('首次存档前崩溃（before-any-write）：无 target、无 tmp、列表为空', async () => {
    const r = await saveGameSequence(saves, 's_fresh', saveFor(10, 1000), 'before-any-write');
    expect(r.crashed?.message).toMatch(/simulated power loss/);
    expect(loadGameBytes(saves, 's_fresh')).toBeNull();
    expect(listSaves(saves)).toEqual([]);
  });

  it('写完 tmp 未 rename：target 仍是上一代完整 JSON，半截态只活在 .tmp 里且不被任何读取面看见', async () => {
    const goodOld = saveFor(21, 2000);
    await saveGameSequence(saves, 's_half', goodOld);
    const r = await saveGameSequence(saves, 's_half', saveFor(22, 3000), 'after-tmp-write');
    expect(r.crashed).not.toBeNull();

    const onDisk = loadGameBytes(saves, 's_half');
    expect(onDisk).toBe(goodOld); // 逐字节等于旧档，不是"能 parse 就行"
    expect(parseOf(onDisk).state.currentDay).toBe(21);
    // 半写代只活在 .tmp 里：这一步它其实是"完整但未生效"的一代，
    // 真正让它变成权威的唯一动作是 rename ⇒ 崩溃点之后游戏侧读不到它。
    const tmpBytes = readFileSync(join(saves, 's_half.json.tmp'), 'utf-8');
    expect(tmpBytes).toBe(saveFor(22, 3000));
    expect(parseOf(tmpBytes).state.currentDay).toBe(22);
    expect(parseOf(onDisk).state.currentDay).toBe(21); // 两代同时存在，target 仍是旧的
    // 关键：读取面看不见 .tmp / .bak
    expect(listSaves(saves)).toEqual(['s_half']);
  });

  it('torn write（tmp 落半截字节就断电）：target 不被污染，读档拿到旧版', async () => {
    const goodOld = saveFor(31, 4000);
    await saveGameSequence(saves, 's_torn', goodOld);
    const newer = saveFor(32, 5000);
    const r = await saveGameSequence(saves, 's_torn', newer, 'torn-tmp-write');
    expect(r.crashed).not.toBeNull();

    expect(loadGameBytes(saves, 's_torn')).toBe(goodOld);
    const torn = readFileSync(join(saves, 's_torn.json.tmp'), 'utf-8');
    expect(torn.length).toBeLessThan(newer.length);
    expect(torn.length).toBeGreaterThan(0);
    expect(() => JSON.parse(torn)).toThrow(); // 半截 JSON 真的不可解析
    expect(() => JSON.parse(String(loadGameBytes(saves, 's_torn')))).not.toThrow();
  });

  it('崩溃后重来一次成功保存：tmp 被 rename 吃掉，目录里只剩 target + bak', async () => {
    await saveGameSequence(saves, 's_retry', saveFor(41, 6000));
    await saveGameSequence(saves, 's_retry', saveFor(42, 7000), 'after-tmp-write');
    expect(existsSync(join(saves, 's_retry.json.tmp'))).toBe(true);
    const ok = await saveGameSequence(saves, 's_retry', saveFor(43, 8000));
    expect(ok.crashed).toBeNull();
    expect(existsSync(join(saves, 's_retry.json.tmp'))).toBe(false); // rename 覆盖式替换，不留残体
    expect(parseOf(loadGameBytes(saves, 's_retry')).state.currentDay).toBe(43);
  });
});

// ---------- 乙：恢复前后版本可辨识 + 多次保存 ----------

describe('乙 多次保存与版本可辨识', () => {
  it('连存 5 次：每次 target 都完整可解析，currentDay / savedAt 严格递增，schemaVersion 恒 9', async () => {
    const slot = 's_multi';
    const seen: Array<{ day: number; at: number; bytes: string }> = [];
    for (let i = 0; i < 5; i++) {
      const json = saveFor(50 + i, 1000 + i * 7);
      const r = await saveGameSequence(saves, slot, json);
      expect(r.crashed).toBeNull();
      const bytes = String(loadGameBytes(saves, slot));
      const parsed = JSON.parse(bytes) as SaveLite;
      expect(parsed.schemaVersion).toBe(9);
      expect(parsed.state.currentDay).toBe(50 + i);
      expect(parsed.savedAt).toBe(1000 + i * 7);
      expect(bytes).toBe(json); // 落盘字节 == 入参字节（无重排、无截断）
      seen.push({ day: parsed.state.currentDay, at: parsed.savedAt, bytes });
    }
    // 相邻两代必须至少有一个可辨识维度前进（这里两条都前进）
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]!.day).toBeGreaterThan(seen[i - 1]!.day);
      expect(seen[i]!.at).toBeGreaterThan(seen[i - 1]!.at);
      expect(seen[i]!.bytes).not.toBe(seen[i - 1]!.bytes);
    }
  });

  it('.bak 恰为前一代（回退点可辨识）', async () => {
    const slot = 's_bak';
    await saveGameSequence(saves, slot, saveFor(60, 1100));
    expect(existsSync(join(saves, 's_bak.json.bak'))).toBe(false); // 首存不产生 bak
    await saveGameSequence(saves, slot, saveFor(61, 1110));
    expect(readFileSync(join(saves, 's_bak.json.bak'), 'utf-8')).toBe(saveFor(60, 1100));
    await saveGameSequence(saves, slot, saveFor(62, 1120));
    expect(readFileSync(join(saves, 's_bak.json.bak'), 'utf-8')).toBe(saveFor(61, 1110));
    expect(parseOf(loadGameBytes(saves, slot)).state.currentDay).toBe(62);
  });

  it('断电后"重启读档"：拿到的是断电前那一代，且能从字节里认出版本', async () => {
    const slot = 's_boot';
    await saveGameSequence(saves, slot, saveFor(70, 1200));
    await saveGameSequence(saves, slot, saveFor(71, 1300));
    await saveGameSequence(saves, slot, saveFor(72, 1400), 'after-bak-copy'); // 死在替换前一步
    const restored = parseOf(loadGameBytes(saves, slot));
    expect(restored.state.currentDay).toBe(71); // 不是 72
    expect(restored.schemaVersion).toBe(9);
    // 面板 getSaveMeta 口径：savedAt + currentDay 两个可辨识量都在
    expect(typeof restored.savedAt).toBe('number');
    expect(restored.savedAt).toBe(1300);
  });

  it('🔴 登记（未改产品码）：死在 copyFile 之后 ⇒ 上一代 .bak 被同代覆盖，两代回退退化成一代', async () => {
    const slot = 's_lost';
    await saveGameSequence(saves, slot, saveFor(80, 2000)); // gen1
    await saveGameSequence(saves, slot, saveFor(81, 2010)); // gen2，bak=gen1
    expect(readFileSync(join(saves, 's_lost.json.bak'), 'utf-8')).toBe(saveFor(80, 2000));
    await saveGameSequence(saves, slot, saveFor(82, 2020), 'after-bak-copy'); // gen3 崩在 rename 前
    const bak = readFileSync(join(saves, 's_lost.json.bak'), 'utf-8');
    // 实况：bak 已被"当前 target（gen2）"覆盖，gen1 永久消失；而 gen3 并未落盘
    expect(bak).toBe(saveFor(81, 2010));
    expect(bak).toBe(String(loadGameBytes(saves, slot)));
    expect(parseOf(bak).state.currentDay).toBe(81);
    // 判据边界：target 仍完整（甲判据未被破坏），退化只发生在"可回退代数"上 ⇒ 报告项，非半写 JSON
  });
});

// ---------- 组 2：产品码结构钉桩（绑住上面的复刻） ----------

describe('组 2 src/main/index.ts 写盘结构钉桩（复刻件漂移即红）', () => {
  const mainSrc = readFileSync('src/main/index.ts', 'utf-8');
  const start = mainSrc.indexOf("ipcMain.handle('save-game'");
  const end = mainSrc.indexOf("ipcMain.handle('load-game'", start);
  if (start === -1 || end === -1) throw new Error('save-game handler not found in src/main/index.ts');
  const body = mainSrc.slice(start, end);

  it('三步顺序＝writeFile(tmp) → 有 target 才 copyFile(target→bak) → rename(tmp→target)', () => {
    const iWrite = body.indexOf('await writeFile(tmp, json');
    const iCopy = body.indexOf('await copyFile(target, bak)');
    const iRename = body.indexOf('await rename(tmp, target)');
    expect(iWrite).toBeGreaterThan(-1);
    expect(iCopy).toBeGreaterThan(iWrite);
    expect(iRename).toBeGreaterThan(iCopy);
  });

  it('绝不对 target 直写：writeFile 的目标只能是 .tmp', () => {
    const writes = body.match(/await writeFile\(\s*[A-Za-z_$][\w$]*/g) ?? [];
    expect(writes.length).toBe(1);
    expect(writes[0]).toContain('tmp');
    expect(body).not.toMatch(/writeFile\(\s*target/);
  });

  it('三个文件名后缀与复刻件一致（slot.json / .json.tmp / .json.bak）', () => {
    expect(body).toContain("join(savesDir, `${slot}.json`)");
    expect(body).toContain("join(savesDir, `${slot}.json.tmp`)");
    expect(body).toContain("join(savesDir, `${slot}.json.bak`)");
  });

  it('10MB 上限与槽位校验发生在任何写盘之前', () => {
    const iCap = body.indexOf('MAX_SAVE_BYTES');
    const iWrite = body.indexOf('await writeFile(');
    expect(iCap).toBeGreaterThan(-1);
    expect(iCap).toBeLessThan(iWrite);
    expect(body.indexOf('VALID_SLOT_RE.test')).toBeLessThan(iWrite);
  });

  it('load-game 只读 `<slot>.json` ⇒ 半写残体（.tmp）永远不会被读进游戏', () => {
    const loadBody = mainSrc.slice(end, mainSrc.indexOf("ipcMain.handle('save-meta'", end));
    expect(loadBody).toContain("join(app.getPath('userData'), 'saves', `${slot}.json`)");
    expect(loadBody).not.toContain('.tmp');
  });
});
