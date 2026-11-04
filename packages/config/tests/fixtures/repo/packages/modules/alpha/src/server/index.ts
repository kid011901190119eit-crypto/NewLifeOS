import { core, type ModuleDefinition } from "@lifeos/core";
import { db } from "@lifeos/db";
import { getThing } from "../operations/get-thing.js";

export const alpha: ModuleDefinition = { id: "alpha" };
export const deps = { core, db, getThing };
