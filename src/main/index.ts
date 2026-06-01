import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { readFile, writeFile, readdir, mkdir } from 'fs/promises';

const D_DRIVE_USER_DATA = 'D:/colony-game/user-data';
const D_DRIVE_TEMP = 'D:/colony-game/user-data/temp';
const D_DRIVE_LOGS = 'D:/colony-game/user-data/logs';

/**
 * 用户硬性要求 D 盘存储；但极个别 Windows 环境无 D 盘（笔记本单 SSD），那种情况下
 * mkdirSync 会抛 ENOENT 让进程启动即崩溃。试一次 D 盘，失败就 fallback 到 Electron
 * 默认 userData 目录（%APPDATA%\邦国录），并 console.warn 让用户知道发生了什么。
 * （DeepSeek 二审 major F1）
 */
function ensureDDrivePaths(): void {
  try {
    for (const dir of [D_DRIVE_USER_DATA, D_DRIVE_TEMP, D_DRIVE_LOGS]) {
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    }
    app.setPath('userData', D_DRIVE_USER_DATA);
    app.setPath('temp', D_DRIVE_TEMP);
    app.setPath('logs', D_DRIVE_LOGS);
    app.setPath('crashDumps', join(D_DRIVE_USER_DATA, 'crash-dumps'));
    app.setPath('cache', join(D_DRIVE_USER_DATA, 'cache'));
    app.setPath('sessionData', join(D_DRIVE_USER_DATA, 'session'));
  } catch (err) {
    console.warn('[main] cannot use D: drive for user data, falling back to default:', err);
    // Electron 默认 userData = %APPDATA%/<productName>，正常 Windows 环境必然可写。
  }
}

ensureDDrivePaths();

app.commandLine.appendSwitch('disable-gpu-vsync');
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');
// hardware acceleration left default; override per-platform if needed

let mainWindow: BrowserWindow | null = null;

function resolveIconPath(): string {
  // dev: dist/main/index.js → ../../resources/icon.ico
  // prod (electron-builder NSIS): app.asar/dist/main/index.js + extraResources 复制到
  // <install>/resources/icon.ico → process.resourcesPath/icon.ico
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.ico')
    : join(__dirname, '../../resources/icon.ico');
}

function resolvePreloadPath(): string {
  // electron-vite 默认输出 .mjs（ESM preload）；Electron 28 + sandbox=false 支持。
  return join(__dirname, '../preload/index.mjs');
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 800,
    minWidth: 1280,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#1A1410',
    title: '邦国录',
    icon: resolveIconPath(),
    fullscreenable: false,
    webPreferences: {
      preload: resolvePreloadPath(),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });

  // v0.9 hotfix：禁掉 F11 / FullscreenChange 入口。Phaser.Scale.RESIZE 在 Electron 28
  // 全屏切换时会拿到 0×0 中间帧，触发 layout 卡死 + 退出后 HUD/面板布局错乱。
  // 用户已立硬规：游戏窗口不允许全屏。最大化按钮仍可用，已经够用。
  mainWindow.setFullScreenable(false);
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && (input.key === 'F11' ||
        (input.key === 'Enter' && input.alt))) {
      event.preventDefault();
    }
  });

  // 窗口尺寸变化（含 maximize/unmaximize 切换）后，把**最终稳定**的内容尺寸推给渲染层。
  // 渲染层据此手动 scale.resize()，绕开 Phaser RESIZE 自动监听在切换瞬间拿到的退化中间帧
  // （那正是"切换瞬间画面畸变 + 卡死不可恢复"的根因）。用 getContentSize（不含边框）。
  const sendCleanSize = (cause: string): void => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const [w, h] = mainWindow.getContentSize();
    if (w > 0 && h > 0) mainWindow.webContents.send('window-resized', { w, h, cause });
  };
  mainWindow.on('maximize', () => sendCleanSize('maximize'));
  mainWindow.on('unmaximize', () => sendCleanSize('unmaximize'));
  mainWindow.on('resize', () => sendCleanSize('resize'));

  mainWindow.on('ready-to-show', () => {
    // 实测：静态最大化渲染正常，只有"最大化↔窗口化切换的瞬间"会因 Phaser RESIZE 拿到
    // 退化中间帧导致画布缓冲与显示尺寸脱钩、画面畸变卡死。故默认开就最大化——直接给大视野，
    // 且这是已知能稳定工作的静态状态，绕开会爆的切换。窗口尺寸已是最大化，Phaser 启动即按此尺寸 boot。
    mainWindow?.maximize();
    mainWindow?.show();
    // DeepSeek 复审[critical]：maximize 的 IPC 可能早于渲染层订阅 onWindowResized 而丢失。
    // 虽然 Phaser boot 时会读到已最大化的 parent 尺寸（通常没事），仍补一次延迟重推，
    // 确保渲染层订阅就绪后拿到一次权威尺寸。
    setTimeout(() => sendCleanSize('initial-resync'), 500);
  });

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  // DeepSeek 二审 nit F3：连续崩溃要有重试上限，否则进入无限 reload 死循环
  let crashRetryCount = 0;
  const MAX_CRASH_RETRIES = 3;
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    const reason = details.reason;
    console.error(`[main] render process gone: ${reason} (retry ${crashRetryCount}/${MAX_CRASH_RETRIES})`);
    if ((reason === 'crashed' || reason === 'oom') && crashRetryCount < MAX_CRASH_RETRIES) {
      crashRetryCount++;
      if (!mainWindow?.isDestroyed()) {
        mainWindow?.webContents.reload();
      }
    } else if (crashRetryCount >= MAX_CRASH_RETRIES) {
      console.error('[main] crash retry limit reached, leaving window blank for user inspection');
    }
  });

  mainWindow.webContents.on('unresponsive', () => {
    console.warn('[main] renderer unresponsive');
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

const VALID_SLOT_RE = /^[a-z0-9_-]{1,32}$/;
const MAX_SAVE_BYTES = 10 * 1024 * 1024;

ipcMain.handle('save-game', async (_event, slot: unknown, json: unknown): Promise<boolean> => {
  if (typeof slot !== 'string' || !VALID_SLOT_RE.test(slot)) throw new Error('invalid slot');
  if (typeof json !== 'string') throw new Error('invalid json');
  if (json.length > MAX_SAVE_BYTES) throw new Error('save data exceeds 10 MB cap');
  const savesDir = join(app.getPath('userData'), 'saves');
  await mkdir(savesDir, { recursive: true });
  await writeFile(join(savesDir, `${slot}.json`), json, 'utf-8');
  return true;
});

ipcMain.handle('load-game', async (_event, slot: unknown): Promise<string | null> => {
  if (typeof slot !== 'string' || !VALID_SLOT_RE.test(slot)) throw new Error('invalid slot');
  const fp = join(app.getPath('userData'), 'saves', `${slot}.json`);
  if (!existsSync(fp)) return null;
  return await readFile(fp, 'utf-8');
});

ipcMain.handle('list-saves', async (): Promise<string[]> => {
  const savesDir = join(app.getPath('userData'), 'saves');
  if (!existsSync(savesDir)) return [];
  const files = await readdir(savesDir);
  return files.filter(f => f.endsWith('.json')).map(f => f.slice(0, -5));
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('child-process-gone', (_event, details) => {
  console.error(`[main] child process gone: ${details.type} (${details.reason})`);
});
