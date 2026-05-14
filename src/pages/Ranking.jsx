import React, { useEffect, useState } from 'react';
import { fetchTodayRanking } from '@/lib/api.js';

export default function Ranking() {
  const [list, setList] = useState([]);

  useEffect(() => {
    fetchTodayRanking(20).then(setList).catch(()=>{});
  }, []);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">今日のランキング</h1>
      <div className="rounded-2xl border border-white/10 bg-ink-800/70 p-4">
        {list.length === 0 ? <div className="opacity-60 p-3">まだアポはありません。</div> :
          <ol className="space-y-2">
            {list.map((r, i) => (
              <li key={r.user_id} className="flex items-center justify-between rounded-lg px-3 py-3 bg-white/5">
                <span className="flex items-center gap-3">
                  <span className="text-xl w-8 text-center">{['👑','🥈','🥉'][i] || `${i+1}`}</span>
                  <span className="font-semibold">{r.display_name}</span>
                  {r.team_name && <span className="text-xs opacity-50">{r.team_name}</span>}
                </span>
                <span className="text-accent-gold font-bold text-lg">{r.today_count}件</span>
              </li>
            ))}
          </ol>
        }
      </div>
      <p className="text-xs opacity-50 mt-3">※ 週間・月間ランキングは MVP 後に追加予定です。</p>
    </div>
  );
}
