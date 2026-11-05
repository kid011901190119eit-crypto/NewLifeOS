import { readFileSync } from "node:fs";
import path from "node:path";
import { serverModules } from "@lifeos/registry";
import { describe, expect, it } from "vitest";
import { migrationPlan } from "./plan.js";

interface Journal {
  entries: { tag: string }[];
}

function firstMigrationSql(folder: string): string {
  const journal = JSON.parse(
    readFileSync(path.join(folder, "meta", "_journal.json"), "utf8"),
  ) as Journal;
  const first = journal.entries[0];
  if (first === undefined) throw new Error(`${folder} にマイグレーションがない`);
  return readFileSync(path.join(folder, `${first.tag}.sql`), "utf8");
}

describe.each(migrationPlan(serverModules))(
  "$schema の最初のマイグレーション",
  ({ schema, folder }) => {
    const sql = firstMigrationSql(folder);

    // Drizzle が履歴(__migrations)を置くために先にスキーマを作るので、IF NOT EXISTS がないと失敗する(ADR 0027)
    it(`CREATE SCHEMA IF NOT EXISTS "${schema}" で自分のスキーマを作る`, () => {
      expect(sql).toContain(`CREATE SCHEMA IF NOT EXISTS "${schema}";`);
    });

    it("IF NOT EXISTS のない CREATE SCHEMA(drizzle-kit が生成したまま)が残っていない", () => {
      expect(sql).not.toMatch(/CREATE SCHEMA "/);
    });
  },
);
