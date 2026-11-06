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

export function checkTransactionRules(_input: TransactionInput): ReviewRule[] {
  return [];
}

export function findUnitViolations(
  _account: UnitAccount,
  _entries: BalanceEntry[],
): TransactionId[] {
  return [];
}

export function detectNeedsReview(
  _transactions: ReviewTransaction[],
  _accounts: AccountEntries[],
): Map<TransactionId, ReviewRule[]> {
  return new Map();
}
