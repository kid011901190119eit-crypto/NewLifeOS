import { startPostgres, type TestPostgres } from "@lifeos/db/testing";
import pg from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import finance from "../server/index.js";

// SQLSTATE(PostgreSQL のエラーの種類)
const checkViolation = "23514";
const foreignKeyViolation = "23503";
const uniqueViolation = "23505";

const maxSafe = Number.MAX_SAFE_INTEGER;
// 安全な整数の範囲を1つ超える値。number では正確に表せないので、文字列で渡す
const beyondMaxSafe = "9007199254740992";
const beyondMinSafe = "-9007199254740992";

interface PostingInput {
  accountId: string;
  role: string;
  amount: number | string;
}

interface TransactionInput {
  id?: string;
  kind?: string;
  createdBy?: string;
  replacesId?: string | null;
  voidedAt?: Date | null;
  voidedBy?: string | null;
  postings: PostingInput[];
}

describe("家計簿のテーブルと DB の制約(finance-data-model.md §3・§5・§9.2)", () => {
  let postgres: TestPostgres;
  let client: pg.Client;
  let databaseCount = 0;

  beforeAll(async () => {
    postgres = await startPostgres();
  });

  afterAll(async () => {
    await postgres?.stop();
  });

  // 有効な開始残高は DB 全体で1件なので、テストごとにマイグレーション直後の空の DB を作る
  beforeEach(async () => {
    databaseCount += 1;
    const url = await postgres.createMigratedDatabase(`finance_test_${databaseCount}`, [
      { schema: finance.id, folder: finance.migrations.folder },
    ]);
    client = new pg.Client({ connectionString: url });
    await client.connect();
  });

  afterEach(async () => {
    await client?.end();
  });

  async function insertAccount(
    kind: string,
    name: string,
    options: { unitAmount?: number | string; systemKey?: string } = {},
  ): Promise<string> {
    const result = await client.query<{ id: string }>(
      `INSERT INTO finance.accounts (kind, name, unit_amount, system_key)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [kind, name, options.unitAmount ?? 1, options.systemKey ?? null],
    );
    return firstId(result);
  }

  async function systemAccountId(systemKey: string): Promise<string> {
    const result = await client.query<{ id: string }>(
      "SELECT id FROM finance.accounts WHERE system_key = $1",
      [systemKey],
    );
    return firstId(result);
  }

  function firstId(result: pg.QueryResult<{ id: string }>): string {
    const row = result.rows[0];
    if (row === undefined) throw new Error("行が返らなかった");
    return row.id;
  }

  // 同じ DB トランザクションの中で使う。取引と仕訳の INSERT だけを行い、BEGIN・COMMIT はしない
  async function insertTransactionRows(input: TransactionInput): Promise<string> {
    const result = await client.query<{ id: string }>(
      `INSERT INTO finance.transactions (id, kind, occurred_on, created_by, replaces_id, voided_at, voided_by)
       VALUES (coalesce($1, uuidv7()), $2, '2026-01-15', $3, $4, $5, $6) RETURNING id`,
      [
        input.id ?? null,
        input.kind ?? "regular",
        input.createdBy ?? "user",
        input.replacesId ?? null,
        input.voidedAt ?? null,
        input.voidedBy ?? null,
      ],
    );
    const id = firstId(result);
    for (const posting of input.postings) {
      await client.query(
        `INSERT INTO finance.postings (transaction_id, account_id, role, amount)
         VALUES ($1, $2, $3, $4)`,
        [id, posting.accountId, posting.role, posting.amount],
      );
    }
    return id;
  }

  async function inTransaction<T>(work: () => Promise<T>): Promise<T> {
    await client.query("BEGIN");
    try {
      const result = await work();
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  // 取引は、合計0の仕訳を2行以上付けて、1つの DB トランザクションで登録する
  function insertTransaction(input: TransactionInput): Promise<string> {
    return inTransaction(() => insertTransactionRows(input));
  }

  async function voidTransaction(id: string, voidedBy = "user"): Promise<void> {
    await client.query(
      "UPDATE finance.transactions SET voided_at = now(), voided_by = $2 WHERE id = $1",
      [id, voidedBy],
    );
  }

  /** 架空の口座2つの間で、合計0になる2行の仕訳を作る */
  async function balancedPostings(amount = 1000): Promise<PostingInput[]> {
    const cash = await insertAccount("asset", "テスト口座A");
    const label = await insertAccount("expense", "テスト支出ラベル");
    return [
      { accountId: cash, role: "account", amount: -amount },
      { accountId: label, role: "counter", amount },
    ];
  }

  /** 架空の口座の開始残高の仕訳(口座側と、システム勘定「開始残高」の相手側) */
  async function openingPostings(accountName: string, amount: number): Promise<PostingInput[]> {
    const account = await insertAccount("asset", accountName);
    return [
      { accountId: account, role: "account", amount },
      { accountId: await systemAccountId("opening_balance"), role: "counter", amount: -amount },
    ];
  }

  // どの種類のエラーで、どの制約に拒否されたか(同じテーブルの別の制約で拒否されたのに通る、を防ぐ)
  function rejection(code: string, constraint: string): unknown {
    return expect.objectContaining({ code, constraint }) as unknown;
  }

  describe("CHECK 制約・外部キー", () => {
    it("金額が0の仕訳は拒否される", async () => {
      const cash = await insertAccount("asset", "テスト口座A");
      const label = await insertAccount("expense", "テスト支出ラベル");

      await expect(
        insertTransaction({
          postings: [
            { accountId: cash, role: "account", amount: 0 },
            { accountId: label, role: "counter", amount: 0 },
          ],
        }),
      ).rejects.toEqual(rejection(checkViolation, "postings_amount_nonzero"));
    });

    it("安全な整数の範囲を超える金額の仕訳は拒否される", async () => {
      const cash = await insertAccount("asset", "テスト口座A");
      const label = await insertAccount("expense", "テスト支出ラベル");

      await expect(
        insertTransaction({
          postings: [
            { accountId: cash, role: "account", amount: beyondMinSafe },
            { accountId: label, role: "counter", amount: beyondMaxSafe },
          ],
        }),
      ).rejects.toEqual(rejection(checkViolation, "postings_amount_safe_integer"));
    });

    it("安全な整数の範囲の端の金額の仕訳は登録できる", async () => {
      const cash = await insertAccount("asset", "テスト口座A");
      const label = await insertAccount("expense", "テスト支出ラベル");

      const id = await insertTransaction({
        postings: [
          { accountId: cash, role: "account", amount: -maxSafe },
          { accountId: label, role: "counter", amount: maxSafe },
        ],
      });

      const result = await client.query<{ amount: string }>(
        "SELECT amount::text AS amount FROM finance.postings WHERE transaction_id = $1 ORDER BY amount",
        [id],
      );
      expect(result.rows.map((row) => row.amount)).toEqual([String(-maxSafe), String(maxSafe)]);
    });

    it("存在しない勘定への仕訳は拒否される", async () => {
      const cash = await insertAccount("asset", "テスト口座A");
      const missing = "01900000-0000-7000-8000-000000000000";

      await expect(
        insertTransaction({
          postings: [
            { accountId: cash, role: "account", amount: -100 },
            { accountId: missing, role: "counter", amount: 100 },
          ],
        }),
      ).rejects.toEqual(rejection(foreignKeyViolation, "postings_account_id_accounts_id_fk"));
    });

    it("存在しない取引への仕訳は拒否される", async () => {
      const cash = await insertAccount("asset", "テスト口座A");
      const missing = "01900000-0000-7000-8000-000000000000";

      await expect(
        client.query(
          `INSERT INTO finance.postings (transaction_id, account_id, role, amount)
           VALUES ($1, $2, 'account', 100)`,
          [missing, cash],
        ),
      ).rejects.toEqual(
        rejection(foreignKeyViolation, "postings_transaction_id_transactions_id_fk"),
      );
    });

    it("決められていない種別の勘定は拒否される", async () => {
      await expect(insertAccount("unknown", "テスト勘定")).rejects.toEqual(
        rejection(checkViolation, "accounts_kind_check"),
      );
    });

    it("決められていない種別の取引は拒否される", async () => {
      const postings = await balancedPostings();

      await expect(insertTransaction({ kind: "unknown", postings })).rejects.toEqual(
        rejection(checkViolation, "transactions_kind_check"),
      );
    });

    it("決められていない役割の仕訳は拒否される", async () => {
      const [account, counter] = await balancedPostings();
      if (account === undefined || counter === undefined) throw new Error("仕訳が足りない");

      await expect(
        insertTransaction({ postings: [account, { ...counter, role: "unknown" }] }),
      ).rejects.toEqual(rejection(checkViolation, "postings_role_check"));
    });

    it("作成元が user・agent 以外の取引は拒否される", async () => {
      const postings = await balancedPostings();

      await expect(insertTransaction({ createdBy: "someone", postings })).rejects.toEqual(
        rejection(checkViolation, "transactions_created_by_check"),
      );
    });

    it("口座以外の勘定に1以外の管理単位を設定すると拒否される", async () => {
      await expect(
        insertAccount("expense", "テスト支出ラベル", { unitAmount: 10 }),
      ).rejects.toEqual(rejection(checkViolation, "accounts_unit_amount_only_for_asset"));
    });

    it("管理単位が0以下の口座は拒否される", async () => {
      await expect(insertAccount("asset", "テスト口座A", { unitAmount: 0 })).rejects.toEqual(
        rejection(checkViolation, "accounts_unit_amount_range"),
      );
    });

    it("管理単位が安全な整数の範囲を超える口座は拒否される", async () => {
      await expect(
        insertAccount("asset", "テスト口座A", { unitAmount: beyondMaxSafe }),
      ).rejects.toEqual(rejection(checkViolation, "accounts_unit_amount_range"));
    });

    it("同じ種別で同じ名前の勘定は登録できない", async () => {
      await insertAccount("expense", "テストその他");

      await expect(insertAccount("expense", "テストその他")).rejects.toEqual(
        rejection(uniqueViolation, "accounts_kind_name_unique"),
      );
    });

    it("種別が違えば同じ名前の勘定を登録できる", async () => {
      await insertAccount("expense", "テストその他");
      await insertAccount("income", "テストその他");

      const result = await client.query<{ kind: string }>(
        "SELECT kind FROM finance.accounts WHERE name = 'テストその他' ORDER BY kind",
      );
      expect(result.rows.map((row) => row.kind)).toEqual(["expense", "income"]);
    });

    it("開始残高と未分類のシステム勘定はマイグレーション後に1件ずつある", async () => {
      const result = await client.query(
        `SELECT kind, name, system_key FROM finance.accounts
         WHERE kind IN ('equity', 'suspense') OR system_key IS NOT NULL ORDER BY kind`,
      );
      expect(result.rows).toEqual([
        { kind: "equity", name: "開始残高", system_key: "opening_balance" },
        { kind: "suspense", name: "未分類", system_key: "uncategorized" },
      ]);
    });

    it.each(["equity", "suspense"])(
      "利用者がシステム勘定の種別(%s)の勘定を新しく作ることはできない",
      async (kind) => {
        await expect(insertAccount(kind, "テストの勘定")).rejects.toEqual(
          rejection(checkViolation, "accounts_system_kind_has_system_key"),
        );
      },
    );

    it("すでにあるシステム勘定と同じ識別子の勘定は作れない", async () => {
      await expect(
        insertAccount("equity", "テストの開始残高", { systemKey: "opening_balance" }),
      ).rejects.toEqual(rejection(uniqueViolation, "accounts_system_key_unique"));
    });

    it.each([
      ["取消日時だけ", { voidedAt: new Date(), voidedBy: null }],
      ["取消した作成元だけ", { voidedAt: null, voidedBy: "user" }],
    ])("取消日時と取消した作成元は、片方だけ設定できない(%s)", async (_, voided) => {
      const postings = await balancedPostings();

      await expect(insertTransaction({ ...voided, postings })).rejects.toEqual(
        rejection(checkViolation, "transactions_voided_together"),
      );
    });
  });

  describe("開始残高", () => {
    it("有効な開始残高は1件だけ登録できる", async () => {
      await insertTransaction({
        kind: "opening",
        postings: await openingPostings("テスト口座A", 10000),
      });

      const result = await client.query(
        "SELECT 1 FROM finance.transactions WHERE kind = 'opening' AND voided_at IS NULL",
      );
      expect(result.rowCount).toBe(1);
    });

    it("2件目の開始残高は拒否される", async () => {
      await insertTransaction({
        kind: "opening",
        postings: await openingPostings("テスト口座A", 10000),
      });
      const second = await openingPostings("テスト口座B", 3000);

      await expect(insertTransaction({ kind: "opening", postings: second })).rejects.toEqual(
        rejection(uniqueViolation, "transactions_one_active_opening"),
      );
    });

    it("開始残高を取消すと、新しい開始残高を登録できる", async () => {
      const first = await insertTransaction({
        kind: "opening",
        postings: await openingPostings("テスト口座A", 10000),
      });
      await voidTransaction(first);

      const second = await insertTransaction({
        kind: "opening",
        postings: await openingPostings("テスト口座B", 3000),
      });

      const result = await client.query<{ id: string }>(
        "SELECT id FROM finance.transactions WHERE kind = 'opening' AND voided_at IS NULL",
      );
      expect(result.rows).toEqual([{ id: second }]);
    });

    it("開始残高を置き換えられる", async () => {
      const original = await insertTransaction({
        kind: "opening",
        postings: await openingPostings("テスト口座A", 10000),
      });
      const replacement = await openingPostings("テスト口座B", 3000);

      const replaced = await inTransaction(async () => {
        await voidTransaction(original);
        return insertTransactionRows({
          kind: "opening",
          replacesId: original,
          postings: replacement,
        });
      });

      const result = await client.query<{ id: string; replaces_id: string }>(
        "SELECT id, replaces_id FROM finance.transactions WHERE kind = 'opening' AND voided_at IS NULL",
      );
      expect(result.rows).toEqual([{ id: replaced, replaces_id: original }]);
    });
  });

  describe("取消・置き換え・作成元", () => {
    it("1つの取引を2回置き換えることはできない", async () => {
      const [account, counter] = await balancedPostings(1000);
      if (account === undefined || counter === undefined) throw new Error("仕訳が足りない");
      const original = await insertTransaction({ postings: [account, counter] });
      await inTransaction(async () => {
        await voidTransaction(original);
        await insertTransactionRows({
          replacesId: original,
          postings: [
            { ...account, amount: -2000 },
            { ...counter, amount: 2000 },
          ],
        });
      });

      await expect(
        insertTransaction({
          replacesId: original,
          postings: [
            { ...account, amount: -3000 },
            { ...counter, amount: 3000 },
          ],
        }),
      ).rejects.toEqual(rejection(uniqueViolation, "transactions_replaces_id_unique"));
    });

    it("取引は自分自身を置き換え元にできない", async () => {
      const id = "01900000-0000-7000-8000-000000000001";
      const postings = await balancedPostings();

      await expect(insertTransaction({ id, replacesId: id, postings })).rejects.toEqual(
        rejection(checkViolation, "transactions_replaces_other"),
      );
    });

    it("取引の作成元(user / agent)が記録される", async () => {
      const [account, counter] = await balancedPostings();
      if (account === undefined || counter === undefined) throw new Error("仕訳が足りない");
      const byUser = await insertTransaction({ createdBy: "user", postings: [account, counter] });
      const byAgent = await insertTransaction({
        createdBy: "agent",
        postings: [
          { ...account, amount: -500 },
          { ...counter, amount: 500 },
        ],
      });

      const result = await client.query<{ id: string; created_by: string }>(
        "SELECT id, created_by FROM finance.transactions WHERE id = ANY($1)",
        [[byUser, byAgent]],
      );
      expect(Object.fromEntries(result.rows.map((row) => [row.id, row.created_by]))).toEqual({
        [byUser]: "user",
        [byAgent]: "agent",
      });
    });
  });

  describe("ビューと冪等キー(§3.4・§3.5)", () => {
    it("取消した取引の仕訳は、ビュー active_postings に出ない", async () => {
      const [account, counter] = await balancedPostings();
      if (account === undefined || counter === undefined) throw new Error("仕訳が足りない");
      const kept = await insertTransaction({ postings: [account, counter] });
      const voided = await insertTransaction({
        postings: [
          { ...account, amount: -500 },
          { ...counter, amount: 500 },
        ],
      });
      await voidTransaction(voided);

      const result = await client.query<{ transaction_id: string }>(
        "SELECT DISTINCT transaction_id FROM finance.active_postings",
      );
      expect(result.rows).toEqual([{ transaction_id: kept }]);
    });

    it("同じ冪等キーは2回記録できない", async () => {
      const id = await insertTransaction({ postings: await balancedPostings() });
      const record = () =>
        client.query(
          `INSERT INTO finance.idempotency_keys (key, operation, request_hash, transaction_id, created_by)
           VALUES ('test-key-1', 'create', 'test-hash', $1, 'agent')`,
          [id],
        );
      await record();

      await expect(record()).rejects.toEqual(rejection(uniqueViolation, "idempotency_keys_pkey"));
    });
  });
});
