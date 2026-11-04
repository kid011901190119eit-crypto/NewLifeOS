import type { ModuleUiDefinition } from "@lifeos/core/web";
import { button } from "@lifeos/ui";
import type { Balance } from "@lifeos/beta/public";
import type { Thing } from "../domain/thing.js";

export const alphaUi: ModuleUiDefinition = { id: "alpha" };
export const parts = { button };
export type Shown = { balance: Balance; thing: Thing };
