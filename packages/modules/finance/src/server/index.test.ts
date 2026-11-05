import { existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import finance from "./index.js";

const packageRoot = path.join(import.meta.dirname, "..", "..");

describe("家計簿(finance)のサーバー用の定義", () => {
  it("id は finance", () => {
    expect(finance.id).toBe("finance");
  });

  it("src から読み込むと、マイグレーションのフォルダはパッケージ直下の migrations を指し、そこに履歴の一覧(meta/_journal.json)がある", () => {
    expect(finance.migrations.folder).toBe(path.join(packageRoot, "migrations"));
    expect(existsSync(path.join(finance.migrations.folder, "meta", "_journal.json"))).toBe(true);
  });

  it("ビルド後の dist から読み込んでも、同じフォルダを指す(registry と migrate は dist を読むため)", async () => {
    const built = path.join(packageRoot, "dist", "server", "index.js");
    expect(existsSync(built), "先に pnpm build が要る").toBe(true);
    const fromDist = (await import(pathToFileURL(built).href)) as typeof import("./index.js");
    expect(fromDist.default.migrations.folder).toBe(finance.migrations.folder);
  });
});
