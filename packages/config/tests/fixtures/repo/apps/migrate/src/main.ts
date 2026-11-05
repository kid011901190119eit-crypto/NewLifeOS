import { core } from "@lifeos/core";
import { db } from "@lifeos/db";
import { migrateSchemas } from "@lifeos/db/migrate";
import { serverModules } from "@lifeos/registry";

export const migrate = { core, db, migrateSchemas, serverModules };
