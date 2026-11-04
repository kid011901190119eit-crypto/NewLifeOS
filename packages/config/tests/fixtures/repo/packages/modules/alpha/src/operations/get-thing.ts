import type { Thing } from "../domain/thing.js";
import { thingsTable } from "../db/schema.js";

export function getThing(): Thing {
  return { name: thingsTable.name };
}
