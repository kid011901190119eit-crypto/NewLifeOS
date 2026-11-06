# DB の制約とビュー(CHECK・外部キー・UNIQUE・部分UNIQUE インデックス・ビュー)

## それは何か

**制約**(constraint)は、「この表には、こういう行しか入れてはいけない」という決まりを、DB 自身に覚えさせる仕組みである。決まりに合わない INSERT や UPDATE は、DB がエラーにして拒否する。

| 制約 | 守ること | 家計簿での例 | 違反したときのエラーコード(SQLSTATE) |
|---|---|---|---|
| CHECK | 1行の中の値の条件 | `CHECK (amount <> 0)` — 金額が0の仕訳は入れない | `23514`(check_violation) |
| 外部キー(FOREIGN KEY) | 参照先の行が本当にあること | 仕訳の `account_id` は、`accounts` にある勘定だけ | `23503`(foreign_key_violation) |
| UNIQUE | 表の中で値が重複しないこと | `UNIQUE (kind, name)` — 同じ種別に同じ名前の勘定は1つだけ | `23505`(unique_violation) |
| 主キー(PRIMARY KEY) | 行を1つに決める値。重複せず、NULL にならない | 冪等キーの `key` | `23505` |
| 部分UNIQUE インデックス | **条件に合う行の中だけで**重複しないこと | 取消されていない開始残高は1件だけ | `23505` |

**ビュー**(view)は、SELECT 文に名前を付けて、表のように読めるようにしたものである。データは持たず、読むたびに元の表から SELECT する。

**遅延制約**(コミットのときにまとめて確かめる制約)は、[複式簿記の仕訳と遅延制約](double-entry-bookkeeping.md) で解説している(Issue #47 で作る)。

## なぜ必要か

- **アプリにバグがあっても、帳簿として壊れたデータを DB に入れないため。** アプリでも同じことを確かめる(わかりやすいエラーを返すため)が、DB は「最後の砦」になる(finance-data-model.md §5.1)。エージェント(MCP)からの書き込みのように、入口が増えても守れる。
- **取消の除外の書き忘れを防ぐため。** 集計のたびに `WHERE voided_at IS NULL` を書くと、どこかで忘れる。ビュー `active_postings` に一度だけ書き、集計はすべてビューから読む。

## このプロジェクトでどう使うか

### どこに書くか

制約とビューは `packages/modules/finance/src/db/schema.ts` に Drizzle で書き、`drizzle-kit generate` でマイグレーションの SQL を作る(ADR 0030。書き方は [ORM と Drizzle](orm-and-drizzle.md))。生成された SQL は `packages/modules/finance/migrations/0001_tables.sql` にある。

### 部分UNIQUE インデックスの読み方

```sql
CREATE UNIQUE INDEX transactions_one_active_opening
  ON finance.transactions ((true))
  WHERE kind = 'opening' AND voided_at IS NULL;
```

- `WHERE` に合う行(取消されていない開始残高)だけが、インデックスに入る。
- インデックスの値は、どの行でも定数の `true` である。値が全部同じなので、2行目が入ろうとすると「重複」になる。
- 取消した開始残高は `WHERE` に合わなくなり、インデックスから外れる。だから「取消せば、新しい開始残高を登録できる」。

### NULL と UNIQUE

`UNIQUE (replaces_id)` は、`replaces_id` が NULL の行を何行でも許す(PostgreSQL では、NULL どうしは「等しい」とみなさない)。置き換えではない普通の取引は `replaces_id` が NULL なので、何件あってもよい。値が入っている行どうしだけが重複を調べられ、「1つの取引を置き換えられるのは1回だけ」になる。

### 安全な整数の範囲

金額と管理単位は、DB では `bigint`、TypeScript では `number` で扱う(ADR 0028)。`number` が正確に表せる整数は `Number.MAX_SAFE_INTEGER`(9007199254740991)までなので、DB にも `CHECK (amount BETWEEN -9007199254740991 AND 9007199254740991)` を付け、TypeScript で読んだときに値が変わってしまう行を入れない(ADR 0030)。

### テストでの確かめ方

`packages/modules/finance/src/db/schema.integration.test.ts` で、本物の PostgreSQL(Testcontainers)に拒否されるはずの INSERT を送る。エラーのコード(`23514` など)と、**どの制約で拒否されたか**(エラーの `constraint` に入る制約の名前)の両方を確かめる。同じ表に CHECK がいくつもあるので、名前まで見ないと「別の理由で拒否されたのにテストが通る」ことがあるためである。
