import { describe, expect, it } from "vitest";
import {
  fromPostings,
  toOpeningPostings,
  toPostings,
  type OpeningInput,
  type Posting,
  type SystemAccounts,
  type TransactionInput,
} from "./posting-conversion.js";

// 勘定の ID は、読みやすさのため docs/design/finance-data-model.md §4.3 の架空の勘定名をそのまま使う
const 現金 = "現金";
const 電子マネー = "電子マネー";
const 食費 = "食費";
const お小遣い = "お小遣い";
const Aさん = "Aさん";
const Bさん = "Bさん";
const system: SystemAccounts = { uncategorizedId: "未分類", openingBalanceId: "開始残高" };

const account = (accountId: string, amount: number): Posting => ({
  accountId,
  role: "account",
  amount,
});
const counter = (accountId: string, amount: number): Posting => ({
  accountId,
  role: "counter",
  amount,
});

const sum = (postings: Posting[]): number => postings.reduce((total, p) => total + p.amount, 0);

function openingPostings(input: OpeningInput): Posting[] {
  const result = toOpeningPostings(input, system);
  if (!result.ok) throw new Error(`開始残高の変換が拒否された: ${result.error}`);
  return result.postings;
}

describe("§4.3 変換表", () => {
  it("#1 支出: 現金、-800、食費 → 現金 -800 / 食費 +800", () => {
    expect(
      toPostings({ kind: "regular", accountId: 現金, amount: -800, labelId: 食費 }, system),
    ).toEqual([account(現金, -800), counter(食費, 800)]);
  });

  it("#2 収入: 現金、+1000、お小遣い → 現金 +1000 / お小遣い -1000", () => {
    expect(
      toPostings({ kind: "regular", accountId: 現金, amount: 1000, labelId: お小遣い }, system),
    ).toEqual([account(現金, 1000), counter(お小遣い, -1000)]);
  });

  it("#3 返金(支出ラベルに+): 現金、+300、食費 → 現金 +300 / 食費 -300", () => {
    expect(
      toPostings({ kind: "regular", accountId: 現金, amount: 300, labelId: 食費 }, system),
    ).toEqual([account(現金, 300), counter(食費, -300)]);
  });

  it("#4 収入の取り消し(収入ラベルに-): 現金、-200、お小遣い → 現金 -200 / お小遣い +200", () => {
    expect(
      toPostings({ kind: "regular", accountId: 現金, amount: -200, labelId: お小遣い }, system),
    ).toEqual([account(現金, -200), counter(お小遣い, 200)]);
  });

  it("#5 ラベルなし: 現金、-500、(なし) → 現金 -500 / 未分類 +500", () => {
    expect(
      toPostings({ kind: "regular", accountId: 現金, amount: -500, labelId: null }, system),
    ).toEqual([account(現金, -500), counter("未分類", 500)]);
  });

  it("#6 移動: 現金 → 移動先 電子マネー、-1000 → 現金 -1000 / 電子マネー +1000", () => {
    expect(
      toPostings(
        { kind: "transfer", fromAccountId: 現金, amount: -1000, toAccountId: 電子マネー },
        system,
      ),
    ).toEqual([account(現金, -1000), counter(電子マネー, 1000)]);
  });

  it("#7 移動(逆向きの符号): 現金 → 移動先 電子マネー、+1000 → 現金 +1000 / 電子マネー -1000", () => {
    expect(
      toPostings(
        { kind: "transfer", fromAccountId: 現金, amount: 1000, toAccountId: 電子マネー },
        system,
      ),
    ).toEqual([account(現金, 1000), counter(電子マネー, -1000)]);
  });

  it("#8 移動先なし: 現金 → (なし)、-1000 → 現金 -1000 / 未分類 +1000", () => {
    expect(
      toPostings(
        { kind: "transfer", fromAccountId: 現金, amount: -1000, toAccountId: null },
        system,
      ),
    ).toEqual([account(現金, -1000), counter("未分類", 1000)]);
  });

  it("#9 移動元=移動先: 現金 → 移動先 現金、-1000 → 現金 -1000 / 現金 +1000", () => {
    expect(
      toPostings(
        { kind: "transfer", fromAccountId: 現金, amount: -1000, toAccountId: 現金 },
        system,
      ),
    ).toEqual([account(現金, -1000), counter(現金, 1000)]);
  });

  it("#10 貸す: 現金、-500、貸す、Aさん → 現金 -500 / Aさん +500", () => {
    expect(
      toPostings({ kind: "lend", accountId: 現金, amount: -500, partyId: Aさん }, system),
    ).toEqual([account(現金, -500), counter(Aさん, 500)]);
  });

  it("#11 貸しの回収: 現金、+500、貸す、Aさん → 現金 +500 / Aさん -500", () => {
    expect(
      toPostings({ kind: "lend", accountId: 現金, amount: 500, partyId: Aさん }, system),
    ).toEqual([account(現金, 500), counter(Aさん, -500)]);
  });

  it("#12 借りる: 現金、+700、借りる、Aさん → 現金 +700 / Aさん -700", () => {
    expect(
      toPostings({ kind: "borrow", accountId: 現金, amount: 700, partyId: Aさん }, system),
    ).toEqual([account(現金, 700), counter(Aさん, -700)]);
  });

  it("#13 借りの返済: 現金、-700、借りる、Aさん → 現金 -700 / Aさん +700", () => {
    expect(
      toPostings({ kind: "borrow", accountId: 現金, amount: -700, partyId: Aさん }, system),
    ).toEqual([account(現金, -700), counter(Aさん, 700)]);
  });

  it("#14 相手なし: 現金、-500、貸す、(なし) → 現金 -500 / 未分類 +500", () => {
    expect(
      toPostings({ kind: "lend", accountId: 現金, amount: -500, partyId: null }, system),
    ).toEqual([account(現金, -500), counter("未分類", 500)]);
  });

  it("#15 開始残高: 現金 10000、電子マネー 3000、Aさん +500 → 現金 +10000、電子マネー +3000、Aさん +500 / 開始残高 -13500", () => {
    expect(
      openingPostings({
        assets: [
          { accountId: 現金, amount: 10000 },
          { accountId: 電子マネー, amount: 3000 },
        ],
        loans: [{ partyId: Aさん, amount: 500 }],
      }),
    ).toEqual([
      account(現金, 10000),
      account(電子マネー, 3000),
      account(Aさん, 500),
      counter("開始残高", -13500),
    ]);
  });

  it("#16 開始残高(借りあり): 現金 1000、Aさん -1000 → 現金 +1000、Aさん -1000(開始残高の仕訳なし)", () => {
    expect(
      openingPostings({
        assets: [{ accountId: 現金, amount: 1000 }],
        loans: [{ partyId: Aさん, amount: -1000 }],
      }),
    ).toEqual([account(現金, 1000), account(Aさん, -1000)]);
  });

  it("#17 開始残高(0の口座): 現金 1000、電子マネー 0 → 現金 +1000 / 開始残高 -1000", () => {
    expect(
      openingPostings({
        assets: [
          { accountId: 現金, amount: 1000 },
          { accountId: 電子マネー, amount: 0 },
        ],
        loans: [],
      }),
    ).toEqual([account(現金, 1000), counter("開始残高", -1000)]);
  });
});

