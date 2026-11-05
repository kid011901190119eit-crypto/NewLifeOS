import { it } from "vitest";
import { thingsTable } from "../db/schema.js";

it("テストでも db は使えない", () => {
  void thingsTable;
});
