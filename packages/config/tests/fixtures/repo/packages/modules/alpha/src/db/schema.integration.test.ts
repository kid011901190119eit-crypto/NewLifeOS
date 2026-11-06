import { startPostgres } from "@lifeos/db/testing";
import { it } from "vitest";
import { thingsTable } from "./schema.js";

// テストのファイルは、テスト用の道具(@lifeos/db/testing)を使える
it("テストは db のテスト用の道具を使える", () => {
  startPostgres();
  void thingsTable;
});
