-- 生成のあと手で IF NOT EXISTS を足した。Drizzle が履歴(__migrations)を置くために、先にこのスキーマを作るため(ADR 0027)
CREATE SCHEMA IF NOT EXISTS "finance";
