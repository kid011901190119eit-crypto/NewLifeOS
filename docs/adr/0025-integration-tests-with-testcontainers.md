# 0025: 結合テストは Testcontainers で使い捨ての PostgreSQL を立て、ユニットテストと分けて実行する

- ステータス: 承認
- 日付: 2026-11-04

## 背景
フェーズ3-2(Issue #29)で、本物の PostgreSQL を使う結合テストの仕組みを作った。そのとき、次の事情があった。

- spec §10.1 は、DB の制約を Testcontainers で本物の PostgreSQL を使ってテストすると決めている。
- 結合テストは Docker が要り、1回に十数秒かかる。ユニットテストは Docker なしで1秒ほどで終わる。
- 開発用の PostgreSQL のイメージは `deploy/compose/compose.yaml` に版と digest で固定し、Renovate が更新する(ADR 0022)。結合テストと開発用で版が食い違うと、どちらかでしか起きない不具合を見逃す。
- Testcontainers は、後片付け係の Ryuk というコンテナを自動で起動する。Ryuk は Docker のソケットを持ち、Docker を操作できる。既定では digest で固定されていない。
- `docs/design/module-system.md` §3.1 は、`Database`・`Tx` を `packages/db` が出す Drizzle の型としている(フェーズ3で確定)。

## 検討した選択肢
**ユニットテストと結合テストの分け方**
- `pnpm test` に含める: コマンドが1つ / Docker が無いと `pnpm test` が失敗し、ユニットテストだけを速く回せない
- `pnpm test:integration` に分ける: `pnpm test` は今までどおり速い。CI で別ジョブにでき、どちらが落ちたかがわかる / コマンドが1つ増える
- Vitest の projects で分ける: Vitest の公式の仕組み / 設定が1段深くなり、結局スクリプトで片方を選ぶ必要がある

**compose.yaml とイメージを揃える方法**
- 実行時に compose.yaml から読む: 書く場所が1か所で、食い違いが起きない / コードが compose.yaml の書き方(字下げ)に依存する
- 両方に書いて比べるテストを置く: コードを読めばイメージがわかる / 同じ値を2か所に書き、Renovate が片方だけ更新すると手で直す
- 別ファイルに置いて両方から参照する: 1か所に集まる / Compose から読むには `.env` の変数経由になり、Renovate が更新しにくい

**Drizzle ORM の導入時期**
- 3-2(この Issue)で入れる: `Database`・`Tx` の型が決まる / プルリクエストが大きくなり、マイグレーションなしでは使い道が少ない
- 3-3(マイグレーション)で入れる: この Issue を小さく保てる。用途と一緒に学べる / `Database`・`Tx` は 3-3 まで未定

**コンテナの片付け**
- 各テストファイルの `beforeAll`・`afterAll` + Ryuk: 読めば起動と停止がわかる。異常終了は Ryuk が拾う / ファイルが増えると起動が増えて遅くなる
- Vitest の `globalSetup` + Ryuk: 起動が1回で速い / 接続情報の受け渡し(`provide`/`inject`)が要り、仕組みが見えにくい

## 決定
- 結合テストのファイル名は `*.integration.test.ts` にし、`pnpm test:integration` で実行する。`pnpm test` には含めない。CI の matrix に `integration` のジョブを足す。Turborepo では結合テストをキャッシュしない(`cache: false`)。
- 結合テストの PostgreSQL のイメージは、**実行時に `compose.yaml` から読む**。版と digest の形でなければエラーにする。結合テストは、動いている PostgreSQL の版が `compose.yaml` の版と同じかも確かめる。
- Drizzle ORM は **3-3 で入れる**。この Issue の `packages/db` は、結合テスト用の道具だけを持つ。
- 片付けは **`beforeAll`・`afterAll` + Ryuk** に頼る。
- **Ryuk のイメージも版と digest で固定する**(`packages/db/src/testing/ryuk-image.ts`)。`startPostgres()` が環境変数 `RYUK_CONTAINER_IMAGE` に設定する。Ryuk の版は Testcontainers の版と組で決まるので、Renovate には digest の更新だけを提案させ(`customManagers` と、版の更新を止める `packageRules`)、版は人が手で合わせる。入っている Testcontainers が既定で使う版と食い違うと、ユニットテストが失敗する。
- DB のドライバは `pg` を使う。結合テストのパスワードは Testcontainers の既定の値を使い、コードに書かない。
- `pnpm install` で、依存関係 `cpu-features`・`protobufjs`・`ssh2`(Testcontainers が間接的に使う)のビルドスクリプトは実行しない(`pnpm-workspace.yaml` の `allowBuilds`)。どれも任意の高速化や生成のためのもので、無くても動くことを確かめた。

## 結果
- `pnpm test` は Docker なしで動き続ける。結合テストは CI の `integration` のジョブで毎回実行される。必須チェックへの追加はオーナーがルールセットで行う。
- テストが成功しても、失敗しても、プロセスを強制終了しても、コンテナが残らないことを確かめた(強制終了のときは Ryuk が消した)。
- `compose.yaml` の PostgreSQL に digest が無いとき、版の文字と digest が別の版を指すとき、Ryuk の版が Testcontainers の既定と違うとき、Ryuk の環境変数を設定しないときに、テストが失敗することを確かめた。
- Testcontainers の更新で Ryuk の既定の版が変わると、その Renovate のプルリクエストでテストが失敗する。直し方は `docs/learning/testcontainers.md` にある。
- CI で Docker Hub からイメージを取得するときのレート制限は、この Issue では扱わない。失敗するようになったら別の Issue にする。
- テストファイルが増えて起動の時間が気になったら、`globalSetup` への切り替えを検討する。
