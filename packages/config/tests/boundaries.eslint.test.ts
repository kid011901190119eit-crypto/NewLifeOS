import path from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";
import { createBoundariesConfig } from "../eslint-boundaries.js";

const fixtureRoot = path.join(import.meta.dirname, "fixtures", "repo");

const eslint = new ESLint({
  cwd: fixtureRoot,
  overrideConfigFile: true,
  overrideConfig: createBoundariesConfig({
    rootDir: fixtureRoot,
    tsconfigPath: path.join(fixtureRoot, "tsconfig.json"),
  }),
});

async function boundaryErrors(file: string): Promise<string[]> {
  const [result] = await eslint.lintFiles([path.join(fixtureRoot, file)]);
  if (result === undefined) {
    throw new Error(`lint result not found: ${file}`);
  }
  return result.messages
    .filter((message) => message.severity === 2)
    .map((message) => `${message.ruleId ?? "(fatal)"}: ${message.message}`);
}

describe("ESLint の境界ルール(module-system.md §5.2)", () => {
  describe("モジュール同士", () => {
    it("他のモジュールの内部のファイルを import すると、エラーになる", async () => {
      const errors = await boundaryErrors(
        "packages/modules/alpha/src/server/violation-imports-beta-internal.ts",
      );
      expect(errors).toEqual([expect.stringContaining("boundaries/dependencies")]);
    });

    it("他のモジュールの server を import すると、エラーになる", async () => {
      const errors = await boundaryErrors(
        "packages/modules/alpha/src/server/violation-imports-beta-server.ts",
      );
      expect(errors).toEqual([expect.stringContaining("boundaries/dependencies")]);
    });

    it("他のモジュールの公開用の入口(/public)を import しても、エラーにならない", async () => {
      expect(await boundaryErrors("packages/modules/alpha/src/server/uses-beta-public.ts")).toEqual(
        [],
      );
    });
  });

  describe("コア", () => {
    it("コアがモジュールを import すると、エラーになる", async () => {
      const errors = await boundaryErrors("packages/core/src/violation-imports-module.ts");
      expect(errors).toEqual([expect.stringContaining("boundaries/dependencies")]);
    });

    it.each([
      ["db", "violation-imports-db.ts"],
      ["コアのサーバー側", "violation-imports-core-server.ts"],
    ])("コアの画面用の入口(core/web)が %s を import すると、エラーになる", async (_, file) => {
      const errors = await boundaryErrors(`packages/core/src/web/${file}`);
      expect(errors).toEqual([expect.stringContaining("boundaries/dependencies")]);
    });

    it("コアが db を import しても、エラーにならない", async () => {
      expect(await boundaryErrors("packages/core/src/index.ts")).toEqual([]);
    });
  });

  describe("モジュールの画面のコード", () => {
    it.each([
      ["自分のモジュールの server", "violation-imports-own-server.ts"],
      ["自分のモジュールの db", "violation-imports-own-db-schema.ts"],
      ["Hono", "violation-imports-hono.ts"],
      ["コアのサーバー用の入口", "violation-imports-core-server.ts"],
    ])("%s を import すると、エラーになる", async (_, file) => {
      const errors = await boundaryErrors(`packages/modules/alpha/src/web/${file}`);
      expect(errors).toEqual([expect.stringContaining("boundaries/dependencies")]);
    });

    it("他のモジュールの公開用の入口から値を import すると、エラーになる", async () => {
      const errors = await boundaryErrors(
        "packages/modules/alpha/src/web/violation-imports-beta-public-value.ts",
      );
      expect(errors).toEqual([expect.stringContaining("boundaries/dependencies")]);
    });

    it("core/web・ui・他のモジュールの公開用の入口の型・自分のモジュールの domain を import しても、エラーにならない", async () => {
      expect(await boundaryErrors("packages/modules/alpha/src/web/index.ts")).toEqual([]);
    });
  });

  describe("モジュールの domain", () => {
    it("Zod 以外の外部のライブラリを import すると、エラーになる", async () => {
      const errors = await boundaryErrors(
        "packages/modules/alpha/src/domain/violation-imports-non-zod-library.ts",
      );
      expect(errors).toEqual([expect.stringContaining("boundaries/dependencies")]);
    });

    it("自分のモジュールの db を import すると、エラーになる", async () => {
      const errors = await boundaryErrors(
        "packages/modules/alpha/src/domain/violation-imports-own-db-schema.ts",
      );
      expect(errors).toEqual([expect.stringContaining("boundaries/dependencies")]);
    });

    it("Zod を import しても、エラーにならない", async () => {
      expect(await boundaryErrors("packages/modules/alpha/src/domain/thing.ts")).toEqual([]);
    });
  });

  describe("違反しないファイル", () => {
    it.each([
      "packages/modules/alpha/src/server/index.ts",
      "packages/modules/alpha/src/operations/get-thing.ts",
      "packages/modules/alpha/src/public/index.ts",
      "packages/modules/alpha/src/db/schema.ts",
      "packages/modules/beta/src/server/index.ts",
      "packages/modules/beta/src/web/index.ts",
      "packages/registry/src/server.ts",
      "apps/api/src/main.ts",
      "apps/web/src/modules.ts",
    ])("%s はエラーにならない", async (file) => {
      expect(await boundaryErrors(file)).toEqual([]);
    });
  });
});
