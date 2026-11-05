# ADR(設計判断の記録)

ADR(Architecture Decision Record)は、「何を・なぜ決めたのか」を1件1ファイルで残す記録です。後から「なぜこうなっているのか」を確認できるようにします。

## ルール

- 新しいADRは [`0000-template.md`](0000-template.md) をコピーし、次の番号を振って作ります。
- 一度「承認」したADRは書き換えません。判断を変えるときは新しいADRを作り、古いADRのステータスを「置き換え済み(→ 新しい番号)」にします。

## 一覧

| # | タイトル | ステータス |
|---|---|---|
| [0001](0001-modular-monolith.md) | マイクロサービスではなくモジュラーモノリスにする | 承認 |
| [0002](0002-hosting-oracle-cloud.md) | ホスティングはOracle Cloud Always Freeにする | 承認 |
| [0003](0003-react-spa-and-hono.md) | 画面はReact SPA、APIはHonoで分離する | 承認 |
| [0004](0004-double-entry-bookkeeping.md) | 家計簿は複式簿記で記録する | 承認 |
| [0005](0005-agent-via-mcp-connector.md) | エージェント連携はMCPコネクタ方式にする | 承認 |
| [0006](0006-self-implemented-auth.md) | 認証はID+パスワードとGoogle OAuthを自前実装する | 承認 |
| [0007](0007-aws-for-external-monitoring.md) | AWSは外部死活監視にのみ使う | 承認 |
| [0008](0008-tdd.md) | 開発はTDDで進める | 承認 |
| [0009](0009-learning-first.md) | 主目的はオーナーの学習とし、理解を優先する | 承認 |
| [0010](0010-finance-journal-rules.md) | 家計簿の仕訳ルール(移動の符号・収入ラベル・貸し借り) | 承認 |
| [0011](0011-finance-needs-review.md) | 入力チェックに違反する取引も保存し、「要確認」は導出する | 承認 |
| [0012](0012-finance-immutability-and-idempotency.md) | 取引は取消フラグと置き換えで変更し、冪等キーは専用テーブルで管理する | 承認 |
| [0013](0013-finance-table-details.md) | 家計簿のテーブル設計の細部(ID・集計・取引の種別・開始残高) | 承認 |
| [0014](0014-module-manifest-and-registration.md) | モジュールのマニフェストをサーバー用と画面用に分け、一覧ファイルで静的に登録する | 承認 |
| [0015](0015-module-collaboration-and-boundaries.md) | モジュール間の連携は公開用の入口とZodで定義したイベントで行い、境界を3つの仕組みで検査する | 承認 |
| [0016](0016-operations-routes-and-tools.md) | 処理は「操作」として共通にし、RESTのルートとMCPのツールは別々の薄い入口として書く | 承認 |
| [0017](0017-typescript-6.md) | TypeScript は当面 6 系を使う(typescript-eslint が 7 系に未対応のため) | 承認 |
| [0018](0018-lint-and-formatting.md) | Lint と整形の方針(境界のルールは ESLint と dependency-cruiser で別々に定義し同じフィクスチャでテストする、型情報を使った Lint) | 承認 |
| [0019](0019-clean-dist-before-build.md) | ビルドの前に dist を Node 標準の fs.rmSync で消し、Turborepo の clean タスクを build の前に実行する | 承認 |
| [0020](0020-commitlint-and-pr-title.md) | commitlint でプルリクエストのタイトルを検査し、Squash の既定のタイトルをプルリクエストのタイトルにする | 承認 |
| [0021](0021-security-scans-and-renovate.md) | CodeQL・Trivy で脆弱性を検査し(Trivy は公式イメージを digest で固定)、Renovate で依存関係の更新を週1回提案させる | 承認 |
| [0022](0022-local-postgres-and-valkey.md) | ローカル開発用に PostgreSQL 18.6 と Valkey 9.1.3 を Docker Compose で動かす(digest で固定、名前付きボリューム、Valkey は AOF、ポートは 127.0.0.1 のみ) | 承認 |
| [0023](0023-issue-workflow-and-worktree-setup.md) | Issue の標準の手順は AGENTS.md に1か所でまとめ、ワークツリーの準備は orca.yaml と .worktreeinclude で自動にする | 承認 |
| [0024](0024-coordinator-implementer-reviewer.md) | 指揮役・実装役・レビュー役に分け、Orca のオーケストレーションで Issue を半自動で進める | 承認 |
| [0025](0025-integration-tests-with-testcontainers.md) | 結合テストは Testcontainers で使い捨ての PostgreSQL を立て、`pnpm test:integration` で分けて実行する(イメージは compose.yaml から読む、Ryuk も digest で固定) | 承認 |
| [0026](0026-db-ui-core-web-boundaries.md) | db・ui はいちばん下の層にし(外部のライブラリと自分の中だけを import する)、コアのサーバー側と core/web はお互いを import しない | 承認 |
