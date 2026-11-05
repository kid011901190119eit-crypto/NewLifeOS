CREATE SCHEMA IF NOT EXISTS "gamma";
--> statement-breakpoint
CREATE TABLE "gamma"."marker" ("applied_at" timestamptz DEFAULT clock_timestamp() NOT NULL);
--> statement-breakpoint
INSERT INTO "gamma"."marker" DEFAULT VALUES;
