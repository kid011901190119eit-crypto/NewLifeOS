// 入力チェック(spec §3.3.1)の違反を「要確認」として導出する(docs/design/finance-data-model.md §6、ADR 0011・0031)
// 金額は安全な整数の number(円)。足し算と整数どうしの余りだけを使う

import type { AccountId, TransactionInput } from "./posting-conversion.js";

export type TransactionId = string;

export type ReviewRule =
  "transfer_destination" | "label_required" | "party_required" | "balance_unit";

export interface UnitAccount {
  id: AccountId;
  // 管理単位(円)。1以上の整数を前提とする(DB の CHECK 制約で守る)
  unitAmount: number;
}

// 口座の1行の仕訳。有効な(取消されていない)取引の仕訳だけを渡す前提(除くのは active_postings を使う SQL の仕事)
export interface BalanceEntry {
  transactionId: TransactionId;
  occurredOn: string;
  createdAt: Date;
  amount: number;
}

export interface AccountEntries {
  account: UnitAccount;
  entries: BalanceEntry[];
}

// 開始残高はルール1〜3の対象外なので、ここには入れず、仕訳を AccountEntries にだけ入れる
export interface ReviewTransaction {
  id: TransactionId;
  input: TransactionInput;
}

export function checkTransactionRules(input: TransactionInput): ReviewRule[] {
  switch (input.kind) {
    case "transfer":
      return input.toAccountId === null || input.toAccountId === input.fromAccountId
        ? ["transfer_destination"]
        : [];
    case "regular":
      return input.labelId === null ? ["label_required"] : [];
    case "lend":
    case "borrow":
      return input.partyId === null ? ["party_required"] : [];
  }
}

// 取引日 → 登録日時 → 取引の ID の順(設計書 §6)
function compareEntries(a: BalanceEntry, b: BalanceEntry): number {
  if (a.occurredOn !== b.occurredOn) return a.occurredOn < b.occurredOn ? -1 : 1;
  const byCreatedAt = a.createdAt.getTime() - b.createdAt.getTime();
  if (byCreatedAt !== 0) return byCreatedAt;
  if (a.transactionId === b.transactionId) return 0;
  return a.transactionId < b.transactionId ? -1 : 1;
}

function isMultipleOf(balance: number, unitAmount: number): boolean {
  // 負の残高では余りが -0 になるが、-0 === 0 は true なので倍数と判定される
  return balance % unitAmount === 0;
}

export function findUnitViolations(account: UnitAccount, entries: BalanceEntry[]): TransactionId[] {
  // 入力の配列を書き換えないように、コピーを並べ替える
  const sorted = [...entries].sort(compareEntries);

  // 同じ取引の仕訳は並べ替えると隣り合うので、取引ごとに合計してから累計残高を進める
  const netByTransaction: { transactionId: TransactionId; amount: number }[] = [];
  for (const entry of sorted) {
    const last = netByTransaction.at(-1);
    if (last && last.transactionId === entry.transactionId) {
      last.amount += entry.amount;
    } else {
      netByTransaction.push({ transactionId: entry.transactionId, amount: entry.amount });
    }
  }

  const violations: TransactionId[] = [];
  let balance = 0;
  for (const { transactionId, amount } of netByTransaction) {
    const before = balance;
    balance += amount;
    if (isMultipleOf(before, account.unitAmount) && !isMultipleOf(balance, account.unitAmount)) {
      violations.push(transactionId);
    }
  }
  return violations;
}

export function detectNeedsReview(
  transactions: ReviewTransaction[],
  accounts: AccountEntries[],
): Map<TransactionId, ReviewRule[]> {
  const result = new Map<TransactionId, ReviewRule[]>();
  const add = (id: TransactionId, rule: ReviewRule): void => {
    const rules = result.get(id) ?? [];
    // 移動で2つの口座が同時に倍数でなくなっても、同じルールは1回だけ返す
    if (!rules.includes(rule)) rules.push(rule);
    result.set(id, rules);
  };

  for (const { id, input } of transactions) {
    for (const rule of checkTransactionRules(input)) add(id, rule);
  }
  for (const { account, entries } of accounts) {
    for (const id of findUnitViolations(account, entries)) add(id, "balance_unit");
  }
  return result;
}
