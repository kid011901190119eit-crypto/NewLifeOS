# 学習ノート

このプロジェクトで新しい技術や概念を導入するたびに、ここに解説を1ファイルずつ追加します。積み上がっていくと、このプロジェクト専用の教科書になります。

## 書き方

ファイル名は `docker.md`、`transactional-outbox.md` のように、技術や概念の名前にします。各ファイルには次の3点を書きます。

1. **それは何か**: 一言でいうと何で、どんな問題を解決するのか
2. **なぜ必要か**: このプロジェクトで、それがないと何に困るのか
3. **このプロジェクトでどう使うか**: どのファイル・どの場面で使っているのか

## 一覧

- [複式簿記の仕訳と遅延制約](double-entry-bookkeeping.md)
- [モジュールの登録と境界](module-registration-and-boundaries.md)
- [pnpm workspaces(モノレポのパッケージ管理)](pnpm-workspaces.md)
- [Turborepo(タスクの実行とキャッシュ)](turborepo.md)
- [TypeScript の設定(tsconfig)](tsconfig.md)
- [Vitest(テストの実行)](vitest.md)
- [ESLint(コードの静的解析)](eslint.md)
- [Prettier(コードの整形)](prettier.md)
- [eslint-plugin-boundaries(モジュールの境界の検査)](eslint-plugin-boundaries.md)
- [dependency-cruiser(依存のグラフの検査)](dependency-cruiser.md)
- [GitHub Actions(CI の自動実行)](github-actions.md)
- [commitlint と Conventional Commits(コミットメッセージの形式の検査)](commitlint.md)
- [CodeQL(自分たちのコードの脆弱性の検査)](codeql.md)
- [Trivy(依存関係の脆弱性の検査)](trivy.md)
- [Renovate(依存関係の更新の自動提案)](renovate.md)
- [Docker(イメージ・コンテナ・ボリューム)](docker.md)
- [Docker Compose(複数のコンテナをまとめて動かす)](docker-compose.md)
- [Claude Code のカスタムスラッシュコマンド(`/issue`・`/start`・`/review-issue`)](claude-code-commands.md)
- [Orca のワークツリーの準備(orca.yaml と .worktreeinclude)](orca-worktree-setup.md)
- [Orca のオーケストレーション(複数のエージェントに分担させる)](orca-orchestration.md)
- [Testcontainers(テストのたびに使い捨てのコンテナを立てる)](testcontainers.md)
- [ORM と Drizzle(TypeScript から DB のテーブルを扱う)](orm-and-drizzle.md)
- [マイグレーション(DB の構造の変更を、順番つきのファイルで残す)](database-migrations.md)
