import { format } from "date-fns";
import { it } from "vitest";

it("テストでも Zod と Vitest 以外の外部のライブラリは使えない", () => {
  format(new Date(), "yyyy");
});
