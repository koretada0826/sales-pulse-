import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchProducts, registerAppointment } from '@/lib/api.js';
import { useToast } from '@/hooks/useToast.jsx';

function nowLocalDatetimeLocal() {
  const d = new Date();
  d.setSeconds(0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addDays(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const errorMessages = {
  company_required: '会社名を入力してください。',
  product_required: '商材を選んでください。',
  invalid_session: '再ログインが必要です。'
};

export default function AppointmentNew() {
  const nav = useNavigate();
  const { push } = useToast();
  const [products, setProducts] = useState([]);
  const [company, setCompany] = useState('');
  const [datetime, setDatetime] = useState(nowLocalDatetimeLocal());
  const [product, setProduct] = useState('');
  const [contact, setContact] = useState('');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchProducts().then((list) => {
      setProducts(list);
      if (list[0]) setProduct(list[0].name);
    }).catch(() => {});
  }, []);

  const isValid = useMemo(() => company.trim() && datetime && product, [company, datetime, product]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!isValid) return;
    setSubmitting(true);
    const r = await registerAppointment({
      companyName: company,
      appointmentDatetime: new Date(datetime).toISOString(),
      productName: product,
      contactName: contact,
      memo
    });
    setSubmitting(false);
    if (!r?.ok) {
      push({ type: 'error', title: 'アポ登録に失敗しました', body: errorMessages[r?.error] || '通信状況を確認してもう一度お試しください。' });
      return;
    }
    push({
      type: 'success',
      title: '🎉 アポ獲得を登録しました！',
      body: `本日${r.today_user_count}件目です。全員に通知しました。`,
      duration: 5000
    });
    nav('/', { replace: true });
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-1">アポ獲得を登録</h1>
      <p className="opacity-60 text-sm mb-6">最小限の入力でOK。「登録して全員に通知」を押すと、全社員のPCに通知が飛びます。</p>

      <form onSubmit={onSubmit} className="rounded-2xl border border-white/10 bg-ink-800/70 p-6 space-y-5">
        <div>
          <label className="text-sm opacity-80">会社名 <span className="text-red-300">*</span></label>
          <input autoFocus value={company} onChange={e=>setCompany(e.target.value)}
            placeholder="例: 株式会社サンプル"
            className="mt-1 w-full rounded-lg bg-ink-900 border border-white/10 px-4 py-3 outline-none focus:border-accent-blue"/>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm opacity-80">アポ日時 <span className="text-red-300">*</span></label>
            <input type="datetime-local" value={datetime} onChange={e=>setDatetime(e.target.value)}
              className="mt-1 w-full rounded-lg bg-ink-900 border border-white/10 px-4 py-3 outline-none focus:border-accent-blue"/>
            <div className="mt-2 flex gap-2 text-xs">
              <button type="button" onClick={()=>setDatetime(nowLocalDatetimeLocal())}
                className="rounded-md bg-white/5 px-2 py-1 hover:bg-white/10">今</button>
              <button type="button" onClick={()=>setDatetime(addDays(nowLocalDatetimeLocal(), 1))}
                className="rounded-md bg-white/5 px-2 py-1 hover:bg-white/10">明日</button>
              <button type="button" onClick={()=>setDatetime(addDays(nowLocalDatetimeLocal(), 7))}
                className="rounded-md bg-white/5 px-2 py-1 hover:bg-white/10">来週</button>
            </div>
          </div>
          <div>
            <label className="text-sm opacity-80">商材 <span className="text-red-300">*</span></label>
            <select value={product} onChange={e=>setProduct(e.target.value)}
              className="mt-1 w-full rounded-lg bg-ink-900 border border-white/10 px-4 py-3 outline-none focus:border-accent-blue">
              <option value="" disabled>選択してください</option>
              {products.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm opacity-80">担当者名（任意）</label>
          <input value={contact} onChange={e=>setContact(e.target.value)}
            placeholder="例: 山田様"
            className="mt-1 w-full rounded-lg bg-ink-900 border border-white/10 px-4 py-3 outline-none focus:border-accent-blue"/>
        </div>

        <div>
          <label className="text-sm opacity-80">メモ（任意）</label>
          <textarea value={memo} onChange={e=>setMemo(e.target.value)} rows={3}
            placeholder="商談で気をつけることなど"
            className="mt-1 w-full rounded-lg bg-ink-900 border border-white/10 px-4 py-3 outline-none focus:border-accent-blue resize-y"/>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={()=>nav(-1)}
            className="flex-1 py-3 rounded-xl border border-white/10 hover:bg-white/5">キャンセル</button>
          <button type="submit" disabled={!isValid || submitting}
            className="flex-[2] py-4 rounded-xl text-lg font-bold bg-gradient-to-r from-accent-blue via-accent-purple to-accent-gold disabled:opacity-50">
            {submitting ? '登録中...' : '登録して全員に通知'}
          </button>
        </div>
      </form>
    </div>
  );
}
