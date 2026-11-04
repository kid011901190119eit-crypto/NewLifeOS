import { describe, expect, it } from "vitest";
import { todayInTokyo } from "./today.js";

describe("todayInTokyo: Asia/Tokyo の今日の日付を YYYY-MM-DD で返す", () => {
  describe("UTCの15時(日本時間の0時)を境に日付が変わる", () => {
    it("UTCの15時の直前は、まだ同じ日付になる", () => {
      expect(todayInTokyo(new Date("2026-03-10T14:59:59.999Z"))).toBe("2026-03-10");
    });

    it("UTCの15時ちょうどは、翌日の日付になる", () => {
      expect(todayInTokyo(new Date("2026-03-10T15:00:00.000Z"))).toBe("2026-03-11");
    });

    it("UTCの15時の直後は、翌日の日付になる", () => {
      expect(todayInTokyo(new Date("2026-03-10T15:00:00.001Z"))).toBe("2026-03-11");
    });
  });

  describe("月末と年末をまたぐ", () => {
    it("30日の月の末日をまたぐと、翌月の1日になる", () => {
      expect(todayInTokyo(new Date("2026-04-30T15:00:00.000Z"))).toBe("2026-05-01");
    });

    it("平年の2月28日をまたぐと、3月1日になる", () => {
      expect(todayInTokyo(new Date("2026-02-28T15:00:00.000Z"))).toBe("2026-03-01");
    });

    it("うるう年の2月28日をまたぐと、2月29日になる", () => {
      expect(todayInTokyo(new Date("2028-02-28T15:00:00.000Z"))).toBe("2028-02-29");
    });

    it("12月31日のUTCの15時の直前は、まだその年の12月31日になる", () => {
      expect(todayInTokyo(new Date("2026-12-31T14:59:59.999Z"))).toBe("2026-12-31");
    });

    it("12月31日のUTCの15時をまたぐと、翌年の1月1日になる", () => {
      expect(todayInTokyo(new Date("2026-12-31T15:00:00.000Z"))).toBe("2027-01-01");
    });
  });

  it("1桁の月と日は0で埋めて2桁にする", () => {
    expect(todayInTokyo(new Date("2026-01-05T00:00:00.000Z"))).toBe("2026-01-05");
  });

  it("不正な日付を渡すと例外を投げる", () => {
    expect(() => todayInTokyo(new Date("invalid"))).toThrow();
  });
});
