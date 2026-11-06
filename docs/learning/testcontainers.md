# Testcontainers(テストのたびに使い捨てのコンテナを立てる)

## それは何か

**Testcontainers** は、テストのコードの中から Docker のコンテナを起動・停止するライブラリである。テストが始まるときに本物の PostgreSQL のコンテナを起動し、テストが終わったら消す。テストのたびに空の DB から始められる。

| 用語 | 意味 |
|---|---|
| ユニットテスト | DB などの外部の仕組みを使わず、関数だけを試すテスト。速い。`pnpm test` |
| 結合テスト(integration test) | 本物の DB とつないで試すテスト。DB の制約やトランザクションの挙動は、本物でしか確かめられない。`pnpm test:integration` |
| `PostgreSqlContainer` | `@testcontainers/postgresql` が出すクラス。イメージを渡して `start()` すると、PostgreSQL が接続を受け付けるまで待ってから戻る |
| Ryuk(リューク) | Testcontainers が最初のコンテナと一緒に自動で起動する「後片付け係」のコンテナ。テストのプロセスとの接続が切れたら、そのプロセスが作ったコンテナを消す |
| ドライバ(`pg`) | Node.js から PostgreSQL に接続して SQL を送る部品 |

## なぜ必要か

- **DB の制約は本物の PostgreSQL でしか試せないため。** 家計簿の「仕訳の合計は0」は、PostgreSQL のトリガーで守る(`docs/design/finance-data-model.md` §9.2)。偽物の DB(モック)では、この制約が本当に効くかを確かめられない(spec §10.1)。
- **テストごとに空の DB から始めるため。** `pnpm db:up` の DB は開発用のデータが残っている。テストが前の結果に左右されないよう、使い捨ての DB を使う。
- **ローカルと CI で同じ方法で動かすため。** GitHub Actions の ubuntu のランナーには Docker が入っているので、手元(Docker Desktop)と同じテストがそのまま動く。

## このプロジェクトでどう使うか

### ファイルの置き場所

