import type { AnyModuleDefinition } from "@lifeos/core";
import { coreMigrations } from "@lifeos/core";
import { describe, expect, it } from "vitest";
import { migrationPlan } from "./plan.js";

const moduleNamed = (id: string): AnyModuleDefinition => ({
  id,
  migrations: { folder: `/modules/${id}/migrations` },
});

describe("マイグレーションを適用する順番", () => {
  it("core を最初に、次にモジュールの一覧の順に並べる", () => {
    expect(migrationPlan([moduleNamed("beta"), moduleNamed("alpha")])).toEqual([
      { schema: "core", folder: coreMigrations.folder },
      { schema: "beta", folder: "/modules/beta/migrations" },
      { schema: "alpha", folder: "/modules/alpha/migrations" },
    ]);
  });

  it("モジュールが1つもなくても、core は適用する", () => {
    expect(migrationPlan([])).toEqual([{ schema: "core", folder: coreMigrations.folder }]);
  });
});
