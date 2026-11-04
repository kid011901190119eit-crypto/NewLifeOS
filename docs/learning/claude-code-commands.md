# Claude Code のカスタムスラッシュコマンド

## それは何か

Claude Code に `/名前` と入力したときに送られる指示を、Markdown ファイルとして保存しておく仕組み。よく使う依頼文を毎回書かずに済む。

- `.claude/commands/issue.md` を置くと `/issue` が使えるようになる(ファイル名がコマンド名になる)。
- ファイルはリポジトリにコミットするので、どのワークツリーでも同じコマンドが使える。
- Claude Code の最新のドキュメントでは、コマンドは「スキル」(`.claude/skills/<名前>/SKILL.md`)に統合されたと説明されている。`.claude/commands/` も引き続き同じように動く。補助のファイルを一緒に置きたいときはスキルを使う。

## なぜ必要か

これまでは Issue を頼むたびに、読むもの・計画・確認・報告などの手順を毎回書いていた。手順は AGENTS.md にまとめたので、コマンドは「AGENTS.md の手順に従って」と伝えるだけにしてある。手順の中身をコマンドに書かないのは、次の2つの理由による。

- Codex など、Claude Code 以外のエージェントも同じ手順(AGENTS.md)を使える。
- 手順を直すときに、1か所を直せば済む。

## このプロジェクトでどう使うか

`/issue 25` のように、Issue の番号を付けて入力する。ファイルの中身は次のとおり。

```markdown
---
description: AGENTS.md の標準の手順に従って、GitHub の Issue に取り組む
argument-hint: <Issue番号>
disable-model-invocation: true
---

Issue #$ARGUMENTS に取り組みます。…
```

- `---` で囲まれた部分は frontmatter(ファイルの先頭に書く設定)。
  - `description`: `/` を打ったときの一覧に出る説明。
  - `argument-hint`: 入力の途中に表示される、引数のヒント。
  - `disable-model-invocation: true`: Claude が自分の判断でこのコマンドを使わないようにする。オーナーが打ったときだけ動く。
- `$ARGUMENTS`: コマンド名のあとに入力した文字(`/issue 25` なら `25`)に置き換わる。
- 番号を付け忘れると `$ARGUMENTS` が空になるので、そのときはオーナーに番号を聞くように書いてある。

参考: [Claude Code のドキュメント(Slash commands / Skills)](https://code.claude.com/docs/en/slash-commands)
