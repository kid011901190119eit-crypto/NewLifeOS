import { migrateSchemas, type SchemaMigrationResult } from "@lifeos/db/migrate";
import { serverModules } from "@lifeos/registry";
import { migrationPlan } from "./plan.js";

/**
 * 環境変数 DATABASE_URL の DB に、core と一覧のモジュールのマイグレーションを適用する。
 * 接続先にはパスワードが含まれるので、ログやエラーの文に出さない。
 */
export async function runMigrate(env: NodeJS.ProcessEnv): Promise<SchemaMigrationResult[]> {
  const databaseUrl = env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl === "") {
    throw new Error("環境変数 DATABASE_URL が設定されていない(deploy/compose/.env.example を参照)");
  }
  return migrateSchemas(databaseUrl, migrationPlan(serverModules));
}
