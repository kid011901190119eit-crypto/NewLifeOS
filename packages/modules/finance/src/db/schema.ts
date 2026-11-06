import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  date,
  foreignKey,
  index,
  pgSchema,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// 家計簿のテーブルは、すべてこのスキーマの下に作る(module-system.md §2.2)
export const financeSchema = pgSchema("finance");

export const accountKinds = ["asset", "expense", "income", "loan", "equity", "suspense"] as const;
export const systemAccountKeys = ["opening_balance", "uncategorized"] as const;
export const transactionKinds = ["regular", "transfer", "lend", "borrow", "opening"] as const;
export const actors = ["user", "agent"] as const;
export const postingRoles = ["account", "counter"] as const;
export const idempotentOperations = ["create", "replace", "void"] as const;

// 金額は TypeScript で number として扱うので、DB でも安全な整数の範囲に収める(ADR 0028・0030)
const maxSafeInteger = sql.raw(String(Number.MAX_SAFE_INTEGER));

/** CHECK (列 IN ('a', 'b')) の条件。値は上の定数の一覧から作るので、SQL に外からの文字は入らない */
function oneOf(column: string, values: readonly string[]) {
  return sql.raw(`${column} IN (${values.map((value) => `'${value}'`).join(", ")})`);
}

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// finance-data-model.md §3.1
export const accounts = financeSchema.table(
  "accounts",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    kind: text("kind", { enum: accountKinds }).notNull(),
    name: text("name").notNull(),
    unitAmount: bigint("unit_amount", { mode: "number" }).notNull().default(1),
    systemKey: text("system_key", { enum: systemAccountKeys }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("accounts_kind_name_unique").on(table.kind, table.name),
    unique("accounts_system_key_unique").on(table.systemKey),
    check("accounts_kind_check", oneOf("kind", accountKinds)),
    check("accounts_name_not_blank", sql`btrim(name) <> ''`),
    check("accounts_unit_amount_range", sql`unit_amount BETWEEN 1 AND ${maxSafeInteger}`),
    check("accounts_unit_amount_only_for_asset", sql`kind = 'asset' OR unit_amount = 1`),
    // 純資産と未分類はシステム勘定だけ(利用者は作れない)
    check(
      "accounts_system_kind_has_system_key",
      sql`(kind IN ('equity', 'suspense')) = (system_key IS NOT NULL)`,
    ),
    check(
      "accounts_system_key_check",
      sql`system_key IS NULL OR ${oneOf("system_key", systemAccountKeys)}`,
    ),
  ],
);

// finance-data-model.md §3.2
export const transactions = financeSchema.table(
  "transactions",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    kind: text("kind", { enum: transactionKinds }).notNull(),
    title: text("title").notNull().default(""),
    occurredOn: date("occurred_on", { mode: "string" }).notNull(),
    memo: text("memo").notNull().default(""),
    createdBy: text("created_by", { enum: actors }).notNull(),
    replacesId: uuid("replaces_id"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: text("voided_by", { enum: actors }),
    createdAt: createdAt(),
  },
  (table) => [
    foreignKey({
      name: "transactions_replaces_id_fk",
      columns: [table.replacesId],
      foreignColumns: [table.id],
    }).onDelete("restrict"),
    // 1つの取引を置き換えられるのは1回だけ
    unique("transactions_replaces_id_unique").on(table.replacesId),
    check("transactions_kind_check", oneOf("kind", transactionKinds)),
    check("transactions_created_by_check", oneOf("created_by", actors)),
    check("transactions_voided_by_check", sql`voided_by IS NULL OR ${oneOf("voided_by", actors)}`),
    check("transactions_voided_together", sql`(voided_at IS NULL) = (voided_by IS NULL)`),
    check("transactions_replaces_other", sql`replaces_id IS NULL OR replaces_id <> id`),
    // 有効な開始残高は1件だけ。条件に合う行だけを、定数 true の値で重複がないか調べる(部分UNIQUE インデックス)
    uniqueIndex("transactions_one_active_opening")
      .on(sql`(true)`)
      .where(sql`kind = 'opening' AND voided_at IS NULL`),
  ],
);

// finance-data-model.md §3.3
export const postings = financeSchema.table(
  "postings",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "restrict" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    role: text("role", { enum: postingRoles }).notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    check("postings_role_check", oneOf("role", postingRoles)),
    check("postings_amount_nonzero", sql`amount <> 0`),
    check(
      "postings_amount_safe_integer",
      sql`amount BETWEEN -${maxSafeInteger} AND ${maxSafeInteger}`,
    ),
    index("postings_transaction_id_idx").on(table.transactionId),
    index("postings_account_id_idx").on(table.accountId),
  ],
);

// finance-data-model.md §3.4
export const idempotencyKeys = financeSchema.table(
  "idempotency_keys",
  {
    key: text("key").primaryKey(),
    operation: text("operation", { enum: idempotentOperations }).notNull(),
    requestHash: text("request_hash").notNull(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "restrict" }),
    createdBy: text("created_by", { enum: actors }).notNull(),
    createdAt: createdAt(),
  },
  () => [
    check("idempotency_keys_key_length", sql`char_length(key) BETWEEN 1 AND 255`),
    check("idempotency_keys_operation_check", oneOf("operation", idempotentOperations)),
    check("idempotency_keys_created_by_check", oneOf("created_by", actors)),
  ],
);

// finance-data-model.md §3.5。取消した取引の仕訳を外す。集計はすべてこのビューを使う
export const activePostings = financeSchema
  .view("active_postings", {
    id: uuid("id").notNull(),
    transactionId: uuid("transaction_id").notNull(),
    accountId: uuid("account_id").notNull(),
    role: text("role", { enum: postingRoles }).notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    transactionKind: text("transaction_kind", { enum: transactionKinds }).notNull(),
    occurredOn: date("occurred_on", { mode: "string" }).notNull(),
    transactionCreatedAt: timestamp("transaction_created_at", { withTimezone: true }).notNull(),
  })
  .as(
    sql`SELECT p.id, p.transaction_id, p.account_id, p.role, p.amount, t.kind AS transaction_kind, t.occurred_on, t.created_at AS transaction_created_at FROM finance.postings p JOIN finance.transactions t ON t.id = p.transaction_id WHERE t.voided_at IS NULL`,
  );
