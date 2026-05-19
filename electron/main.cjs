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
    floatingButtonEnabled: true,
    floatPos: null, // { x, y } 浮きボタンの位置を記憶
    fallbackToken: null // keytarが使えない場合のフォールバック
  }
});

const autoLauncher = new AutoLaunch({
  name: 'Sales Pulse',
  isHidden: true
});

let mainWindow = null;
let floatWindow = null;
let tray = null;
let isQuitting = false;

// Supabase設定はレンダラからIPCで受け取る（VITE_*環境変数の値）
let supabaseConfig = null; // { url, anonKey }
let isLoggedIn = false;    // レンダラからログイン状態を受け取る
let currentUserName = '';  // 浮きボタンに表示するユーザー名

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
   Floating Button Window (常時最前面の小さな "+ アポ獲得" ボタン)
------------------------------------------------------------------ */
function createFloatWindow() {
  if (floatWindow) return;
  const saved = store.get('floatPos');
  const opts = {
    width: 180,
    height: 200,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    focusable: true,
    show: false,
    // Mac: panel型にすると他アプリのフルスクリーンSpace上にも常に出る
    type: process.platform === 'darwin' ? 'panel' : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload-float.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  };
  // 画面右上を必ず計算
  const { screen } = require('electron');
  const area = screen.getPrimaryDisplay().workArea;
  if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)
      && saved.x >= area.x && saved.x <= area.x + area.width - 40
      && saved.y >= area.y && saved.y <= area.y + area.height - 40) {
    opts.x = saved.x;
    opts.y = saved.y;
  } else {
    opts.x = area.x + area.width - opts.width - 32;
    opts.y = area.y + 60;
  }

  floatWindow = new BrowserWindow(opts);
  // 全Space／フルスクリーン上でも表示（show前に呼ぶ）
  floatWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // 最前面: 'screen-saver' レベル＋relativeLevel=1で他アプリより上に強制
  floatWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  // 他アプリがアクティブになった時も最前面を維持
  app.on('browser-window-focus', () => {
    if (floatWindow && !floatWindow.isDestroyed()) {
      floatWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    }
  });
  floatWindow.loadFile(path.join(__dirname, 'float.html'));
  floatWindow.once('ready-to-show', () => {
    try {
      floatWindow.showInactive();
      console.log('[FloatWindow] shown at', opts.x, opts.y, 'size', opts.width, opts.height);
    } catch (e) { console.error('[FloatWindow] show failed', e); }
  });
  floatWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('[FloatWindow] failed to load:', code, desc);
  });
  floatWindow.on('moved', () => {
    if (!floatWindow) return;
    const [x, y] = floatWindow.getPosition();
    store.set('floatPos', { x, y });
  });
  floatWindow.on('closed', () => { floatWindow = null; });
}

function destroyFloatWindow() {
  if (!floatWindow) return;
  try { floatWindow.close(); } catch {}
  floatWindow = null;
}

function applyFloatVisibility() {
  const enabled = !!store.get('floatingButtonEnabled');
  console.log('[FloatWindow] applyVisibility — isLoggedIn:', isLoggedIn, 'enabled:', enabled, 'exists:', !!floatWindow);
  if (isLoggedIn && enabled) {
    if (!floatWindow) createFloatWindow();
  } else {
    if (floatWindow) destroyFloatWindow();
  }
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
  const floatEnabled = store.get('floatingButtonEnabled');
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
      label: '画面に浮く「＋アポ獲得」ボタンを表示',
      type: 'checkbox',
      checked: !!floatEnabled,
      click: (mi) => {
        store.set('floatingButtonEnabled', mi.checked);
        applyFloatVisibility();
        refreshTrayMenu();
      }
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
  autoLaunch: store.get('autoLaunch'),
  floatingButtonEnabled: store.get('floatingButtonEnabled')
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
  if (typeof partial?.floatingButtonEnabled === 'boolean') {
    store.set('floatingButtonEnabled', partial.floatingButtonEnabled);
    applyFloatVisibility();
  }
  refreshTrayMenu();
  return true;
});

// レンダラからSupabaseの接続情報を受け取る（浮きボタンが直接Supabaseを叩くため）
ipcMain.handle('app:configure-supabase', async (_e, cfg) => {
  if (cfg && typeof cfg.url === 'string' && typeof cfg.anonKey === 'string') {
    supabaseConfig = { url: cfg.url, anonKey: cfg.anonKey };
    return true;
  }
  return false;
});

// ログイン状態の同期（浮きボタンの表示/非表示制御）
ipcMain.handle('auth:state', async (_e, state) => {
  isLoggedIn = !!state?.loggedIn;
  currentUserName = state?.displayName || '';
  applyFloatVisibility();
  // 浮きボタンに即時反映
  if (floatWindow && !floatWindow.isDestroyed()) {
    try { floatWindow.webContents.send('float:user-changed', currentUserName); } catch {}
  }
  return true;
});

ipcMain.handle('float:get-user-name', async () => currentUserName);

// 浮きボタンの×から呼ばれる：設定をOFFにして閉じる（再表示は設定 or トレイから）
ipcMain.handle('float:dismiss', async () => {
  store.set('floatingButtonEnabled', false);
  applyFloatVisibility();
  refreshTrayMenu();
  return true;
});

// 浮きボタンから即発火
ipcMain.handle('appointment:quick-fire', async () => {
  if (!supabaseConfig) return { ok: false, error: 'not_configured' };
  const token = await getSessionToken();
  if (!token) return { ok: false, error: 'not_logged_in' };
  try {
    const res = await fetch(`${supabaseConfig.url}/rest/v1/rpc/sp_quick_appointment`, {
      method: 'POST',
      headers: {
        apikey: supabaseConfig.anonKey,
        Authorization: `Bearer ${supabaseConfig.anonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_token: token })
    });
    if (!res.ok) {
      return { ok: false, error: `http_${res.status}` };
    }
    const data = await res.json();
    return data;
  } catch (e) {
    return { ok: false, error: e.message || 'network_error' };
  }
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
