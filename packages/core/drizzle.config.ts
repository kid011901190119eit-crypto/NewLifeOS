import { defineConfig } from "drizzle-kit";

// マイグレーションの SQL を生成するための設定。適用は apps/migrate が行う(module-system.md §4.4)
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./migrations",
  schemaFilter: ["core"],
});
