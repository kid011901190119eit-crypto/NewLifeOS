import { describe, expect, it } from "vitest";
import {
  checkTransactionRules,
  detectNeedsReview,
  findUnitViolations,
  type BalanceEntry,
  type UnitAccount,
} from "./needs-review.js";

// 勘定の ID は、読みやすさのため docs/design/finance-data-model.md §4.3 の架空の勘定名をそのまま使う
const 現金 = "現金";
const 電子マネー = "電子マネー";
const 食費 = "食費";
const Aさん = "Aさん";

const 千円単位の現金: UnitAccount = { id: 現金, unitAmount: 1000 };

function entry(
  transactionId: string,
  amount: number,
  occurredOn = "2026-11-01",
  createdAt = "2026-11-01T00:00:00.000Z",
): BalanceEntry {
  return { transactionId, occurredOn, createdAt: new Date(createdAt), amount };
}

describe("ルール1: 移動先は、移動元と別の口座であること", () => {
  it("ルール1: 移動先が移動元と別の口座なら要確認にならない", () => {
    expect(
      checkTransactionRules({
        kind: "transfer",
        fromAccountId: 現金,
        amount: -1000,
        toAccountId: 電子マネー,
      }),
    ).toEqual([]);
  });

  it("ルール1: 移動先が移動元と同じ口座なら要確認になる", () => {
    expect(
      checkTransactionRules({
        kind: "transfer",
        fromAccountId: 現金,
        amount: -1000,
        toAccountId: 現金,
      }),
    ).toEqual(["transfer_destination"]);
  });

  it("ルール1: 移動先のない移動は要確認になる", () => {
    expect(
      checkTransactionRules({
        kind: "transfer",
        fromAccountId: 現金,
        amount: -1000,
        toAccountId: null,
      }),
    ).toEqual(["transfer_destination"]);
  });
});

describe("ルール2: 移動以外の取引にはラベルが必須", () => {
  it("ルール2: ラベルのある支出・収入は要確認にならない", () => {
    expect(
      checkTransactionRules({ kind: "regular", accountId: 現金, amount: -800, labelId: 食費 }),
    ).toEqual([]);
  });

  it("ルール2: ラベルのない支出・収入は要確認になる", () => {
    expect(
      checkTransactionRules({ kind: "regular", accountId: 現金, amount: -500, labelId: null }),
    ).toEqual(["label_required"]);
  });

  it("ルール2: 移動・貸し借り・開始残高にはラベルを求めない", () => {
    expect(
      checkTransactionRules({
        kind: "transfer",
        fromAccountId: 現金,
        amount: -1000,
        toAccountId: 電子マネー,
      }),
    ).toEqual([]);
    expect(
      checkTransactionRules({ kind: "lend", accountId: 現金, amount: -500, partyId: Aさん }),
    ).toEqual([]);
    expect(
      checkTransactionRules({ kind: "borrow", accountId: 現金, amount: 700, partyId: Aさん }),
    ).toEqual([]);
    // 開始残高はルール1〜3の判定に渡さず、仕訳をルール4の入力にだけ入れる(ADR 0031)
    expect(
      detectNeedsReview(
        [],
        [
          {
            account: { id: 現金, unitAmount: 1 },
            entries: [entry("開始残高の取引", 10000)],
          },
        ],
      ),
    ).toEqual(new Map());
  });
});

describe("ルール3: 貸し借りには相手が必須", () => {
  it("ルール3: 相手のある貸し借りは要確認にならない", () => {
    expect(
      checkTransactionRules({ kind: "lend", accountId: 現金, amount: -500, partyId: Aさん }),
    ).toEqual([]);
    expect(
      checkTransactionRules({ kind: "borrow", accountId: 現金, amount: 700, partyId: Aさん }),
    ).toEqual([]);
  });

  it("ルール3: 相手のない貸す・借りるは要確認になる", () => {
    expect(
      checkTransactionRules({ kind: "lend", accountId: 現金, amount: -500, partyId: null }),
    ).toEqual(["party_required"]);
    expect(
      checkTransactionRules({ kind: "borrow", accountId: 現金, amount: 700, partyId: null }),
    ).toEqual(["party_required"]);
  });
});

