# ESLint(コードの静的解析)

## それは何か

**ESLint** は、コードを実行せずに読んで、バグになりやすい書き方やルール違反を見つける道具(静的解析ツール、リンター)である。見つけた問題を「エラー」として報告するので、エディタで書いている最中や、CI で気づける。

検査の中身は「ルール」の集まりで、プラグインを足すとルールが増える。このプロジェクトでは次の3つを使う。

| パッケージ | 役割 |
|---|---|
| `@eslint/js` | JavaScript の基本のルール(未使用の変数など) |
| `typescript-eslint` | TypeScript を読めるようにするパーサーと、TypeScript 向けのルール |
| `eslint-plugin-boundaries` | モジュールの境界のルール([解説](eslint-plugin-boundaries.md)) |

## なぜ必要か

- 型チェック(`tsc`)は「型が合っているか」しか見ない。たとえば `await` を付け忘れた Promise は、型としては正しいので見逃される。ESLint はこうした「型は正しいが、たぶんバグ」を見つける。
- モジュールの境界のルール(`docs/design/module-system.md` §5.2)を、人の注意ではなく機械で守らせるため(ADR 0015)。

## このプロジェクトでどう使うか

### 型情報を使った Lint

`typescript-eslint` の `recommendedTypeChecked` を使っている。ESLint が TypeScript のコンパイラーから型の情報を受け取って検査するので、`no-floating-promises`(await の付け忘れ)のように、型がわからないと判定できないルールが使える。代わりに、型チェックと同じくらいの時間がかかる。

型の情報は、各パッケージの `tsconfig.json` から作る(`projectService`)。`vitest.config.ts` のように tsconfig の `include` に入っていない設定ファイルは、`allowDefaultProject` で別に扱う。型の情報には依存先のパッケージのビルド結果(`dist`)が要るので、Turborepo の `lint` タスクは `^build` を待つ。

### 設定ファイル

| ファイル | 内容 |
|---|---|
| `packages/config/eslint.base.js` | 共通の設定。`createEslintConfig({ packageDir })` という関数で、呼び出し元のパッケージのディレクトリを受け取る |
| `packages/config/eslint-boundaries.js` | 境界のルールの設定(テストからも使うので、分けてある) |
| `packages/core/eslint.config.js` など | 各パッケージの設定。共通の設定を呼ぶだけ |

ESLint 9 から、設定ファイルは `eslint.config.js` という1つの JavaScript ファイルに、設定の配列を書く形(flat config)になった。配列の後ろの設定ほど優先される。

### コマンド

- `pnpm lint`: すべてのパッケージの ESLint と、dependency-cruiser を実行する
- `pnpm --filter @lifeos/core lint`: 1つのパッケージだけ
