import { startPostgres, type TestPostgres } from "@lifeos/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrate } from "./run.js";

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
      { schema: "core", applied: 1 },
      { schema: "finance", applied: 1 },
    ]);
    for (const schema of ["core", "finance"]) {
      const history = await postgres.client.query(`SELECT * FROM ${schema}.__migrations`);
      expect(history.rowCount, schema).toBe(1);
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