| ファイル | 役割 |
|---|---|
| `packages/db/src/testing/start-postgres.ts` | PostgreSQL を起動して接続し、`client` と `stop()` を返す |
| `packages/db/src/testing/postgres-image.ts` | `deploy/compose/compose.yaml` から PostgreSQL のイメージ名を読む |
| `packages/db/src/testing/ryuk-image.ts` | Ryuk のイメージ(版と digest で固定) |
| `packages/db/src/*.integration.test.ts` | 結合テスト。ファイル名の `.integration` で、ユニットテストと分ける |
| `packages/db/vitest.integration.config.ts` | 結合テストだけを実行する Vitest の設定 |
| `packages/modules/finance/src/db/schema.integration.test.ts` | 家計簿のテーブルの制約の結合テスト(Issue #46) |

### 書き方

```ts
let postgres: TestPostgres;

beforeAll(async () => {
  postgres = await startPostgres();
});

afterAll(async () => {
  await postgres?.stop();
});

it("接続して SELECT 1 の結果を受け取れる", async () => {
  const result = await postgres.client.query("SELECT 1 AS one");
  expect(result.rows).toEqual([{ one: 1 }]);
});
```

### マイグレーションを適用した DB を作る(`createMigratedDatabase`)

モジュールのテーブルを確かめる結合テストでは、テストごとに空の DB を作り、そのモジュールのマイグレーションを適用してから始める。`createMigratedDatabase` は、中で本番の `pnpm db:migrate` と同じ `migrateSchemas` を使う(ADR 0030)。テスト用に別の適用の仕方を書くと、本番と食い違うおそれがあるためである。

```ts
beforeEach(async () => {
  const url = await postgres.createMigratedDatabase(`finance_test_${count}`, [
    { schema: finance.id, folder: finance.migrations.folder },
  ]);
  client = new pg.Client({ connectionString: url });
  await client.connect();
});
```

- テストごとに DB を分けるのは、「有効な開始残高は1件だけ」のように DB 全体で数を数える制約があり、前のテストのデータが残ると結果が変わるためである。
- 各テストを `BEGIN`〜`ROLLBACK` で包んで片付ける方法は使わない。仕訳の合計0を確かめる遅延制約(Issue #47)は `COMMIT` のときに動くので、コミットしないと確かめられないためである。
- `@lifeos/db/testing` は、テストのファイル(`*.test.ts`)からしか import できない(ESLint と dependency-cruiser で検査している)。

### 実行のしかた

```sh
pnpm test:integration                          # すべての結合テスト(Docker Desktop を起動しておく)
pnpm --filter @lifeos/db test:integration      # packages/db だけ
pnpm --filter @lifeos/finance test:integration # 家計簿のテーブルだけ
```

`pnpm test`(ユニットテスト)は Docker なしで動く。CI では `integration` という別のジョブで結合テストを実行する。Turborepo のキャッシュは使わない(`cache: false`)。結合テストは毎回本物の DB で確かめるためである。

## コンテナの片付け(どの仕組みに頼るか)

片付けは2段構えにしている(ADR 0025)。

| 場面 | 片付ける仕組み |
|---|---|
| テストが成功した | `afterAll` の `stop()` |
| テストが失敗した | `afterAll` の `stop()`(Vitest は失敗しても `afterAll` を実行する) |
| プロセスごと落ちた(Ctrl+C・強制終了・クラッシュ) | Ryuk。`afterAll` は実行されないが、接続が切れたのを Ryuk が見て、そのコンテナを消す。Ryuk 自身も少しあとに消える |

`afterAll` を書いておけば、テストを読むだけで「いつ起動していつ止めるか」がわかる。Ryuk は、`afterAll` が届かない異常終了のときの安全網である。

Vitest の `globalSetup` で1回だけ起動する方法もある。テストファイルが増えたら速くなるが、接続情報をテストへ渡す仕組み(`provide`/`inject`)が要り、テスト同士でデータが混ざらない工夫も要る。今はファイルが1つなので、素直な `beforeAll`・`afterAll` にした。

確かめ方: テストの後に `docker ps -a --filter label=org.testcontainers=true` を実行し、何も出ないこと(Ryuk は終了後10秒ほどで消える)。

## イメージの固定

### PostgreSQL: compose.yaml を正とする

結合テストの PostgreSQL は、開発用の Docker Compose と同じイメージを使う。イメージ名は `compose.yaml` から実行時に読むので、書く場所は1か所だけになり、食い違いが起きない。Renovate が `compose.yaml` を更新すれば、結合テストも同じ版で動く。

- `compose.yaml` の `postgres` のイメージに版か digest が無いと、ユニットテスト(`postgres-image.test.ts`)が失敗する。
- 結合テストは、動いている PostgreSQL の版(`SHOW server_version`)が `compose.yaml` の版と同じかを確かめる。版の文字(`18.6`)と digest が別の版を指していると、ここで失敗する。

### Ryuk: digest で固定し、版は Testcontainers に合わせる

Ryuk は、他のコンテナを消すために **Docker を操作できる強い権限**(Docker のソケット)を持つ。中身がすり替わると危ないので、PostgreSQL と同じく digest で固定する。Testcontainers は環境変数 `RYUK_CONTAINER_IMAGE` に書いたイメージを Ryuk に使うので、`startPostgres()` がこれを設定する。

Ryuk の版は、Testcontainers の版と組で決まる(Testcontainers の中に既定の版が書いてある)。そのため、Renovate に**組ごと1つのプルリクエストで**上げさせる。

| 設定(`renovate.json`) | 役割 |
|---|---|
| `customManagers` | `ryuk-image.ts` の Ryuk のイメージを読み、版と digest の両方を更新できるようにする |
| `packageRules` の `groupName: "testcontainers"` | `testcontainers`・`@testcontainers/postgresql`(npm)と `testcontainers/ryuk`(Docker のイメージ)の更新を1つのプルリクエストにまとめる |
| 同じ規則の `separateMajorMinor: false` | Renovate は既定でメジャーの更新を別のプルリクエストに分ける。分かれると組が崩れるので、メジャーもまとめる |

組が合っているかは `ryuk-image.test.ts` が検査する(入っている Testcontainers が既定で使う版と、`ryuk-image.ts` の版が同じか)。Renovate のプルリクエストで次のことが起きると、このテストが失敗してマージ前に気づける。

- Ryuk の新しい版だけが先に出て、Testcontainers はまだ古い版を使っている
- Testcontainers が新しい Ryuk を使うようになったのに、Ryuk の新しい版が7日(`minimumReleaseAge`)を過ぎていない

失敗したら、Testcontainers が使う版(失敗の表示に出る)に `ryuk-image.ts` を合わせる。digest は `docker buildx imagetools inspect testcontainers/ryuk:<版>` の `Digest:` の行で調べる。

## パスワード

結合テストの PostgreSQL のパスワードは、Testcontainers がコンテナを作るときに設定する既定の値を使う。コードにも `.env` にも書かない。コンテナはテストのあいだだけ、ランダムなポートで手元に公開され、終わると消える。

## 参考

- [Testcontainers for Node.js](https://node.testcontainers.org/)
- [PostgreSQL モジュール](https://node.testcontainers.org/modules/postgresql/)
- [Ryuk の設定(環境変数)](https://node.testcontainers.org/configuration/)
