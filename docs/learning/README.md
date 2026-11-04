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
