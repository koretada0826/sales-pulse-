import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { subscribeNotifications } from '@/lib/realtime.js';
import { ipc } from '@/lib/ipc.js';
import { useAuth } from './useAuth.jsx';
import { useToast } from './useToast.jsx';

const Ctx = createContext(null);

// アポ獲得のお祝い音 (Web Audio で合成。外部ファイル不要)
function playCelebrateSound() {
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    // 3音のアルペジオ風: C5 -> E5 -> G5
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = ctx.currentTime + i * 0.09;
      const stop = start + 0.35;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, stop);
      osc.start(start);
      osc.stop(stop);
    });
    // 5秒後にコンテキストをクローズしてメモリ解放
    setTimeout(() => ctx.close().catch(() => {}), 1500);
  } catch {}
}

export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const { push } = useToast();
  const [status, setStatus] = useState('idle'); // idle/connecting/online/reconnecting/offline
  const [recent, setRecent] = useState([]);
  const seen = useRef(new Set());
  const [onlineNetwork, setOnlineNetwork] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    if (!user) { setStatus('idle'); return; }
    setStatus('connecting');

    const unsub = subscribeNotifications(
      async (n) => {
        if (seen.current.has(n.id)) return;
        seen.current.add(n.id);
        setRecent((arr) => [n, ...arr].slice(0, 50));

        // 自分発信の通知を自分にも出すか
        const settings = await ipc.settings.get();
        const isSelf = n.sender_user_id === user.id;
        if (settings.notificationsEnabled !== false) {
          // 自分発の通知は基本出さない（成功トーストで代替）
          if (!isSelf) {
            ipc.notify.os({ title: n.title, body: n.body, silent: settings.soundEnabled === false });
            push({ type: 'celebrate', title: n.title, body: n.body, duration: 6000 });
            if (settings.soundEnabled !== false) playCelebrateSound();
          }
        }
      },
      (s) => {
        if (s === 'SUBSCRIBED') setStatus('online');
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') setStatus('reconnecting');
        else if (s === 'CLOSED') setStatus('offline');
      }
    );
    return () => { unsub?.(); };
  }, [user, push]);

  useEffect(() => {
    const on = () => setOnlineNetwork(true);
    const off = () => setOnlineNetwork(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  const effectiveStatus = !onlineNetwork ? 'offline' : status;

  return (
    <Ctx.Provider value={{ status: effectiveStatus, recent }}>
      {children}
    </Ctx.Provider>
  );
}

export const useRealtime = () => useContext(Ctx);
