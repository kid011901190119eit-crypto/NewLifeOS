CREATE SCHEMA IF NOT EXISTS "alpha";
--> statement-breakpoint
CREATE TABLE "alpha"."marker" ("applied_at" timestamptz DEFAULT clock_timestamp() NOT NULL);
--> statement-breakpoint
INSERT INTO "alpha"."marker" DEFAULT VALUES;
