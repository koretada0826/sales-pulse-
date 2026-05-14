import React, { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth.jsx';
import { fetchMyAppointments } from '@/lib/api.js';

function fmt(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleString('ja-JP', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
}

export default function History() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchMyAppointments(user.id).then((rows) => { setList(rows); setLoading(false); });
  }, [user]);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">アポ履歴</h1>
      {loading ? <div className="opacity-60">読み込み中...</div> :
       list.length === 0 ? <div className="opacity-60">まだアポ履歴はありません。</div> :
        <div className="rounded-2xl border border-white/10 bg-ink-800/70 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5">
              <tr className="text-left">
                <th className="px-4 py-3">登録日時</th>
                <th className="px-4 py-3">会社</th>
                <th className="px-4 py-3">担当</th>
                <th className="px-4 py-3">アポ日時</th>
                <th className="px-4 py-3">商材</th>
                <th className="px-4 py-3">メモ</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-4 py-2 opacity-70 whitespace-nowrap">{fmt(r.created_at)}</td>
                  <td className="px-4 py-2 font-medium">{r.company_name}</td>
                  <td className="px-4 py-2 opacity-80">{r.contact_name || '-'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{fmt(r.appointment_datetime)}</td>
                  <td className="px-4 py-2">{r.product_name}</td>
                  <td className="px-4 py-2 opacity-70">{r.memo || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
    </div>
  );
}
