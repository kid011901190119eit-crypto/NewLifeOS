import { sql } from "drizzle-orm";
import { bigint, date, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

// 家計簿のテーブルは、すべてこのスキーマの下に作る(module-system.md §2.2)
export const financeSchema = pgSchema("finance");

export const accountKinds = ["asset", "expense", "income", "loan", "equity", "suspense"] as const;
export const systemAccountKeys = ["opening_balance", "uncategorized"] as const;
export const transactionKinds = ["regular", "transfer", "lend", "borrow", "opening"] as const;
export const actors = ["user", "agent"] as const;
export const postingRoles = ["account", "counter"] as const;
export const idempotentOperations = ["create", "replace", "void"] as const;

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// finance-data-model.md §3.1
export const accounts = financeSchema.table("accounts", {
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
});

// finance-data-model.md §3.2
export const transactions = financeSchema.table("transactions", {
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
});

// finance-data-model.md §3.3
export const postings = financeSchema.table("postings", {
  id: uuid("id")
    .primaryKey()
    .default(sql`uuidv7()`),
  transactionId: uuid("transaction_id").notNull(),
  accountId: uuid("account_id").notNull(),
  role: text("role", { enum: postingRoles }).notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  createdAt: createdAt(),
});

// finance-data-model.md §3.4
export const idempotencyKeys = financeSchema.table("idempotency_keys", {
  key: text("key").notNull(),
  operation: text("operation", { enum: idempotentOperations }).notNull(),
  requestHash: text("request_hash").notNull(),
  transactionId: uuid("transaction_id").notNull(),
  createdBy: text("created_by", { enum: actors }).notNull(),
  createdAt: createdAt(),
});

// finance-data-model.md §3.5。集計はすべてこのビューを使う
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
    sql`SELECT p.id, p.transaction_id, p.account_id, p.role, p.amount, t.kind AS transaction_kind, t.occurred_on, t.created_at AS transaction_created_at FROM finance.postings p JOIN finance.transactions t ON t.id = p.transaction_id`,
  );
