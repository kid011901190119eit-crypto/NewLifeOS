# 0027: Drizzle 0.45 を使い、apps/migrate が registry の一覧から core → モジュールの順にマイグレーションを適用する

- ステータス: 承認
- 日付: 2026-11-05

## 背景
ADR 0014 と `docs/design/module-system.md` §4.4 で、「モジュールごとのスキーマと適用履歴」「core を先に適用する migrate コマンド」「api などは起動時に適用しない」は決まっていた。Issue #37 で実装するにあたり、次の点が未決だった。

- `packages/registry` と `defineModule` はフェーズ4で作る予定で、まだない。
- `packages/db` はいちばん下の層で、core やモジュールを import できない(ADR 0026)。
- Drizzle は 0.45(安定版)と 1.0(rc)が出ている。
- Drizzle の `migrate` は、履歴の置き場所のスキーマを、マイグレーションより先に `CREATE SCHEMA IF NOT EXISTS` で作る。そのため、drizzle-kit が生成した `CREATE SCHEMA "<id>";` は「もうある」で失敗する(結合テストで確認した)。

## 検討した選択肢
**migrate の置き場所**
- `apps/migrate` を新しく作る: api・mcp・worker と並ぶプロセスとして、ADR 0014 に合う / アプリが1つ増え、§5.2 の表と検査に行を足す
- `packages/db` のコマンドにする: パッケージが増えない / db はモジュールを import できないので、一覧をパスの文字列で持つことになり、境界の検査にも型チェックにも見えない

**migrate がモジュールの一覧を知る方法**
- `packages/registry` を最小限で作る: 境界の検査と型チェックが効き、§2.3 どおりの場所になる / 作るファイルが数個増える
- migrate の中にパスの文字列で書く: 作業がいちばん少ない / 検査に見えず、フォルダを動かしても実行するまで気づけない
- migrate から finance を直接 import する: 型チェックは効く / §5.2 で × の組み合わせで、例外が要る

**Drizzle の版**
- 0.45 / drizzle-kit 0.31(安定版): 情報が多く、動きが落ち着いている / 1.0 が出たら、マイグレーションのフォルダの形式を移す必要がある
- 1.0.0-rc.5: これからの形式で作れる / 正式版ではなく、まだ変わるおそれがある

**接続先の渡し方**
- `DATABASE_URL`: 一般的な形で、コードが単純 / `.env` の中でパスワードが2か所になる
- `POSTGRES_*` から組み立てる: パスワードが1か所 / 組み立てるコードが増える

**`CREATE SCHEMA` のぶつかり**
- 最初のマイグレーションだけ `IF NOT EXISTS` に手で直す: §4.4 の「最初のマイグレーションで CREATE SCHEMA」がそのまま正しい / モジュールを足すたびに1回、手で直す
- 生成物から `CREATE SCHEMA` を消す: SQL が短い / 手作業は同じで、§4.4 を書き換える必要がある
- 履歴を共通の場所に置く: 生成物をそのまま使える / ADR 0014 の「履歴は各スキーマの中」に反する

## 決定
- `apps/migrate` を作る。`@lifeos/registry` の `serverModules` を読み、`@lifeos/core` の `coreMigrations` を先頭にして、`@lifeos/db/migrate` の `migrateSchemas` に渡す。
- `packages/registry` を最小限で作る。一覧の要素の型は `@lifeos/core` の `AnyModuleDefinition`(今は `id` と `migrations.folder` だけ)とし、フェーズ4で `defineModule` の項目を足して育てる。finance の `exports` は `./server` だけを足す(`./web`・`./public` と、Issue #9 の exports の検査はフェーズ4)。
- マイグレーションのフォルダは、各パッケージが `new URL("../../migrations", import.meta.url)` で自分の位置から求める。src と dist のどちらから読んでも同じフォルダを指すことを、テストで確かめる。
- Drizzle は `drizzle-orm` 0.45 と `drizzle-kit` 0.31 を使う。ドライバは既存の `pg` を使う。
- 接続先は環境変数 `DATABASE_URL` で渡す。`.env.example` の値が `POSTGRES_*` とずれないことを、テストで確かめる。
- 各モジュールの最初のマイグレーションは、生成のあと `CREATE SCHEMA IF NOT EXISTS "<id>";` に手で直す。直し忘れは `apps/migrate` のテストで検出する。
- `@lifeos/db/migrate` を import できるのは `apps/migrate` だけにし、ESLint と dependency-cruiser で検査する。

## 結果
- §8.3 のマイグレーションのテストケースが、結合テストで確かめられるようになった(`packages/db`・`apps/migrate`)。
- §5.2 の表に `apps/migrate` の行ができた。モジュールも `exports` で dist に解決されるので、境界の検査はモジュールの src と dist の両方を見る。dependency-cruiser には package.json の `exports` を読ませる。
- モジュールを足すときは、最初のマイグレーションを手で直す作業が1つ増える。
- drizzle-kit が中で使う esbuild のインストール用スクリプトは、`pnpm-workspace.yaml` の `allowBuilds` で `esbuild: false` にして止めている。pnpm 12 は、許可も禁止もしていないスクリプトがあるとインストールを失敗にするため、既存の `cpu-features` などと同じく、必要のないスクリプトは実行させない。esbuild の本体は、OS ごとの別パッケージとして入る。止めたままでも、`drizzle-kit generate` が core と finance で動くことを確かめた。
- 1.0 の正式版が出たら、移行するかを改めて決める。
- `migrate` をデプロイ時にどう呼ぶかは、引き続きフェーズ7で決める。
