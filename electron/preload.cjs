// Sales Pulse - Preload
// レンダラに公開する安全なAPI（contextBridge経由）
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('salesPulse', {
  session: {
    get: () => ipcRenderer.invoke('session:get'),
    set: (token) => ipcRenderer.invoke('session:set', token),
    clear: () => ipcRenderer.invoke('session:clear')
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (partial) => ipcRenderer.invoke('settings:set', partial)
  },
  notify: {
    os: (payload) => ipcRenderer.invoke('notify:os', payload)
  },
  app: {
    platform: () => ipcRenderer.invoke('app:platform'),
    version: () => ipcRenderer.invoke('app:version'),
    openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
    configureSupabase: (cfg) => ipcRenderer.invoke('app:configure-supabase', cfg)
  },
  auth: {
    setState: (state) => ipcRenderer.invoke('auth:state', state)
  },
  on: (channel, listener) => {
    const allowed = ['request-logout'];
    if (!allowed.includes(channel)) return () => {};
    const sub = (_e, ...args) => listener(...args);
    ipcRenderer.on(channel, sub);
    return () => ipcRenderer.removeListener(channel, sub);
  }
});
