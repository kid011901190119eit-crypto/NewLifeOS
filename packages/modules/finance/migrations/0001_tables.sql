CREATE TABLE "finance"."accounts" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"unit_amount" bigint DEFAULT 1 NOT NULL,
	"system_key" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_kind_name_unique" UNIQUE("kind","name"),
	CONSTRAINT "accounts_system_key_unique" UNIQUE("system_key"),
	CONSTRAINT "accounts_kind_check" CHECK (kind IN ('asset', 'expense', 'income', 'loan', 'equity', 'suspense')),
	CONSTRAINT "accounts_name_not_blank" CHECK (btrim(name) <> ''),
	CONSTRAINT "accounts_unit_amount_range" CHECK (unit_amount BETWEEN 1 AND 9007199254740991),
	CONSTRAINT "accounts_unit_amount_only_for_asset" CHECK (kind = 'asset' OR unit_amount = 1),
	CONSTRAINT "accounts_system_kind_has_system_key" CHECK ((kind IN ('equity', 'suspense')) = (system_key IS NOT NULL)),
	CONSTRAINT "accounts_system_key_check" CHECK (system_key IS NULL OR system_key IN ('opening_balance', 'uncategorized'))
);
--> statement-breakpoint
CREATE TABLE "finance"."idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"operation" text NOT NULL,
	"request_hash" text NOT NULL,
	"transaction_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "idempotency_keys_key_length" CHECK (char_length(key) BETWEEN 1 AND 255),
	CONSTRAINT "idempotency_keys_operation_check" CHECK (operation IN ('create', 'replace', 'void')),
	CONSTRAINT "idempotency_keys_created_by_check" CHECK (created_by IN ('user', 'agent'))
);
--> statement-breakpoint
CREATE TABLE "finance"."postings" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"role" text NOT NULL,
	"amount" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "postings_role_check" CHECK (role IN ('account', 'counter')),
	CONSTRAINT "postings_amount_nonzero" CHECK (amount <> 0),
	CONSTRAINT "postings_amount_safe_integer" CHECK (amount BETWEEN -9007199254740991 AND 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE "finance"."transactions" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"kind" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"occurred_on" date NOT NULL,
	"memo" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"replaces_id" uuid,
	"voided_at" timestamp with time zone,
	"voided_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_replaces_id_unique" UNIQUE("replaces_id"),
	CONSTRAINT "transactions_kind_check" CHECK (kind IN ('regular', 'transfer', 'lend', 'borrow', 'opening')),
	CONSTRAINT "transactions_created_by_check" CHECK (created_by IN ('user', 'agent')),
	CONSTRAINT "transactions_voided_by_check" CHECK (voided_by IS NULL OR voided_by IN ('user', 'agent')),
	CONSTRAINT "transactions_voided_together" CHECK ((voided_at IS NULL) = (voided_by IS NULL)),
	CONSTRAINT "transactions_replaces_other" CHECK (replaces_id IS NULL OR replaces_id <> id)
);
--> statement-breakpoint
ALTER TABLE "finance"."idempotency_keys" ADD CONSTRAINT "idempotency_keys_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "finance"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."postings" ADD CONSTRAINT "postings_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "finance"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."postings" ADD CONSTRAINT "postings_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "finance"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance"."transactions" ADD CONSTRAINT "transactions_replaces_id_fk" FOREIGN KEY ("replaces_id") REFERENCES "finance"."transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "postings_transaction_id_idx" ON "finance"."postings" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "postings_account_id_idx" ON "finance"."postings" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_one_active_opening" ON "finance"."transactions" USING btree ((true)) WHERE kind = 'opening' AND voided_at IS NULL;--> statement-breakpoint
CREATE VIEW "finance"."active_postings" AS (SELECT p.id, p.transaction_id, p.account_id, p.role, p.amount, t.kind AS transaction_kind, t.occurred_on, t.created_at AS transaction_created_at FROM finance.postings p JOIN finance.transactions t ON t.id = p.transaction_id WHERE t.voided_at IS NULL);