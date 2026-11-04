# 0022: ローカル開発用の PostgreSQL と Valkey(版・保存方法・公開範囲)

- ステータス: 承認
- 日付: 2026-11-04

## 背景
フェーズ3-1(Issue #23)で、手元で PostgreSQL と Valkey を Docker Compose で起動できるようにした。そのとき、次の事情があった。

- 家計簿の設計書(§3)は、PostgreSQL 18 なら主キーの既定値に `uuidv7()` を使い、18 未満ならアプリでの生成だけにすると決めていた。版はフェーズ3で決めることになっていた。
- 2026年11月4日の時点で、PostgreSQL の正式版の最新は 18.6。19 はリリース候補(`19rc1`)までだった。Valkey の最新は 9.1.3 で、8.1 系も配布されていた。
- 本番のサーバー(Oracle Cloud の Ampere A1)は ARM64 である。`postgres:18.6` と `valkey/valkey:9.1.3` は、どちらも `linux/amd64` と `linux/arm64` を含むマルチアーキテクチャのイメージだった(`docker buildx imagetools inspect` と、`--platform linux/arm64` での起動で確かめた)。
- PostgreSQL 18 の公式イメージは、データの置き場所を `/var/lib/postgresql/18/docker` に変えた。
- Valkey は BullMQ のキューに使う(フェーズ4)。BullMQ は AOF での永続化を推奨している。

## 検討した選択肢
**PostgreSQL の版とイメージの種類**
- 18.6 Debian 版: `uuidv7()` が使える。glibc なので照合順序の挙動が本番・Testcontainers と揃えやすい / 約640MBと大きい
- 18.6 Alpine 版: 約430MBと小さい / musl なので照合順序が Debian 版と微妙に違いうる
- 19 RC: 最新の機能 / 正式版ではない。7日待ってから更新する方針(ADR 0021)とも合わない
- 17: 情報が多い / `uuidv7()` がなく、設計書の修正が要る

**Valkey の版**
- 9.1: 最新の系列でサポートが長い。BullMQ は Redis 互換の API しか使わない / 利用例は 8 より少ない
- 8.1: 利用例が多い / メジャーの更新が早めに来る

**データの保存方法**
- 名前付きボリューム + Valkey は AOF: Windows でも速く、権限の問題が起きにくい。異常終了しても直近のジョブが残る / 中身がエクスプローラーから見えない
- 名前付きボリューム + Valkey は RDB(既定): 設定が最小 / 異常終了すると最後のスナップショット以降のジョブを失う
- バインドマウント(`./data`): 中身が見える / Windows では遅く、PostgreSQL の権限のエラーが起きやすい

**コマンドの名前**
- `db:up`・`db:down`・`db:status`・`db:logs`・`db:reset`: 何を動かすかが名前でわかる / 将来ほかのミドルウェアを足すと名前が合わなくなる
- `reset` なし: 誤ってデータを消すコマンドがない / 作り直すときは手で `down -v` を打つ
- `infra:*`: 将来も名前が合う / 今は少し抽象的

## 決定
- PostgreSQL は **18.6 の Debian 版**、Valkey は **9.1.3 の Debian 版**にする。どちらも `postgres:18.6@sha256:…` のように、版と digest の両方で固定する。Renovate(`docker-compose` マネージャー)が更新を `build(deps)` として提案する。
- データは**名前付きボリューム**に保存する。PostgreSQL のボリュームは `/var/lib/postgresql` に付ける。Valkey は `--appendonly yes`(AOF)で動かす。
- ポートは **`127.0.0.1` にだけ**公開する。
- PostgreSQL と Valkey のパスワードは `deploy/compose/.env`(コミットしない)から受け取り、値が無ければ起動を止める(`${VAR:?…}`)。見本は `deploy/compose/.env.example`。
- コマンドは `db:up`・`db:down`・`db:status`・`db:logs`・`db:reset` にする。`db:up` は `--wait` でヘルスチェックが通るまで待つ。
- 家計簿の主キーの既定値には、`uuidv7()` を使う(設計書 §3 のとおり)。

## 結果
- 設計書どおり `uuidv7()` を DB の既定値に使える。起動して `select uuidv7()` が動くことを確かめた。
- コンテナを作り直しても(`db:down` → `db:up`)、PostgreSQL と Valkey のデータが残ることを確かめた。
- 同じネットワークの他の機器(LAN の IP アドレス)からは接続できないことを確かめた。
- PostgreSQL のメジャーの版を上げると、データの置き場所(`/var/lib/postgresql/<版>/docker`)が変わる。Renovate が 19 を提案してきたら、ローカルは `pnpm db:reset` で作り直す。本番のデータを移す手順(`pg_upgrade` など)は、フェーズ7(バックアップ)以降で決める。
- `compose.yaml` は YAML のパーサを足さずに、文字列のパターンでテストしている(`packages/config/tests/compose.test.ts`)。書き方(字下げ2つの YAML)を大きく変えると、テストも直す必要がある。
