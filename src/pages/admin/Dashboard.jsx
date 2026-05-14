import React, { useEffect, useState } from 'react';
import { fetchTodayRanking, fetchRecentNotifications, fetchUsers } from '@/lib/api.js';
import { supabase } from '@/lib/supabase.js';

function StatCard({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-ink-800/70 p-5">
      <div className="text-xs uppercase tracking-wider opacity-60">{label}</div>
      <div className={`mt-1 text-3xl font-bold ${accent || ''}`}>{value}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const [todayCount, setTodayCount] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [ranking, setRanking] = useState([]);
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    (async () => {
      const since = (() => {
        const jstDate = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
        }).format(new Date());
        return new Date(`${jstDate}T00:00:00+09:00`).toISOString();
      })();
      const today = await supabase.from('appointments').select('id',{count:'exact',head:true}).eq('status','active').gte('created_at', since);
      setTodayCount(today.count || 0);
      const users = await fetchUsers();
      setActiveUsers(users.filter(u => u.status==='active').length);
      setRanking(await fetchTodayRanking(10));
      setNotifs(await fetchRecentNotifications(8));
    })().catch(console.error);
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">管理者ダッシュボード</h1>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="今日の全体アポ数" value={todayCount} accent="text-accent-gold"/>
        <StatCard label="有効ユーザー数" value={activeUsers} accent="text-accent-blue"/>
        <StatCard label="今日の獲得者数" value={ranking.length} accent="text-accent-purple"/>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <section className="rounded-2xl border border-white/10 bg-ink-800/70 p-5">
          <div className="mb-3 text-sm font-semibold opacity-80">今日のランキング</div>
          {ranking.length === 0 ? <div className="opacity-50 text-sm">まだアポはありません。</div> :
            <ol className="space-y-2">
              {ranking.map((r,i) => (
                <li key={r.user_id} className="flex justify-between bg-white/5 rounded px-3 py-2">
                  <span>{i===0?'👑':`${i+1}位`} {r.display_name} <span className="opacity-50 text-xs">{r.team_name}</span></span>
                  <span className="text-accent-gold font-semibold">{r.today_count}件</span>
                </li>
              ))}
            </ol>}
        </section>
        <section className="rounded-2xl border border-white/10 bg-ink-800/70 p-5">
          <div className="mb-3 text-sm font-semibold opacity-80">最近の通知</div>
          {notifs.length === 0 ? <div className="opacity-50 text-sm">通知はまだありません。</div> :
            <ul className="space-y-2 text-sm">
              {notifs.map(n => (
                <li key={n.id} className="bg-white/5 rounded px-3 py-2">
                  <div>{n.title}</div>
                  {n.body && <div className="text-xs opacity-60">{n.body}</div>}
                </li>
              ))}
            </ul>}
        </section>
      </div>
    </div>
  );
}
