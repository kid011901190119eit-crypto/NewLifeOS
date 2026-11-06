import { readFileSync } from "node:fs";
import path from "node:path";
import { startPostgres, type TestPostgres } from "@lifeos/db/testing";
import { serverModules } from "@lifeos/registry";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { migrationPlan } from "./plan.js";
import { runMigrate } from "./run.js";

// マイグレーションを足すたびに期待値を直さなくて済むよう、各スキーマの件数は drizzle-kit の記録(_journal.json)から求める
function migrationCount(schema: string): number {
  const source = migrationPlan(serverModules).find((plan) => plan.schema === schema);
  if (source === undefined) throw new Error(`${schema} が一覧にない`);
  const journal = JSON.parse(
    readFileSync(path.join(source.folder, "meta", "_journal.json"), "utf8"),
  ) as { entries: unknown[] };
  return journal.entries.length;
}

describe("migrate コマンド(core と一覧のモジュールのマイグレーションを適用する)", () => {
  let postgres: TestPostgres;

  beforeAll(async () => {
    postgres = await startPostgres();
  });

  afterAll(async () => {
    await postgres?.stop();
  });

  it("core を先に、次に finance を適用し、それぞれのスキーマの中に適用履歴を残す", async () => {
    const result = await runMigrate({ DATABASE_URL: postgres.connectionUri });

    expect(result).toEqual([
      { schema: "core", applied: migrationCount("core") },
      { schema: "finance", applied: migrationCount("finance") },
    ]);
    for (const schema of ["core", "finance"]) {
      const history = await postgres.client.query(`SELECT * FROM ${schema}.__migrations`);
      expect(history.rowCount, schema).toBe(migrationCount(schema));
    }
  });

  it("もう1度実行しても、何も適用しない", async () => {
    expect(await runMigrate({ DATABASE_URL: postgres.connectionUri })).toEqual([
      { schema: "core", applied: 0 },
      { schema: "finance", applied: 0 },
    ]);
  });

  it("DATABASE_URL がないときは、DB に触れずにエラーにする", async () => {
    await expect(runMigrate({})).rejects.toThrow(/DATABASE_URL/);
  });
});
