import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase.js';

function fmt(d) {
  return new Date(d).toLocaleString('ja-JP', { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
}

function toCsv(rows) {
  const head = ['登録日時','獲得者','チーム','会社','担当','アポ日時','商材','メモ'];
  const escape = (v) => `"${String(v ?? '').replace(/"/g,'""')}"`;
  const lines = [head.map(escape).join(',')];
  rows.forEach(r => lines.push([
    fmt(r.created_at), r.user?.display_name, r.team?.name, r.company_name,
    r.contact_name, fmt(r.appointment_datetime), r.product_name, r.memo
  ].map(escape).join(',')));
  return '\uFEFF' + lines.join('\r\n');
}

export default function AdminAppointments() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('appointments')
        .select('id, company_name, contact_name, appointment_datetime, product_name, memo, created_at, user:users(display_name), team:teams(name)')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(200);
      setRows(data || []);
    })();
  }, []);

  const exportCsv = () => {
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `sales-pulse-appointments-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold">アポ履歴 (全社)</h1>
        <button onClick={exportCsv} className="px-3 py-1.5 rounded bg-accent-blue/80 hover:bg-accent-blue text-sm">CSV出力</button>
      </div>
      <div className="rounded-2xl border border-white/10 bg-ink-800/70 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr className="text-left">
              <th className="px-4 py-2">登録</th>
              <th className="px-4 py-2">獲得者</th>
              <th className="px-4 py-2">チーム</th>
              <th className="px-4 py-2">会社</th>
              <th className="px-4 py-2">商材</th>
              <th className="px-4 py-2">アポ日時</th>
              <th className="px-4 py-2">メモ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="px-4 py-2 whitespace-nowrap opacity-70">{fmt(r.created_at)}</td>
                <td className="px-4 py-2">{r.user?.display_name}</td>
                <td className="px-4 py-2 opacity-80">{r.team?.name || '-'}</td>
                <td className="px-4 py-2 font-medium">{r.company_name}</td>
                <td className="px-4 py-2">{r.product_name}</td>
                <td className="px-4 py-2 whitespace-nowrap">{fmt(r.appointment_datetime)}</td>
                <td className="px-4 py-2 opacity-70">{r.memo || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
