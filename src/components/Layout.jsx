import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth.jsx';
import { useRealtime } from '@/hooks/useRealtime.jsx';

function StatusPill({ status }) {
  const map = {
    online:       { label: 'オンライン  通知受信中', dot: 'bg-emerald-400' },
    connecting:   { label: '接続中...', dot: 'bg-amber-400 animate-pulse' },
    reconnecting: { label: '再接続中...', dot: 'bg-amber-400 animate-pulse' },
    offline:      { label: 'オフライン  通知を受け取れません', dot: 'bg-red-400' },
    idle:         { label: '待機', dot: 'bg-slate-500' }
  };
  const s = map[status] || map.idle;
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-ink-800/60 border border-white/10 px-3 py-1 text-xs">
      <span className={`inline-block h-2 w-2 rounded-full ${s.dot}`} />
      {s.label}
    </div>
  );
}

function NavItem({ to, end, children }) {
  return (
    <NavLink
      to={to} end={end}
      className={({ isActive }) =>
        `block px-4 py-2 rounded-lg text-sm transition ${
          isActive ? 'bg-gradient-to-r from-accent-blue/30 to-accent-purple/30 border border-white/10'
                   : 'hover:bg-white/5'
        }`}>{children}</NavLink>
  );
}

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const { status } = useRealtime();
  const nav = useNavigate();

  return (
    <div className="grid h-screen grid-cols-[240px_1fr]">
      <aside className="border-r border-white/10 bg-ink-900/60 backdrop-blur p-4 flex flex-col">
        <div className="mb-6">
          <div className="text-xl font-bold bg-gradient-to-r from-accent-blue via-accent-purple to-accent-gold bg-clip-text text-transparent">
            Sales Pulse
          </div>
          <div className="text-xs opacity-60 mt-0.5">{user?.display_name} ／ {user?.role === 'admin' ? '管理者' : '営業'}</div>
        </div>

        <nav className="space-y-1 text-slate-200">
          <NavItem to="/" end>ホーム</NavItem>
          <NavItem to="/new">＋ アポ獲得を登録</NavItem>
          <NavItem to="/history">アポ履歴</NavItem>
          <NavItem to="/ranking">ランキング</NavItem>
          <NavItem to="/notifications">通知履歴</NavItem>
          <NavItem to="/settings">設定</NavItem>

          {isAdmin && (
            <>
              <div className="mt-5 mb-1 text-xs uppercase tracking-wider opacity-50">管理者</div>
              <NavItem to="/admin">ダッシュボード</NavItem>
              <NavItem to="/admin/users">営業マン管理</NavItem>
              <NavItem to="/admin/appointments">アポ履歴 (全社)</NavItem>
            </>
          )}
        </nav>

        <div className="mt-auto pt-4 space-y-2">
          <StatusPill status={status} />
          <button onClick={async () => { await logout(); nav('/login'); }}
            className="w-full text-left text-sm opacity-70 hover:opacity-100">ログアウト</button>
        </div>
      </aside>

      <main className="overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
