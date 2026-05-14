import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // 致命的ではないが、ユーザーに分かりやすく表示できるようにする
  console.warn('[Sales Pulse] Supabase の環境変数が未設定です。.env を確認してください。');
}

export const supabase = createClient(url || 'https://invalid.supabase.co', anon || 'invalid', {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 10 } }
});

export const hasSupabaseConfig = Boolean(url && anon);
