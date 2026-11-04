import path from "node:path";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { createBoundariesConfig } from "./eslint-boundaries.js";

const repoRoot = path.resolve(import.meta.dirname, "../..");

/**
 * 全パッケージで共通の ESLint 設定。各パッケージの eslint.config.js から呼ぶ。
 * @param {{ packageDir: string }} options packageDir は呼び出し元のパッケージのディレクトリ
 * @returns {import("eslint").Linter.Config[]}
 */
export function createEslintConfig({ packageDir }) {
  return [
    { ignores: ["dist/", "coverage/", "tests/fixtures/"] },
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked.map((config) => ({
      ...config,
      files: ["**/*.ts"],
    })),
    {
      files: ["**/*.ts"],
      languageOptions: {
        parserOptions: {
          // tsconfig の include に入っていない設定ファイル(vitest.config.ts など)も型情報つきで検査する
          projectService: { allowDefaultProject: ["*.config.ts"] },
          tsconfigRootDir: packageDir,
        },
      },
    },
    ...createBoundariesConfig({
      rootDir: repoRoot,
      tsconfigPath: [
        path.join(repoRoot, "packages/*/tsconfig.json"),
        path.join(repoRoot, "packages/modules/*/tsconfig.json"),
        path.join(repoRoot, "apps/*/tsconfig.json"),
      ],
    }),
  ];
}
