import { coreMigrations, type AnyModuleDefinition } from "@lifeos/core";
import type { SchemaMigrations } from "@lifeos/db/migrate";

/** core を最初に、次にモジュールの一覧の順に並べる(module-system.md §4.4) */
export function migrationPlan(modules: readonly AnyModuleDefinition[]): SchemaMigrations[] {
  return [
    { schema: coreMigrations.schema, folder: coreMigrations.folder },
    ...modules.map((module) => ({ schema: module.id, folder: module.migrations.folder })),
  ];
}
