# 開発の進め方

このプロジェクトは個人開発ですが、学習のために実際のチーム開発に近い流れで進めます。AIコーディングエージェントは、これに加えて [`AGENTS.md`](AGENTS.md) のルールに従います。

## 作業の流れ

1. **Issueを作る**: 何をするのかを書く(テンプレートあり)。
2. **ブランチを切る**: `main` から作業用のブランチを作る。名前は `feat/finance-transfer` のように「種類/内容」にする(機械では検査しない)。
3. **TDDで実装する**: テストを先に書き、通る実装を書き、整理する。
4. **プルリクエストを出す**: テンプレートに沿って、何をなぜ変えたのかを書く。
5. **CIが通ったらマージする**: `main` には直接コミットしない。

## コミットメッセージ

[Conventional Commits](https://www.conventionalcommits.org/ja/v1.0.0/) 形式で、`<種類>(<範囲>): <説明>` と書きます。範囲は省略できます。

例: `feat(finance): 口座間移動の仕訳ルールを追加`

main へは Squash and merge でマージするので、**main に残るのはプルリクエストのタイトル**です。プルリクエストのタイトルは、CI の `pr-title` ジョブ(commitlint)で検査され、形式に合わないとマージできません。作業ブランチの個々のコミットは検査しませんが、同じ形式で書きます。

| 種類 | 使う場面 |
|---|---|
| `feat` | 機能の追加 |
| `fix` | バグの修正 |
| `docs` | ドキュメントのみの変更 |
| `test` | テストの追加・修正 |
| `refactor` | 動作を変えないコードの整理 |
| `perf` | 性能の改善 |
| `style` | 動作に影響しない見た目の変更(空白・整形など) |
| `build` | ビルドの仕組み・依存関係の変更 |
| `ci` | CI の設定の変更 |
| `revert` | 以前のコミットの取り消し |
| `chore` | 上記のどれにも当てはまらないもの |

範囲は次の一覧から選びます(設定は [`packages/config/commitlint.config.js`](packages/config/commitlint.config.js))。

| 範囲 | 対象 |
|---|---|
| `repo` | リポジトリ全体(ルートの設定、ドキュメント全般など) |
| `config` | `packages/config`(共通の設定) |
| `deps` | 依存関係の更新 |
| `core`・`db`・`ui` | `packages/` の各パッケージ |
| `finance`・`calendar` | `packages/modules/` の各モジュール |
| `api`・`web`・`mcp`・`worker` | `apps/` の各アプリ |

互換性を壊す変更は、`feat(core)!: …` のように `!` を付けます。手元で形式を確かめるには、`printf '%s\n' '<メッセージ>' | pnpm --filter @lifeos/config exec commitlint --verbose` を実行します。

## 設計判断を変えるとき

重要な判断は [`docs/adr/`](docs/adr/) にADRとして残します。過去の判断を変えるときは、元のADRを書き換えず、新しいADRを作って「置き換え」として記録します。
