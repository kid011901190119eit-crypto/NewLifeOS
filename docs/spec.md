# LifeOS 仕様書(ドラフト v0.1)

> ステータス: **途中**(要件定義・非機能要件・技術選定まで確定。実装ロードマップは [`roadmap.md`](roadmap.md) で確定。家計簿のDB設計は §5 と [`design/finance-data-model.md`](design/finance-data-model.md) で確定。モジュールの仕組みは §4.3 と [`design/module-system.md`](design/module-system.md) で確定)
> 最終更新: 2026-11-04
> この文書は人間とAIコーディングエージェントの両方が読む前提で書かれている。「未確定」と書かれた箇所は、実装前に必ず人間に確認すること。

---

## 0. この文書の位置づけ

- この文書は `docs/spec.md` に置く、プロジェクト全体の仕様書である。
- AIエージェント向けの作業ルールは、リポジトリ直下の `AGENTS.md`(と、それを読み込む `CLAUDE.md`)にまとめてある。作業前に必ずそちらも読むこと。
- 仕様が大きくなったら、`docs/spec/` 以下にモジュールごとのファイルへ分割する。

---

## 1. 概要

### 1.1 主目的:オーナーの学習
**このプロジェクトの最大の目的は、オーナー(開発者本人)が現実の大規模Webアプリ開発を学ぶことである。** アプリが完成すること自体よりも、その過程でオーナーが理解を深めることを優先する。

- 学ぶ対象: コンテナ、デプロイ、CI/CD、Git/GitHubでのチーム開発の流れ、監視、バックアップ、IaC、OAuth、DB設計、TDD
- 個人アプリとしては意図的に構成を作り込む。ただし、**マイクロサービスは採用しない**(モジュラーモノリス)。
- 成果物はポートフォリオとしても使う。

#### エージェントへの影響(必ず守ること)
1. **オーナーが理解できる形で進める。** 1回の作業(1プルリクエスト)は小さく保ち、何をなぜ変えたのかをプルリクエストの説明に日本語で書く。
2. **新しい技術・概念を初めて導入するときは、短い解説を書く。** `docs/learning/` に「それは何か・なぜ必要か・このプロジェクトでどう使うか」をまとめる。
3. **ブラックボックスにしない。** 動けばよいという理由で、オーナーが説明できない複雑な仕組みや過度に巧妙なコードを入れない。同じことができるなら、明示的でわかりやすい方法を選ぶ。ここでいう「わかりやすく」とは、**各部品の中身をシンプルに書くこと**であり、**構成要素の数を減らすことではない**。意図的に作り込んだ構成要素(§8.2・§9)を「個人用には過剰」という理由で削らない(`AGENTS.md`「意図的な作り込み」)。
4. **判断の分かれ目ではオーナーに選ばせる。** 選択肢と、それぞれの利点・欠点を示してから進める。決まった判断はADR(§10.4)に残す。
5. **テストは仕様書として読める形にする。** オーナーはテストを読んで仕様の正しさを確認する。テスト名は日本語で、何を保証するのかがわかるように書く。

### 1.2 アプリとしての目的
LifeOSは、個人の生活管理(家計簿・カレンダーなど)を1つのWebアプリにまとめる**個人専用**のアプリケーションである。

- **エージェントファースト**: ClaudeなどのAIエージェントから、自然文で全モジュールを操作できる。
- **手動UIも完備**: すべての操作は画面からも直接行える。
- **モジュール式**: 機能(モジュール)はいくらでも追加でき、追加しても既存のモジュールやDBに影響を与えない。

### 1.3 利用者
- 利用者は1人(オーナー本人)のみ。アプリとして他者に公開・配布はしない。
- 新規ユーザー登録機能は持たない(無効化する)。

### 1.4 制約
- **費用**: Claude Pro(既存の契約)とドメイン代(.com、年額)以外は課金しない。インフラはすべて無料枠で運用する。
- **エージェント**: 当面はClaude(Proプラン)で動かす。将来、他のエージェントに乗り換えられる設計にする。

---

## 2. スコープ

