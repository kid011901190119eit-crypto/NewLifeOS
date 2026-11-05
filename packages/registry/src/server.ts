import type { AnyModuleDefinition } from "@lifeos/core";
import finance from "@lifeos/finance/server";

// 並び順はマイグレーションの適用順の元になる(module-system.md §2.3)
export const serverModules: readonly AnyModuleDefinition[] = [finance];
