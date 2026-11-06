import { startPostgres } from "@lifeos/db/testing";
import { it } from "vitest";

// domain のテストでも、db(テスト用の道具を含む)は使えない
it("domain のテストは db を使えない", () => {
  startPostgres();
});
