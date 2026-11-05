import { format } from "date-fns";
import { it } from "vitest";

// domain の外のテストは、domain のテスト用のルールの対象にならない
it("server のテストは外部のライブラリを使える", () => {
  format(new Date(), "yyyy");
});