describe("ルール4: 口座の残高が管理単位の倍数であること", () => {
  it("ルール4: 累計残高が管理単位の倍数のままなら要確認にならない", () => {
    expect(
      findUnitViolations(千円単位の現金, [
        entry("t1", 10000),
        entry("t2", -3000),
        entry("t3", -7000),
      ]),
    ).toEqual([]);
  });

  it("ルール4: 累計残高が倍数でなくなった取引が要確認になる", () => {
    expect(findUnitViolations(千円単位の現金, [entry("t1", 10000), entry("t2", -800)])).toEqual([
      "t2",
    ]);
  });

  it("ルール4: 倍数でない状態が続く間の後続の取引は要確認にならない", () => {
    expect(
      findUnitViolations(千円単位の現金, [
        entry("t1", 10000),
        entry("t2", -800),
        entry("t3", -1000),
        entry("t4", -50),
      ]),
    ).toEqual(["t2"]);
  });

  it("ルール4: 倍数に戻った後、再び倍数でなくなった取引が要確認になる", () => {
    expect(
      findUnitViolations(千円単位の現金, [
        entry("t1", 10000),
        entry("t2", -800),
        entry("t3", -200),
        entry("t4", -500),
      ]),
    ).toEqual(["t2", "t4"]);
  });

  it("ルール4: 管理単位が1の口座は要確認にならない", () => {
    expect(
      findUnitViolations({ id: 電子マネー, unitAmount: 1 }, [
        entry("t1", 3000),
        entry("t2", -123),
        entry("t3", -45),
      ]),
    ).toEqual([]);
  });

  it("ルール4: 同じ日の取引は登録順に累計残高を求める", () => {
    // 登録順は t2(-800)→ t1(-200)なので、倍数でなくなったのは t2 だけ
    const t1 = entry("t1", -200, "2026-11-02", "2026-11-02T03:00:00.000Z");
    const t2 = entry("t2", -800, "2026-11-02", "2026-11-02T01:00:00.000Z");
    const t0 = entry("t0", 10000, "2026-11-01", "2026-11-05T00:00:00.000Z");
    const entries = [t1, t2, t0];

    expect(findUnitViolations(千円単位の現金, entries)).toEqual(["t2"]);
    // 入力の配列は並べ替えない
    expect(entries).toEqual([t1, t2, t0]);
  });

  it("ルール4: 登録の順ではなく取引日の順に累計残高を求める", () => {
    // 取引日の順は t0 → t1(11/2)→ t2(11/3)。登録の順(t0 → t2 → t1)で累計すると t2 が要確認になってしまう
    const t0 = entry("t0", 10000, "2026-11-01", "2026-11-01T00:00:00.000Z");
    const t1 = entry("t1", -200, "2026-11-02", "2026-11-05T00:00:00.000Z");
    const t2 = entry("t2", -800, "2026-11-03", "2026-11-02T00:00:00.000Z");

    expect(findUnitViolations(千円単位の現金, [t0, t2, t1])).toEqual(["t1"]);
  });

  it("ルール4: 予定の取引も累計残高に含めて判定する", () => {
    // 基準日より後の日付(予定)の取引も、確定の取引と同じく累計する
    expect(
      findUnitViolations(千円単位の現金, [
        entry("確定", 10000, "2026-11-01"),
        entry("予定", -800, "2099-12-31"),
      ]),
    ).toEqual(["予定"]);
  });

  it("ルール4: 同じ取引の仕訳は合計してから累計残高を進める", () => {
    // 移動元=移動先の移動は、同じ口座に -500 と +500 の2行を持つ
    expect(
      findUnitViolations(千円単位の現金, [
        entry("t1", 10000),
        entry("t2", -500, "2026-11-02"),
        entry("t2", 500, "2026-11-02"),
      ]),
    ).toEqual([]);
  });

  it("ルール4: 累計残高が負でも、管理単位の倍数かどうかで判定する", () => {
    expect(findUnitViolations(千円単位の現金, [entry("t1", -3000), entry("t2", -500)])).toEqual([
      "t2",
    ]);
  });
});

describe("まとめた判定", () => {
  it("1つの取引が複数のルールに違反すると、違反したルールがすべて返る", () => {
    const result = detectNeedsReview(
      [
        { id: "t1", input: { kind: "regular", accountId: 現金, amount: -500, labelId: null } },
        { id: "t2", input: { kind: "regular", accountId: 現金, amount: -1000, labelId: 食費 } },
      ],
      [{ account: 千円単位の現金, entries: [entry("t1", -500), entry("t2", -1000)] }],
    );

    expect(result).toEqual(new Map([["t1", ["label_required", "balance_unit"]]]));
  });

  it("移動で2つの口座が倍数でなくなっても、ルール4は1回だけ返る", () => {
    const result = detectNeedsReview(
      [
        {
          id: "t1",
          input: { kind: "transfer", fromAccountId: 現金, amount: -500, toAccountId: 電子マネー },
        },
      ],
      [
        { account: 千円単位の現金, entries: [entry("t1", -500)] },
        { account: { id: 電子マネー, unitAmount: 1000 }, entries: [entry("t1", 500)] },
      ],
    );

    expect(result).toEqual(new Map([["t1", ["balance_unit"]]]));
  });
});
