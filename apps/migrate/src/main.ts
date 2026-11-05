import { runMigrate } from "./run.js";

try {
  for (const { schema, applied } of await runMigrate(process.env)) {
    console.log(`${schema}: ${applied} 件のマイグレーションを適用した`);
  }
} catch (error) {
  console.error("マイグレーションに失敗した:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
