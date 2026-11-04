# Vitest(テストの実行)

## それは何か

**Vitest** は、JavaScript と TypeScript のテストを書いて実行するための道具(テストフレームワーク)である。`.ts` のテストを、事前にビルドせずにそのまま実行できる。画面のビルドに使う Vite と同じ仕組みで動くので、フェーズ5で画面を作るときも同じ道具でテストできる。

テストは次の3つの関数で書く。

- `describe("…", () => { … })`: テストをまとめる見出し
- `it("…", () => { … })`: 1つのテスト。名前に「何を保証するか」を書く(このプロジェクトでは日本語)
- `expect(実際の値).toBe(期待する値)`: 確かめる内容。一致しなければテストは失敗する

## なぜ必要か

- このプロジェクトは TDD で進める(ADR 0008)。「失敗するテストを書く → 通す → 整える」を繰り返すには、テストをすばやく実行できる道具が要る。
- テストの名前を日本語で並べると、そのまま仕様書として読める(AGENTS.md ルール3)。

## このプロジェクトでどう使うか

### `packages/config/vitest.base.js`(共通設定)

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

| 項目 | 何のためか |
|---|---|
| `defineConfig` | 中身はそのまま返すだけの関数。エディタで設定の補完と検査を効かせるために使う |
| `test.include` | テストファイルの場所の決まり。テストは、対象のファイルと同じフォルダに `〇〇.test.ts` として置く |
| `test.environment: "node"` | テストを Node.js の環境で実行する。画面のテストでは、ブラウザに似た環境に変える予定 |

このファイルだけ `.ts` ではなく `.js` で書いている。`packages/config` はビルドしないパッケージなので、ほかのパッケージから `.ts` を直接読ませると、読み込む道具によって動いたり動かなかったりするためである。

### `packages/core/vitest.config.ts`(各パッケージの設定)

共通設定を読み込んで、そのまま使う。パッケージ固有の設定が必要になったら、Vitest の `mergeConfig` で共通設定に足す。

### テストの例

`packages/core/src/clock/today.test.ts` が最初のテストである。「今日の日付」は実行した時刻で変わってしまうので、関数 `todayInTokyo(now)` は現在時刻を引数で受け取る。テストでは時刻を固定した `Date` を渡し、UTC の15時(日本時間の0時)の前後や、月末・年末をまたぐ場合を確かめている。

### コマンド

- `pnpm test`: すべてのパッケージのテストを1回実行する(各パッケージで `vitest run`)
- `pnpm test:integration`: 本物の PostgreSQL を使う結合テスト(`*.integration.test.ts`)を実行する。解説は [Testcontainers](testcontainers.md)
- `pnpm --filter @lifeos/core exec vitest`: ファイルを保存するたびにテストを実行し直す監視モード。TDD で手を動かすときに使う
