import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { coreMigrations } from "./migrations.js";

const packageRoot = path.join(import.meta.dirname, "..", "..");

describe("core のマイグレーションの置き場所", () => {
  it("スキーマ名は core", () => {
    expect(coreMigrations.schema).toBe("core");
  });

  it("src から読み込むと、パッケージ直下の migrations を指し、そこに履歴の一覧(meta/_journal.json)がある", () => {
    expect(coreMigrations.folder).toBe(path.join(packageRoot, "migrations"));
    expect(existsSync(path.join(coreMigrations.folder, "meta", "_journal.json"))).toBe(true);
  });

  it("ビルド後の dist から読み込んでも、同じフォルダを指す(migrate は dist を読むため)", async () => {
    const built = path.join(packageRoot, "dist", "db", "migrations.js");
    expect(existsSync(built), "先に pnpm build が要る").toBe(true);
    const fromDist = (await import(pathToFileURL(built).href)) as typeof import("./migrations.js");
    expect(fromDist.coreMigrations.folder).toBe(coreMigrations.folder);
  });
});
