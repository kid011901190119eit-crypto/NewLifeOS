import { describe, expect, it } from "vitest";
import { serverModules } from "./server.js";

describe("サーバー側のモジュールの一覧", () => {
  it("家計簿(finance)が載っている", () => {
    expect(serverModules.map((module) => module.id)).toEqual(["finance"]);
  });
});
