# Turborepo(タスクの実行とキャッシュ)

## それは何か

**Turborepo** は、モノレポの中の各パッケージのスクリプト(`build`、`test` など。Turborepo では**タスク**と呼ぶ)を、正しい順番で、できるだけ並列に、結果を再利用しながら実行する道具である。コマンド名は `turbo`。

- **順番**: `@lifeos/finance` のテストの前に、それが使う `@lifeos/core` をビルドしておく、といった依存関係の順を守る。
- **並列**: 互いに依存しないタスクは同時に実行する。
- **キャッシュ**: タスクの入力(ソースコード、設定、依存関係の版など)が前回と同じなら、実行せずに前回の結果(ログと出力ファイル)を再生する。

## なぜ必要か

- pnpm だけでも `pnpm -r test`(全パッケージで test を実行)はできる。しかし、「依存先を先にビルドする」という順番の管理や、変更のないパッケージを飛ばす仕組みはない。
- パッケージが増えるほど、毎回すべてを実行すると遅くなる。CI(フェーズ2の後半)でも、変更のない部分を飛ばせると待ち時間が短くなる。

## このプロジェクトでどう使うか

ルートの `pnpm test` は `turbo run test` を実行する。Turborepo は、`pnpm-workspace.yaml` に書かれたパッケージのうち、`test` スクリプトを持つものを探して実行する。

### `turbo.json`

```json
{
  "tasks": {
    "clean": { "cache": false },
    "build": { "dependsOn": ["^build", "clean"], "outputs": ["dist/**"] },
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] }
  }
}
```

| 項目 | 何のためか |
|---|---|
| `$schema` | エディタで項目の補完と検査を効かせるための、設定ファイルの形の定義 |
| `tasks` | Turborepo が知っているタスクの一覧。ここに書いた名前のスクリプトを、各パッケージで実行する |
| `dependsOn: ["^build"]` | `^` は「自分が依存しているパッケージの」という意味。たとえば将来 `@lifeos/finance` の `test` を実行する前に、依存先の `@lifeos/core` の `build` を済ませる。`@lifeos/core` の `exports` は `dist/` を指しているので、ビルドしないと型も中身も見つからないためである |
| `outputs: ["dist/**"]` | タスクが作るファイル。キャッシュから再生するとき、このファイルも復元する。`test` と `typecheck` はファイルを作らないので書かない(ログだけを再生する) |

### Lint と整形のタスク(Issue #8 で追加)

- `lint`: 各パッケージの ESLint。型情報を使うので、`test` と同じく `^build` を待つ。
- `//#lint:deps`・`//#prettier:check`・`//#prettier:write`: `//#` は「ルートの package.json のスクリプト」という意味。dependency-cruiser と Prettier はリポジトリ全体を一度に見る道具なので、パッケージごとではなくルートで1回だけ実行する。どのファイルが入力なのかを Turborepo が判定しにくいので、キャッシュは使わない(`cache: false`)。
- `//#lint:deps` は `@lifeos/core#build` を待つ。`@lifeos/core` は `dist` に解決されるので、ビルドの前だと依存が見えないため。
- ルートの `pnpm lint` は `turbo run lint lint:deps` を実行する。ルートのスクリプトと同じ名前のタスクを turbo に実行させると、自分自身を呼び出し続ける(再帰する)ので、`pnpm format:check` は別の名前のタスク `prettier:check` を呼ぶ。

### キャッシュの確かめ方

`pnpm build` を2回続けて実行すると、2回目は `cache hit, replaying logs` と表示され、`FULL TURBO` で一瞬で終わる。キャッシュは `.turbo/` に置かれる(`.gitignore` 済み)。

### ビルドの前に dist を消す(Issue #10 で追加)

- `tsc` は `dist/` を掃除しないので、消したソースの古い出力が残る。そこで build スクリプトを `pnpm run clean && tsc ...` にした。`clean` は `node -e "require('node:fs').rmSync('dist', { recursive: true, force: true })"`(Node 標準の機能でフォルダを中身ごと消す。`force` はフォルダがなくてもエラーにしない指定)。
- ただし、**キャッシュから復元するときは build スクリプトが実行されない**。しかも復元は `outputs` のファイルを上書きするだけで、`dist/` にある余分なファイルは消さない。
- そこで `turbo.json` に `clean` タスク(`cache: false` で毎回実行)を作り、build の `dependsOn` に入れた。`^` が付かない `"clean"` は「同じパッケージの clean」という意味。これで、キャッシュを復元する前に必ず `dist/` が空になる。
- 判断の経緯は [ADR 0019](../adr/0019-clean-dist-before-build.md)。

### このPRで決めていないこと

- リモートキャッシュ(CI と手元でキャッシュを共有する仕組み)は使わない。必要になったら提案する。