### 2.1 MVPに含めるもの
| 区分 | 内容 |
|---|---|
| コア | 認証、PWA、エージェント連携(MCP)、変更履歴と取り消し、モジュール登録の仕組み |
| カレンダー | Googleカレンダーの予定の読み取り・登録・編集・削除 |
| 家計簿 | 取引・口座間移動・貸し借り・予定取引・残高・開始残高・入力チェック・各種一覧 |
| 管理画面 | バックアップ状況、インシデント一覧、データエクスポート |

### 2.2 MVPに含めないもの(将来候補)
- 音声メモ、タスク、日記、天気
- 全文検索エンジン(Meilisearch)
- スマホのホーム画面ウィジェット(PWAでは作れないため、将来ネイティブの殻などで検討)
- LifeOS画面内のチャット欄・自動ブリーフ(Claude Agent SDKを使う案。§6.4)
- Notionからのデータ移行スクリプト(**作らない**。完成後に開始残高を手動入力する)
- k3s(Kubernetes)への移行

---

## 3. 機能要件

IDは実装・テスト・Issueで参照する。

### 3.1 コア(CORE)

| ID | 要件 |
|---|---|
| CORE-01 | ログインできる(ID+パスワード、またはGoogleアカウント)。詳細は§6.1 |
| CORE-02 | PWAとしてホーム画面に追加でき、スマホでアプリのように使える。スマホ向けのレイアウトを持つ |
| CORE-03 | ClaudeアプリからMCPコネクタ経由で、各モジュールの操作(ツール)を呼び出せる。詳細は§6.2 |
| CORE-04 | すべての書き込み操作(画面・エージェントとも)の変更履歴を記録し、閲覧・取り消しができる |
| CORE-05 | モジュールは自己紹介形式の定義(マニフェスト)でコアに登録される。詳細は§4.3 |
| CORE-06 | すべての書き込み操作には「作成元」(`user` / `agent`)が記録される |

### 3.2 カレンダー(CAL)

| ID | 要件 |
|---|---|
| CAL-01 | Googleアカウントと連携できる(OAuth。トークンは暗号化して保存し、期限切れ時は自動更新) |
| CAL-02 | 予定を日・週・月の単位で表示できる |
| CAL-03 | 予定を登録・編集・削除できる(Googleカレンダーへ反映) |
| CAL-04 | エージェントから予定の登録と空き時間の確認ができる。重複する予定がある場合は警告する |
| CAL-05 | 予定データの正(マスター)はGoogleカレンダーとし、LifeOS側では永続保存しない(短期キャッシュのみ可) |

### 3.3 家計簿(FIN)

画面での操作感は、現在使っている家計簿(Notion版)と同等にする。裏側は複式簿記で記録する(§5)。

| ID | 要件 |
|---|---|
| FIN-01 | 取引を登録・編集・削除できる。入力項目: 題名、金額、日付、口座、ラベル。収入はプラス、支出はマイナスで入力する |
| FIN-02 | 口座間の移動(チャージ、お釣りなど)を登録できる。「移動先」口座を指定する |
| FIN-03 | 貸し借りを記録できる(ラベル「貸す」「借りる」+相手)。精算も記録できる。相手ごとの未精算額を自動計算する |
| FIN-04 | 未来の日付の取引を「予定」として登録できる。今日までの取引による「確定残高」と、予定を含む「予定込み残高」を分けて表示する |
| FIN-05 | 口座ごとの残高と、全口座の総額を表示する(確定・予定込みの両方) |
| FIN-06 | 口座とラベルを追加・編集できる。口座には「管理単位」(残高の最小単位、円)を設定できる |
| FIN-07 | 開始残高を登録できる。口座ごとの残高と、その時点で未精算の貸し借りを、開始日付で1回だけ入力する |
| FIN-08 | 入力チェックを行い、違反のある取引を「要確認」として扱う(ルールは§3.3.1) |
| FIN-09 | 一覧表示: すべての取引、今月の取引、ラベル別(今月)、これからの予定、未精算の貸し借り、要確認 |
| FIN-10 | エージェントから、取引の登録・照会・集計ができる |