describe("§9.1 仕訳の変換", () => {
  it("支出は、口座にマイナス・支出ラベルにプラスの仕訳になる", () => {
    expect(
      toPostings({ kind: "regular", accountId: 現金, amount: -800, labelId: 食費 }, system),
    ).toEqual([account(現金, -800), counter(食費, 800)]);
  });

  it("収入は、口座にプラス・収入ラベルにマイナスの仕訳になる", () => {
    expect(
      toPostings({ kind: "regular", accountId: 現金, amount: 1000, labelId: お小遣い }, system),
    ).toEqual([account(現金, 1000), counter(お小遣い, -1000)]);
  });

  it("支出ラベルにプラスの金額を入れると、返金として支出ラベルが減る仕訳になる", () => {
    expect(
      toPostings({ kind: "regular", accountId: 現金, amount: 300, labelId: 食費 }, system),
    ).toEqual([account(現金, 300), counter(食費, -300)]);
  });

  it("収入ラベルにマイナスの金額を入れると、収入ラベルが減る仕訳になる", () => {
    expect(
      toPostings({ kind: "regular", accountId: 現金, amount: -200, labelId: お小遣い }, system),
    ).toEqual([account(現金, -200), counter(お小遣い, 200)]);
  });

  it("ラベルのない支出・収入は、相手側が未分類の仕訳になる", () => {
    expect(
      toPostings({ kind: "regular", accountId: 現金, amount: -500, labelId: null }, system),
    ).toEqual([account(現金, -500), counter("未分類", 500)]);
    expect(
      toPostings({ kind: "regular", accountId: 現金, amount: 500, labelId: null }, system),
    ).toEqual([account(現金, 500), counter("未分類", -500)]);
  });

  it("移動は、移動元に入力した金額・移動先に符号を反転した金額の仕訳になる", () => {
    expect(
      toPostings(
        { kind: "transfer", fromAccountId: 現金, amount: -1000, toAccountId: 電子マネー },
        system,
      ),
    ).toEqual([account(現金, -1000), counter(電子マネー, 1000)]);
  });

  it("移動の金額がプラスのときは、移動先から移動元へお金が入る仕訳になる", () => {
    expect(
      toPostings(
        { kind: "transfer", fromAccountId: 現金, amount: 1000, toAccountId: 電子マネー },
        system,
      ),
    ).toEqual([account(現金, 1000), counter(電子マネー, -1000)]);
  });

  it("移動先のない移動は、相手側が未分類の仕訳になる", () => {
    expect(
      toPostings(
        { kind: "transfer", fromAccountId: 現金, amount: -1000, toAccountId: null },
        system,
      ),
    ).toEqual([account(現金, -1000), counter("未分類", 1000)]);
  });

  it("移動元と移動先が同じ移動は、同じ口座への2行の仕訳になる", () => {
    expect(
      toPostings(
        { kind: "transfer", fromAccountId: 現金, amount: -1000, toAccountId: 現金 },
        system,
      ),
    ).toEqual([account(現金, -1000), counter(現金, 1000)]);
  });

  it("貸すでマイナスの金額は、口座が減り相手の貸し借りの残高が増える", () => {
    expect(
      toPostings({ kind: "lend", accountId: 現金, amount: -500, partyId: Aさん }, system),
    ).toEqual([account(現金, -500), counter(Aさん, 500)]);
  });

  it("貸すでプラスの金額は、回収として口座が増え相手の貸し借りの残高が減る", () => {
    expect(
      toPostings({ kind: "lend", accountId: 現金, amount: 500, partyId: Aさん }, system),
    ).toEqual([account(現金, 500), counter(Aさん, -500)]);
  });

  it("借りるでプラスの金額は、口座が増え相手の貸し借りの残高が減る", () => {
    expect(
      toPostings({ kind: "borrow", accountId: 現金, amount: 700, partyId: Aさん }, system),
    ).toEqual([account(現金, 700), counter(Aさん, -700)]);
  });

  it("借りるでマイナスの金額は、返済として口座が減り相手の貸し借りの残高が増える", () => {
    expect(
      toPostings({ kind: "borrow", accountId: 現金, amount: -700, partyId: Aさん }, system),
    ).toEqual([account(現金, -700), counter(Aさん, 700)]);
  });

  it("貸すと借りるは、同じ金額なら同じ仕訳になり、種別だけが異なる", () => {
    for (const amount of [-500, 500]) {
      const lend = toPostings({ kind: "lend", accountId: 現金, amount, partyId: Aさん }, system);
      const borrow = toPostings(
        { kind: "borrow", accountId: 現金, amount, partyId: Aさん },
        system,
      );
      expect(lend).toEqual(borrow);
      expect(fromPostings("lend", lend, system).kind).toBe("lend");
      expect(fromPostings("borrow", borrow, system).kind).toBe("borrow");
    }
  });

  it("相手のない貸し借りは、相手側が未分類の仕訳になる", () => {
    expect(
      toPostings({ kind: "lend", accountId: 現金, amount: -500, partyId: null }, system),
    ).toEqual([account(現金, -500), counter("未分類", 500)]);
    expect(
      toPostings({ kind: "borrow", accountId: 現金, amount: 700, partyId: null }, system),
    ).toEqual([account(現金, 700), counter("未分類", -700)]);
  });

  it("開始残高は、口座と相手ごとの仕訳と、合計を打ち消す開始残高の仕訳になる", () => {
    expect(
      openingPostings({
        assets: [
          { accountId: 現金, amount: 10000 },
          { accountId: 電子マネー, amount: 3000 },
        ],
        loans: [
          { partyId: Aさん, amount: 500 },
          { partyId: Bさん, amount: -2000 },
        ],
      }),
    ).toEqual([
      account(現金, 10000),
      account(電子マネー, 3000),
      account(Aさん, 500),
      account(Bさん, -2000),
      counter("開始残高", -11500),
    ]);
  });

  it("開始残高で残高0の口座と相手は仕訳を作らない", () => {
    expect(
      openingPostings({
        assets: [
          { accountId: 現金, amount: 1000 },
          { accountId: 電子マネー, amount: 0 },
        ],
        loans: [{ partyId: Aさん, amount: 0 }],
      }),
    ).toEqual([account(現金, 1000), counter("開始残高", -1000)]);
  });

  it("開始残高の合計が0のときは、開始残高の勘定の仕訳を作らない", () => {
    expect(
      openingPostings({
        assets: [{ accountId: 現金, amount: 1000 }],
        loans: [{ partyId: Aさん, amount: -1000 }],
      }),
    ).toEqual([account(現金, 1000), account(Aさん, -1000)]);
  });

  it("開始残高で仕訳が2行未満になる入力は拒否される", () => {
    const rejected = { ok: false, error: "too_few_postings" };
    expect(toOpeningPostings({ assets: [], loans: [] }, system)).toEqual(rejected);
    expect(
      toOpeningPostings(
        { assets: [{ accountId: 現金, amount: 0 }], loans: [{ partyId: Aさん, amount: 0 }] },
        system,
      ),
    ).toEqual(rejected);
  });

  it("開始残高で同じ勘定が2回出てくる入力は拒否される", () => {
    const rejected = { ok: false, error: "duplicate_account" };
    expect(
      toOpeningPostings(
        {
          assets: [
            { accountId: 現金, amount: 1000 },
            { accountId: 現金, amount: 2000 },
          ],
          loans: [],
        },
        system,
      ),
    ).toEqual(rejected);
    expect(
      toOpeningPostings(
        {
          assets: [{ accountId: 現金, amount: 1000 }],
          loans: [
            { partyId: Aさん, amount: 500 },
            { partyId: Aさん, amount: 0 },
          ],
        },
        system,
      ),
    ).toEqual(rejected);
  });

  const inputsOfEveryKind: TransactionInput[] = [
    { kind: "regular", accountId: 現金, amount: -800, labelId: 食費 },
    { kind: "regular", accountId: 現金, amount: 1000, labelId: null },
    { kind: "transfer", fromAccountId: 現金, amount: -1000, toAccountId: 電子マネー },
    { kind: "transfer", fromAccountId: 現金, amount: 1000, toAccountId: 現金 },
    { kind: "lend", accountId: 現金, amount: -500, partyId: Aさん },
    { kind: "borrow", accountId: 現金, amount: 700, partyId: null },
  ];
  const openingInput: OpeningInput = {
    assets: [
      { accountId: 現金, amount: 10000 },
      { accountId: 電子マネー, amount: 3000 },
    ],
    loans: [{ partyId: Aさん, amount: -500 }],
  };

  it("どの種別でも、変換した仕訳の合計は0になる", () => {
    for (const input of inputsOfEveryKind) {
      expect(sum(toPostings(input, system)), input.kind).toBe(0);
    }
    expect(sum(openingPostings(openingInput)), "opening").toBe(0);
  });

  it("どの種別でも、口座側の仕訳の金額は画面で入力した金額と等しい", () => {
    for (const input of inputsOfEveryKind) {
      const accountSide = toPostings(input, system).filter((p) => p.role === "account");
      expect(accountSide, input.kind).toHaveLength(1);
      expect(accountSide[0]?.amount, input.kind).toBe(input.amount);
    }
    const openingAccountSide = openingPostings(openingInput)
      .filter((p) => p.role === "account")
      .map((p) => ({ accountId: p.accountId, amount: p.amount }));
    expect(openingAccountSide).toEqual([
      ...openingInput.assets,
      ...openingInput.loans.map((l) => ({ accountId: l.partyId, amount: l.amount })),
    ]);
  });

  it("仕訳から編集画面の入力(種別・口座・金額・相手側)を復元できる", () => {
    for (const input of inputsOfEveryKind) {
      expect(fromPostings(input.kind, toPostings(input, system), system), input.kind).toEqual(
        input,
      );
    }
  });
});

describe("逆変換(仕訳 → 編集画面の入力)の細部", () => {
  it("相手側が未分類の勘定なら、相手側は「なし」として復元する", () => {
    expect(
      fromPostings("transfer", [account(現金, -1000), counter("未分類", 1000)], system),
    ).toEqual({ kind: "transfer", fromAccountId: 現金, amount: -1000, toAccountId: null });
  });

  it("仕訳の並び順に関係なく、role で口座側と相手側を見分ける", () => {
    expect(fromPostings("transfer", [counter(現金, 1000), account(現金, -1000)], system)).toEqual({
      kind: "transfer",
      fromAccountId: 現金,
      amount: -1000,
      toAccountId: 現金,
    });
  });

  it("口座側と相手側が1行ずつでない仕訳は、復元できずエラーになる", () => {
    expect(() =>
      fromPostings("regular", [account(現金, -800), account(食費, 800)], system),
    ).toThrow();
    expect(() => fromPostings("regular", [account(現金, -800)], system)).toThrow();
  });
});
