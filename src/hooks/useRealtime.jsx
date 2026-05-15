import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { subscribeNotifications } from '@/lib/realtime.js';
import { ipc } from '@/lib/ipc.js';
import { useAuth } from './useAuth.jsx';
import { useToast } from './useToast.jsx';
import CelebrateBanner from '@/components/CelebrateBanner.jsx';

const Ctx = createContext(null);

// ────────────────────────────────────────────────────────────
// AudioContext（モジュールレベルで1つだけ持つ）
// ブラウザの自動再生制限のため、最初のユーザー操作で「解錠」する。
// ────────────────────────────────────────────────────────────
let _audioCtx = null;
let _audioUnlocked = false;

function ensureAudioCtx() {
  if (typeof window === 'undefined') return null;
  if (_audioCtx) return _audioCtx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try { _audioCtx = new Ctor(); } catch { return null; }
  return _audioCtx;
}

function unlockAudio() {
  if (_audioUnlocked) return;
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.001);
  } catch {}
  _audioUnlocked = true;
}

if (typeof window !== 'undefined') {
  const onGesture = () => unlockAudio();
  window.addEventListener('click', onGesture, { capture: true });
  window.addEventListener('keydown', onGesture, { capture: true });
  window.addEventListener('pointerdown', onGesture, { capture: true });
}

// ────────────────────────────────────────────────────────────
// アポ獲得のお祝い音（チャイム＋アルペジオ＋仕上げのディン）
// ────────────────────────────────────────────────────────────
function playCelebrateSound() {
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const now = ctx.currentTime + 0.02;

  const tone = (freq, start, duration, { type = 'sine', vol = 0.18 } = {}) => {
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      osc.connect(gain); gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(vol, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.start(start);
      osc.stop(start + duration + 0.05);
    } catch {}
  };

  // 冒頭のチャイム（鐘っぽい高音＋倍音）
  tone(1318.51, now,        1.00, { type: 'triangle', vol: 0.22 }); // E6
  tone(2637.02, now,        0.80, { type: 'sine',     vol: 0.10 }); // E7
  tone(3951.07, now,        0.50, { type: 'sine',     vol: 0.05 }); // B7

  // アルペジオ：C5 → E5 → G5 → C6
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    tone(freq, now + 0.18 + i * 0.09, 0.55, { type: 'triangle', vol: 0.18 });
  });

  // 仕上げの大きなディン
  tone(1568.00, now + 0.62, 1.20, { type: 'triangle', vol: 0.22 }); // G6
  tone(3136.00, now + 0.62, 0.90, { type: 'sine',     vol: 0.09 }); // G7
}

// ────────────────────────────────────────────────────────────
// Provider
// ────────────────────────────────────────────────────────────
export function RealtimeProvider({ children }) {
  const { user } = useAuth();
  const { push } = useToast();
  const [status, setStatus] = useState('idle');
  const [recent, setRecent] = useState([]);
  const [celebrate, setCelebrate] = useState(null);
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

        const settings = await ipc.settings.get();
        const isSelf = n.sender_user_id === user.id;
        if (settings.notificationsEnabled !== false) {
          if (!isSelf) {
            ipc.notify.os({ title: n.title, body: n.body, silent: settings.soundEnabled === false });
            push({ type: 'celebrate', title: n.title, body: n.body, duration: 6000 });
            setCelebrate({ id: n.id, title: n.title, body: n.body });
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
      <CelebrateBanner event={celebrate} onClose={() => setCelebrate(null)} />
    </Ctx.Provider>
  );
}

export const useRealtime = () => useContext(Ctx);
