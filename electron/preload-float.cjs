// Sales Pulse - 浮きボタン専用 preload
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('floatApi', {
  quickFire: () => ipcRenderer.invoke('appointment:quick-fire'),
  getUserName: () => ipcRenderer.invoke('float:get-user-name'),
  dismiss: () => ipcRenderer.invoke('float:dismiss'),
  onUserChanged: (cb) => {
    const sub = (_e, name) => cb(name);
    ipcRenderer.on('float:user-changed', sub);
    return () => ipcRenderer.removeListener('float:user-changed', sub);
  }
});
