# Sales Pulse  -- アポ獲得リアルタイム通知アプリ

> 営業マンがアポを獲得した瞬間、全社員のPCに通知を出して、組織のモチベーションを上げるためのデスクトップアプリです。

- **対応OS**: Windows / macOS
- **技術スタック**: Electron + React (Vite) + Tailwind CSS + Supabase (PostgreSQL + Realtime)
- **常駐**: タスクトレイ (Win) / メニューバー (Mac)。閉じても終了せず通知を受け取り続けます。
- **配布**: `.exe` (NSIS) / `.dmg`

---

## クイックスタート (開発環境)

```bash
# 1. 依存をインストール
cd sales-pulse
npm install

# 2. Supabase接続情報を設定
cp .env.example .env
# .env を編集して VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を入れる

# 3. 開発起動 (ViteとElectronを同時起動)
npm run dev
```

ログイン画面で `admin / Admin1234!` を入力すると管理者画面に入れます。

---

## Supabase セットアップ手順 (管理者向け)

1. [Supabase](https://supabase.com) で新規プロジェクトを作成 (リージョンは東京推奨)
2. プロジェクト設定 → API から、`Project URL` と `anon public key` をコピー
3. Studio の SQL Editor で以下を順番に実行:
   - `supabase/schema.sql`
   - `supabase/seed.sql`
4. Database → Replication → `supabase_realtime` publication に `notifications` と `appointments` が含まれているか確認 (schema.sqlで自動追加されます)
5. プロジェクトルートに `.env` を作成し以下を設定:
   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGci...
   ```

### 初期アカウント

| 表示名     | ログインID | 初期パスワード   | 権限     | チーム   |
|-----------|------------|------------------|----------|---------|
| 管理者    | `admin`    | `Admin1234!`     | admin    | -       |
| 山田太郎  | `yamada`   | `Yamada1234!`    | sales    | Aチーム |
| 佐藤花子  | `sato`     | `Sato1234!`      | sales    | Aチーム |
| 田中健    | `tanaka`   | `Tanaka1234!`    | sales    | Bチーム |

本番運用前にパスワードを必ず変更してください。

---

## 営業マン向け 導入手順

1. 管理者から共有された Sales Pulse インストーラ (`.dmg` または `.exe`) を開く
2. インストール → 起動
3. 管理者から共有された **ログインID / 初期パスワード** を入力
4. 通知の許可を求められたら「許可」
5. 次回以降は **PC起動時に自動で立ち上がり、ログイン状態も維持** されます
6. アポを獲得したら、ホーム画面の `＋ アポ獲得を登録` ボタンを押して入力するだけ

> アプリを「✕」で閉じても、タスクトレイ / メニューバーで常駐し続け通知を受け取ります。完全に終了したい場合はトレイメニューから「完全終了」を選んでください。

---

## ビルド (本番配布物の作成)

```bash
# 共通: フロントのビルド
npm run build:vite

# Mac (.dmg)
npm run build:mac

# Windows (.exe)
npm run build:win
```

成果物は `release/` ディレクトリに出力されます。
- macOS: `Sales Pulse-x.y.z.dmg`
- Windows: `Sales Pulse Setup x.y.z.exe`

### コード署名

MVP段階ではコード署名を入れていないため、初回起動時に以下の警告が出ます:
- **Windows**: 「Windows によって PC が保護されました」 → 詳細情報 → 実行
- **macOS**: 「開発元を確認できないため開けません」 → システム設定 → セキュリティ → 「このまま開く」

本番配布の前には必ずコード署名を導入してください。

- **Windows**: コードサイニング証明書 (OV/EV) を購入し、`electron-builder` の `win.certificateFile` 等で署名
- **macOS**: Apple Developer Program (年額 99 USD) に加入 → Developer ID 証明書を作成 → `osxSign` + `osxNotarize` の設定

---

## 自動アップデート (将来導入)

`electron-updater` を使った自動更新を想定済みです。

導入手順 (MVP後):

1. `npm install electron-updater`
2. `electron/main.cjs` に以下を追加:
   ```js
   const { autoUpdater } = require('electron-updater');
   app.whenReady().then(() => {
     autoUpdater.checkForUpdatesAndNotify();
   });
   ```
3. `package.json` の `build.publish` に GitHub Releases 等を設定:
   ```json
   "publish": [{ "provider": "github", "owner": "your-org", "repo": "sales-pulse" }]
   ```
4. `electron-builder --publish always` でリリース

理想のUX:
- アプリ起動時 / 終了時に裏で更新確認
- 更新があれば「新しいバージョンがあります。再起動して更新しますか?」を表示
- 社内ツールのため「次回起動時に自動更新」でもOK

---

## ディレクトリ構成

```
sales-pulse/
├── electron/
│   ├── main.cjs           # Electronメインプロセス (Tray, AutoLaunch, OS通知, IPC)
│   └── preload.cjs        # contextBridge で安全にAPIを公開
├── src/
│   ├── main.jsx           # Reactエントリ
│   ├── App.jsx            # ルーティング
│   ├── styles.css         # Tailwind + カスタム
│   ├── lib/
│   │   ├── supabase.js    # Supabaseクライアント
│   │   ├── auth.js        # 独自ログイン (login, verifySession, logout, changePassword)
│   │   ├── api.js         # アポ登録、ユーザー管理、集計取得
│   │   ├── realtime.js    # notifications 購読
│   │   └── ipc.js         # Electron IPC のラッパ (ブラウザフォールバック付)
│   ├── hooks/
│   │   ├── useAuth.jsx
│   │   ├── useToast.jsx
│   │   └── useRealtime.jsx
│   ├── components/
│   │   └── Layout.jsx     # サイドバー + 接続状態表示
│   └── pages/
│       ├── Login.jsx
│       ├── ChangePassword.jsx
│       ├── Home.jsx               # 大ボタン + 集計 + ランキング
│       ├── AppointmentNew.jsx     # アポ登録
│       ├── History.jsx
│       ├── Ranking.jsx
│       ├── Notifications.jsx
│       ├── Settings.jsx
│       └── admin/
│           ├── Dashboard.jsx
│           ├── Users.jsx
│           └── Appointments.jsx
├── supabase/
│   ├── schema.sql         # 全テーブル + RPC + RLS + Realtime publication
│   └── seed.sql           # 初期データ (admin / 営業3名 / チーム / 商材)
├── build/                 # アイコン等の配置場所
├── .env.example
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

---

## 設計のポイント

### 認証 (独自ログイン)
- 会社メールアドレスがない前提なので、`ログインID + パスワード` 方式を独自実装。
- パスワードは `pgcrypto` の `crypt(password, gen_salt('bf'))` (= bcrypt) でハッシュ化。**平文保存はしません**。
- ログインRPC `sp_login` がランダムトークンを発行し、`login_sessions` テーブルにはトークンの `sha256` ハッシュのみ保存。
- セッショントークンはクライアント側で **keytar** (Windows Credential Manager / macOS Keychain) に保存。keytar が使えない環境では `electron-store` にフォールバックします。
- 起動時に `sp_verify_session` で検証 → 失効・停止アカウントは即座にローカルトークンを削除。

### リアルタイム通知
- アポ登録 RPC (`sp_register_appointment`) が `notifications` テーブルに行を INSERT。
- 全クライアントは Supabase Realtime で `notifications` テーブルの INSERT を購読。
- INSERT を受け取ったら:
  1. アプリ内トースト通知 (`useToast`) を表示
  2. Electronの `Notification` API で OS標準通知を発火
  3. 通知履歴に追加
- **二重通知防止**: クライアントローカルに `Set<notification_id>` を持ち、重複イベントを破棄。
- **接続状態の可視化**: `useRealtime` フックが `online / connecting / reconnecting / offline` を判定し、サイドバー下部に常時表示。

### 常駐
- `mainWindow.on('close')` で `preventDefault()` + `hide()`。完全終了は Tray メニューから。
- Tray アイコンから「通知ON/OFF」「自動起動」「ログアウト」「完全終了」を操作可能。
- 自動起動は `auto-launch` で実装。設定変更時に即時反映。

### セキュリティ
- **書き込み系操作は全て `SECURITY DEFINER` の RPC 経由** にして、anon クライアントから直接 INSERT/UPDATE できない設計にしています。
- 読み取り系は RLS で `select` だけ開放 (営業マンが他人のアポ件数を見るのは仕様上必要)。個人情報は通知本文に出していません。
- **管理者操作 (ユーザー作成・停止・パスワードリセット) は RPC 内で `role = admin` チェック** を必ず行います。
- アカウント停止時に `login_sessions` を即時 revoke (= 強制ログアウト)。
- 監査ログ (`audit_logs`) に ログイン / アポ作成 / ユーザー作成 / 停止 / パスワード変更 を記録。

---

## 動作確認チェックリスト

開発時に以下を確認してください。

- [ ] `admin / Admin1234!` でログインできる
- [ ] 管理者画面から営業マンを追加できる (発行IDと初期パスワードが表示される)
- [ ] 別ユーザーで `yamada / Yamada1234!` 等でログインできる
- [ ] 初回ログイン後、アプリを再起動してもログイン状態が維持されている
- [ ] ホーム画面の `＋ アポ獲得を登録` ボタンが大きく中央に表示される
- [ ] アポを登録すると、別の端末/別のユーザーセッションに即座にOS通知が届く
- [ ] アプリ内トースト通知も同時に表示される
- [ ] 通知履歴ページに通知が残る
- [ ] 今日のランキングが即時更新される
- [ ] アプリを閉じてもタスクトレイ/メニューバーに常駐する
- [ ] トレイから再表示・完全終了ができる
- [ ] 設定ページで 自動起動 / 通知 ON/OFF が変更できる
- [ ] ネット切断時にサイドバーが「オフライン」表示になる
- [ ] 停止されたユーザーはログインできない / セッションが切れる

---

## 既知の制約 & 今後の改善点

### MVP段階の制約
- ランキングは「今日 (個人)」のみ。週間・月間・チームランキングは未実装。
- 通知文テンプレートはハードコード。管理者画面からの編集は未実装。
- 連続獲得 (streak) 通知、チーム目標達成通知は未実装 (DBスキーマは対応済み)。
- アポ編集・削除UIは未実装。誤登録時は管理者が SQL で修正してください。
- オフライン時の一時保存 (= 復帰時に再送) は未実装。
- 商材マスタの管理UIは未実装 (SQL で直接編集)。

### 本番運用前にやるべきこと
1. 初期パスワードを全員変更
2. コード署名 (Windows / macOS)
3. Supabase RLS の最終レビュー (anon に対する SELECT 範囲を再検討)
4. Supabase のレート制限 / バックアップ設定
5. 自動アップデートチャネルの構築 (GitHub Releases or 自社サーバー)
6. アイコン (`build/icon.png`, `build/tray.png`) の差し替え (512x512 推奨)
7. `electron-store` フォールバック時のトークン暗号化 (現在は平文保存)
8. 監査ログの可視化UI

### 将来の機能拡張 (MVP後)
- チーム別通知 (target_scope=team)
- 通知文テンプレート編集
- チーム目標達成 / 連続獲得 / ランキング更新 通知
- 詳細ランキング (週/月/チーム)
- CSV出力 (アポ・ユーザー)
- 監査ログUI
- アポ編集/削除 + 管理者承認フロー
- 商材マスタ管理
- オフライン時の一時保存 → 再送
- 月次レポート

---

## トラブルシュート

| 症状 | 原因 / 対処 |
|------|------|
| ログイン画面に「Supabaseの接続情報が未設定です」と出る | `.env` が無い、もしくは値が空。`.env.example` を参考に設定。 |
| ログインを試すと `Failed to fetch` | `VITE_SUPABASE_URL` の値が間違っているか、ネット接続不可。 |
| `sp_login` が `invalid_credentials` を返す | パスワードが違うか、ユーザーが `suspended/retired` 状態。 |
| OS通知が出ない | macOSは「システム設定 → 通知」で許可確認。Windowsは「集中モード」がONになっていないか確認。 |
| 別端末で通知が来ない | Supabase Realtime publication に `notifications` が含まれているか確認。`alter publication supabase_realtime add table notifications;` を実行。 |
| Mac でビルドした `.dmg` が「開発元未確認」で開けない | コード署名が必要。一時的には Ctrl+クリック → 開く。 |

---

## ライセンス

社内利用を想定した非公開プロダクトです。