#### 3.3.1 入力チェックのルール(FIN-08)
1. 移動先は、移動元と別の口座であること
2. 移動以外の取引にはラベルが必須
3. 貸し借り(ラベル「貸す」「借りる」)には相手が必須
4. 口座の残高が、その口座の管理単位の倍数であること

#### 3.3.2 初期データについて
- 口座とラベルは利用者が画面から登録する。**実際の口座名・ラベル名・金額をリポジトリ(シード、テスト、ドキュメント)に含めない。**
- 参考までに、現行の家計簿では4つの口座(現金、電子マネー等)と、用途別のラベル(食費など)および「貸す」「借りる」「その他」を使っている。

### 3.4 管理画面(ADM)

| ID | 要件 |
|---|---|
| ADM-01 | バックアップの状況を表示する(最終実行時刻、保持している世代、直近の復元テストの結果) |
| ADM-02 | インシデント一覧を表示する。状態は「発生 → 確認済み → 解決」で管理する |
| ADM-03 | データをCSVでエクスポートできる |
| ADM-04 | 監査ログ(ログインの成功・失敗、重要な操作)を閲覧できる |

---

## 4. アーキテクチャ

### 4.1 全体構成
- **形態**: モジュラーモノリス(1つのコードベース、複数のプロセス)
- **言語**: TypeScriptに統一
- **ホスティング**: Oracle Cloud Always Free(ARM64)上でDocker Composeで運用。将来k3sへ移行する

```
[スマホ・PC(PWA)]   [Claudeアプリ(MCPコネクタ)]
          \              /
           [Cloudflare(DNS・WAF・Tunnel・Access)]
                    |
   ┌──────── Oracle Cloud(Docker Compose)────────┐
   │ [Traefik]                                       │
   │   ├─ web    : React SPA(静的配信)            │
   │   ├─ api    : Hono(REST + OpenAPI)          │
   │   └─ mcp    : MCPサーバー + OAuth認可サーバー │
   │ worker      : BullMQ(定期実行・同期・通知)    │
   │ PostgreSQL / Valkey / pgBackRest                │
   │ OTel Collector / Prometheus / Loki / Tempo      │
   │ Grafana / Alertmanager                          │
   └─────────────────────────────────────────────────┘
   外部: Google(OAuth・カレンダー)、Cloudflare R2(バックアップ)、
         AWS(Lambda による外部死活監視)、Discord(通知)
```

- 外部に公開するのは `web`・`api`・`mcp` のみ。`worker` とデータ層は内部ネットワークのみ。
- AWSは外からLifeOSの生存を確認する側(監視される側と別の事業者に置くため)。

### 4.2 モジュール境界のルール
1. **DBはモジュールごとにPostgreSQLのスキーマで分ける**(例: `core`、`finance`、`calendar`)。マイグレーションもモジュール単位で管理する。
2. **他のモジュールのテーブルを直接読み書きしない。** 連携は次のどちらかで行う。
   - イベント(Transactional Outboxで発行し、ワーカーが配送する)
   - そのモジュールが公開する問い合わせ用インターフェース
3. モジュールは、コアが提供する機能(認証、イベント、ジョブ、通知、監査ログ、エージェントのツール登録)だけに依存する。

