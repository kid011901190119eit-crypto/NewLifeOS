# TypeScript の設定(tsconfig)

## それは何か

**TypeScript** は、JavaScript に「型」(この変数には文字列が入る、この関数は日付を受け取る、など)を書けるようにした言語である。**`tsc`**(TypeScript コンパイラー)が型の矛盾を検査し(**型チェック**)、型を取り除いた JavaScript を出力する(**ビルド**)。

**`tsconfig.json`** は、`tsc` に「どのファイルを」「どの厳しさで検査し」「どんな JavaScript を出力するか」を伝える設定ファイルである。

このプロジェクトでは TypeScript 7 を使う。TypeScript 7 は、コンパイラーを Go 言語で書き直した版で、以前の版より大幅に速い。書き方や設定は以前とほぼ同じである。

## なぜ必要か

- 家計簿の金額や日付を扱うコードで、「文字列を渡すべきところに数値を渡した」といった間違いを、実行する前に見つけるため。
- 設定をパッケージごとにばらばらに書くと、パッケージによって検査の厳しさが変わってしまう。共通の設定を1か所(`packages/config`)に置き、各パッケージはそれを引き継ぐ(`extends`)。

## このプロジェクトでどう使うか

設定は3段になっている。

```
packages/config/tsconfig.base.json   全パッケージ共通(検査の厳しさ、出力の形式)
  └ packages/core/tsconfig.json        型チェック用(テストも含む、出力しない)
      └ packages/core/tsconfig.build.json  ビルド用(テストを除き、dist/ に出力する)
```

### `packages/config/tsconfig.base.json`

| 項目 | 何のためか |
|---|---|
| `target: "ES2024"` | 出力する JavaScript の世代。Node.js 24 は ES2024 の機能をそのまま実行できるので、古い書き方への変換をしない |
| `lib: ["ES2024"]` | 型チェックのときに「存在する」とみなす標準機能。ブラウザ用の `DOM` は入れない(画面のパッケージで個別に足す) |
| `module: "NodeNext"` / `moduleResolution: "NodeNext"` | import を Node.js と同じ規則で解決する。`package.json` の `"type": "module"` と `exports` を読む。そのため、相対パスの import には拡張子が必要になる(`./today.ts` を `"./today.js"` と書く。出力後のファイル名で書く決まり) |
| `types: []` | `@types/*` の型を自動で読み込まない。`packages/core` のドメインは Node.js にも依存しない(module-system.md §2.2)ので、Node.js の型(`@types/node`)も入れていない。必要なパッケージだけが個別に足す |
| `strict: true` | 厳しい検査をまとめて有効にする(`null` の扱い忘れ、型のない引数などを止める) |
| `noUncheckedIndexedAccess: true` | 配列の `arr[0]` などを「`undefined` かもしれない」として扱う。範囲外アクセスの見落としを防ぐ |
| `verbatimModuleSyntax: true` | 型だけの import は `import type` と書くことを強制する。出力に何が残るかが、書いたとおりになる |
| `isolatedModules: true` | 1ファイルずつ変換するツール(Vitest など)でも正しく変換できる書き方だけを許す |
| `declaration` / `declarationMap` | ビルドのときに型の定義ファイル(`.d.ts`)と、その元の位置の情報を出力する。ほかのパッケージから使ったときに型が効き、エディタで定義元の `.ts` へジャンプできる |
| `sourceMap: true` | 出力した `.js` と元の `.ts` の対応表を出す。エラーの行番号が `.ts` のもので表示される |
| `skipLibCheck: true` | `node_modules` の中の `.d.ts` は検査しない。自分のコードの検査に集中し、速くする |

### `packages/core/tsconfig.json`(型チェック用)

| 項目 | 何のためか |
|---|---|
| `extends: "@lifeos/config/tsconfig.base.json"` | 共通設定を引き継ぐ。パッケージ名で指定できるのは、`@lifeos/config` が依存関係として入っているから |
| `noEmit: true` | 検査だけして、ファイルは出力しない(`pnpm typecheck` 用) |
| `include: ["src"]` | `src/` の下をすべて検査する。テストファイル(`*.test.ts`)も含む |

`vitest.config.ts` は検査の対象に入れていない。読み込む共通設定が `.js` で、型の定義ファイルがないためである(Vitest の実行時には問題なく読まれる)。

### `packages/core/tsconfig.build.json`(ビルド用)

| 項目 | 何のためか |
|---|---|
| `extends: "./tsconfig.json"` | 型チェック用の設定を引き継ぐ |
| `noEmit: false` | 出力する |
| `rootDir: "src"` / `outDir: "dist"` | `src/clock/today.ts` を `dist/clock/today.js` に出力する(フォルダの構造を保つ) |
| `exclude: ["src/**/*.test.ts"]` | テストはビルドの成果物に含めない |

型チェック用とビルド用を分けたのは、「テストも型チェックしたい」と「テストは出力したくない」を両立させるためである。

### コマンド

- `pnpm typecheck` → 各パッケージで `tsc -p tsconfig.json`
- `pnpm build` → 各パッケージで `tsc -p tsconfig.build.json`(`-p` は使う設定ファイルの指定)
