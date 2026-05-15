// Electronのpreloadが用意するAPIへの薄いラッパ
// ブラウザでも壊れないようフォールバック実装を返す

const fallback = {
  session: {
    get: async () => localStorage.getItem('sp_token'),
    set: async (t) => localStorage.setItem('sp_token', t),
    clear: async () => localStorage.removeItem('sp_token')
  },
  settings: {
    get: async () => ({ notificationsEnabled: true, soundEnabled: true, autoLaunch: false }),
    set: async () => true
  },
  notify: {
    os: async ({ title, body }) => {
      if (!('Notification' in window)) return false;
      if (Notification.permission !== 'granted') {
        try { await Notification.requestPermission(); } catch {}
      }
      if (Notification.permission === 'granted') new Notification(title, { body });
      return true;
    }
  },
  app: {
    platform: async () => navigator.platform,
    version: async () => '0.0.0-web',
    openExternal: async (u) => window.open(u, '_blank'),
    configureSupabase: async () => false
  },
  auth: {
    setState: async () => true
  },
  on: () => () => {}
};

export const ipc = (typeof window !== 'undefined' && window.salesPulse) ? window.salesPulse : fallback;
