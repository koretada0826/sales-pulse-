# Sales Pulse — プロジェクト状態スナップショット

> 最終更新: 2026-05-20
> このファイルは「次回続きから再開する」ための申し送りです。
> **「続きから」と言われたら、まずこのファイルを読み込むこと。**

## 🆕 直近の変更（2026-05-20）
- **浮きボタンに「✕（非表示）」ボタンを追加**: 浮きボタン左上に小さな ✕ を配置。クリックすると設定が OFF になり浮きボタンが消える。再表示は **設定ページ** または **タスクトレイ／メニューバーのメニュー** から ON にする。
  - 変更ファイル: `electron/float.html` / `electron/main.cjs` / `electron/preload-float.cjs`
  - 新IPC: `float:dismiss`（main側で `store.set('floatingButtonEnabled', false)` → `applyFloatVisibility()` → `refreshTrayMenu()`）
  - コミット: `558d741`（GitHubへプッシュ済み ✅）

## 🗒 1つ前の変更（2026-05-15）
- **音が鳴らない問題を修正**: ブラウザの自動再生制限が原因だった。最初のクリック/キー操作で AudioContext を解錠する処理を `useRealtime.jsx` に追加。
- **通知音をリッチに**: チャイム（鐘）＋アルペジオ（C-E-G-C↑）＋仕上げのディン、に変更。
- **ドロップダウン式お祝いバナー追加**: `src/components/CelebrateBanner.jsx`。他人がアポ獲得すると上から大バナーがスッと降りてくる（4秒で消える）。
- **浮きボタン（B-1 爆速モード）追加**: 他アプリ作業中も画面隅に「＋」が浮く。1クリックで `sp_quick_appointment` RPCを叩いて即通知発火。会社名・日時・商材は「(未入力)」で登録され、あとから追記する想定。
  - 設定 / トレイメニュー / の両方からON/OFF可能。
  - 位置はドラッグで変更可、`electron-store` の `floatPos` に保存。
  - main側で `fetch` を使うため Supabase URL/anonKey をレンダラからIPC `app:configure-supabase` で渡している。

## ⚠️ 次回開発前にやること（最優先）
**Supabase ダッシュボードで `supabase/schema.sql` の `sp_quick_appointment` を実行する**（CREATE OR REPLACE なので既存への影響なし）。これをやらないと浮きボタンを押した時に `http_404` エラーになる。

## 📌 リポジトリ状態（2026-05-20 時点）
- ブランチ: `main`
- 最新コミット: `558d741 feat: 浮きボタンに×（非表示）ボタンを追加`
- リモート: `origin/main` と完全に同期済み（push 完了）
- 未コミットの変更: なし（working tree clean）

---

## 🎯 プロダクト概要

営業会社向けの **アポ獲得リアルタイム通知デスクトップアプリ**。
営業マンがホームの大ボタンを押してアポ登録すると、**全社員のPCに即座にOS通知＋アプリ内トースト＋通知音** が飛ぶ。
PC起動中はタスクトレイ/メニューバーに常駐し続け、通知を受け取り続ける。

---

## ✅ 完成している機能 (MVP)

| 機能 | 状態 |
|---|---|
| 独自ログイン (ログインID + パスワード, bcrypt) | ✅ |
| ログイン状態維持 (keytar/electron-store フォールバック) | ✅ |
| 初回パスワード変更フロー | ✅ |
| ホーム画面 (大ボタン + 今日の集計 + ランキング + 直近通知) | ✅ |
| アポ獲得登録モーダル (会社/日時/商材 + 任意項目) | ✅ |
| Supabase Realtime で全クライアントに即時通知配信 | ✅ |
| OS標準通知 (Windows右下/Mac右上) | ✅ |
| アプリ内トースト通知 (お祝いカラー) | ✅ |
| 通知音 (Web Audio で ドミソ♪ 3音アルペジオを合成) | ✅ |
| 通知履歴一覧 | ✅ |
| 今日の個人ランキング | ✅ |
| アポ履歴 (個人 / 全社) | ✅ |
| 接続状態表示 (online/reconnecting/offline) | ✅ |
| タスクトレイ/メニューバー常駐 (ウィンドウを閉じても終了しない) | ✅ |
| 自動起動設定 (auto-launch) | ✅ |
| 管理者: ダッシュボード | ✅ |
| 管理者: 営業マン追加 (ID/初期パスワード発行 + 表示してコピー) | ✅ |
| 管理者: ステータス変更 (active/suspended) | ✅ |
| 管理者: パスワードリセット | ✅ |
| 管理者: アポ履歴 (全社) + CSV出力 | ✅ |
| 監査ログ (audit_logs) | ✅ (記録のみ、UIは未) |

---

## ❌ 未実装 (MVP後の予定)

- 週間 / 月間 / チーム別ランキング
- 通知文テンプレート編集UI
- チーム目標達成通知 (🏆)
- 連続獲得通知 (🔥 streak)
- アポの編集 / 削除 (営業マン側 / 管理者側)
- 商材マスタ管理UI (今はSQLで直接編集)
- オフライン時の一時保存 → 復帰時に再送
- 監査ログの可視化UI
- 自動アップデート (electron-updater) の組み込み
- コード署名 (Windows / macOS)
- アプリアイコン (`build/icon.png` / `build/tray.png` は未配置、本番では差し替え必須)

---

