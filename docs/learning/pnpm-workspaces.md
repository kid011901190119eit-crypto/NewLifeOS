# pnpm workspaces(モノレポのパッケージ管理)

## それは何か

**パッケージ**は、`package.json` を持つフォルダのことである。名前、依存関係(使う外部のコード)、実行できるスクリプトを `package.json` に書く。

**パッケージマネージャー**は、`package.json` に書かれた依存関係をインターネット(npm レジストリ)から取ってきて、`node_modules/` に置く道具である。npm、Yarn、pnpm がある。

**モノレポ**は、複数のパッケージを1つのリポジトリにまとめる構成である。**pnpm workspaces** は、モノレポの中の複数のパッケージを、pnpm がまとめて管理する機能である。

pnpm の特徴:

- **速くてディスクを節約する。** 一度ダウンロードしたパッケージは、PC 全体で共有する置き場(ストア)に1つだけ置き、各プロジェクトからはリンクで参照する。
- **厳密である。** `package.json` に書いていない依存関係は import できない。npm では、ほかのパッケージの依存関係がたまたま見えてしまい、書き忘れに気づけないことがある。

## なぜ必要か

- LifeOS は `apps/`(web・api・mcp・worker)と `packages/`(core・db・modules など)の、多数のパッケージで構成する(spec §10.2)。別々のリポジトリにすると、変更を1つのプルリクエストにまとめられず、版を合わせる手間も増える。
- パッケージ同士の依存(`@lifeos/finance` が `@lifeos/core` を使う、など)を、npm に公開せずにリポジトリの中で解決したい。
- 「`package.json` に書いたものしか使えない」という厳密さは、モジュールの境界を守る(ADR 0015)ための1つ目の土台になる。

## このプロジェクトでどう使うか

### ルートの `package.json`

| 項目 | 何のためか |
|---|---|
| `"private": true` | このリポジトリ全体を npm に誤って公開しないようにする |
| `"packageManager": "pnpm@12.16.1"` | 使う pnpm の版を固定する。Corepack(Node.js 付属の、パッケージマネージャーの版を切り替える道具)や Turborepo がこれを読む |
| `"engines": { "node": ">=24 <25" }` | 必要な Node.js の版を宣言する。Node.js 24 系だけを対象にする |
| `"scripts"` | `pnpm test` などで実行するコマンド。中身は `turbo run …` で、実際の実行は Turborepo に任せる([turborepo.md](turborepo.md)) |
| `"devDependencies"` | 開発のときだけ使う依存関係。ルートには turbo だけを置く |

### `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "packages/modules/*"
```

どのフォルダをパッケージとして扱うかを書く。ここに当てはまり、`package.json` を持つフォルダだけがパッケージになる(`.gitkeep` だけのフォルダは無視される)。

### 各パッケージの `package.json`(`packages/core` の例)

| 項目 | 何のためか |
|---|---|
| `"name": "@lifeos/core"` | パッケージの名前。`@lifeos/` は**スコープ**と呼ばれる接頭辞で、このプロジェクトのパッケージであることを示す |
| `"private": true` | このパッケージを npm に公開しない |
| `"type": "module"` | `.js` ファイルを ESM(`import` / `export` を使う、今の JavaScript の標準のモジュール形式)として扱う |
| `"exports"` | パッケージの外に出す入口を限定する。`@lifeos/core` を import すると `dist/index.js` が読まれ、型は `dist/index.d.ts` から取られる。ここに書いていないファイルは外から import できない(module-system.md §5.3) |
| `"scripts"` | `build`・`typecheck`・`test` の中身。Turborepo はこの名前のスクリプトを探して実行する |
| `"devDependencies"` の `"@lifeos/config": "workspace:*"` | `workspace:` は、npm から取ってこずに、リポジトリの中の同じ名前のパッケージを使う、という指定。`node_modules/@lifeos/config` は `packages/config` へのリンクになる |

### `pnpm-lock.yaml`

`pnpm install` が自動で作る。実際にインストールした正確な版をすべて記録する。`package.json` の `^5.1.0` は「5.1.0 以上で 6 未満」という幅のある指定なので、ロックファイルがないと、インストールした日によって版が変わってしまう。**コミットする**。

### よく使うコマンド

- `pnpm install`: すべてのパッケージの依存関係をまとめてインストールする
- `pnpm --filter @lifeos/core <コマンド>`: 1つのパッケージだけで実行する
- `pnpm --filter @lifeos/core add -D <名前>`: そのパッケージに開発用の依存関係を追加する
