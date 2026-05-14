import { supabase } from './supabase.js';
import { ipc } from './ipc.js';

export async function login(loginId, password) {
  const platform = await ipc.app.platform();
  const { data, error } = await supabase.rpc('sp_login', {
    p_login_id: loginId,
    p_password: password,
    p_device_name: navigator.userAgent.slice(0, 80),
    p_platform: platform
  });
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) return { ok: false, error: data?.error || 'unknown' };
  await ipc.session.set(data.token);
  return { ok: true, user: data.user, token: data.token };
}

export async function verifySession() {
  const token = await ipc.session.get();
  if (!token) return { ok: false, error: 'no_token' };
  const { data, error } = await supabase.rpc('sp_verify_session', { p_token: token });
  if (error) return { ok: false, error: error.message };
  if (!data?.ok) {
    await ipc.session.clear();
    return { ok: false, error: data?.error || 'invalid' };
  }
  return { ok: true, user: data.user, token };
}

export async function logout() {
  const token = await ipc.session.get();
  if (token) {
    try { await supabase.rpc('sp_logout', { p_token: token }); } catch {}
  }
  await ipc.session.clear();
}

export async function changePassword(oldPw, newPw) {
  const token = await ipc.session.get();
  const { data, error } = await supabase.rpc('sp_change_password', {
    p_token: token, p_old_password: oldPw, p_new_password: newPw
  });
  if (error) return { ok: false, error: error.message };
  return data;
}
