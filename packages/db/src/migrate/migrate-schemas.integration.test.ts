import path from "node:path";
import pg from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { startPostgres, type TestPostgres } from "../testing/start-postgres.js";
import { migrateSchemas, type SchemaMigrations } from "./migrate-schemas.js";

const fixture = (schema: string): SchemaMigrations => ({
  schema,
  folder: path.join(import.meta.dirname, "fixtures", schema),
});

describe("スキーマごとのマイグレーションの適用(module-system.md §4.4・§8.3)", () => {
  let postgres: TestPostgres;
  let databaseCount = 0;
  const clients: pg.Client[] = [];

  beforeAll(async () => {
    postgres = await startPostgres();
  });

  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.end()));
  });

  afterAll(async () => {
    await postgres?.stop();
  });

  // テストごとに空のデータベースを作り、前のテストの適用履歴を持ち込まない
  async function freshDatabase(): Promise<{ url: string; client: pg.Client }> {
    databaseCount += 1;
    const url = await postgres.createDatabase(`migrate_test_${databaseCount}`);
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    clients.push(client);
    return { url, client };
  }

  async function appliedAt(client: pg.Client, schema: string): Promise<Date> {
    const result = await client.query<{ applied_at: Date }>(
      `SELECT applied_at FROM ${client.escapeIdentifier(schema)}.marker`,
    );
    const row = result.rows[0];
    if (row === undefined) throw new Error(`${schema}.marker に行がない`);
    return row.applied_at;
  }

  async function history(client: pg.Client, schema: string): Promise<unknown[]> {
    const result = await client.query<Record<string, unknown>>(
      `SELECT id, hash, created_at FROM ${client.escapeIdentifier(schema)}.__migrations ORDER BY id`,
    );
    return result.rows;
  }

  async function tableExists(client: pg.Client, qualifiedName: string): Promise<boolean> {
    const result = await client.query<{ exists: boolean }>(
      "SELECT to_regclass($1) IS NOT NULL AS exists",
      [qualifiedName],
    );
    return result.rows[0]?.exists ?? false;
  }

  it("一覧の順にスキーマごとに適用し、適用した件数を順に返す", async () => {
    const { url, client } = await freshDatabase();

    const result = await migrateSchemas(url, [fixture("beta"), fixture("alpha")]);

    expect(result).toEqual([
      { schema: "beta", applied: 1 },
      { schema: "alpha", applied: 1 },
    ]);
    expect(await appliedAt(client, "beta")).toBeInstanceOf(Date);
    expect((await appliedAt(client, "beta")).getTime()).toBeLessThan(
      (await appliedAt(client, "alpha")).getTime(),
    );
  });

  it("適用履歴は、それぞれのスキーマの中の __migrations に記録され、共通の drizzle スキーマは作らない", async () => {
    const { url, client } = await freshDatabase();

    await migrateSchemas(url, [fixture("alpha"), fixture("beta")]);

    expect(await history(client, "alpha")).toHaveLength(1);
    expect(await history(client, "beta")).toHaveLength(1);
    const drizzle = await client.query("SELECT 1 FROM pg_namespace WHERE nspname = 'drizzle'");
    expect(drizzle.rowCount).toBe(0);
  });

  it("2回続けて実行すると、2回目は何も適用しない", async () => {
    const { url, client } = await freshDatabase();
    await migrateSchemas(url, [fixture("alpha"), fixture("beta")]);

    const second = await migrateSchemas(url, [fixture("alpha"), fixture("beta")]);

    expect(second).toEqual([
      { schema: "alpha", applied: 0 },
      { schema: "beta", applied: 0 },
    ]);
    const markers = await client.query("SELECT * FROM alpha.marker");
    expect(markers.rowCount).toBe(1);
  });

  it("一覧にモジュールを1つ足して実行すると、足したモジュールだけが適用され、既存の適用履歴は変わらない", async () => {
    const { url, client } = await freshDatabase();
    await migrateSchemas(url, [fixture("alpha")]);
    const before = await history(client, "alpha");

    const result = await migrateSchemas(url, [fixture("alpha"), fixture("gamma")]);

    expect(result).toEqual([
      { schema: "alpha", applied: 0 },
      { schema: "gamma", applied: 1 },
    ]);
    expect(await history(client, "alpha")).toEqual(before);
    expect(await history(client, "gamma")).toHaveLength(1);
  });

  it("マイグレーションの途中で失敗すると、そのマイグレーションの変更と履歴は残らない", async () => {
    const { url, client } = await freshDatabase();

    await expect(migrateSchemas(url, [fixture("broken")])).rejects.toThrow();

    expect(await tableExists(client, "broken.partial")).toBe(false);
    expect(await history(client, "broken")).toEqual([]);
  });

  it("失敗したスキーマより後ろの一覧のスキーマは、適用しない", async () => {
    const { url, client } = await freshDatabase();

    await expect(migrateSchemas(url, [fixture("broken"), fixture("alpha")])).rejects.toThrow();

    expect(await tableExists(client, "alpha.marker")).toBe(false);
  });

  it("drizzle-kit が生成したままの CREATE SCHEMA(IF NOT EXISTS なし)は、すでにあるスキーマとぶつかって失敗する", async () => {
    // Drizzle は履歴の置き場所のスキーマを、マイグレーションより先に作るため(docs/learning/database-migrations.md)
    const { url } = await freshDatabase();

    // Drizzle は失敗した文を "Failed query: ..." で包み、PostgreSQL のエラーを cause に入れる
    const error = await migrateSchemas(url, [fixture("plain")]).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('CREATE SCHEMA "plain"');
    // 42P06 は PostgreSQL の duplicate_schema(スキーマがすでにある)。ほかの理由の失敗では通らないようにする
    expect((error as Error).cause).toBeInstanceOf(pg.DatabaseError);
    expect(((error as Error).cause as pg.DatabaseError).code).toBe("42P06");
  });
});
