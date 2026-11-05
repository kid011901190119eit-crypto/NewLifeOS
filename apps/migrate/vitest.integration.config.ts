import { defineConfig } from "vitest/config";

// 共有設定(vitest.base.js)の include と配列が連結されないよう、ここでは共有設定を使わない
export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    environment: "node",
    // 初回はイメージの取得に時間がかかるため、起動・停止の待ち時間を長めにする
    hookTimeout: 180_000,
  },
});
