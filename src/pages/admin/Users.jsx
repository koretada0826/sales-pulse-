import React, { useCallback, useEffect, useState } from 'react';
import { fetchUsers, fetchTeams, adminCreateUser, adminSetUserStatus, adminResetPassword } from '@/lib/api.js';
import { useToast } from '@/hooks/useToast.jsx';

function suggestPassword() {
  const base = ['Aurora','Bolt','Comet','Dawn','Echo','Falcon','Glow','Halo'];
  return base[Math.floor(Math.random()*base.length)] + Math.floor(1000+Math.random()*9000) + '!';
}

const errorMap = {
  login_id_exists: 'このログインIDは既に使われています。',
  weak_password: 'パスワードは8文字以上にしてください。',
  forbidden: '管理者権限が必要です。'
};

export default function AdminUsers() {
  const { push } = useToast();
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreated, setShowCreated] = useState(null); // {login_id, password}

  // 新規追加フォーム
  const [form, setForm] = useState({
    displayName: '', loginId: '', initialPassword: suggestPassword(), teamId: '', role: 'sales'
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, t] = await Promise.all([fetchUsers(), fetchTeams()]);
      setUsers(u); setTeams(t);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onCreate = async (e) => {
    e.preventDefault();
    if (!form.displayName || !form.loginId || !form.initialPassword) return;
    const r = await adminCreateUser(form);
    if (!r?.ok) return push({ type:'error', title:'作成に失敗', body: errorMap[r?.error] || r?.error });
    setShowCreated({ loginId: form.loginId, password: form.initialPassword });
    setForm({ displayName:'', loginId:'', initialPassword: suggestPassword(), teamId: form.teamId, role: 'sales' });
    await load();
  };

  const onToggleStatus = async (u) => {
    const next = u.status === 'active' ? 'suspended' : 'active';
    const r = await adminSetUserStatus(u.id, next);
    if (!r?.ok) return push({ type:'error', title:'失敗', body: r?.error });
    push({ type:'success', title: next === 'active' ? '再開しました' : '停止しました' });
    await load();
  };

  const onResetPassword = async (u) => {
    const newPw = suggestPassword();
    const r = await adminResetPassword(u.id, newPw);
    if (!r?.ok) return push({ type:'error', title:'失敗', body: r?.error });
    setShowCreated({ loginId: u.login_id, password: newPw });
  };

  const copy = (text) => { navigator.clipboard?.writeText(text); push({ title:'コピーしました', duration: 1500 }); };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">営業マン管理</h1>

      <form onSubmit={onCreate} className="rounded-2xl border border-white/10 bg-ink-800/70 p-5 mb-6">
        <div className="mb-3 font-semibold">＋ 営業マンを追加</div>
        <div className="grid grid-cols-2 gap-3">
          <input placeholder="表示名 (例: 山田太郎)" value={form.displayName}
            onChange={e=>setForm({...form, displayName:e.target.value})}
            className="rounded-lg bg-ink-900 border border-white/10 px-3 py-2"/>
          <input placeholder="ログインID (例: yamada)" value={form.loginId}
            onChange={e=>setForm({...form, loginId:e.target.value})}
            className="rounded-lg bg-ink-900 border border-white/10 px-3 py-2"/>
          <input placeholder="初期パスワード" value={form.initialPassword}
            onChange={e=>setForm({...form, initialPassword:e.target.value})}
            className="rounded-lg bg-ink-900 border border-white/10 px-3 py-2"/>
          <select value={form.teamId} onChange={e=>setForm({...form, teamId:e.target.value})}
            className="rounded-lg bg-ink-900 border border-white/10 px-3 py-2">
            <option value="">チームなし</option>
            {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={form.role} onChange={e=>setForm({...form, role:e.target.value})}
            className="rounded-lg bg-ink-900 border border-white/10 px-3 py-2 col-span-2">
            <option value="sales">営業</option>
            <option value="manager">マネージャー</option>
            <option value="admin">管理者</option>
          </select>
        </div>
        <div className="flex justify-end mt-3">
          <button className="px-5 py-2 rounded-lg bg-gradient-to-r from-accent-blue to-accent-purple font-semibold">追加する</button>
        </div>
      </form>

      {showCreated && (
        <div className="rounded-xl border border-accent-gold/50 bg-accent-gold/10 p-4 mb-6">
          <div className="font-semibold mb-2">✅ 発行しました（営業マンに共有してください）</div>
          <div className="text-sm">ログインID: <code className="bg-black/40 px-2 py-0.5 rounded">{showCreated.loginId}</code>
            <button onClick={()=>copy(showCreated.loginId)} className="ml-2 text-xs underline">コピー</button></div>
          <div className="text-sm">初期パスワード: <code className="bg-black/40 px-2 py-0.5 rounded">{showCreated.password}</code>
            <button onClick={()=>copy(showCreated.password)} className="ml-2 text-xs underline">コピー</button></div>
          <button onClick={()=>setShowCreated(null)} className="mt-2 text-xs opacity-70 hover:opacity-100">閉じる</button>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-ink-800/70 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr className="text-left">
              <th className="px-4 py-2">表示名</th>
              <th className="px-4 py-2">ログインID</th>
              <th className="px-4 py-2">チーム</th>
              <th className="px-4 py-2">権限</th>
              <th className="px-4 py-2">状態</th>
              <th className="px-4 py-2">最終ログイン</th>
              <th className="px-4 py-2 text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan="7" className="p-4 opacity-60">読み込み中...</td></tr> :
              users.map(u => (
                <tr key={u.id} className="border-t border-white/5">
                  <td className="px-4 py-2 font-medium">{u.display_name}</td>
                  <td className="px-4 py-2 opacity-80">{u.login_id}</td>
                  <td className="px-4 py-2 opacity-80">{teams.find(t=>t.id===u.team_id)?.name || '-'}</td>
                  <td className="px-4 py-2">{u.role}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      u.status==='active' ? 'bg-emerald-500/20 text-emerald-300' :
                      u.status==='suspended' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-white/10'}`}>{u.status}</span>
                  </td>
                  <td className="px-4 py-2 opacity-60 text-xs">{u.last_login_at ? new Date(u.last_login_at).toLocaleString('ja-JP') : '未ログイン'}</td>
                  <td className="px-4 py-2 text-right space-x-2">
                    <button onClick={()=>onResetPassword(u)} className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10">PWリセット</button>
                    <button onClick={()=>onToggleStatus(u)} className={`text-xs px-2 py-1 rounded ${u.status==='active' ? 'bg-amber-500/20 hover:bg-amber-500/30' : 'bg-emerald-500/20 hover:bg-emerald-500/30'}`}>
                      {u.status==='active' ? '停止' : '再開'}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
