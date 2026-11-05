import { expect, it } from "vitest";
import { thingSchema } from "./thing.js";

it("名前のある thing を受け付ける", () => {
  expect(thingSchema.parse({ name: "a" })).toEqual({ name: "a" });
});
