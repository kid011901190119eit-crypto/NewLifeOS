CREATE SCHEMA IF NOT EXISTS "beta";
--> statement-breakpoint
CREATE TABLE "beta"."marker" ("applied_at" timestamptz DEFAULT clock_timestamp() NOT NULL);
--> statement-breakpoint
INSERT INTO "beta"."marker" DEFAULT VALUES;
