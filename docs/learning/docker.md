# Docker(イメージ・コンテナ・ボリューム)

## それは何か

**Docker** は、アプリを「動かすのに必要なものを丸ごと詰めた箱」にして、どの PC やサーバーでも同じように動かすための道具である。PostgreSQL を Windows に直接インストールする代わりに、PostgreSQL の入った箱を取ってきて起動する。

| 用語 | 意味 | たとえ |
|---|---|---|
| イメージ(image) | アプリと、その動作に必要なファイル(OS のライブラリなど)を固めた、読み取り専用のひな形 | 料理のレシピと材料のセット |
| コンテナ(container) | イメージから起動した、実際に動いているもの。消して作り直せる | レシピから作った料理 |
| レジストリ(registry) | イメージを配る場所。Docker Hub、GHCR など | スーパー |
| タグ(tag) | イメージに付ける名前。`postgres:18.6` の `18.6` の部分。**付け替えられる** | 商品名 |
| digest | イメージの中身から計算したハッシュ(`sha256:…`)。中身が1ビットでも変われば値が変わる。**付け替えられない** | 商品の指紋 |
| ボリューム(volume) | コンテナの外に置く、Docker が管理する保存領域。コンテナを消しても残る | 冷蔵庫 |
| ポートの公開(port publishing) | コンテナの中のポートを、ホスト(手元の PC)のポートにつなぐこと | 窓口 |

Docker Desktop は、Windows や macOS の中に小さな Linux の仮想マシンを立て、その中でコンテナを動かしている。コンテナは Linux の仕組み(名前空間と cgroup)で他のプロセスから隔離された、普通の Linux のプロセスである。仮想マシンと違って OS を丸ごと起動しないので、数秒で立ち上がる。

### コンテナの中のデータは消える

コンテナの中で書き込んだファイルは、**コンテナを消すと一緒に消える**。データベースのデータをコンテナの中に置くと、版を上げるためにコンテナを作り直しただけで、全部失われる。そこでデータの置き場所だけをボリュームとしてコンテナの外に出す。コンテナは使い捨て、データはボリュームに残す、という役割の分け方をする。

| 保存方法 | 置き場所 | 特徴 |
|---|---|---|
| 名前付きボリューム | Docker の管理する領域(`docker volume ls` で見える) | 速く、権限の問題が起きにくい。中身はエクスプローラーからは見えない |
| バインドマウント | PC の任意のフォルダ(例: `./data`) | 中身が見える。Windows では遅く、PostgreSQL の権限のエラーが起きやすい |

### マルチアーキテクチャのイメージ

CPU の種類(アーキテクチャ)が違うと、同じプログラムは動かない。手元の PC は x86_64(`amd64`)、本番の Oracle Cloud の Ampere A1 は ARM64(`arm64`、`aarch64`)である。公式イメージの多くは、1つのタグの下に CPU ごとのイメージを並べた**イメージインデックス**になっていて、Docker が自分の CPU に合うものを自動で選ぶ。digest で固定するときは、このインデックスの digest を書くので、1つの digest で両方の CPU に対応できる。

## なぜ必要か

- **本番と同じものを手元で動かすため。** 本番はコンテナで動かす(spec §8.2)。手元でも同じイメージを使えば、「手元では動いたのに本番で動かない」が減る。
- **PC を汚さないため。** PostgreSQL や Valkey を Windows に直接入れずに済む。いらなくなったらコンテナとボリュームを消せば元通りになる。
- **版をそろえるため。** イメージの digest を Git で管理すれば、いつ誰が起動しても同じ中身になる。後の Testcontainers(フェーズ3-3)も、同じイメージを使う。

## このプロジェクトでどう使うか

イメージは [`deploy/compose/compose.yaml`](../../deploy/compose/compose.yaml) に書いている。判断の記録は [ADR 0022](../adr/0022-local-postgres-and-valkey.md)。

| イメージ | 版 | 用途 |
|---|---|---|
| `postgres` | 18.6(Debian 版) | データベース。18 から `uuidv7()` が使える([家計簿の設計書 §3](../design/finance-data-model.md)) |
| `valkey/valkey` | 9.1.3(Debian 版) | Redis 互換のインメモリ DB。BullMQ のジョブのキューに使う(フェーズ4) |

### 版と digest の両方で固定する

```yaml
image: postgres:18.6@sha256:3a4264520e121176619f54ff867d12774bc81e95e7b84db58d63bccdb6144b81
```

`@sha256:…` を書くと、Docker はタグを無視して digest のイメージを使う。タグの `18.6` は、人間が読むためと、Renovate が「次は 18.7」と判断するために残す。Renovate は版の更新(`18.6` → `18.7`)も digest だけの更新(同じ `18.6` の作り直し)も、プルリクエストで提案する([Renovate](renovate.md))。

### 新しい版の digest と ARM64 対応を確かめる

Renovate の提案をマージする前や、自分で版を上げるときは、次の方法で確かめる。

```sh
# digest と、含まれる CPU の種類を表示する。linux/amd64 と linux/arm64 の両方があること
docker buildx imagetools inspect postgres:18.6

# ARM64 版を実際に起動する(Docker Desktop が QEMU というエミュレーターで動かす)。aarch64 と表示されること
docker run --rm --platform linux/arm64 --entrypoint sh postgres:18.6 -c 'uname -m; postgres --version'
```

### PostgreSQL 18 のデータの置き場所

PostgreSQL 18 の公式イメージから、データの置き場所が `/var/lib/postgresql/data` から `/var/lib/postgresql/18/docker` に変わった。ボリュームは親の **`/var/lib/postgresql`** に付ける。17 以前の書き方(`/var/lib/postgresql/data`)のままだと、データがボリュームの外に書かれ、コンテナを作り直すと消える。

置き場所に版の番号が入るので、将来 19 に上げると、19 は空の `/var/lib/postgresql/19/docker` から始まる(18 のデータは消えずに残るが、見えなくなる)。メジャーの版を上げるときは、`pg_upgrade` か、ダンプと復元でデータを移す。ローカルでは `pnpm db:reset` で作り直してもよい。

### よく使う Docker のコマンド

| やりたいこと | コマンド |
|---|---|
| 動いているコンテナの一覧 | `docker ps` |
| ボリュームの一覧 | `docker volume ls` |
| イメージの一覧と大きさ | `docker image ls` |
| 使っていないイメージを消す | `docker image prune`(ボリュームは消えない) |
