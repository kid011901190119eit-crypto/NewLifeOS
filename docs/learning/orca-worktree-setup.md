# Orca のワークツリーの準備(orca.yaml と .worktreeinclude)

## それは何か

Git のワークツリーは、1つのリポジトリから作業用のフォルダを複数作る仕組み。Orca は Issue ごとにワークツリーを作り、それぞれでエージェントを動かす。

新しいワークツリーには、Git で管理しているファイルしか入らない。`node_modules/`(依存関係)や `deploy/compose/.env`(パスワード)は `.gitignore` で管理外にしているので、そのままではない。Orca には、これらを自動で用意する仕組みが2つある。

| ファイル | 役割 | どのフォルダの設定が使われるか |
|---|---|---|
| `orca.yaml` の `scripts.setup` | ワークツリーができたあとに実行するコマンド | 新しいワークツリー |
| `.worktreeinclude` | 管理外のファイルを、メインのチェックアウトからコピーする一覧 | メインのチェックアウト |

メインのチェックアウトは、Orca に登録した元のリポジトリのフォルダのこと。

## なぜ必要か

ワークツリーを作るたびに `pnpm install` と `.env` の複製を手でやると、忘れたときにテストや `pnpm db:up` が失敗する。

`.env` は、`.env.example` から作るよりメインの `.env` をコピーするほうがよい。`compose.yaml` でプロジェクト名を `lifeos-local` に固定しているので、すべてのワークツリーが同じコンテナとデータを共有するからである。パスワードが食い違うと、共有の DB に接続できない。

`.env` の中身はコミットしない。`.worktreeinclude` はファイルの名前だけをコミットし、中身は手元でコピーされるだけである。

## このプロジェクトでどう使うか

`orca.yaml`:

```yaml
scripts:
  setup: |
    pnpm install --frozen-lockfile
    node -e "const fs=require('node:fs');const p='deploy/compose/.env';if(!fs.existsSync(p))fs.copyFileSync(p+'.example',p)"
setupAgentStartupPolicy: wait-for-setup
```

- `pnpm install --frozen-lockfile`: `pnpm-lock.yaml` を書き換えずにインストールする。ロックファイルが `package.json` と合わないときは失敗するので、そのときは手で `pnpm install` する。
- `node -e …`: `.env` がまだないときだけ `.env.example` から作る。メインに `.env` がなくてコピーされなかったときの予備である。Windows では setup が cmd で1行ずつ実行されるので、cmd と bash の両方で動く Node の1行にした(`clean` スクリプトと同じ書き方)。
- `setupAgentStartupPolicy: wait-for-setup`: setup が終わってからエージェントを起動する。

`.worktreeinclude`:

```text
deploy/compose/.env
```

### 気をつけること

- setup は新しいワークツリーの `orca.yaml` を読む。そのため、`orca.yaml` が入った main から作ったワークツリーでだけ動く。
- コピーの一覧は、メインのチェックアウトの `.worktreeinclude` を読む。そのため、メインのフォルダで `git pull` しておく必要がある。
- メインに `deploy/compose/.env` がないときは、何もコピーされない(予備の処理が `.env.example` から作る)。
- setup が動くかどうかは、Orca の画面の Settings → Repository で決まる(既定は「自動で実行」)。リポジトリに書いたコマンドを初めて実行するときは、Orca が確認を求める。

参考: [Orca のドキュメント(orca.yaml & .worktreeinclude)](https://github.com/stablyai/orca/blob/main/docs/site/content/docs/model/orca-yaml.mdx)
