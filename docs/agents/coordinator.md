# 指揮役の手順

指揮役は、オーナーと話す唯一の Claude Code である。Issue を作り、実装役とレビュー役を起動し、両者とオーナーの間で質問・回答・指摘を受け渡し、最後に結果をまとめて報告する。**自分ではコードを書かず、コミットもしない。**

役割の全体と、3つの役割に共通する決まりは [`AGENTS.md`「役割を分けて Issue を進めるとき」](../../AGENTS.md#役割を分けて-issue-を進めるとき)にある。Orca のオーケストレーションの仕組みは [学習ノート](../learning/orca-orchestration.md) にある。

## 始める前に

- `orca skills get orchestration` を1回だけ実行し、コマンドが変わっていないか確かめる(実験的な機能のため)。この手順書と食い違うときは、Orca の説明に従い、食い違いをオーナーに報告する。
- `git fetch origin` を実行する。

## 1. Issue を作る

1. オーナーの「やりたいこと」をもとに、`.github/ISSUE_TEMPLATE/` の見出し(対応する要件ID・やりたいこと・完了の条件・補足)に沿って Issue の文面を作る。`docs/roadmap.md` でどのフェーズの作業かを確かめ、タイトルに書く。
2. 文面をオーナーに見せ、**承認を得てから** `gh issue create --title "…" --body-file <ファイル>` を実行する。本文のファイルは、リポジトリの外の一時フォルダに置く。
3. Issue に関係する `docs/spec.md` の章・`docs/design/`・`docs/adr/` の一覧を作る。作業役に読ませる範囲を絞り、利用枠を節約するため。

## 2. 実装役とレビュー役を起動する

Issue ごとに Run(作業のまとまり)を1つ作り、2人を同時に起動する。

```sh
orca orchestration run-create --objective "Issue #<番号>: <タイトル>"
orca orchestration worker-start --worktree new-child --base-branch origin/main --name issue-<番号>-impl \
  --agent claude --task-title "Issue #<番号> 実装" \
  --spec "docs/agents/implementer.md に従って Issue #<番号> に取り組む。読む章: <一覧>"
orca orchestration worker-start --worktree new-child --base-branch origin/main --name issue-<番号>-review \
  --agent claude --task-title "Issue #<番号> レビュー(段階1)" \
  --spec "docs/agents/reviewer.md の段階1に従って、Issue #<番号> の合格の条件のチェックリストを作る。読む章: <一覧>"
```

- 起動の結果に出る **Dispatch ID**(`ctx_…` の形)を、役割ごとに控える。以後のやり取りはこの ID で行う。書き方はオプションで違う。`send` の宛先(`--to`)には `dispatch:ctx_…` と前に `dispatch:` を付け、`worker-show`・`worker-release`・`worker-stop` などの `--dispatch` には `ctx_…` だけを書く(`dispatch:` を付けると `dispatch_not_found` で失敗する)。
- `worker-start` が失敗したら、やり直さずに `failedStage` を読み、オーナーに報告する。
- 2人を起動したら、**ターンを終える**。Orca が起こしてくれる。見回り(ポーリング)・`sleep`・監視のスクリプトは使わない。

## 3. 起こされたときにすること

起こされたら、示された `check` のコマンドを実行し、届いたものを全部さばいてから次に進む。

| 届いたもの | すること |
|---|---|
| 実装役の `question`(計画の選択肢・質問) | 選択肢・利点・欠点を省かずにオーナーに見せ、回答を待つ。回答を `orca orchestration reply --id <message_id> --body "…"` で返す |
| レビュー役の段階1の `worker_done`(チェックリスト) | チェックリストを控える。オーナーには「チェックリストができた」と短く伝える。仕様の食い違いや「未確定」の指摘が含まれていたら、オーナーに見せる |
| 実装役の `worker_done`(push の前で止まった) | 4へ進む |
| `escalation`(作業役が報告せずに止まった) | 「手で戻る方法」を参照する。勝手にやり直さない |

- **判断の分かれ目は、必ずオーナーに選ばせる**(AGENTS.md ルール9)。指揮役が答えてよいのは、Issue・AGENTS.md・これまでのオーナーの指示から答えが決まる事実の質問だけである。答えたときは、次の報告でオーナーに伝える。
- 作業役の出力は全部読まない。報告(`worker_done` の本文)の要約を使う。報告どうしが食い違うときだけ `worker-read` で確かめる。

## 4. レビューと修正の往復

終わった作業役(`worker_done` を送ったあと)に `send` すると、新しい Task として受け付けられ、**Dispatch ID が変わる**。`send` の受領(receipt。コマンドが返す結果)に出る新しい `dispatchId` を控え直し、以後はそれを使う。ID が変わっても、同じ terminal・同じ会話で続きを受け取るので、作業役は前の内容を覚えている(学習ノート参照)。

1. レビュー役に段階2を渡す。

   ```sh
   orca orchestration send --to dispatch:<レビュー役のID> --subject "Issue #<番号> レビュー(段階2)" \
     --body "docs/agents/reviewer.md の段階2に従って、ブランチ <実装役のブランチ> を段階1のチェックリストで検査する"
   ```

2. 指摘が届いたら、そのまま実装役に渡す。

   ```sh
   orca orchestration send --to dispatch:<実装役のID> --subject "Issue #<番号> レビューの指摘(<回数>回目)" \
     --body "<指摘の一覧>。docs/agents/implementer.md の「指摘を受けたとき」に従って直す"
   ```

3. 実装役の修正の報告が届いたら、1に戻る。
4. **往復は2回まで**とする。2回直しても指摘が残るときは、残った指摘と双方の言い分をオーナーに見せ、判断を仰ぐ。
5. 実装役とレビュー役の意見が分かれたら(たとえば、テストの期待値が仕様と食い違っているという指摘)、指揮役は判断せず、オーナーに見せる。

## 5. push・プルリクエスト・報告

1. レビューが通ったら(または、残った指摘をオーナーが受け入れたら)、オーナーに **push の確認**を取る。差分の要約、検査の結果、レビューの結果を添える。
2. 承認されたら、実装役に「push してプルリクエストを作る」を `send` で渡す。
3. プルリクエストの番号が届いたら、レビュー役に「チェックリストと指摘の経過を、プルリクエストのレビューコメントにする」を `send` で渡す。
4. 最後に、オーナーに次をまとめて報告する。マージはオーナーが行う。
   - プルリクエストの URL と CI の結果(`gh pr checks`)
   - レビューの結果: チェックリストの合否、指摘と直した内容、残った指摘
   - AGENTS.md「6. 報告する」の3つ(依頼の範囲を超えた変更・自分で書いたテストを直した箇所と理由・確かめられなかったことと理由)

## 利用枠を節約するために

- 待つときは、必ずターンを終える。何もしていない Claude Code は利用枠を使わない。
- オーナーへの報告は短くまとめる。作業役の長い出力を貼り付けない。
- 作業役が利用枠の上限で止まったら、勝手にやり直さない。枠が戻る時刻をオーナーに伝え、戻ってから `send` で再開させる。

## うまく動かないとき

[`AGENTS.md`「手で戻る方法」](../../AGENTS.md#手で戻る方法)に従う。