### 4.3 モジュールのマニフェスト
> **ステータス: 確定**(Issue #4)。詳細(型定義・登録の流れ・定義例・テストケースの一覧)は [`design/module-system.md`](design/module-system.md) を正とする。判断の経緯は ADR 0014〜0016。

各モジュールは次のような定義を持ち、コアはそれを読み込むだけにする。新しいモジュールの追加は「マニフェストを一覧に登録する」ことで完結させる。

- **マニフェストはサーバー用と画面用の2つ**に分け、同じ `id` で結び付ける(ADR 0014)。画面はブラウザで動くため、サーバーのコードを混ぜない。
- **登録は一覧ファイルに手で書く**(静的な登録)。サーバー側は `packages/registry/src/server.ts`(api・mcp・worker・migrate が共通で読む)、画面側は `apps/web/src/modules.ts`。
- **`id` を接頭辞として強制する**: DBスキーマ `<id>`、API `/api/<id>/...`、画面 `/<id>/...`、ツール `<id>.<name>`、イベント `<id>.<entity>.<verb過去形>`、ジョブ `<id>.<name>`。違反はコアが起動時に検査して止める。
- **処理は「操作」として共通にし**、REST のルートと MCP のツールは、それを呼ぶ薄い入口として別々に書く(ADR 0016)。

```ts
// サーバー用(packages/modules/finance/src/server/index.ts)
export default defineModule({
  id: "finance",
  displayName: "家計簿",
  migrations: { folder: fileURLToPath(new URL("../../migrations", import.meta.url)) },
  routes: financeRoutes,                          // /api/finance に載る
  tools: [addTransactionTool, getBalancesTool /* ... */], // finance.add_transaction など
  events: { emits: [transactionCreated, transactionVoided], listens: [] },
  jobs: [],                                       // { name, schedule?: { cron }, run }
  changeHandlers: { transaction: transactionChangeHandler }, // 変更履歴の取り消し(CORE-04)
});

// 画面用(packages/modules/finance/src/web/index.ts)
export default defineModuleUi({
  id: "finance",
  displayName: "家計簿",
  menu: [{ label: "取引", to: "/finance/transactions", order: 100 }],
  routes: (parent) => /* TanStack Router のルート。ページは遅延読み込み */,
});
```

- マイグレーションはモジュールごとのフォルダ・スキーマ・適用履歴に分け、専用の `migrate` コマンドが `core` を先に、次に一覧の順に適用する。
- コアはモジュールを import しない。変更履歴の取り消しなど、コアの機能にモジュールの協力が必要なときは、モジュールがマニフェストに登録した関数をコアが呼ぶ。
- 境界は、package.json の `exports`、ESLint の境界ルール、アーキテクチャテストの3つで検査する(ADR 0015)。

### 4.4 イベント
- 書き込みと同じDBトランザクションでoutboxテーブルにイベントを記録し、ワーカーが配送する(Transactional Outbox)。
- イベント名は `<module>.<entity>.<verb過去形>` とする(例: `finance.transaction.created`)。
- 受け手は冪等(同じイベントを2回受けても結果が変わらない)に作る。コアが受け手ごとの処理済みのイベントを記録し、2回目の配送では処理しない。
- イベントは名前・版番号・Zod スキーマで定義し、発行時と受信時に中身を検証する。中身の形を変えたら版番号を上げる(ADR 0015)。
- 他のモジュールの読み取りは、そのモジュールの公開用の入口(`@lifeos/<id>/public`)だけを使う。MVPでは公開用の入口は読み取り専用とする(ADR 0015)。

---

## 5. 家計簿のデータ設計

> **ステータス: 確定**(Issue #2)。詳細(ER図・テーブル定義・制約・テストケースの一覧)は [`design/finance-data-model.md`](design/finance-data-model.md) を正とする。判断の経緯は ADR 0010〜0013。

### 5.1 基本方針
- **金額は整数(円)で持つ。** 浮動小数点型は使わない(`bigint`)。
- **複式簿記で記録する。** 1つの取引(transaction)は2行以上の仕訳(posting)を持ち、**仕訳の合計は必ず0になる**。
- **物理削除しない。** 削除は取消フラグ(`voided_at`)、編集は「元の取引を取消して新しい取引で置き換える」で表現する。仕訳は一度書いたら変えない(ADR 0012)。
- **冪等キー**: 書き込みAPIは冪等キーを受け取る。同じキー・同じ内容の再送は最初の結果を返し、同じキーで内容が違えばエラー(409)にする(ADR 0012)。
- **DBの制約でデータを守る**: 外部キー、CHECK制約、仕訳合計0の検証(遅延制約トリガー)、物理削除・書き換えを禁止するトリガー。入力チェック(§3.3.1)はアプリで判定する(ADR 0011)。

### 5.2 勘定の種類
| 種類 | 例 | 対応する画面上の概念 |
|---|---|---|
| asset(資産) | 現金、電子マネー | 口座 |
| expense(費用) | 食費など | 支出のラベル |
| income(収入) | お小遣いなど | 収入のラベル |
| loan(貸し借り) | 相手ごとに1つ。正=貸している、負=借りている | 「貸す」「借りる」+相手 |
| equity(純資産) | 開始残高(システム勘定) | 開始残高 |
| suspense(未分類) | 未分類(システム勘定) | ラベル・相手・移動先のない取引の受け皿 |

ラベルは支出・収入の種別を持つが、金額の符号は自由(支出ラベルに `+` は返金)。「貸す」「借りる」はラベルではなく取引の種別として保存する(ADR 0010・0013)。

### 5.3 画面入力から仕訳への変換規則
開始残高以外は、すべて「**口座側 = 入力金額 x、相手側 = -x**」の1つの公式で変換する(ADR 0010)。

| 操作 | 画面入力 | 仕訳 |
|---|---|---|
| 支出 | 現金、-800、食費 | 現金 -800 / 食費 +800 |
| 収入 | 現金、+1000、お小遣い | 現金 +1000 / お小遣い -1000 |
| 返金 | 現金、+300、食費 | 現金 +300 / 食費 -300 |
| 移動 | 移動元A → 移動先B、x(移動元から見た符号。通常は -x) | A x / B -x |
| 貸す | 口座、-x、貸す、相手 | 口座 -x / 相手 +x |
| 貸しの回収 | 口座、+x、貸す、相手 | 口座 +x / 相手 -x |
| 借りる | 口座、+x、借りる、相手 | 口座 +x / 相手 -x |
| 借りの返済 | 口座、-x、借りる、相手 | 口座 -x / 相手 +x |
| ラベル・相手・移動先なし | (上のいずれか) | 相手側を未分類にする(要確認) |
| 開始残高 | 開始日付、口座ごとの残高、相手ごとの未精算額 | 各口座・各相手 +残高 / 純資産:開始残高 -合計(1つの取引。有効なものは1件だけ) |

- **未精算額** = 相手ごとの `loan` 勘定の残高。0なら精算済み。
- 入力チェック(§3.3.1)に違反する取引も保存し、「要確認」は毎回導出する。「移動先がない移動」はルール1の違反、ルール4は累計残高が管理単位の倍数でなくなった取引を要確認にする(ADR 0011)。
- 全パターンの入力と期待する仕訳の表は [`design/finance-data-model.md` §4.3](design/finance-data-model.md) にある。

### 5.4 テーブル(`finance` スキーマ)
主キーはすべて UUIDv7(ADR 0013)。

- `accounts`: id, kind(上記の種類), name, unit_amount(管理単位。口座以外は1), system_key(システム勘定のみ), archived_at, created_at, updated_at
- `transactions`: id, kind(`regular` / `transfer` / `lend` / `borrow` / `opening`), title, occurred_on(date、Asia/Tokyo基準), memo, created_by(`user`/`agent`), replaces_id(編集で置き換えた元), voided_at, voided_by, created_at
- `postings`: id, transaction_id, account_id, role(`account` = 口座側 / `counter` = 相手側), amount(bigint、0以外), created_at
- `idempotency_keys`: key, operation, request_hash, transaction_id, created_by, created_at
- ビュー `active_postings`: 取消されていない取引の仕訳だけを見せる。集計はすべてこのビューから行う

「予定」と「要確認」は保存せず、日付と仕訳から導出する。残高・未精算額・月次集計は、アプリが Asia/Tokyo で求めた「今日」を引数で渡す集計クエリで求め、残高テーブルは持たない(ADR 0013)。

---

## 6. 認証・エージェント連携

### 6.1 ログイン(学習目的で自前実装。ただし暗号処理は実績のあるライブラリを使う)
- **ID+パスワード**: Argon2idでハッシュ化。流出済みパスワードのチェック(Have I Been Pwned、k-匿名性API)。
- **総当たり対策**: ログイン試行のレート制限と一時ロック(Valkeyで管理)。
- **2要素認証**: TOTP(認証アプリ)。
- **Googleログイン**: OpenID Connect。Authorization Code + PKCE、stateとnonceを検証。
- **セッション**: サーバー側で管理。CookieはHttpOnly・Secure・SameSite。CSRF対策を行う。全セッションの失効ができる。
- **新規登録は無効**。オーナーのアカウントのみ存在する。
- ログインの成功・失敗はすべて監査ログに残す。

### 6.2 エージェント連携(MCP)
- LifeOSは**リモートMCPサーバー**としてツールを公開し、利用者はClaudeアプリ(Proプラン)の**カスタムコネクタ**として接続する。
- Claudeからの接続はAnthropicのサーバー経由で行われるため、MCPサーバーはインターネットに公開する必要がある。そのため認証は必須。
- `mcp` プロセスは**OAuth 2.1の認可サーバー**も兼ねる(PKCE必須、アクセストークンの対象を限定)。
  - **未確定**: 準拠するMCP認可仕様のバージョン。実装時点の最新仕様を確認する。
- MCPはオープン標準なので、将来、他のMCP対応エージェントにもそのまま接続できる。

### 6.3 ツール一覧(案)
| ツール | 内容 | 書き込み |
|---|---|---|
| `finance.add_transaction` | 支出・収入を登録 | ○ |
| `finance.transfer` | 口座間の移動 | ○ |
| `finance.record_loan` / `finance.settle_loan` | 貸し借りの記録・精算 | ○ |
| `finance.get_balances` | 口座別残高と総額(確定・予定込み) | |
| `finance.list_transactions` | 条件付きの取引一覧 | |
| `finance.monthly_summary` | 月次のラベル別集計 | |
| `calendar.list_events` | 予定の一覧 | |
| `calendar.find_free_slots` | 空き時間の検索 | |
| `calendar.create_event` / `update_event` / `delete_event` | 予定の登録・編集・削除 | ○ |
| `core.list_changes` / `core.revert_change` | 変更履歴の確認と取り消し | ○ |

書き込みツールは冪等キーを受け取る。

### 6.4 将来の選択肢(MVP外)
- LifeOS画面内のチャットや定期的な自動処理には、サーバー上でClaude Agent SDKを使う案がある。現時点ではProでログインした状態での利用はサブスクリプションの利用枠から消費されるが、規約が頻繁に変わっているため、エージェント部分は差し替え可能なアダプター層として設計する。

---

## 7. 非機能要件

| 区分 | 要件 |
|---|---|
| 可用性 | 個人用のため、メンテナンス中・障害時の停止は許容する。データを失わないことを最優先にする |
| バックアップ(RPO) | 最大5分前の状態まで戻せる(WALアーカイブによるポイントインタイムリカバリ) |
| バックアップ(RTO) | 1時間以内に復旧できる |
| バックアップの保持 | 日次を30日分、月次を12か月分 |
| バックアップの保管 | 3-2-1ルール。Oracle Object StorageとCloudflare R2の2か所(別事業者)に暗号化して保存 |
| 復元テスト | 週1回、別コンテナへ自動で復元し、件数と残高の一致を検証する。失敗したら通知する |
| 性能 | 画面の表示は1秒以内。エージェントの応答は数秒程度を許容 |
| セキュリティ | §6.1に加え、秘密情報の暗号化保存、外部公開の入口を最小化、依存関係の脆弱性チェックをCIで自動実行 |
| 観測性 | ログ・メトリクス・トレースを集約する。異常はDiscordと管理画面(インシデント一覧)の両方に通知する |
| 外部死活監視 | サーバーの外(AWS Lambda + EventBridge Scheduler)から定期的に生存確認する |
| ドメイン | 独自ドメイン(.com)を使う。ただし設定の切り替えで無料サブドメインでも動作させる(§8.3) |
| 費用 | Claude Proとドメイン代以外は0円 |

### 7.1 アラートの例
バックアップ失敗、復元テスト失敗、ディスク使用率80%超、5xxエラー率の上昇、Google同期の失敗、証明書の期限切れ間近、外部死活監視の失敗。

---

## 8. インフラ

### 8.1 利用サービス(すべて無料枠)
| サービス | 用途 | 注意点 |
|---|---|---|
| Oracle Cloud Always Free | メインサーバー(Ampere A1、ARM64) | 2026年に無料枠が2 OCPU・12GBへ縮小。30日以上アイドルだとアカウント停止の対象 |
| Cloudflare(無料プラン) | DNS、WAF、Tunnel、Access、ドメイン登録(.com) | ドメイン代のみ有料 |
| Cloudflare R2 | バックアップ保管(2か所目) | 無料枠は月10GB |
| AWS | 外部死活監視(Lambda + EventBridge Scheduler) | 常時無料枠の範囲のみ。AWS Budgetsで課金発生時に通知 |
| GitHub | リポジトリ(公開)、Actions、GHCR、Pages | セルフホストランナーは使わない |

### 8.2 コンテナ一覧(Docker Compose)
`traefik`、`cloudflared`、`web`、`api`、`mcp`、`worker`、`postgres`、`valkey`、`pgbackrest`、`otel-collector`、`prometheus`、`loki`、`tempo`、`grafana`、`alertmanager`

- すべてARM64のイメージでビルドする。
- ステージング環境は同じVM上に別系統として立てる。

### 8.3 入口の切り替え
環境変数で入口の方式を切り替える。アプリのコードにはドメイン名を直接書かない。

- `INGRESS_MODE=cloudflare_tunnel`: 独自ドメイン。Cloudflare Tunnel経由で公開し、Cloudflareの機能をフルに使う。
- `INGRESS_MODE=direct_acme`: 無料サブドメイン(DuckDNSなど)。TraefikがLet's Encryptで証明書を取得する。Cloudflare固有の保護がない分、アプリ側のレート制限で補う。

---

## 9. 技術スタック

| 層 | 技術 |
|---|---|
| 画面 | React、Vite、TanStack Router / Query、Tailwind CSS、shadcn/ui、Recharts、vite-plugin-pwa |
| アプリ | TypeScript、Node.js、Hono、Zod、OpenAPI(仕様から画面側の型付きクライアントを生成)、MCP TypeScript SDK、BullMQ |
| データ | PostgreSQL、Drizzle ORM、Valkey(Redis互換)、Transactional Outbox |
| 認証 | Argon2(@node-rs/argon2)、Arctic(Google OAuth)、jose(JWT)、otpauth(TOTP) |
| 入口 | Cloudflare、Traefik、Let's Encrypt |
| 観測性 | OpenTelemetry、Prometheus、Loki、Tempo、Grafana、Alertmanager |
| バックアップ | pgBackRest、Oracle Object Storage、Cloudflare R2 |
| 外部連携 | Google Calendar API、AWS Lambda、EventBridge Scheduler、Discord Webhook |
| テスト | Vitest(ユニット)、Testcontainers(本物のPostgreSQLを使う結合テスト)、Playwright(E2E) |
| 開発基盤 | pnpm workspaces、Turborepo、ESLint、Prettier、commitlint |
| CI/CD | GitHub Actions、GHCR、Docker Buildx(ARM64)、release-please、Renovate、CodeQL、Trivy、cosign |
| インフラ管理 | OpenTofu(Oracle・Cloudflare・AWS)、SOPS + age(秘密情報の暗号化) |
| 将来 | k3s、Argo CD、Meilisearch |

---

## 10. 開発プロセス

### 10.1 TDD
- 1サイクル = Red → Green → Refactor。
- 家計簿のドメインロジック(仕訳の変換規則、残高計算、入力チェック)は、**ユニットテストで網羅する**(目標カバレッジ90%以上)。
- DBの制約(仕訳合計0など)は、Testcontainersで本物のPostgreSQLを使ってテストする。
- 主要な利用シナリオ(ログイン、取引登録、残高確認)はPlaywrightでE2Eテストする。

### 10.2 リポジトリ構成(案)
```
apps/       web / api / mcp / worker / migrate
packages/   core / modules/finance / modules/calendar / registry / db / ui / config
infra/      opentofu/(oracle / cloudflare / aws)
deploy/     compose/ / k8s/(将来)
docs/       spec.md(この文書) / adr/ / runbooks/ / design/ / learning/(導入した技術の解説)
AGENTS.md   AIエージェント向けの作業ルール(エージェント共通)
CLAUDE.md   Claude Code用。AGENTS.md を読み込む
.github/    workflows / ISSUE_TEMPLATE / pull_request_template.md / CODEOWNERS
```

### 10.3 GitHubの運用
- GitHub Organization(無料)の下に公開リポジトリを置く。
- Issue → ブランチ → プルリクエスト → CI → マージ。mainへの直接プッシュは禁止(ルールセットで強制)。
- 必須チェック: Lint、型チェック、テスト、ビルド、CodeQL、Trivy。
- release-pleaseでバージョンタグとCHANGELOGを自動生成。
- GitHub Environments(staging / production)。本番へのデプロイには承認ステップを挟む。
- SBOMの生成、ビルドの出所証明(attestation)、cosignによるイメージ署名(OIDCを使った鍵なし方式)。
- GitHubのシークレット・OIDCで秘密情報を管理し、シークレットスキャンとプッシュ保護を有効にする。
- GitHub Pagesでドキュメント(設計資料、ADR、API仕様)を公開する。
- README、CONTRIBUTING、SECURITY、LICENSE、CHANGELOGを用意する。

### 10.4 ADR(設計判断の記録)
`docs/adr/` に記録する。現時点で決まっている判断は次のとおり。

| # | 判断 |
|---|---|
| 0001 | マイクロサービスは採用せず、モジュラーモノリスにする |
| 0002 | ホスティングはOracle Cloud Always Free(Vercelから変更) |
| 0003 | 画面はReact SPA(Next.jsから変更)、APIはHonoで分離する |
| 0004 | 家計簿は複式簿記で記録する |
| 0005 | エージェント連携はMCPコネクタ方式(Claude Proで動かす) |
| 0006 | 認証はID+パスワードとGoogle OAuthを自前実装する(学習目的) |
| 0007 | AWSは常時無料枠の範囲で外部死活監視にのみ使う |
| 0008 | 開発はTDDで進める |
| 0009 | プロジェクトの主目的はオーナーの学習とし、完成速度より理解を優先する |
| 0010 | 家計簿の仕訳ルール(移動は移動元の符号、ラベルは支出・収入の種別を持つ、貸し借りは相手ごとに1勘定) |
| 0011 | 入力チェックに違反する取引も保存し(未分類勘定)、「要確認」は導出する |
| 0012 | 取引は取消フラグと置き換えで変更し、冪等キーは専用テーブルで管理する |
| 0013 | 家計簿のIDはUUIDv7、残高は基準日を渡す集計クエリ、取引の種別を保存、開始残高は1取引 |
| 0014 | モジュールのマニフェストをサーバー用と画面用に分け、一覧ファイルで静的に登録する |
| 0015 | モジュール間の連携は公開用の入口とZodで定義したイベントで行い、境界を3つの仕組みで検査する |
| 0016 | 処理は「操作」として共通にし、RESTのルートとMCPのツールは別々の薄い入口として書く |
| 0017 | TypeScript は当面 6 系を使う(typescript-eslint が 7 系に未対応のため。7 系への移行は周辺ツールの対応後に判断する) |
| 0018 | Lint と整形の方針(境界のルールは ESLint と dependency-cruiser で別々に定義し、同じフィクスチャで食い違いがないことをテストする。型情報を使った Lint を行う) |

---

## 11. 未確定事項

- [x] 家計簿のER図とテーブル定義の確定(§5)→ [`docs/design/finance-data-model.md`](design/finance-data-model.md)
- [x] 移動の金額の符号規則、収入ラベルの扱い(§5.3)→ ADR 0010
- [x] `defineModule` の型とUIの動的登録の方法(§4.3)→ [`docs/design/module-system.md`](design/module-system.md)、ADR 0014〜0016
- [ ] 準拠するMCP認可仕様のバージョン(§6.2)
- [ ] カレンダーの変更履歴と取り消し(CORE-04 と CAL-05 の両立。フェーズ9で決める)→ [`design/module-system.md` §9](design/module-system.md)
- [x] 実装ロードマップ(作る順番)→ [`docs/roadmap.md`](roadmap.md)
- [ ] ドメイン名
- [ ] Oracle Cloudのホームリージョン(後から変更できない。ARMの空き容量も考慮)
- [ ] PWAのプッシュ通知の範囲
- [ ] k3sへの移行時期
