# NewLifeOS

個人用のライフマネジメントWebアプリ「LifeOS」の開発リポジトリです。

> **ステータス:** フェーズ2(土台とCI)に着手。モノレポの骨組みとテストの仕組みまで完了

## これは何か

- 家計簿・カレンダーなどの生活管理を、1つのWebアプリにまとめる個人専用のアプリケーションです。
- ClaudeなどのAIエージェントから、自然文で操作できる「エージェントファースト」の設計です(MCPコネクタ経由)。
- **このプロジェクトの主目的は、開発者本人が現実の大規模Webアプリ開発を学ぶことです。** そのため、個人アプリとしては意図的に構成を作り込んでいます(コンテナ、監視、バックアップ、IaC、CI/CDなど)。

## ドキュメント

| 文書 | 内容 |
|---|---|
| [`docs/spec.md`](docs/spec.md) | 仕様書(機能要件・非機能要件・アーキテクチャ・技術スタック) |
| [`docs/roadmap.md`](docs/roadmap.md) | 実装ロードマップ(作る順番と各フェーズの完了の条件) |
| [`docs/design/`](docs/design/) | 詳細設計(例: [家計簿のデータモデル](docs/design/finance-data-model.md)、[モジュールの仕組み](docs/design/module-system.md)) |
| [`docs/adr/`](docs/adr/) | 設計判断の記録(ADR) |
| [`docs/learning/`](docs/learning/) | 導入した技術の解説(学習ノート) |
| [`docs/runbooks/`](docs/runbooks/) | 障害対応の手順書 |
| [`AGENTS.md`](AGENTS.md) | AIコーディングエージェント向けの作業ルール |

## リポジトリ構成

```
apps/       実行されるアプリ(web / api / mcp / worker)
packages/   アプリが共有する部品(core / db / ui / config / modules / registry)
infra/      インフラのコード(OpenTofu)
deploy/     デプロイ設定(Docker Compose、将来のk8s)
docs/       仕様書・ADR・学習ノート・手順書
.github/    CI/CD、Issue・プルリクエストのテンプレート
```

## 開発の始め方

Node.js 24 と pnpm 12 が必要です。リポジトリのルートで次を実行します。

```sh
pnpm install     # 依存関係のインストール
pnpm test        # すべてのテスト
pnpm typecheck   # すべての型チェック
pnpm build       # すべてのビルド
pnpm lint        # すべての Lint(ESLint と dependency-cruiser)
pnpm format:check  # 整形が必要なファイルの確認
```

プルリクエストと main へのプッシュでは、GitHub Actions(`.github/workflows/ci.yml`)が同じチェック(Lint・整形・型チェック・テスト・ビルド)を自動で実行します。プルリクエストのタイトルは、`.github/workflows/pr-title.yml` が commitlint で Conventional Commits の形式かどうかを検査します(書き方は [`CONTRIBUTING.md`](CONTRIBUTING.md))。

脆弱性は、CodeQL(`.github/workflows/codeql.yml`、自分たちのコード)と Trivy(`.github/workflows/trivy.yml`、依存関係)で、プルリクエストごとと毎週検査します。依存関係の更新は、Renovate(`renovate.json`)が毎週プルリクエストとして提案します。詳しくは学習ノートの [CodeQL](docs/learning/codeql.md)・[Trivy](docs/learning/trivy.md)・[Renovate](docs/learning/renovate.md) を参照してください。

手元で PostgreSQL と Valkey を動かすには Docker Desktop が必要です。最初に `deploy/compose/.env.example` を `deploy/compose/.env` に複製し、`pnpm db:up` で起動します(停止は `pnpm db:down`)。詳しくは学習ノートの [Docker](docs/learning/docker.md)・[Docker Compose](docs/learning/docker-compose.md) を参照してください。

ほかのコマンドは [`AGENTS.md`「よく使うコマンド」](AGENTS.md#よく使うコマンド) を参照してください。

## 技術スタック(予定)

TypeScript / React / Hono / PostgreSQL / Valkey / Docker Compose / Oracle Cloud / Cloudflare / OpenTelemetry / Grafana / GitHub Actions / OpenTofu

詳細は [`docs/spec.md` §9](docs/spec.md) を参照してください。

## ライセンス

[MIT](LICENSE)
