-- ============================================================
-- Sales Pulse 初期データ
-- ============================================================

-- チーム
insert into teams(name, daily_target) values
  ('Aチーム', 10),
  ('Bチーム', 8),
  ('Cチーム', 6)
on conflict (name) do nothing;

-- 商材
insert into products(name) values
  ('採用支援'),
  ('Web制作'),
  ('広告運用'),
  ('コンサルティング')
on conflict (name) do nothing;

-- 管理者
insert into users(login_id, password_hash, display_name, role, status, must_change_password)
values ('admin', sp_hash_password('Admin1234!'), '管理者', 'admin', 'active', false)
on conflict (login_id) do nothing;

-- 営業マン
insert into users(login_id, password_hash, display_name, team_id, role, status, must_change_password)
values
  ('yamada', sp_hash_password('Yamada1234!'), '山田太郎',
    (select id from teams where name='Aチーム'), 'sales', 'active', false),
  ('sato',   sp_hash_password('Sato1234!'),   '佐藤花子',
    (select id from teams where name='Aチーム'), 'sales', 'active', false),
  ('tanaka', sp_hash_password('Tanaka1234!'), '田中健',
    (select id from teams where name='Bチーム'), 'sales', 'active', false)
on conflict (login_id) do nothing;

-- 通知設定（全ユーザー初期化）
insert into notification_settings(user_id)
select id from users where id not in (select user_id from notification_settings)
on conflict do nothing;

-- アプリ全体設定
insert into app_settings(key, value) values
  ('notification_target_scope', '"all"'::jsonb),
  ('show_ranking', 'true'::jsonb),
  ('show_team_count', 'true'::jsonb)
on conflict (key) do nothing;
