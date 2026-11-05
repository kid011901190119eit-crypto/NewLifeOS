import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

/** 1つのスキーマ(core かモジュール1つ)の、マイグレーションの置き場所 */
export interface SchemaMigrations {
  readonly schema: string;
  /** drizzle-kit generate が出力したフォルダ(meta/_journal.json があるところ) */
  readonly folder: string;
}

export interface SchemaMigrationResult {
  readonly schema: string;
  /** 今回の実行で新しく適用したマイグレーションの数 */
  readonly applied: number;
}

const migrationsTable = "__migrations";

/**
 * 一覧の順に、スキーマごとのマイグレーションを適用する(module-system.md §4.4)。
 * 適用履歴は各スキーマの中の __migrations に持つので、スキーマを足しても他の履歴に触れない。
 * どこかで失敗したら、そこで止めて後ろのスキーマは適用しない。
 */
export async function migrateSchemas(
  connectionString: string,
  sources: readonly SchemaMigrations[],
): Promise<SchemaMigrationResult[]> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const db = drizzle({ client });
    const results: SchemaMigrationResult[] = [];
    for (const { schema, folder } of sources) {
      const before = await countHistory(client, schema);
      await migrate(db, {
        migrationsFolder: folder,
        migrationsSchema: schema,
        migrationsTable,
      });
      results.push({ schema, applied: (await countHistory(client, schema)) - before });
    }
    return results;
  } finally {
    await client.end();
  }
}

async function countHistory(client: pg.Client, schema: string): Promise<number> {
  const table = `${client.escapeIdentifier(schema)}.${client.escapeIdentifier(migrationsTable)}`;
  const exists = await client.query<{ exists: boolean }>(
    "SELECT to_regclass($1) IS NOT NULL AS exists",
    [table],
  );
  if (exists.rows[0]?.exists !== true) return 0;
  const result = await client.query<{ count: number }>(
    `SELECT count(*)::int AS count FROM ${table}`,
  );
  return result.rows[0]?.count ?? 0;
}
