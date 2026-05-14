import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth.jsx';
import { useToast } from '@/hooks/useToast.jsx';
import { changePassword } from '@/lib/auth.js';

export default function ChangePassword() {
  const { user, refresh } = useAuth();
  const { push } = useToast();
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [newPw2, setNewPw2] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const nav = useNavigate();

  if (!user) return <Navigate to="/login" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (newPw !== newPw2) return push({ type: 'error', title: 'パスワードが一致しません' });
    if (newPw.length < 8) return push({ type: 'error', title: 'パスワードは8文字以上' });
    setSubmitting(true);
    const r = await changePassword(oldPw, newPw);
    setSubmitting(false);
    if (!r?.ok) return push({ type: 'error', title: 'パスワード変更に失敗', body: r?.error || '' });
    push({ type: 'success', title: 'パスワードを変更しました' });
    await refresh();
    nav('/', { replace: true });
  };

  return (
    <div className="flex h-screen items-center justify-center px-6">
      <form onSubmit={onSubmit} className="w-full max-w-md rounded-2xl border border-white/10 bg-ink-800/70 p-6 space-y-4">
        <h1 className="text-xl font-bold">初回パスワード変更</h1>
        <p className="text-sm opacity-70">初期パスワードのままでは利用できません。新しいパスワードを設定してください。</p>
        <input type="password" placeholder="現在のパスワード（初期パスワード）" value={oldPw} onChange={e=>setOldPw(e.target.value)}
          className="w-full rounded-lg bg-ink-900 border border-white/10 px-4 py-3"/>
        <input type="password" placeholder="新しいパスワード（8文字以上）" value={newPw} onChange={e=>setNewPw(e.target.value)}
          className="w-full rounded-lg bg-ink-900 border border-white/10 px-4 py-3"/>
        <input type="password" placeholder="新しいパスワード（確認）" value={newPw2} onChange={e=>setNewPw2(e.target.value)}
          className="w-full rounded-lg bg-ink-900 border border-white/10 px-4 py-3"/>
        <button disabled={submitting} className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-accent-blue to-accent-purple disabled:opacity-50">
          {submitting ? '変更中...' : 'パスワードを変更'}
        </button>
      </form>
    </div>
  );
}
