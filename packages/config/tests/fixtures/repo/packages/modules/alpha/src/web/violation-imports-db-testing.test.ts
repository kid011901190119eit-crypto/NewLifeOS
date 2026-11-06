import { startPostgres } from "@lifeos/db/testing";
import { it } from "vitest";

// 画面のコードは db を使えないので、テストのファイルでも db のテスト用の道具は使えない
it("画面のテストは db のテスト用の道具を使えない", () => {
  startPostgres();
});
