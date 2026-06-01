import { contextBridge, ipcRenderer } from 'electron';

const api = {
  getVersion: (): string => process.versions.electron ?? 'unknown',
  saveGame: (slot: string, json: string): Promise<boolean> =>
    ipcRenderer.invoke('save-game', slot, json),
  loadGame: (slot: string): Promise<string | null> =>
    ipcRenderer.invoke('load-game', slot),
  listSaves: (): Promise<string[]> =>
    ipcRenderer.invoke('list-saves'),
  /** 主进程在窗口 maximize/unmaximize/resize 完成后推送"干净"的内容尺寸；
   *  渲染层据此手动 game.scale.resize()，绕开 Phaser RESIZE 自动监听拿到的退化中间帧。
   *  返回取消订阅函数。 */
  onWindowResized: (
    cb: (size: { w: number; h: number; cause: string }) => void,
  ): (() => void) => {
    const listener = (_e: unknown, data: { w: number; h: number; cause: string }): void => cb(data);
    ipcRenderer.on('window-resized', listener);
    return () => ipcRenderer.removeListener('window-resized', listener);
  },
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('colonyApi', api);
  } catch (error) {
    // DeepSeek 二审 major F4：silent failure 会让 renderer 拿到 undefined colonyApi
    // 调一次 ipcMain "save-game"/"load-game" 就 TypeError，且无诊断信息。
    // 抛回让 main 的 'preload-error' 事件触发，至少日志里能看到。
    console.error('[preload] FATAL: contextBridge.exposeInMainWorld failed:', error);
    throw error;
  }
} else {
  // fallback: should not happen when contextIsolation is on
  (globalThis as unknown as Record<string, unknown>).colonyApi = api;
}

export type ColonyApi = typeof api;
