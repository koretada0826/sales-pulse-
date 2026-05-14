import { supabase } from './supabase.js';

/**
 * notifications テーブルのINSERTを購読する。
 * @param {(notification) => void} onInsert
 * @param {(status: 'SUBSCRIBED'|'CHANNEL_ERROR'|'TIMED_OUT'|'CLOSED') => void} onStatus
 */
export function subscribeNotifications(onInsert, onStatus) {
  const channel = supabase
    .channel('sp:notifications')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications' },
      (payload) => onInsert?.(payload.new))
    .subscribe((status) => onStatus?.(status));
  return () => { supabase.removeChannel(channel); };
}
