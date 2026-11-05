import { pgSchema } from "drizzle-orm/pg-core";

// 家計簿のテーブルは、すべてこのスキーマの下に作る(module-system.md §2.2)。テーブルはフェーズ4で足す
export const financeSchema = pgSchema("finance");
