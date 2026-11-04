import path from "node:path";
import { cruise, type ICruiseResult } from "dependency-cruiser";
import extractTSConfig from "dependency-cruiser/config-utl/extract-ts-config";
import { describe, expect, it } from "vitest";
import { createDependencyCruiserConfig } from "../dependency-cruiser.base.js";

const fixtureRoot = path.join(import.meta.dirname, "fixtures", "repo");
const tsconfigPath = path.join(fixtureRoot, "tsconfig.json");

async function violations(): Promise<string[]> {
  const { forbidden, options } = createDependencyCruiserConfig({ tsconfigPath });
  const { output } = await cruise(
    ["packages", "apps"],
    { ...options, baseDir: fixtureRoot, ruleSet: { forbidden }, validate: true },
    {},
    { tsConfig: extractTSConfig(tsconfigPath) },
  );
  const result = output as ICruiseResult;
  return result.summary.violations.map((v) => `${v.rule.name}: ${v.from}`).sort();
}

describe("dependency-cruiser のアーキテクチャテスト(module-system.md §5.2・§5.4)", () => {
  it("依存のルールの違反と循環依存を検出し、違反しないファイルは検出しない", async () => {
    expect(await violations()).toEqual(
      [
        "core-deps: packages/core/src/violation-imports-module.ts",
        "core-web-deps: packages/core/src/web/violation-imports-core-server.ts",
        "core-web-deps: packages/core/src/web/violation-imports-db.ts",
        "domain-no-db: packages/modules/alpha/src/domain/violation-imports-own-db-schema.ts",
        "domain-only-zod: packages/modules/alpha/src/domain/violation-imports-non-zod-library.ts",
        "module-server-side-deps: packages/modules/alpha/src/server/violation-imports-beta-internal.ts",
        "module-server-side-deps: packages/modules/alpha/src/server/violation-imports-beta-server.ts",
        "module-web-deps: packages/modules/alpha/src/web/violation-imports-core-server.ts",
        "module-web-deps: packages/modules/alpha/src/web/violation-imports-own-db-schema.ts",
        "module-web-deps: packages/modules/alpha/src/web/violation-imports-own-server.ts",
        "module-web-no-hono: packages/modules/alpha/src/web/violation-imports-hono.ts",
        "module-web-other-public-type-only: packages/modules/alpha/src/web/violation-imports-beta-public-value.ts",
        "no-unresolvable-workspace-package: apps/api/src/violation-imports-unresolvable-workspace-package.ts",
        // 1つの循環(cycle-a ⇄ cycle-b)は、1件として報告される
        "no-circular: packages/modules/alpha/src/domain/cycle-a.ts",
      ].sort(),
    );
  });
});
