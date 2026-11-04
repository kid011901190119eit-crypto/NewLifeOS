# commitlint と Conventional Commits(コミットメッセージの形式の検査)

## それは何か

**Conventional Commits** は、コミットメッセージの書き方の約束である。1行目(ヘッダー)を次の形にする。

```
<種類>(<範囲>): <説明>
```

例: `feat(finance): 口座間移動の仕訳ルールを追加`

| 部分 | 意味 | 例 |
|---|---|---|
| 種類(type) | 何をした変更か | `feat`・`fix`・`docs` |
| 範囲(scope) | どこの変更か。省略できる | `finance`・`repo` |
| `!` | 互換性を壊す変更の印。範囲の後ろ(なければ種類の後ろ)に付ける | `feat(core)!: …` |
| 説明(subject) | 変更の内容を短く | `口座間移動の仕訳ルールを追加` |

**commitlint** は、メッセージがこの約束に従っているかを検査する道具である。ESLint がコードを検査するのと同じように、メッセージを「ルール」の集まりで検査する。`@commitlint/config-conventional` は、Conventional Commits のための標準のルールの集まりである。

## なぜ必要か

- 履歴を見たときに、どんな変更か(機能の追加か、修正か、CI の設定か)が1行目でわかる。
- 形式がそろっていると、変更履歴(CHANGELOG)の自動生成や、版の番号の自動決定などの道具を、あとから使える。
- 約束を文書に書くだけでは、人もエージェントも忘れる(実際に、CONTRIBUTING.md の表と履歴の種類が食い違っていた)。機械で検査すると、ずれに必ず気づける。

### なぜプルリクエストのタイトルを検査するのか

main は **Squash and merge** だけを許可している。Squash は、プルリクエストの中のコミットを1つにまとめてから main に入れるマージの方法である。まとめたコミットのメッセージには、プルリクエストのタイトル(と末尾の ` (#番号)`)が使われる。つまり、**main に残るのはプルリクエストのタイトル**で、作業ブランチの個々のコミットは残らない。

ただし、リポジトリの設定によっては、コミットが1つだけのプルリクエストで、そのコミットのメッセージが使われる。そのため、Squash の既定のタイトルを「プルリクエストのタイトル」(`PR_TITLE`)にする設定も合わせて行う(ADR 0020)。

## このプロジェクトでどう使うか

### 設定

[`packages/config/commitlint.config.js`](../../packages/config/commitlint.config.js) に置く。commitlint は、実行した場所でこの名前のファイルを自動で探す。

- `extends: ["@commitlint/config-conventional"]`: 標準のルールをそのまま使う。
- `scope-enum`: 範囲を決まった一覧に限定する(省略は許す)。一覧にない範囲(`fin` などの打ち間違い)は失敗する。

標準のルールのうち、よく引っかかるもの:

| ルール | 内容 |
|---|---|
| `type-enum` | 種類は `feat`・`fix`・`docs`・`test`・`refactor`・`chore`・`build`・`ci`・`perf`・`style`・`revert` のどれか |
| `type-case` | 種類は小文字(`Feat` は失敗) |
| `type-empty`・`subject-empty` | 種類と説明は省略できない。`feat:追加` のようにコロンの後に空白がないと、形式として読めず、この2つで失敗する |
| `subject-full-stop` | 説明を半角のピリオド `.` で終えない(全角の `。` は検査されない) |
| `subject-case` | 説明を大文字で始めない(英語の場合。日本語には影響しない) |
| `header-max-length` | 1行目は100文字まで(日本語も1文字は1文字) |
| `header-trim` | 1行目の前後に空白を入れない |

### テスト

[`packages/config/tests/commitlint.test.ts`](../../packages/config/tests/commitlint.test.ts) で、形式に合う例・合わない例のメッセージを検査し、どのルールで失敗するかを確かめている。設定を読み込む `@commitlint/load` と、メッセージを検査する `@commitlint/lint` を、CLI を通さずに直接使う。範囲の一覧に、すべてのパッケージ・モジュール・アプリの名前が入っていることも確かめる(モジュールを足して一覧を直し忘れると、テストが失敗する)。

### CI

[`.github/workflows/pr-title.yml`](../../.github/workflows/pr-title.yml) の `pr-title` ジョブが、プルリクエストのタイトルを検査する。

- **トリガー**: `opened`(作成)・`edited`(タイトルや本文の編集)・`synchronize`(コミットのプッシュ)・`reopened`(再オープン)。`edited` がないと、失敗したタイトルを直しても再検査されない。`synchronize` がないと、新しいコミットに対して必須チェックの結果がなく、マージできなくなる。
- ci.yml と分けたのは、`edited` を ci.yml に足すと、本文を直しただけで Lint などの5つのジョブまで再実行されるからである。
- **タイトルの渡し方**: `${{ github.event.pull_request.title }}` を `run:` の中に直接書くと、GitHub がシェルのスクリプトを作る前に文字列を埋め込む。タイトルに `` `…` `` や `$(…)` があると、それがコマンドとして実行されてしまう(スクリプトインジェクション)。そのため、タイトルはいったん環境変数 `PR_TITLE` に入れ、`printf '%s\n' "$PR_TITLE"` で標準入力から commitlint に渡す。環境変数の中身は、シェルにとってただの文字列である。`echo` ではなく `printf` を使うのは、`-n` で始まるタイトルなどを `echo` が特別に扱うことがあるため。

### 手元で試す

```sh
printf '%s\n' 'feat(finance): 口座間移動を追加' | pnpm --filter @lifeos/config exec commitlint --verbose
```

### 入れていないもの

- **Git フック**(コミットのたびに手元で検査する仕組み): main に入るのはタイトルだけなので、CI の検査で目的は果たせる。依存関係を増やさないために入れていない。
- **ブランチ名の検査**: Squash するとブランチ名は main に残らないため。