## 🧱 技術構成

- **デスクトップ**: Electron 32 + Vite 5 + React 18
- **UI**: Tailwind CSS (ダークネイビー + ブルー/パープル/ゴールド)
- **DB / Realtime**: Supabase (PostgreSQL + Realtime channel)
- **認証**: 独自RPC (`sp_login` / `sp_verify_session` / `sp_logout` / `sp_change_password`)
- **常駐**: Tray (Electron) + auto-launch
- **トークン保存**: keytar (Win Credential Manager / macOS Keychain) → 失敗時 `electron-store` にフォールバック
- **パスワード**: pgcrypto の bcrypt (`$2a$10$...`)
- **ローカル開発ポート**: **5273** (5173 が他で使われていたため変更済み)

---

## 🌐 Supabase プロジェクト情報

- プロジェクト名: `sales-pulse`
- リージョン: `ap-northeast-1` (東京)
- Project Ref: `vujwenxvijyyralikgpc`
- URL: `https://vujwenxvijyyralikgpc.supabase.co`
- anon key は `.env` に記載 (このファイルにはコミットしない)
- Realtime publication: `notifications`, `appointments` 含む

---

## 👤 テストアカウント

| 役割 | ログインID | パスワード | チーム |
|---|---|---|---|
| 管理者 | `admin` | `Admin1234!` | - |
| 営業 | `yamada` | `Yamada1234!` | Aチーム |
| 営業 | `sato` | `Sato1234!` | Aチーム |
| 営業 | `tanaka` | `Tanaka1234!` | Bチーム |

**本番運用前に必ず変更**。

---

## 🚀 ローカルでの起動方法

```bash
cd sales-pulse
# 初回のみ
npm install
# .env を作成 (.env.example をコピーして VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY を埋める)

# 起動 (Vite + Electron が同時起動。ブラウザでテストしたい場合は http://localhost:5273)
npm run dev
```

---

## 📦 配布 (Windows / Mac)

```bash
npm run build:mac   # Sales Pulse-x.y.z.dmg を release/ に生成
npm run build:win   # Sales Pulse Setup x.y.z.exe を release/ に生成
```

社内配布: Slack / Google Drive / 共有フォルダで `.exe` または `.dmg` を共有。
初回起動時は署名なしの警告が出るが「詳細→実行」で進める。

---

## 🐛 これまでに直したバグ・つまずき

1. **`function crypt(text, text) does not exist`** ← Supabase の pgcrypto が `extensions` スキーマにあるため。`sp_hash_password` / `sp_verify_password` 等の search_path に `extensions` を追加 + パスワードを再ハッシュ済み。
2. **ポート 5173 が他のアプリと衝突** → Sales Pulse 側を **5273** に変更 (`vite.config.js`, `package.json`, `electron/main.cjs`)。
3. **通知音が鳴らない** → OS通知に依存せず、Web Audio API で `useRealtime.jsx` 内に `playCelebrateSound()` を実装して鳴らすように修正。
4. **JST 日付判定のミス** → `(created_at at time zone 'Asia/Tokyo')::date` と `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' })` で統一。

---

## 🗂 ディレクトリ構成 (主要)

```
sales-pulse/
├── electron/
│   ├── main.cjs           # Tray / AutoLaunch / OS通知 / IPC / keytar
│   └── preload.cjs        # contextBridge で安全にAPI公開
├── src/
│   ├── App.jsx            # ルーティング (HashRouter)
│   ├── components/Layout.jsx
│   ├── pages/             # Login / Home / AppointmentNew / History / Ranking / Notifications / Settings / ChangePassword
│   ├── pages/admin/       # Dashboard / Users / Appointments
│   ├── lib/               # supabase.js / auth.js / api.js / realtime.js / ipc.js
│   └── hooks/             # useAuth / useToast / useRealtime
├── supabase/
│   ├── schema.sql         # テーブル / RLS / RPC / Realtime publication
│   └── seed.sql           # admin / 営業3名 / チーム / 商材
├── PROJECT_STATE.md       # ← このファイル
├── README.md
└── package.json
```

---

## 🔁 次にやる候補 (優先度順)

### A. Windows 用 .exe をビルドして社員に配布
- `npm run build:win` を Mac から実行 (クロスビルド)
- 失敗するなら Docker `electronuserland/builder:wine` で試す
- 1人だけ Windows 社員に渡してテスト → OKなら全員配布

### B. 管理者画面に「テストデータ全消去」ボタンを追加
- 本番稼働日にワンクリックでアポ・通知をリセットできるように
- 追加するRPC: `sp_admin_reset_data(p_token text)`

### C. 自動アップデート (electron-updater) を組み込む
- GitHub Releases を配信元にする
- `package.json` に `build.publish` を追加
- main.cjs で `autoUpdater.checkForUpdatesAndNotify()`

### D. 週間 / 月間 / チーム別ランキング
- ビューを `v_weekly_ranking` / `v_monthly_ranking` / `v_team_ranking` で追加
- ランキングページにタブ切り替えを追加

### E. アプリアイコンの差し替え
- `build/icon.png` (512x512) / `build/tray.png` (16x16, 32x32) を会社ロゴに

---

## 🔑 「続き」の合言葉

次回会話で **「Sales Pulse の続き」** と言えば、私はこのファイルと自分のメモリを読み込んで、ここから即座に再開します。
