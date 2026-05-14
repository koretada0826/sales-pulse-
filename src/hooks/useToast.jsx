import React, { createContext, useCallback, useContext, useState } from 'react';

const Ctx = createContext(null);

let _id = 0;

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((toast) => {
    const id = ++_id;
    const t = { id, type: 'info', duration: 4500, ...toast };
    setItems((arr) => [...arr, t]);
    setTimeout(() => {
      setItems((arr) => arr.filter((x) => x.id !== id));
    }, t.duration);
  }, []);
  return (
    <Ctx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed top-4 right-4 z-50 flex w-[360px] flex-col gap-2">
        {items.map((t) => (
          <div key={t.id}
            className={`toast-in pointer-events-auto rounded-xl border px-4 py-3 shadow-glow backdrop-blur
              ${t.type === 'success' ? 'border-emerald-500/50 bg-emerald-500/10'
                : t.type === 'error' ? 'border-red-500/50 bg-red-500/10'
                : t.type === 'celebrate' ? 'border-accent-gold/60 bg-gradient-to-r from-accent-blue/20 to-accent-purple/20'
                : 'border-white/10 bg-ink-800/80'}`}>
            <div className="font-semibold">{t.title}</div>
            {t.body && <div className="text-sm opacity-80 mt-0.5">{t.body}</div>}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
