# ORM と Drizzle(TypeScript から DB のテーブルを扱う)

## それは何か

**ORM**(Object-Relational Mapping)は、DB のテーブルを、プログラムの言葉(TypeScript の型や関数)で扱えるようにする道具である。SQL の文字列を手で組み立てる代わりに、テーブルの定義から型がつき、列の名前を間違えると型チェックで気づける。

**Drizzle ORM** は TypeScript 用の ORM で、次の2つのパッケージからなる。

| パッケージ | 役割 | いつ動くか |
|---|---|---|
| `drizzle-orm` | テーブルの定義(`pgSchema`・`pgTable` など)、問い合わせ、マイグレーションの適用(`migrate`) | アプリの実行時 |
| `drizzle-kit` | テーブルの定義を読み、前回との差分からマイグレーションの SQL を生成する(`drizzle-kit generate`) | 開発者が手で実行するとき |

| 用語 | 意味 |
|---|---|
| スキーマ(PostgreSQL) | DB の中の「区画」。`core.__migrations` の `core` の部分。モジュールごとに1つ持つ(spec §4.2) |
| `pgSchema("finance")` | Drizzle で、PostgreSQL のスキーマを表すもの。この下にテーブルを作る |
| `drizzle.config.ts` | `drizzle-kit` の設定。どのファイルのテーブル定義を読み、どこに SQL を出力するか |
| `schemaFilter` | `drizzle-kit` が見るスキーマを絞る設定。自分のスキーマ以外を差分に含めないため |
| ドライバ(`pg`) | Node.js から PostgreSQL に接続する部品。Drizzle はこれの上で動く(`drizzle-orm/node-postgres`) |

## なぜ必要か

- **テーブルの定義を1か所にまとめ、型と SQL をそろえるため。** `src/db/schema.ts` に書いた定義から、問い合わせの型と、マイグレーションの SQL の両方が作られる。
- **SQL に近い書き方で、中身が見えるため。** Drizzle は生成する SQL が素直で、マイグレーションも普通の SQL ファイルとして残る。何が DB に流れるかを読める(AGENTS.md ルール8「ブラックボックスにしない」)。
- **モジュールごとにスキーマを分けやすいため。** `pgSchema` と `schemaFilter` で、モジュールが自分のスキーマだけを扱える(module-system.md §4.4)。

## このプロジェクトでどう使うか

### ファイルの置き場所

| ファイル | 役割 |
|---|---|
| `packages/core/src/db/schema.ts` | `pgSchema("core")`。core のテーブルはこの下に作る |
| `packages/modules/finance/src/db/schema.ts` | `pgSchema("finance")`。家計簿のテーブルはフェーズ4でこの下に足す |
| `packages/core/drizzle.config.ts`・`packages/modules/finance/drizzle.config.ts` | `schemaFilter` で自分のスキーマだけを見て、`migrations/` に SQL を出力する |

### マイグレーションの SQL の作り方

```sh
cd packages/modules/finance
pnpm exec drizzle-kit generate --name <変更の名前>   # migrations/ に SQL と meta/ ができる
```

- 生成された SQL は、コミットする前に必ず読む。
- **各モジュールの最初のマイグレーションだけは、手で直す。** 生成された `CREATE SCHEMA "finance";` を `CREATE SCHEMA IF NOT EXISTS "finance";` にする。理由は [マイグレーション](database-migrations.md) の「気をつけること」と ADR 0027 にある。直し忘れは `apps/migrate/src/first-migration.test.ts` で検出する。
- `migrations/meta/` は drizzle-kit が差分を計算するための記録で、drizzle-kit が自分の形式で書き直す。Prettier の対象から外している(`.prettierignore`)。
- `drizzle-kit migrate`(drizzle-kit からの適用)は使わない。適用は `pnpm db:migrate` で行う。

### 版

`drizzle-orm` 0.45 と `drizzle-kit` 0.31(安定版)を使う。1.0 は、マイグレーションのフォルダの形式が変わる。正式版が出たら、Renovate の提案を見て移行を決める(ADR 0027)。
