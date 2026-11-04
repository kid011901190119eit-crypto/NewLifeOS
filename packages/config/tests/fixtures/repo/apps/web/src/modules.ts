import type { ModuleUiDefinition } from "@lifeos/core/web";
import { button } from "@lifeos/ui";
import { alphaUi } from "@lifeos/alpha/web";
import { betaUi } from "@lifeos/beta/web";

export const uiModules: readonly ModuleUiDefinition[] = [alphaUi, betaUi];
export const parts = { button };
