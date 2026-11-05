# マイグレーション(DB の構造の変更を、順番つきのファイルで残す)

## それは何か

**マイグレーション**は、DB の構造の変更(スキーマやテーブルを作る、列を足す、など)を、番号順の SQL ファイルとして残す仕組みである。どの DB にどこまで適用したかを**適用履歴**のテーブルに記録し、まだ適用していないファイルだけを、順番に流す。

| 用語 | 意味 |
|---|---|
| マイグレーション | 1回分の変更の SQL ファイル。例: `migrations/0000_init.sql` |
| 適用(migrate) | まだ適用していないマイグレーションを DB に流すこと |
| 適用履歴(`__migrations`) | 適用したマイグレーションの記録。このプロジェクトでは、各スキーマの中に持つ(`core.__migrations`・`finance.__migrations`) |
| `meta/_journal.json` | drizzle-kit が書く、マイグレーションの一覧と順番。Drizzle の適用の仕組みはこれを読む |
| トランザクション | 複数の SQL を「全部成功するか、全部なかったことになるか」にまとめる仕組み |

## なぜ必要か

- **手元・CI・本番の DB を、同じ手順で同じ構造にするため。** 手で SQL を流すと、どこまで流したかが DB ごとにばらばらになる。
- **変更の歴史を Git で読めるようにするため。** いつ・なぜテーブルが変わったかが、ファイルとコミットに残る。
- **モジュールを足しても、既存のモジュールに触れないため。** 履歴をスキーマごとに分けているので、カレンダーを足しても家計簿の履歴は変わらない(module-system.md §4.4、§8.3 のテスト)。

## このプロジェクトでどう使うか

### 全体の流れ

```
pnpm db:migrate
  └ apps/migrate          DATABASE_URL を読み、適用する順番を決める
      ├ core              最初に必ず適用する(@lifeos/core の coreMigrations)
      └ serverModules     packages/registry の一覧の順(今は finance だけ)
          └ packages/db   migrateSchemas: スキーマごとに Drizzle の migrate を呼ぶ
```

| ファイル | 役割 |
|---|---|
| `packages/db/src/migrate/migrate-schemas.ts` | スキーマ名とフォルダの一覧を受け取り、順に適用する。モジュールの名前は知らない(db はいちばん下の層。ADR 0026) |
| `packages/registry/src/server.ts` | サーバー側のモジュールの一覧。並び順が適用の順になる |
| `apps/migrate/src/plan.ts` | core を先頭に、一覧の順に並べる |
| `apps/migrate/src/main.ts` | コマンドの入口。結果を表示し、失敗したら終了コード1で止まる |

api・mcp・worker は、起動時にマイグレーションを適用しない。複数のプロセスが同時に適用してぶつかるのを避けるためである。`@lifeos/db/migrate` を import できるのは `apps/migrate` だけで、ESLint と dependency-cruiser で検査している。

### 実行のしかた

```sh
pnpm db:up        # 手元の PostgreSQL を起動する
pnpm db:migrate   # ビルドしてから、core と各モジュールのマイグレーションを適用する
```

接続先は環境変数 `DATABASE_URL` で渡す。手元では `deploy/compose/.env` を Node.js の `--env-file-if-exists` で読む。`.env.example` の `DATABASE_URL` は `POSTGRES_*` と同じ値にしておく(ずれるとテストが失敗する)。本番での呼び方はフェーズ7で決める。

### 気をつけること(Drizzle の適用の仕組みの動き)

Drizzle の `migrate` は、次の順に動く(`drizzle-orm` 0.45 のソースと結合テストで確かめた)。

1. 履歴の置き場所のスキーマを `CREATE SCHEMA IF NOT EXISTS` で作り、`__migrations` テーブルを作る。**ここはトランザクションの外。**
2. 履歴のうち最後の行の `created_at` より新しいマイグレーション(`_journal.json` の `when` で比べる)を、**1つのトランザクションの中で**順に流し、履歴に1行ずつ足す。

このため、次のことが起きる。

- **最初のマイグレーションの `CREATE SCHEMA "finance";` は「もうある」で失敗する。** 1でスキーマが先にできているため。各モジュールの最初のマイグレーションは `CREATE SCHEMA IF NOT EXISTS` に手で直す(ADR 0027)。
- **途中で失敗すると、マイグレーションの中身と履歴の行は残らない。** ただし、1で作った空のスキーマと空の `__migrations` は残る。
- **未適用かどうかは、ファイルの内容ではなく `when`(生成した時刻)で決まる。** 適用済みのマイグレーションのファイルを書き換えても、もう1度は流れない。変更は新しいマイグレーションとして足す。
