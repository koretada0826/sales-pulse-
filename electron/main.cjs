// Sales Pulse - Electron main process
// 役割: ウィンドウ管理 / Tray常駐 / 自動起動 / OS通知 / IPC / トークン安全保存

const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, nativeImage, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

let keytar = null;
try { keytar = require('keytar'); } catch (e) { keytar = null; }

const Store = require('electron-store');
const AutoLaunch = require('auto-launch');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

const KEYTAR_SERVICE = 'SalesPulse';
const KEYTAR_ACCOUNT = 'session_token';

const store = new Store({
  name: 'sales-pulse-config',
  defaults: {
    notificationsEnabled: true,
    soundEnabled: true,
    autoLaunch: true,
    fallbackToken: null // keytarが使えない場合のフォールバック
  }
});

const autoLauncher = new AutoLaunch({
  name: 'Sales Pulse',
  isHidden: true
});

let mainWindow = null;
let tray = null;
let isQuitting = false;

/* ------------------------------------------------------------------
   Window
------------------------------------------------------------------ */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#0b0f19',
    show: false,
    autoHideMenuBar: true,
    title: 'Sales Pulse',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5273');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    if (!process.argv.includes('--hidden')) mainWindow.show();
  });

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      // 初回最小化時に通知
      if (!store.get('hasShownTrayHint')) {
        store.set('hasShownTrayHint', true);
        new Notification({
          title: 'Sales Pulse は常駐しています',
          body: process.platform === 'darwin'
            ? 'メニューバーのアイコンから再表示できます。'
            : 'タスクトレイのアイコンから再表示できます。'
        }).show();
      }
    }
  });
}

/* ------------------------------------------------------------------
   Tray
------------------------------------------------------------------ */
function buildTrayIcon() {
  // 簡易PNGアイコン（無ければプレーンな1x1透過）
  const iconPath = path.join(__dirname, '..', 'build', 'tray.png');
  if (fs.existsSync(iconPath)) return nativeImage.createFromPath(iconPath);
  // ダミーアイコン（16x16 単色）
  const buf = nativeImage.createEmpty();
  return buf;
}

function createTray() {
  const icon = buildTrayIcon();
  tray = new Tray(icon.isEmpty() ? nativeImage.createFromDataURL(FALLBACK_ICON_DATAURL) : icon);
  tray.setToolTip('Sales Pulse');
  refreshTrayMenu();
  tray.on('click', () => showMainWindow());
  tray.on('double-click', () => showMainWindow());
}

function refreshTrayMenu() {
  if (!tray) return;
  const notifEnabled = store.get('notificationsEnabled');
  const autoLaunchEnabled = store.get('autoLaunch');
  const menu = Menu.buildFromTemplate([
    { label: 'Sales Pulseを開く', click: () => showMainWindow() },
    { type: 'separator' },
    {
      label: '通知を有効にする',
      type: 'checkbox',
      checked: !!notifEnabled,
      click: (mi) => { store.set('notificationsEnabled', mi.checked); refreshTrayMenu(); }
    },
    {
      label: 'PC起動時に自動起動',
      type: 'checkbox',
      checked: !!autoLaunchEnabled,
      click: async (mi) => {
        store.set('autoLaunch', mi.checked);
        await applyAutoLaunch(mi.checked);
        refreshTrayMenu();
      }
    },
    { type: 'separator' },
    { label: 'ログアウト', click: () => { mainWindow?.webContents.send('request-logout'); showMainWindow(); } },
    { label: '完全終了', click: () => { isQuitting = true; app.quit(); } }
  ]);
  tray.setContextMenu(menu);
}

function showMainWindow() {
  if (!mainWindow) return createWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

/* ------------------------------------------------------------------
   Auto Launch
------------------------------------------------------------------ */
async function applyAutoLaunch(enable) {
  try {
    const enabled = await autoLauncher.isEnabled();
    if (enable && !enabled) await autoLauncher.enable();
    if (!enable && enabled) await autoLauncher.disable();
  } catch (e) {
    console.warn('AutoLaunch error:', e.message);
  }
}

/* ------------------------------------------------------------------
   Token storage (keytar優先 + electron-store fallback)
------------------------------------------------------------------ */
async function setSessionToken(token) {
  if (keytar) {
    try { await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, token); return true; }
    catch (e) { console.warn('keytar.set failed, fallback:', e.message); }
  }
  store.set('fallbackToken', token);
  return true;
}

async function getSessionToken() {
  if (keytar) {
    try {
      const t = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
      if (t) return t;
    } catch (e) { console.warn('keytar.get failed, fallback:', e.message); }
  }
  return store.get('fallbackToken') || null;
}

async function clearSessionToken() {
  if (keytar) {
    try { await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT); } catch {}
  }
  store.set('fallbackToken', null);
}

/* ------------------------------------------------------------------
   IPC
------------------------------------------------------------------ */
ipcMain.handle('session:get', async () => getSessionToken());
ipcMain.handle('session:set', async (_e, token) => setSessionToken(token));
ipcMain.handle('session:clear', async () => clearSessionToken());

ipcMain.handle('settings:get', async () => ({
  notificationsEnabled: store.get('notificationsEnabled'),
  soundEnabled: store.get('soundEnabled'),
  autoLaunch: store.get('autoLaunch')
}));

ipcMain.handle('settings:set', async (_e, partial) => {
  if (typeof partial?.notificationsEnabled === 'boolean')
    store.set('notificationsEnabled', partial.notificationsEnabled);
  if (typeof partial?.soundEnabled === 'boolean')
    store.set('soundEnabled', partial.soundEnabled);
  if (typeof partial?.autoLaunch === 'boolean') {
    store.set('autoLaunch', partial.autoLaunch);
    await applyAutoLaunch(partial.autoLaunch);
  }
  refreshTrayMenu();
  return true;
});

ipcMain.handle('notify:os', (_e, { title, body, silent }) => {
  if (!store.get('notificationsEnabled')) return false;
  if (!Notification.isSupported()) return false;
  const n = new Notification({
    title: title || 'Sales Pulse',
    body: body || '',
    silent: silent === true || !store.get('soundEnabled')
  });
  n.on('click', () => showMainWindow());
  n.show();
  return true;
});

ipcMain.handle('app:platform', () => process.platform);
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:openExternal', (_e, url) => { if (/^https?:/.test(url)) shell.openExternal(url); });

/* ------------------------------------------------------------------
   App lifecycle
------------------------------------------------------------------ */
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); return; }
app.on('second-instance', () => showMainWindow());

app.whenReady().then(async () => {
  createWindow();
  createTray();
  await applyAutoLaunch(store.get('autoLaunch'));
});

app.on('window-all-closed', (e) => {
  // 全ウィンドウ閉じても終了しない（常駐）
  if (process.platform !== 'darwin') e?.preventDefault?.();
});

app.on('before-quit', () => { isQuitting = true; });

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else showMainWindow();
});

// 1x1 透過PNG (フォールバック)
const FALLBACK_ICON_DATAURL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAEklEQVR42mNkYGD4z0AEYBxVCAAA//8DAA' +
  'kBA1pQwYyJAAAAAElFTkSuQmCC';
