# 0019: ビルドの前に dist を Node 標準の fs.rmSync で消し、Turborepo の clean タスクを build の前に実行する

- ステータス: 承認
- 日付: 2026-11-04

## 背景
`tsc -p tsconfig.build.json` は出力先の `dist/` を掃除しないので、ソースを消したり名前を変えたりしても、古いビルド結果(`.js`・`.d.ts`・`.map`)が残る(Issue #10)。

さらに、Turborepo のキャッシュから復元するとき(`cache hit`)は build スクリプト自体が実行されず、`outputs` のファイルを上書きするだけで余分なファイルは消さない。実際に、一時ソースを作ってビルドし、ソースを消して再ビルドすると、キャッシュヒットした場合に古いファイルが `dist/` に残ることを確かめた。そのため、build スクリプトの中で消すだけでは足りない。

## 検討した選択肢

消し方:
- Node 標準の `fs.rmSync`(`node -e` で実行): 利点 依存の追加がなく、Windows と Linux の両方で動き、中身が1行で説明できる / 欠点 クォートが入れ子になり少し読みにくい
- rimraf を追加: 利点 読みやすく定番 / 欠点 依存が1つ増える(更新・脆弱性対応の対象が増える)。Node 標準で同じことができる
- `tsc --build --clean`: 利点 依存の追加がない / 欠点 今のソースから作られるはずの出力しか消さないので、消したソースの古い出力は残る(完了の条件を満たさない)。composite の設定も必要

キャッシュから復元するときへの対応:
- turbo に `clean` タスク(`cache: false`)を作って build の `dependsOn` に入れ、build スクリプトにも clean を入れる: 利点 キャッシュを使ったまま、turbo 経由でも直接実行でも掃除される / 欠点 turbo 経由のキャッシュミス時は clean が2回動く(数ミリ秒)
- turbo の `clean` タスクだけ: 利点 重複がない / 欠点 `pnpm --filter @lifeos/core build` のように turbo を通さないと掃除されない
- build のキャッシュを無効にする: 利点 設定が最も単純 / 欠点 Turborepo のキャッシュの効果を捨てることになる

## 決定
`fs.rmSync` で消す `clean` スクリプトを、ビルドするパッケージに置く。build スクリプトの最初で `pnpm run clean` を実行し、`turbo.json` にも `clean` タスク(`cache: false`)を作って build の `dependsOn` に入れる。

## 結果
- ソースを消してからビルドしても、キャッシュから復元しても、`dist/` に古いファイルが残らない。
- ビルドするパッケージを増やすときは、`clean` スクリプトと `pnpm run clean && ` で始まる build スクリプトを書く。`packages/config/tests/clean-dist.test.ts` の `buildPackages` にも追加して、検査の対象にする。
