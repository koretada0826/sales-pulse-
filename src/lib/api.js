import { supabase } from './supabase.js';
import { ipc } from './ipc.js';

async function token() { return ipc.session.get(); }

export async function registerAppointment(payload) {
  const t = await token();
  const { data, error } = await supabase.rpc('sp_register_appointment', {
    p_token: t,
    p_company_name: payload.companyName,
    p_appointment_datetime: payload.appointmentDatetime,
    p_product_name: payload.productName,
    p_contact_name: payload.contactName || null,
    p_memo: payload.memo || null
  });
  if (error) return { ok: false, error: error.message };
  return data;
}

export async function adminCreateUser(payload) {
  const t = await token();
  const { data, error } = await supabase.rpc('sp_admin_create_user', {
    p_token: t,
    p_login_id: payload.loginId,
    p_initial_password: payload.initialPassword,
    p_display_name: payload.displayName,
    p_team_id: payload.teamId || null,
    p_role: payload.role || 'sales'
  });
  if (error) return { ok: false, error: error.message };
  return data;
}

export async function adminSetUserStatus(userId, status) {
  const t = await token();
  const { data, error } = await supabase.rpc('sp_admin_set_user_status', {
    p_token: t, p_user_id: userId, p_status: status
  });
  if (error) return { ok: false, error: error.message };
  return data;
}

export async function adminResetPassword(userId, newPassword) {
  const t = await token();
  const { data, error } = await supabase.rpc('sp_admin_reset_password', {
    p_token: t, p_user_id: userId, p_new_password: newPassword
  });
  if (error) return { ok: false, error: error.message };
  return data;
}

/* ---------- 取得系（RLSでanon読取可） ---------- */

export async function fetchTeams() {
  const { data, error } = await supabase.from('teams').select('id, name, daily_target').order('name');
  if (error) throw error;
  return data;
}

export async function fetchProducts() {
  const { data, error } = await supabase.from('products').select('id, name').eq('is_active', true).order('name');
  if (error) throw error;
  return data;
}

export async function fetchUsers() {
  const { data, error } = await supabase
    .from('users')
    .select('id, login_id, display_name, team_id, role, status, last_login_at, must_change_password')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

const TODAY_ISO_START_JST = () => {
  // JST今日の00:00を、UTC ISO文字列で返す
  const jstDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date()); // "YYYY-MM-DD"
  return new Date(`${jstDate}T00:00:00+09:00`).toISOString();
};

export async function fetchTodayStats(userId, teamId) {
  const since = TODAY_ISO_START_JST();
  // 全体
  const allRes = await supabase.from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active').gte('created_at', since);
  const meRes = await supabase.from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'active').eq('user_id', userId).gte('created_at', since);
  let teamCount = 0;
  if (teamId) {
    const tRes = await supabase.from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active').eq('team_id', teamId).gte('created_at', since);
    teamCount = tRes.count || 0;
  }
  return {
    total: allRes.count || 0,
    me: meRes.count || 0,
    team: teamCount
  };
}

export async function fetchTodayRanking(limit = 10) {
  const since = TODAY_ISO_START_JST();
  // 営業マンごとのカウントを取得（v_daily_rankingを使う）
  const { data, error } = await supabase.from('v_daily_ranking')
    .select('user_id, display_name, team_name, today_count')
    .order('today_count', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).filter(r => r.today_count > 0);
}

export async function fetchRecentNotifications(limit = 20) {
  const { data, error } = await supabase.from('notifications')
    .select('id, type, title, body, created_at')
    .order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}

export async function fetchMyAppointments(userId, limit = 50) {
  const { data, error } = await supabase.from('appointments')
    .select('id, company_name, contact_name, appointment_datetime, product_name, memo, created_at')
    .eq('user_id', userId).eq('status', 'active')
    .order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data;
}
