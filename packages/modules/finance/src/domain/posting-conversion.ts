// 画面入力と仕訳の相互変換(docs/design/finance-data-model.md §4、ADR 0010・0028)
// 金額は安全な整数の number(円)。足し算と符号の反転だけを使う

export type AccountId = string;

export type PostingRole = "account" | "counter";

export interface Posting {
  accountId: AccountId;
  role: PostingRole;
  amount: number;
}

export interface SystemAccounts {
  uncategorizedId: AccountId;
  openingBalanceId: AccountId;
}

export interface RegularInput {
  kind: "regular";
  accountId: AccountId;
  amount: number;
  labelId: AccountId | null;
}

export interface TransferInput {
  kind: "transfer";
  fromAccountId: AccountId;
  amount: number;
  toAccountId: AccountId | null;
}

export interface LoanInput {
  kind: "lend" | "borrow";
  accountId: AccountId;
  amount: number;
  partyId: AccountId | null;
}

export type TransactionInput = RegularInput | TransferInput | LoanInput;

export type TransactionKind = TransactionInput["kind"];

export interface OpeningInput {
  assets: { accountId: AccountId; amount: number }[];
  loans: { partyId: AccountId; amount: number }[];
}

export type OpeningError = "too_few_postings" | "duplicate_account";

export type OpeningResult = { ok: true; postings: Posting[] } | { ok: false; error: OpeningError };

function accountSideOf(input: TransactionInput): AccountId {
  return input.kind === "transfer" ? input.fromAccountId : input.accountId;
}

function counterSideOf(input: TransactionInput): AccountId | null {
  switch (input.kind) {
    case "regular":
      return input.labelId;
    case "transfer":
      return input.toAccountId;
    case "lend":
    case "borrow":
      return input.partyId;
  }
}

export function toPostings(input: TransactionInput, system: SystemAccounts): Posting[] {
  return [
    { accountId: accountSideOf(input), role: "account", amount: input.amount },
    {
      accountId: counterSideOf(input) ?? system.uncategorizedId,
      role: "counter",
      amount: -input.amount,
    },
  ];
}

export function toOpeningPostings(input: OpeningInput, system: SystemAccounts): OpeningResult {
  const entries = [
    ...input.assets,
    ...input.loans.map((loan) => ({ accountId: loan.partyId, amount: loan.amount })),
  ];

  const seen = new Set<AccountId>();
  for (const entry of entries) {
    if (seen.has(entry.accountId)) return { ok: false, error: "duplicate_account" };
    seen.add(entry.accountId);
  }

  const postings: Posting[] = entries
    .filter((entry) => entry.amount !== 0)
    .map((entry) => ({ accountId: entry.accountId, role: "account", amount: entry.amount }));

  const total = postings.reduce((sum, posting) => sum + posting.amount, 0);
  if (total !== 0) {
    postings.push({ accountId: system.openingBalanceId, role: "counter", amount: -total });
  }

  if (postings.length < 2) return { ok: false, error: "too_few_postings" };
  return { ok: true, postings };
}

// 保存済みの仕訳が壊れているのはプログラムかデータの誤りなので、結果の型ではなく例外にする
export function fromPostings(
  kind: TransactionKind,
  postings: Posting[],
  system: SystemAccounts,
): TransactionInput {
  const accountSide = postings.filter((p) => p.role === "account");
  const counterSide = postings.filter((p) => p.role === "counter");
  const [account] = accountSide;
  const [counter] = counterSide;
  if (accountSide.length !== 1 || counterSide.length !== 1 || !account || !counter) {
    throw new Error("口座側と相手側の仕訳が1行ずつではないので、入力を復元できない");
  }

  const counterId = counter.accountId === system.uncategorizedId ? null : counter.accountId;
  switch (kind) {
    case "regular":
      return { kind, accountId: account.accountId, amount: account.amount, labelId: counterId };
    case "transfer":
      return {
        kind,
        fromAccountId: account.accountId,
        amount: account.amount,
        toAccountId: counterId,
      };
    case "lend":
    case "borrow":
      return { kind, accountId: account.accountId, amount: account.amount, partyId: counterId };
  }
}
