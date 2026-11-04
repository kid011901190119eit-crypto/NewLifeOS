import base from "@lifeos/config/vitest.base.js";
import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

// 結合テスト(Docker が要る)は vitest.integration.config.ts で別に実行する
export default mergeConfig(
  base,
  defineConfig({
    test: { exclude: [...configDefaults.exclude, "src/**/*.integration.test.ts"] },
  }),
);
