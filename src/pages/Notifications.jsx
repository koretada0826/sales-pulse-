import React, { useEffect, useState } from 'react';
import { fetchRecentNotifications } from '@/lib/api.js';
import { useRealtime } from '@/hooks/useRealtime.jsx';

function fmt(d) {
  return new Date(d).toLocaleString('ja-JP', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
}

export default function NotificationsPage() {
  const { recent } = useRealtime();
  const [list, setList] = useState([]);

  useEffect(() => {
    fetchRecentNotifications(50).then(setList).catch(()=>{});
  }, [recent.length]);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">通知履歴</h1>
      <div className="rounded-2xl border border-white/10 bg-ink-800/70 divide-y divide-white/5">
        {list.length === 0 ? <div className="p-4 opacity-60">通知はまだありません。</div> :
          list.map(n => (
            <div key={n.id} className="p-4">
              <div className="flex items-baseline justify-between">
                <div className="font-medium">{n.title}</div>
                <div className="text-xs opacity-50">{fmt(n.created_at)}</div>
              </div>
              {n.body && <div className="mt-1 text-sm opacity-80">{n.body}</div>}
            </div>
          ))}
      </div>
    </div>
  );
}
