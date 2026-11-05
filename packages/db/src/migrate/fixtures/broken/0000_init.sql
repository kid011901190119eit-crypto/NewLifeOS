CREATE SCHEMA IF NOT EXISTS "broken";
--> statement-breakpoint
CREATE TABLE "broken"."partial" ("id" integer NOT NULL);
--> statement-breakpoint
-- わざと失敗させる(途中で失敗したときに、前の文の変更が残らないことを確かめる)
SELECT * FROM "broken"."does_not_exist";
