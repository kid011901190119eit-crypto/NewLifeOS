# 0018: Lint と整形の方針

- ステータス: 承認
- 日付: 2026-11-04

## 背景
フェーズ2(Issue #8)で、ESLint・Prettier と、モジュール境界の検査(ADR 0015)を導入した。そのとき、次のことを決める必要があった。

- 境界のルール(`docs/design/module-system.md` §5.2)を、eslint-plugin-boundaries と dependency-cruiser の2つの道具で、どう定義するか。2つの道具は、ルールの書き方が違う。eslint-plugin-boundaries はファイルの場所の種類(要素)とポリシーで書き、dependency-cruiser はパスの正規表現で書く。
- ESLint で、型情報を使った検査をするか。
- Prettier で、何を整形の対象にするか。

## 検討した選択肢
**境界のルールの定義の仕方**
- 1つの共通の定義(要素の一覧と許可の表)を書き、2つの道具の設定をそこから作る: ルールを書く場所が1か所で済む / 書き方の違う2つの道具に合わせる変換の仕組みが必要になり、オーナーが説明できない仕組みになりやすい(AGENTS.md ルール8)
- 2つの道具で別々に定義し、同じフィクスチャで結果を比べるテストを書く: それぞれの設定が、その道具の普通の書き方のまま読める。片方の設定の誤りを、もう片方とテストで見つけられる / 同じルールを2か所に書くので、変えるときは両方を直す必要がある
- ESLint だけで定義する: 書く場所が1か所 / 循環依存などのグラフ全体の検査ができず、ADR 0015 の「3つの仕組み」を満たせない

**型情報を使った Lint**
- 使う(typescript-eslint の `recommendedTypeChecked`): `await` の付け忘れ(`no-floating-promises`)など、型がわからないと判定できないバグを見つけられる。DB・イベント・HTTP と非同期の処理が多いこのプロジェクトで効果が大きい / Lint が型チェックと同じくらい遅くなる。依存先のパッケージのビルド(`dist`)を待つ必要がある。tsconfig に含まれない設定ファイルの扱いを設定する必要がある
- 使わない(`recommended`): 速く、設定が簡単 / 型が必要なルールが使えない。あとから足すと、指摘がまとめて出る

## 決定
- 境界のルールは、**ESLint(eslint-plugin-boundaries)と dependency-cruiser で別々に定義する**。両方とも、§5.2 の表の1行ずつを「許可する行き先」として書き、モジュール名は書かずにワイルドカードとキャプチャで表す(§5.4)。
  - 2つの設定が食い違っていないことは、**同じフィクスチャ**(`packages/config/tests/fixtures/repo`、架空のモジュール `alpha`・`beta`)に両方をかけるテストで確かめる。違反するファイルが両方でエラーになり、違反しないファイルがどちらでもエラーにならないことを確かめる。
  - ルールを変えるときは、両方の設定とフィクスチャのテストを、同じプルリクエストで直す。
- ESLint は、**型情報を使った検査**(`recommendedTypeChecked`)を行う。型情報は各パッケージの tsconfig から作り(`projectService`)、Turborepo の `lint` タスクは `^build` を待つ。
- Prettier は既定の設定を使い、1行の最大文字数(`printWidth`)だけを 100 にする(既定の 80 では既存のコードが折り返されるため)。Markdown は整形の対象外にする(既存のドキュメントが一度に36ファイル変わるため。入れる場合は、整形だけの別のプルリクエストで行う)。

## 結果
- 境界のルールに違反すると、エディタ(ESLint)と `pnpm lint`(ESLint と dependency-cruiser)で気づける。2つの道具の設定の誤りは、フィクスチャのテストで見つかる。
- 同じルールを2か所に書くので、変更の手間は2倍になる。フィクスチャのテストが、直し忘れを防ぐ。
- §5.2 の表にない組み合わせ(db・ui からの import など)は、ESLint では禁止(許可リスト方式)、dependency-cruiser では未検査になり、扱いが食い違う。モジュールを作るときに決める(#9)。→ #35 で決めた(ADR 0026)。core/web から db・コアのサーバー側への import は、画面のコードと同じ考え方(§4.2)で、両方の道具で禁止した。
- 型情報を使うので、Lint に時間がかかり、依存先のパッケージをビルドしてからでないと Lint できない。
- Markdown の書き方(表や空行)は、人とエージェントの注意に任せる。
- 詳細は学習ノート([ESLint](../learning/eslint.md)・[Prettier](../learning/prettier.md)・[eslint-plugin-boundaries](../learning/eslint-plugin-boundaries.md)・[dependency-cruiser](../learning/dependency-cruiser.md))にある。
