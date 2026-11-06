import { migrateSchemas } from "../migrate/index.js";

// テスト用の道具は、本番と同じ適用の処理でテストの DB を作るために、マイグレーションの適用を使ってよい
export function startPostgres(): string {
  return `fixture-testing-${migrateSchemas()}`;
}
