import React, { useEffect, useState } from 'react';
import { ipc } from '@/lib/ipc.js';
import { changePassword } from '@/lib/auth.js';
import { useToast } from '@/hooks/useToast.jsx';
import { useAuth } from '@/hooks/useAuth.jsx';
import { useNavigate } from 'react-router-dom';

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-xl border border-white/10 bg-ink-800/70 p-4 cursor-pointer">
      <div>
        <div className="font-medium">{label}</div>
        {hint && <div className="text-xs opacity-60 mt-0.5">{hint}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-12 h-7 rounded-full transition flex-shrink-0 ${checked ? 'bg-accent-blue' : 'bg-white/15'}`}>
        <span className={`block h-6 w-6 rounded-full bg-white transition ${checked ? 'translate-x-6' : 'translate-x-0.5'} mt-0.5`}/>
      </button>
    </label>
  );
}

export default function Settings() {
  const { push } = useToast();
  const { logout } = useAuth();
  const nav = useNavigate();
  const [s, setS] = useState({ notificationsEnabled: true, soundEnabled: true, autoLaunch: true });

  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');

  useEffect(() => { ipc.settings.get().then(setS); }, []);

  const set = async (partial) => {
    const next = { ...s, ...partial };
    setS(next);
    await ipc.settings.set(partial);
  };

  const onChangePassword = async (e) => {
    e.preventDefault();
    if (newPw.length < 8) return push({ type:'error', title:'パスワードは8文字以上' });
    const r = await changePassword(oldPw, newPw);
    if (!r?.ok) return push({ type:'error', title:'変更に失敗しました', body: r?.error || '' });
    setOldPw(''); setNewPw('');
    push({ type:'success', title:'パスワードを変更しました' });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">設定</h1>

      <div className="space-y-3">
        <Toggle label="通知を有効にする" hint="OFFにすると他の人のアポ獲得通知が表示されません"
          checked={s.notificationsEnabled} onChange={(v)=>set({ notificationsEnabled: v })}/>
        <Toggle label="通知音を鳴らす" hint="OS通知の音をON/OFFします"
          checked={s.soundEnabled} onChange={(v)=>set({ soundEnabled: v })}/>
        <Toggle label="PC起動時に自動起動" hint="PCを起動するとSales Pulseが裏で立ち上がります"
          checked={s.autoLaunch} onChange={(v)=>set({ autoLaunch: v })}/>
      </div>

      <div className="mt-8 rounded-2xl border border-white/10 bg-ink-800/70 p-5">
        <h2 className="font-semibold mb-3">パスワード変更</h2>
        <form onSubmit={onChangePassword} className="space-y-3">
          <input type="password" placeholder="現在のパスワード" value={oldPw} onChange={e=>setOldPw(e.target.value)}
            className="w-full rounded-lg bg-ink-900 border border-white/10 px-4 py-3"/>
          <input type="password" placeholder="新しいパスワード（8文字以上）" value={newPw} onChange={e=>setNewPw(e.target.value)}
            className="w-full rounded-lg bg-ink-900 border border-white/10 px-4 py-3"/>
          <button className="px-4 py-2 rounded-lg bg-accent-blue/80 hover:bg-accent-blue">パスワード変更</button>
        </form>
      </div>

      <div className="mt-8">
        <button onClick={async () => { await logout(); nav('/login'); }}
          className="px-4 py-2 rounded-lg border border-white/10 hover:bg-white/5">ログアウト</button>
      </div>
    </div>
  );
}
