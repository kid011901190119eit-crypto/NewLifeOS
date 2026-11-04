import type { ModuleDefinition } from "@lifeos/core";
import { alpha } from "@lifeos/alpha/server";
import { beta } from "@lifeos/beta/server";

export const serverModules: readonly ModuleDefinition[] = [alpha, beta];
