import { pgSchema } from "drizzle-orm/pg-core";

// core のテーブルは、すべてこのスキーマの下に作る(module-system.md §4.4)
export const coreSchema = pgSchema("core");
