# Docker Compose(複数のコンテナをまとめて動かす)

## それは何か

**Docker Compose** は、複数のコンテナの起動のしかたを1つの YAML ファイル(`compose.yaml`)に書いておき、1つのコマンドでまとめて起動・停止する道具である。`docker run` に長いオプションを毎回打つ代わりに、設定をファイルとして Git で管理できる。

| 用語 | 意味 |
|---|---|
| サービス(service) | `compose.yaml` の `services:` の下の1項目。1種類のコンテナの設定。例: `postgres`、`valkey` |
| プロジェクト(project) | 1つの `compose.yaml` から作られるコンテナ・ボリューム・ネットワークのまとまり。名前が各部品の頭に付く(`lifeos-local-postgres-1`、`lifeos-local_postgres-data`) |
| ネットワーク | Compose がプロジェクトごとに作る仮想のネットワーク。コンテナ同士はサービス名(`postgres`)で互いを呼べる |
| 変数の展開(interpolation) | `compose.yaml` の中の `${変数名}` を、環境変数や `.env` の値に置き換えること |
| ヘルスチェック(healthcheck) | コンテナの中で定期的にコマンドを実行し、サービスが本当に使える状態かを判定する仕組み |

### 「起動した」と「使える」は違う

コンテナのプロセスが起動しても、PostgreSQL はデータの領域を初期化している最中で、まだ接続を受け付けないことがある。ヘルスチェックは、この「使えるかどうか」を判定する。

| 状態 | 意味 |
|---|---|
| `starting` | 起動した直後。`start_period` の間は、失敗しても数えない |
| `healthy` | `test` のコマンドが成功した(終了コード0) |
| `unhealthy` | `retries` 回続けて失敗した |

`docker compose up --wait` は、すべてのサービスが `healthy` になるまで待ってから終わる。`unhealthy` になれば失敗で終わる。そのため、`pnpm db:up` が成功して戻ってきたら、すぐに接続してよい。

## なぜ必要か

- **1つのコマンドで、決まった構成を起動するため。** ロードマップのフェーズ3の完了の条件である。PostgreSQL と Valkey のポート・パスワード・ボリュームを毎回手で指定するのは間違いのもとになる。
- **本番も同じ方式で動かすため。** 本番の15個のコンテナ(spec §8.2)も Docker Compose で動かす。手元で書き方に慣れておく。
- **準備完了を機械が判定できるようにするため。** ヘルスチェックがあれば、アプリや CI は「DB が使えるようになるまで待つ」を推測ではなく判定で行える。

## このプロジェクトでどう使うか

設定は [`deploy/compose/compose.yaml`](../../deploy/compose/compose.yaml)、判断の記録は [ADR 0022](../adr/0022-local-postgres-and-valkey.md) にある。

### 最初に1回だけ

```sh
cp deploy/compose/.env.example deploy/compose/.env   # 値を書き換えてよい。.env はコミットされない
```

Compose は、`compose.yaml` と同じフォルダの `.env` を自動で読み、`${POSTGRES_PASSWORD}` などに当てはめる。`${POSTGRES_PASSWORD:?メッセージ}` の書き方は「値が無ければメッセージを出して止まる」という意味である。`.env` を作り忘れても、空のパスワードで起動してしまうことはない。

### コマンド

| やりたいこと | コマンド | 中身 |
|---|---|---|
| 起動し、準備完了まで待つ | `pnpm db:up` | `docker compose … up -d --wait`(`-d` は裏で動かす) |
| 停止し、コンテナを消す(データは残る) | `pnpm db:down` | `docker compose … down` |
| 状態を見る | `pnpm db:status` | `docker compose … ps`。STATUS に `(healthy)` と出れば準備完了 |
| ログを見る | `pnpm db:logs` | `docker compose … logs -f`(Ctrl+C で抜ける) |
| **データを消して**作り直す | `pnpm db:reset` | `down --volumes` でボリュームも消してから、`up` する |

### 接続先

| | ホスト(手元の PC)から | 別のコンテナから(フェーズ4以降) |
|---|---|---|
| PostgreSQL | `postgres://lifeos:<パスワード>@127.0.0.1:5432/lifeos` | `postgres:5432` |
| Valkey | `redis://:<パスワード>@127.0.0.1:6379` | `valkey:6379` |

ホストにクライアントが入っていなくても、コンテナの中のクライアントで試せる。

```sh
docker compose -f deploy/compose/compose.yaml exec postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
docker compose -f deploy/compose/compose.yaml exec valkey sh -c 'REDISCLI_AUTH="$VALKEY_PASSWORD" valkey-cli'
```

### 設定の読み方

- **`ports: "127.0.0.1:5432:5432"`**: 「ホストの 127.0.0.1 の 5432 番を、コンテナの 5432 番につなぐ」。`127.0.0.1` を省いて `"5432:5432"` と書くと、すべてのネットワークの口(`0.0.0.0`)で待ち受け、同じ Wi-Fi の他の機器からも DB に接続できてしまう。Docker はポートの公開のために OS のファイアウォールの設定を自分で書き換えることがあるので、ファイアウォールだけに頼らず、ここで絞る。
- **`healthcheck`**: PostgreSQL は付属の `pg_isready`、Valkey は `valkey-cli ping` が `PONG` を返すかで判定する。5秒ごとに実行し、10回続けて失敗したら `unhealthy` にする。
- **`$$POSTGRES_USER`**: `$$` は Compose に「ここは展開しない」と伝え、`$` 1つとしてコンテナに渡す書き方である。コンテナの中のシェルが、コンテナの環境変数から値を読む。Valkey のパスワードもこの方法で渡し、`compose.yaml` の中にパスワードが展開されないようにしている(`docker compose config` で表示しても、コマンドの部分には出ない)。
- **`--appendonly yes`(Valkey)**: Valkey の永続化の方式を AOF にする。AOF は、書き込みのたびに操作をファイルに追記する方式である。既定の RDB(一定間隔でスナップショットを取る)だと、異常終了したときに最後のスナップショット以降のジョブを失う。BullMQ の公式の推奨に合わせた。
- **`volumes:`(一番下)**: 名前付きボリュームの宣言。`pnpm db:down` では消えず、`pnpm db:reset`(`--volumes`)でだけ消える。

### うまく動かないとき

| 症状 | 原因と対処 |
|---|---|
| `required variable POSTGRES_PASSWORD is missing a value` | `deploy/compose/.env` が無い。見本を複製する |
| `port is already allocated` | 手元で別の PostgreSQL や Redis が同じポートを使っている。`.env` の `POSTGRES_PORT` か `VALKEY_PORT` を変える |
| `.env` のパスワードを変えたのに、PostgreSQL に古いパスワードでしか入れない | PostgreSQL のパスワードは、ボリュームが空のとき(初回)にだけ設定される。`pnpm db:reset` で作り直す |
| `unhealthy` で `db:up` が失敗する | `pnpm db:logs` でログを見る |
