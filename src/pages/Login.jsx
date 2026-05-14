import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth.jsx';
import { hasSupabaseConfig } from '@/lib/supabase.js';

const errorMessages = {
  invalid_credentials: 'ログインIDまたはパスワードが違います。',
  account_inactive: 'このアカウントは利用停止中です。管理者にお問い合わせください。',
  no_token: 'セッション情報がありません。',
  weak_password: 'パスワードは8文字以上にしてください。',
  login_id_exists: 'このログインIDは既に使われています。'
};

export default function Login() {
  const { login, user, loading } = useAuth();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const nav = useNavigate();

  useEffect(() => {
    if (user) nav('/', { replace: true });
  }, [user, nav]);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    const res = await login(loginId.trim(), password);
    setSubmitting(false);
    if (!res.ok) setError(errorMessages[res.error] || `ログインに失敗しました（${res.error}）`);
  };

  return (
    <div className="flex h-screen items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl font-bold bg-gradient-to-r from-accent-blue via-accent-purple to-accent-gold bg-clip-text text-transparent">
            Sales Pulse
          </div>
          <div className="opacity-70 mt-2">アポ獲得をチームで盛り上げる</div>
        </div>

        {!hasSupabaseConfig && (
          <div className="mb-4 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-sm">
            ⚠ Supabaseの接続情報が未設定です。<br/>
            プロジェクトルートの <code>.env</code> に <code>VITE_SUPABASE_URL</code> と <code>VITE_SUPABASE_ANON_KEY</code> を設定してください。
          </div>
        )}

        <form onSubmit={onSubmit}
          className="rounded-2xl border border-white/10 bg-ink-800/70 backdrop-blur p-6 space-y-4">
          <div>
            <label className="text-sm opacity-80">ログインID</label>
            <input
              autoFocus
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              className="mt-1 w-full rounded-lg bg-ink-900 border border-white/10 px-4 py-3 outline-none focus:border-accent-blue"
              placeholder="例: yamada"
            />
          </div>
          <div>
            <label className="text-sm opacity-80">パスワード</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg bg-ink-900 border border-white/10 px-4 py-3 outline-none focus:border-accent-blue"
            />
          </div>

          {error && <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}

          <button
            type="submit"
            disabled={submitting || !loginId || !password}
            className="w-full py-3 rounded-xl font-semibold bg-gradient-to-r from-accent-blue to-accent-purple hover:opacity-95 disabled:opacity-50">
            {submitting ? 'ログイン中...' : 'ログイン'}
          </button>

          <div className="text-xs opacity-60 leading-relaxed">
            ログインIDと初期パスワードは管理者から共有されています。<br/>
            次回以降はこのPCで自動ログインされます。
          </div>
        </form>
      </div>
    </div>
  );
}
