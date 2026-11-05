import { fileURLToPath } from "node:url";

/**
 * core のマイグレーションの置き場所。src/db と dist/db のどちらから見ても、
 * 2つ上がパッケージの直下になるので、同じ migrations フォルダを指す。
 */
export const coreMigrations = {
  schema: "core",
  folder: fileURLToPath(new URL("../../migrations", import.meta.url)),
} as const;
