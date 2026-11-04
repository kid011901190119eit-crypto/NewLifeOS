# eslint-plugin-boundaries(モジュールの境界の検査)

## それは何か

**eslint-plugin-boundaries** は、「どのファイルが、どのファイルを import してよいか」というアーキテクチャのルールを、ESLint のルールとして検査するプラグインである。ルールに違反した import を書くと、その行が ESLint のエラーになる。

設定は2段階で書く。

1. **要素(element)**: ファイルの場所から「種類」を決める。例: `packages/modules/*/src/web` の下のファイルは `module-web`。
2. **ポリシー(policy)**: 種類と種類の間で、import を許可するか禁止するかを決める。例: `module-web` から `ui` は許可。

## なぜ必要か

- モジュールの境界のルール(`docs/design/module-system.md` §5.2)を守るため(ADR 0015)。たとえば、モジュールの画面のコードがサーバーのコードを import すると、ブラウザに DB のコードが入ってしまう。
- ESLint の一部として動くので、エディタで書いている最中に気づける。境界を守る3つの仕組み(`exports`・ESLint・アーキテクチャテスト)のうち、いちばん早く気づける仕組みである。

## このプロジェクトでどう使うか

設定は `packages/config/eslint-boundaries.js` にある。

### 要素

| 種類 | 場所 |
|---|---|
| `core` / `core-web` | `packages/core` / その中の `src/web`(`dist/web`) |
| `db`・`ui`・`registry` | `packages/db`・`packages/ui`・`packages/registry` |
| `module-server`・`module-operations`・`module-domain`・`module-public`・`module-db`・`module-web` | `packages/modules/*/src/<それぞれ>` |
| `module` | `packages/modules/*` のそれ以外のファイル |
| `app-server` / `app-web` | `apps/api`・`apps/mcp`・`apps/worker` / `apps/web` |

モジュール名(`finance` など)は設定に書かない(§5.4)。`*` の部分を `capture: ["moduleId"]` で取り出し、ポリシーの中で `{{ from.element.captured.moduleId }}` として使う。これで「自分のモジュールの中は自由に import してよい」を、モジュール名を書かずに表せる。カレンダーを足しても、この設定は変わらない。

### ポリシー

- `default: "disallow"`: ポリシーで許可していない import は、すべて禁止する(許可リスト方式)。表に書き忘れた依存は、エラーになって気づける。
- 複数のポリシーに当てはまるときは、**後に書いたもの**が優先される。そのため「モジュールの web は自分のモジュールを import してよい」の後に、「ただし server・db は禁止」を書いている。
- `dependency: { kind: "type" }`: `import type` だけを許可する。モジュールの web から他のモジュールの public は、型だけ使ってよい(§5.2)。
- `checkAllOrigins: true`: 外部のライブラリへの依存も検査する。既定ではローカルのファイルだけを見るので、これがないと「web から Hono は禁止」「domain は Zod だけ」を検査できない。

### import の解決

`@lifeos/finance/public` のような import が、どのファイルを指すのかを知るために、`eslint-import-resolver-typescript` を使う。プラグインが標準で使う仕組みは、package.json の `exports` と、TypeScript の `.js` と書いて実体は `.ts` という書き方を理解できないため。

### テスト

`packages/config/tests/boundaries.eslint.test.ts` で、テスト専用の小さなリポジトリ(`tests/fixtures/repo`、架空のモジュール `alpha`・`beta`)に設定を当てて、違反するファイルはエラーになり、違反しないファイルはエラーにならないことを確かめている。ルールを変えたら、このテストで確かめる。
