# 0023: Issue の標準の手順は AGENTS.md に1か所でまとめ、ワークツリーの準備は orca.yaml と .worktreeinclude で自動にする

- ステータス: 承認
- 日付: 2026-11-04

## 背景
Issue #25 で、エージェントに Issue を頼むときの手順(読むもの・計画・実装・確認・安全・報告・仕上げ)をまとめることにした。それまでは、同じ内容を依頼のたびに書いていた。

あわせて、Orca で新しいワークツリーを作るたびに `pnpm install` と `deploy/compose/.env` の複製を手でしていた。そのときに、次の事情があった。

- `.env` にはパスワードが入るので、コミットできない(AGENTS.md ルール17・18)。
- `compose.yaml` でプロジェクト名を `lifeos-local` に固定しているので、すべてのワークツリーが同じコンテナとデータを共有する。パスワードはメインのチェックアウトと揃っている必要がある。
- Orca の setup は、Windows では cmd で1行ずつ実行される。

## 検討した選択肢
**手順を書く場所**
- AGENTS.md に書き、`/issue` コマンドからは参照するだけにする: Codex など他のエージェントも使える。直すのは1か所で済む / コマンドのファイルだけでは中身がわからない
- コマンドのファイルに手順を全部書く: コマンドを見ればすべてわかる / Claude Code 専用になり、AGENTS.md と二重になる

**`.env` の準備**
- `.worktreeinclude` でメインの `.env` をコピーし、ないときだけ `.env.example` から作る: パスワードが揃う。メインに `.env` がなくても動く / Node の1行が少し読みにくい
- `.worktreeinclude` だけ: いちばん単純 / メインに `.env` がないと何も用意されない
- setup で毎回 `.env.example` から作る: メインの状態に左右されない / メインでパスワードを変えていると、共有の DB に接続できない

**`pnpm install` の形**
- `--frozen-lockfile` を付ける: ロックファイルを書き換えず、CI と同じ状態になる / ロックファイルが古いと失敗する
- 付けない: 必ず最後まで進む / ロックファイルに意図しない差分が出ることがある

## 決定
- 標準の手順は AGENTS.md の「Issue に取り組むときの標準の手順」に書く。既存のルールと重なる部分は、ルールの番号を参照する。`.claude/commands/issue.md` は、その手順に従うように伝えるだけにする。
- `orca.yaml` の `scripts.setup` で `pnpm install --frozen-lockfile` を実行し、`.env` がないときだけ `.env.example` から作る。`setupAgentStartupPolicy` は `wait-for-setup` にする。
- `.worktreeinclude` に `deploy/compose/.env` を書き、メインのチェックアウトの `.env` をコピーする。

## 結果
- 依頼は `/issue <番号>` だけで済む。手順を変えるときは AGENTS.md を直す。
- 新しいワークツリーで、依存関係と `.env` が自動で用意される。ただし、setup は新しいワークツリーの `orca.yaml` を、コピーはメインのチェックアウトの `.worktreeinclude` を読む。そのため、main へのマージとメインでの `git pull` のあとに作ったワークツリーから効く。
- setup を動かすかどうかは Orca の画面の設定(Settings → Repository)に左右される。手順は README と学習ノートに書いた。
