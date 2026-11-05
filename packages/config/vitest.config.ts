import { configDefaults, defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.base.js";

export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ["tests/**/*.test.ts"],
      // フィクスチャの *.test.ts は境界の検査の材料で、実行するテストではない
      exclude: [...configDefaults.exclude, "tests/fixtures/**"],
      // ESLint の型情報の準備と dependency-cruiser の解析に数秒かかるため
      testTimeout: 30_000,
    },
  }),
);
