import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth.jsx';
import { useRealtime } from '@/hooks/useRealtime.jsx';
import { fetchTodayStats, fetchTodayRanking, fetchRecentNotifications } from '@/lib/api.js';

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-ink-800/70 p-5">
      <div className="text-xs uppercase tracking-wider opacity-60">{label}</div>
      <div className={`mt-1 text-4xl font-bold ${accent || ''}`}>{value}</div>
      <div className="text-xs opacity-50 mt-1">件</div>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const { recent: rtRecent } = useRealtime();
  const nav = useNavigate();
  const [stats, setStats] = useState({ me: 0, team: 0, total: 0 });
  const [ranking, setRanking] = useState([]);
  const [notifs, setNotifs] = useState([]);

  const load = useCallback(async () => {
    if (!user) return;
    const [s, r, n] = await Promise.all([
      fetchTodayStats(user.id, user.team_id),
      fetchTodayRanking(5),
      fetchRecentNotifications(6)
    ]);
    setStats(s); setRanking(r); setNotifs(n);
  }, [user]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    // 新しい通知が届いたら自動更新
    if (rtRecent.length > 0) load();
  }, [rtRecent, load]);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <div className="text-2xl font-bold">こんにちは、{user?.display_name}さん</div>
          <div className="opacity-60 text-sm mt-1">今日も1件、捕まえにいきましょう。</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="今日の自分のアポ" value={stats.me} accent="text-accent-gold" />
        <StatCard label="今日のチーム合計" value={stats.team} accent="text-accent-blue" />
        <StatCard label="今日の全体合計" value={stats.total} accent="text-accent-purple" />
      </div>

      <div className="mb-10 flex justify-center">
        <button
          onClick={() => nav('/new')}
          className="btn-pulse rounded-3xl bg-gradient-to-r from-accent-blue via-accent-purple to-accent-gold px-14 py-10 text-3xl font-extrabold text-white shadow-glow hover:scale-[1.02] active:scale-[0.99] transition">
          ＋ アポ獲得を登録
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <section className="rounded-2xl border border-white/10 bg-ink-800/70 p-5">
          <div className="mb-3 text-sm font-semibold opacity-80">今日のランキング</div>
          {ranking.length === 0 ? (
            <div className="text-sm opacity-50">まだアポはありません。最初の1件を取りましょう！</div>
          ) : (
            <ol className="space-y-2">
              {ranking.map((r, i) => (
                <li key={r.user_id} className="flex items-center justify-between rounded-lg px-3 py-2 bg-white/5">
                  <span className="flex items-center gap-2">
                    <span className="w-6 text-center">{i === 0 ? '👑' : `${i+1}位`}</span>
                    <span className="font-medium">{r.display_name}</span>
                    {r.team_name && <span className="text-xs opacity-50">({r.team_name})</span>}
                  </span>
                  <span className="text-accent-gold font-semibold">{r.today_count}件</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-2xl border border-white/10 bg-ink-800/70 p-5">
          <div className="mb-3 text-sm font-semibold opacity-80">直近の通知</div>
          {notifs.length === 0 ? (
            <div className="text-sm opacity-50">通知はまだありません。</div>
          ) : (
            <ul className="space-y-2">
              {notifs.map((n) => (
                <li key={n.id} className="rounded-lg px-3 py-2 bg-white/5">
                  <div className="text-sm">{n.title}</div>
                  {n.body && <div className="text-xs opacity-60 mt-0.5">{n.body}</div>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
