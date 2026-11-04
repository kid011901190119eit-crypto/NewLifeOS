# dependency-cruiser(依存のグラフの検査)

## それは何か

**dependency-cruiser** は、リポジトリ全体のファイルの import をたどって「依存のグラフ」を作り、そのグラフがルールに合っているかを検査する道具である。グラフを図(dot・mermaid など)として出力することもできる。

## なぜ必要か

ESLint は1ファイルずつ検査するので速いが、グラフ全体を見る必要がある問題は苦手である。代表的なものが**循環依存**(A が B を、B が A を import している状態)で、初期化の順番の問題や、モジュールを分けられなくなる原因になる。

`docs/design/module-system.md` §5.4 では、境界を3つの仕組みで守ると決めている。dependency-cruiser は3つ目の「アーキテクチャテスト」の一部で、§5.2 の依存のルールを ESLint とは**別の道具でもう一度**検査し、さらに循環依存を禁止する。同じルールを2つの道具で書くのは、片方の設定の誤りを、もう片方で見つけるためである。

## このプロジェクトでどう使うか

### 設定

| ファイル | 内容 |
|---|---|
| `packages/config/dependency-cruiser.base.js` | ルールの本体。`createDependencyCruiserConfig()` という関数 |
| `.dependency-cruiser.mjs`(ルート) | 共通のルールを読み込むだけ |

ルールは「禁止する依存」(`forbidden`)として書く。§5.2 の表の1行を1つのルールにして、「この行のファイルが import してよいのは、ここに書いた場所だけ」とする(`pathNot` に許可する場所を並べる)。

- パスは正規表現で書く。`^packages/modules/([^/]+)/` の `()` で取り出したモジュール名を、`$1` として使える。これで「自分のモジュール」を、モジュール名を書かずに表す(§5.4)。
- `tsPreCompilationDeps: true`: `import type` も依存として数える。型だけの import かどうかは `dependencyTypes` に `type-only` として入る。
- `no-circular`: 循環依存を禁止する。1つの循環は、循環の中の1ファイルとして1件だけ報告される。
- `no-unresolvable-workspace-package`: `@lifeos/…` が解決できないときにエラーにする。`@lifeos/core` は `exports` によってビルドの成果物(`dist`)に解決されるので、ビルドの前に実行すると依存が見えなくなり、何も言わずに成功してしまうため。Turborepo の `lint:deps` タスクが core のビルドを待つのも、同じ理由である。
- 検査の出発点は、各パッケージの `src` だけにしている(ルートの `package.json` の `lint:deps`)。ビルドの成果物(`dist`)は、依存の行き先としては見えるが、その中はたどらない(`doNotFollow`)。ソースを消しても `dist` に古いファイルが残ることがあり、それを検査しないため。`exclude` で `dist` を外さないのは、`exclude` すると `dist` への依存そのものが結果から消え、`@lifeos/core` への依存を検査できなくなるためである。
- `packages/config`(開発用の設定の共有)は §5.2 の表の対象外なので、どこから import してもよい。

### テスト

`packages/config/tests/boundaries.depcruise.test.ts` で、ESLint のテストと同じフィクスチャ(`tests/fixtures/repo`)を検査し、検出された違反の一覧が期待どおりであることを確かめている。違反しないファイルが一覧に出てこないことも、同時に確かめている。

### コマンド

- `pnpm lint`: ESLint と一緒に実行される(Turborepo のルートのタスク `//#lint:deps`)
- `pnpm lint:deps`: dependency-cruiser だけを実行する(core を先にビルドしておくこと)
- 依存の図を出したいとき: `pnpm exec depcruise "packages/*/src" "packages/modules/*/src" "apps/*/src" --config .dependency-cruiser.mjs -T mermaid`
