# 判別可能なユニオン型と結果の型

## それは何か

**ユニオン型**は「A か B のどちらか」を表す TypeScript の型である(`A | B`)。そのうち、どの形かを見分けるための共通の項目(多くは `kind` や `ok`)を持つものを**判別可能なユニオン型**(discriminated union)と呼ぶ。

```ts
type TransferInput = { kind: "transfer"; fromAccountId: string; amount: number; toAccountId: string | null };
type RegularInput = { kind: "regular"; accountId: string; amount: number; labelId: string | null };
type TransactionInput = RegularInput | TransferInput;

function counterOf(input: TransactionInput) {
  if (input.kind === "transfer") {
    return input.toAccountId; // ここでは TransferInput として扱われる
  }
  return input.labelId; // ここでは RegularInput として扱われる
}
```

`if` や `switch` で `kind` を確かめると、TypeScript はその中で型を絞り込む(narrowing)。移動の入力に `labelId` を書くと、型チェックでエラーになる。

**結果の型**は、同じ考え方で「成功か失敗か」を表すものである。

```ts
type OpeningResult = { ok: true; postings: Posting[] } | { ok: false; error: "too_few_postings" | "duplicate_account" };
```

## なぜ必要か

- 画面の操作ごとに入力の項目が違う(支出はラベル、移動は移動先、貸し借りは相手)。1つの型にまとめると「移動にラベル」のような誤った組み合わせを作れてしまう。種別ごとの型に分けると、そうした誤りを**動かす前に**型チェックで見つけられる。
- 例外(`throw`)は関数の型に現れないので、呼ぶ側が受け止め忘れても気づけない。結果の型なら、`ok` を確かめないと `postings` を取り出せないため、処理忘れが型エラーになる。

## このプロジェクトでどう使うか

- `packages/modules/finance/src/domain/posting-conversion.ts` の `TransactionInput` が、種別(`regular` / `transfer` / `lend`・`borrow`)ごとの判別可能なユニオン型である。
- 開始残高の変換 `toOpeningPostings` は結果の型を返す。入力の間違い(仕訳が2行未満、同じ勘定が2回)は普通に起こりうるので例外にしない。
- 一方で、保存済みの仕訳が壊れていて逆変換できない場合はプログラムかデータの誤りなので、例外にしている。
- 判断の記録は [ADR 0028](../adr/0028-finance-posting-conversion-types.md)。
