-- ============================================================
-- Sales Pulse  -- スキーマ定義
-- Supabase / PostgreSQL
-- 実行順: schema.sql -> seed.sql
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  daily_target int not null default 10,
  weekly_target int not null default 50,
  monthly_target int not null default 200,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  login_id text not null unique,
  password_hash text not null,
  display_name text not null,
  team_id uuid references teams(id) on delete set null,
  role text not null default 'sales' check (role in ('admin','manager','sales')),
  status text not null default 'active' check (status in ('active','suspended','retired')),
  must_change_password boolean not null default true,
  last_login_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  company_name text not null,
  contact_name text,
  appointment_datetime timestamptz not null,
  product_name text not null,
  memo text,
  status text not null default 'active' check (status in ('active','edited','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists appointments_user_idx on appointments(user_id, created_at desc);
create index if not exists appointments_team_idx on appointments(team_id, created_at desc);
create index if not exists appointments_created_idx on appointments(created_at desc);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('appointment_created','team_goal_reached','streak','system')),
  title text not null,
  body text not null,
  appointment_id uuid references appointments(id) on delete set null,
  sender_user_id uuid references users(id) on delete set null,
  target_scope text not null default 'all' check (target_scope in ('all','team','admins')),
  target_team_id uuid references teams(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists notifications_created_idx on notifications(created_at desc);

create table if not exists notification_receipts (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references notifications(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  read_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique(notification_id, user_id)
);

create table if not exists notification_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references users(id) on delete cascade,
  notifications_enabled boolean not null default true,
  sound_enabled boolean not null default true,
  notify_self boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists login_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  device_name text,
  platform text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  expires_at timestamptz not null default (now() + interval '60 days'),
  created_at timestamptz not null default now()
);

create index if not exists login_sessions_user_idx on login_sessions(user_id);
create index if not exists login_sessions_token_idx on login_sessions(token_hash);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references users(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ============================================================
-- VIEW: daily ranking
-- ============================================================
create or replace view v_daily_ranking as
select
  u.id as user_id,
  u.display_name,
  u.team_id,
  t.name as team_name,
  count(a.id)::int as today_count
from users u
left join teams t on t.id = u.team_id
left join appointments a
  on a.user_id = u.id
  and a.status = 'active'
  and (a.created_at at time zone 'Asia/Tokyo')::date
        = (now() at time zone 'Asia/Tokyo')::date
where u.status = 'active'
group by u.id, u.display_name, u.team_id, t.name;

-- ============================================================
-- HELPER: bcrypt hash / verify
-- ============================================================
create or replace function sp_hash_password(p_password text)
returns text language sql as $$
  select crypt(p_password, gen_salt('bf', 10));
$$;

create or replace function sp_verify_password(p_password text, p_hash text)
returns boolean language sql as $$
  select p_hash = crypt(p_password, p_hash);
$$;

-- ============================================================
-- RPC: login
-- 返り値: session_token, user情報
-- ============================================================
create or replace function sp_login(
  p_login_id text,
  p_password text,
  p_device_name text default null,
  p_platform text default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_user users%rowtype;
  v_token text;
  v_token_hash text;
begin
  select * into v_user from users where login_id = p_login_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_credentials');
  end if;
  if v_user.status <> 'active' then
    return jsonb_build_object('ok', false, 'error', 'account_inactive');
  end if;
  if not sp_verify_password(p_password, v_user.password_hash) then
    return jsonb_build_object('ok', false, 'error', 'invalid_credentials');
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');
  v_token_hash := encode(digest(v_token, 'sha256'), 'hex');

  insert into login_sessions(user_id, token_hash, device_name, platform)
    values (v_user.id, v_token_hash, p_device_name, p_platform);

  update users set last_login_at = now(), last_seen_at = now() where id = v_user.id;

  insert into audit_logs(actor_user_id, action, target_type, target_id, metadata)
    values (v_user.id, 'login', 'user', v_user.id,
            jsonb_build_object('platform', p_platform, 'device', p_device_name));

  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'user', jsonb_build_object(
      'id', v_user.id,
      'login_id', v_user.login_id,
      'display_name', v_user.display_name,
      'team_id', v_user.team_id,
      'role', v_user.role,
      'must_change_password', v_user.must_change_password
    )
  );
end;
$$;

-- ============================================================
-- RPC: verify session token
-- ============================================================
create or replace function sp_verify_session(p_token text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_hash text;
  v_session login_sessions%rowtype;
  v_user users%rowtype;
begin
  if p_token is null or length(p_token) = 0 then
    return jsonb_build_object('ok', false, 'error', 'no_token');
  end if;
  v_hash := encode(digest(p_token, 'sha256'), 'hex');
  select * into v_session from login_sessions
    where token_hash = v_hash and revoked_at is null and expires_at > now();
  if not found then
    return jsonb_build_object('ok', false, 'error', 'invalid_session');
  end if;
  select * into v_user from users where id = v_session.user_id;
  if v_user.status <> 'active' then
    update login_sessions set revoked_at = now() where id = v_session.id;
    return jsonb_build_object('ok', false, 'error', 'account_inactive');
  end if;

  update login_sessions set last_seen_at = now() where id = v_session.id;
  update users set last_seen_at = now() where id = v_user.id;

  return jsonb_build_object(
    'ok', true,
    'user', jsonb_build_object(
      'id', v_user.id,
      'login_id', v_user.login_id,
      'display_name', v_user.display_name,
      'team_id', v_user.team_id,
      'role', v_user.role,
      'must_change_password', v_user.must_change_password
    )
  );
end;
$$;

-- ============================================================
-- RPC: logout
-- ============================================================
create or replace function sp_logout(p_token text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  v_hash := encode(digest(p_token, 'sha256'), 'hex');
  update login_sessions set revoked_at = now() where token_hash = v_hash and revoked_at is null;
  return jsonb_build_object('ok', true);
end;
$$;

-- ============================================================
-- RPC: change password
-- ============================================================
create or replace function sp_change_password(
  p_token text,
  p_old_password text,
  p_new_password text
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_session_res jsonb;
  v_user_id uuid;
  v_user users%rowtype;
begin
  v_session_res := sp_verify_session(p_token);
  if (v_session_res->>'ok')::boolean is not true then
    return v_session_res;
  end if;
  v_user_id := (v_session_res->'user'->>'id')::uuid;
  select * into v_user from users where id = v_user_id;
  if not sp_verify_password(p_old_password, v_user.password_hash) then
    return jsonb_build_object('ok', false, 'error', 'invalid_old_password');
  end if;
  if length(p_new_password) < 8 then
    return jsonb_build_object('ok', false, 'error', 'weak_password');
  end if;
  update users set
    password_hash = sp_hash_password(p_new_password),
    must_change_password = false,
    updated_at = now()
  where id = v_user_id;

  insert into audit_logs(actor_user_id, action, target_type, target_id)
    values (v_user_id, 'password_change', 'user', v_user_id);

  return jsonb_build_object('ok', true);
end;
$$;

-- ============================================================
-- RPC: register appointment + emit notification
-- ============================================================
create or replace function sp_register_appointment(
  p_token text,
  p_company_name text,
  p_appointment_datetime timestamptz,
  p_product_name text,
  p_contact_name text default null,
  p_memo text default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_session_res jsonb;
  v_user users%rowtype;
  v_appt appointments%rowtype;
  v_today_user_count int;
  v_today_team_count int;
  v_team_name text;
  v_title text;
  v_body text;
begin
  v_session_res := sp_verify_session(p_token);
  if (v_session_res->>'ok')::boolean is not true then
    return v_session_res;
  end if;

  select * into v_user from users where id = (v_session_res->'user'->>'id')::uuid;

  if p_company_name is null or length(trim(p_company_name)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'company_required');
  end if;
  if p_product_name is null or length(trim(p_product_name)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'product_required');
  end if;

  insert into appointments(user_id, team_id, company_name, contact_name, appointment_datetime, product_name, memo)
    values (v_user.id, v_user.team_id, trim(p_company_name), nullif(trim(p_contact_name), ''),
            p_appointment_datetime, trim(p_product_name), nullif(trim(p_memo), ''))
    returning * into v_appt;

  -- 集計 (JST基準の今日)
  select count(*) into v_today_user_count from appointments
    where user_id = v_user.id and status = 'active'
      and (created_at at time zone 'Asia/Tokyo')::date
          = (now() at time zone 'Asia/Tokyo')::date;

  if v_user.team_id is not null then
    select t.name into v_team_name from teams t where t.id = v_user.team_id;
    select count(*) into v_today_team_count from appointments
      where team_id = v_user.team_id and status = 'active'
        and (created_at at time zone 'Asia/Tokyo')::date
            = (now() at time zone 'Asia/Tokyo')::date;
  else
    v_team_name := '';
    v_today_team_count := 0;
  end if;

  v_title := '🎉 ' || v_user.display_name || 'さんが1アポ獲得しました！';
  v_body := '本日' || v_today_user_count || '件目'
            || case when v_user.team_id is not null
                    then ' / ' || coalesce(v_team_name,'') || '合計' || v_today_team_count || '件'
                    else '' end;

  insert into notifications(type, title, body, appointment_id, sender_user_id, target_scope, target_team_id)
    values ('appointment_created', v_title, v_body, v_appt.id, v_user.id, 'all', v_user.team_id);

  insert into audit_logs(actor_user_id, action, target_type, target_id, metadata)
    values (v_user.id, 'appointment_create', 'appointment', v_appt.id,
            jsonb_build_object('company', v_appt.company_name, 'product', v_appt.product_name));

  return jsonb_build_object(
    'ok', true,
    'appointment_id', v_appt.id,
    'today_user_count', v_today_user_count,
    'today_team_count', v_today_team_count
  );
end;
$$;

-- ============================================================
-- RPC: 浮きボタン用 ワンクリック即発火（B-1 爆速モード）
-- 詳細は (未入力) で登録し、即通知を発火する
-- ============================================================
create or replace function sp_quick_appointment(p_token text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_session_res jsonb;
  v_user users%rowtype;
  v_appt appointments%rowtype;
  v_today_user_count int;
  v_today_team_count int;
  v_team_name text;
  v_title text;
  v_body text;
begin
  v_session_res := sp_verify_session(p_token);
  if (v_session_res->>'ok')::boolean is not true then
    return v_session_res;
  end if;

  select * into v_user from users where id = (v_session_res->'user'->>'id')::uuid;

  insert into appointments(user_id, team_id, company_name, appointment_datetime, product_name, status)
    values (v_user.id, v_user.team_id, '(未入力)', now(), '(未入力)', 'active')
    returning * into v_appt;

  select count(*) into v_today_user_count from appointments
    where user_id = v_user.id and status = 'active'
      and (created_at at time zone 'Asia/Tokyo')::date
          = (now() at time zone 'Asia/Tokyo')::date;

  if v_user.team_id is not null then
    select t.name into v_team_name from teams t where t.id = v_user.team_id;
    select count(*) into v_today_team_count from appointments
      where team_id = v_user.team_id and status = 'active'
        and (created_at at time zone 'Asia/Tokyo')::date
            = (now() at time zone 'Asia/Tokyo')::date;
  else
    v_team_name := '';
    v_today_team_count := 0;
  end if;

  v_title := '🎉 ' || v_user.display_name || 'さんが1アポ獲得しました！';
  v_body := '本日' || v_today_user_count || '件目'
            || case when v_user.team_id is not null
                    then ' / ' || coalesce(v_team_name,'') || '合計' || v_today_team_count || '件'
                    else '' end;

  insert into notifications(type, title, body, appointment_id, sender_user_id, target_scope, target_team_id)
    values ('appointment_created', v_title, v_body, v_appt.id, v_user.id, 'all', v_user.team_id);

  insert into audit_logs(actor_user_id, action, target_type, target_id, metadata)
    values (v_user.id, 'appointment_create_quick', 'appointment', v_appt.id,
            jsonb_build_object('mode', 'quick'));

  return jsonb_build_object(
    'ok', true,
    'appointment_id', v_appt.id,
    'today_user_count', v_today_user_count,
    'today_team_count', v_today_team_count
  );
end;
$$;

grant execute on function sp_quick_appointment(text) to anon, authenticated;

-- ============================================================
-- RPC: admin: create user
-- ============================================================
create or replace function sp_admin_create_user(
  p_token text,
  p_login_id text,
  p_initial_password text,
  p_display_name text,
  p_team_id uuid default null,
  p_role text default 'sales'
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_session_res jsonb;
  v_actor users%rowtype;
  v_new_id uuid;
begin
  v_session_res := sp_verify_session(p_token);
  if (v_session_res->>'ok')::boolean is not true then return v_session_res; end if;
  select * into v_actor from users where id = (v_session_res->'user'->>'id')::uuid;
  if v_actor.role <> 'admin' then
    return jsonb_build_object('ok', false, 'error', 'forbidden');
  end if;
  if exists(select 1 from users where login_id = p_login_id) then
    return jsonb_build_object('ok', false, 'error', 'login_id_exists');
  end if;
  if length(p_initial_password) < 8 then
    return jsonb_build_object('ok', false, 'error', 'weak_password');
  end if;

  insert into users(login_id, password_hash, display_name, team_id, role, must_change_password)
    values (p_login_id, sp_hash_password(p_initial_password), p_display_name, p_team_id, p_role, true)
    returning id into v_new_id;

  insert into notification_settings(user_id) values (v_new_id);

  insert into audit_logs(actor_user_id, action, target_type, target_id, metadata)
    values (v_actor.id, 'user_create', 'user', v_new_id,
            jsonb_build_object('login_id', p_login_id, 'role', p_role));

  return jsonb_build_object('ok', true, 'user_id', v_new_id);
end;
$$;

-- ============================================================
-- RPC: admin: set user status / reset password / change team
-- ============================================================
create or replace function sp_admin_set_user_status(
  p_token text, p_user_id uuid, p_status text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_session_res jsonb; v_actor users%rowtype;
begin
  v_session_res := sp_verify_session(p_token);
  if (v_session_res->>'ok')::boolean is not true then return v_session_res; end if;
  select * into v_actor from users where id = (v_session_res->'user'->>'id')::uuid;
  if v_actor.role <> 'admin' then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  update users set status = p_status, updated_at = now() where id = p_user_id;
  if p_status <> 'active' then
    update login_sessions set revoked_at = now() where user_id = p_user_id and revoked_at is null;
  end if;
  insert into audit_logs(actor_user_id, action, target_type, target_id, metadata)
    values (v_actor.id, 'user_status_change', 'user', p_user_id, jsonb_build_object('status', p_status));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function sp_admin_reset_password(
  p_token text, p_user_id uuid, p_new_password text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_session_res jsonb; v_actor users%rowtype;
begin
  v_session_res := sp_verify_session(p_token);
  if (v_session_res->>'ok')::boolean is not true then return v_session_res; end if;
  select * into v_actor from users where id = (v_session_res->'user'->>'id')::uuid;
  if v_actor.role <> 'admin' then return jsonb_build_object('ok', false, 'error', 'forbidden'); end if;
  if length(p_new_password) < 8 then return jsonb_build_object('ok', false, 'error', 'weak_password'); end if;
  update users set password_hash = sp_hash_password(p_new_password), must_change_password = true, updated_at = now()
    where id = p_user_id;
  update login_sessions set revoked_at = now() where user_id = p_user_id and revoked_at is null;
  insert into audit_logs(actor_user_id, action, target_type, target_id)
    values (v_actor.id, 'password_reset', 'user', p_user_id);
  return jsonb_build_object('ok', true);
end;
$$;

-- ============================================================
-- RLS  (anon でも安全に読めるデータのみ open / 書き込みは RPC 経由)
-- ============================================================
alter table users enable row level security;
alter table teams enable row level security;
alter table products enable row level security;
alter table appointments enable row level security;
alter table notifications enable row level security;
alter table notification_receipts enable row level security;
alter table notification_settings enable row level security;
alter table login_sessions enable row level security;
alter table audit_logs enable row level security;
alter table app_settings enable row level security;

-- READ ポリシー: anon/authenticated に最低限のデータ閲覧を許す
drop policy if exists users_read on users;
create policy users_read on users for select to anon, authenticated using (true);

drop policy if exists teams_read on teams;
create policy teams_read on teams for select to anon, authenticated using (true);

drop policy if exists products_read on products;
create policy products_read on products for select to anon, authenticated using (is_active);

drop policy if exists appointments_read on appointments;
create policy appointments_read on appointments for select to anon, authenticated using (status = 'active');

drop policy if exists notifications_read on notifications;
create policy notifications_read on notifications for select to anon, authenticated using (true);

-- 書き込みは全てRPC経由を強制（ポリシーを作らない＝拒否）

-- ============================================================
-- REALTIME publication
-- ============================================================
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table appointments;

-- ============================================================
-- updated_at trigger
-- ============================================================
create or replace function sp_touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists trg_touch_users on users;
create trigger trg_touch_users before update on users
  for each row execute function sp_touch_updated_at();

drop trigger if exists trg_touch_teams on teams;
create trigger trg_touch_teams before update on teams
  for each row execute function sp_touch_updated_at();

drop trigger if exists trg_touch_appointments on appointments;
create trigger trg_touch_appointments before update on appointments
  for each row execute function sp_touch_updated_at();
