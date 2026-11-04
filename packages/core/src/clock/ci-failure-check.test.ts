import { describe, expect, it } from "vitest";

// 必須チェックが失敗したときにマージが拒否されることを確かめるための、わざと失敗させるテスト。マージしない
describe("必須チェックの確認", () => {
  it("わざと失敗させて、CI の test ジョブを落とす", () => {
    expect(1).toBe(2);
  });
});
