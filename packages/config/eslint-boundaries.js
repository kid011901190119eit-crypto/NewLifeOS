import { createRequire } from "node:module";
import boundaries from "eslint-plugin-boundaries";
import tseslint from "typescript-eslint";

const resolverPath = createRequire(import.meta.url).resolve("eslint-import-resolver-typescript");

const moduleDir = (part) => ({
  type: `module-${part}`,
  pattern: `packages/modules/*/src/${part}`,
  capture: ["moduleId"],
  partialMatch: false,
});

// 要素(ファイルの種類)。モジュール名は書かず、moduleId として取り出す(module-system.md §5.4)
const elements = [
  // @lifeos/core は exports によって dist(ビルドの成果物)に解決されるので、src と dist の両方を見る
  {
    type: "core-web",
    pattern: ["packages/core/src/web", "packages/core/dist/web"],
    partialMatch: false,
  },
  { type: "core", pattern: "packages/core", partialMatch: false },
  { type: "db", pattern: "packages/db", partialMatch: false },
  { type: "ui", pattern: "packages/ui", partialMatch: false },
  { type: "registry", pattern: "packages/registry", partialMatch: false },
  moduleDir("server"),
  moduleDir("operations"),
  moduleDir("domain"),
  moduleDir("public"),
  moduleDir("db"),
  moduleDir("web"),
  { type: "module", pattern: "packages/modules/*", capture: ["moduleId"], partialMatch: false },
  { type: "app-server", pattern: "apps/{api,mcp,worker}", partialMatch: false },
  { type: "app-web", pattern: "apps/web", partialMatch: false },
];

const moduleServerSide = [
  "module-server",
  "module-operations",
  "module-domain",
  "module-public",
  "module-db",
  "module",
];

const to = (...types) => ({ to: { element: { types } } });
const from = (...types) => ({ element: { types } });

// module-system.md §5.2 の表。複数のポリシーに当てはまるときは、後に書いたものが優先される
const policies = [
  // 外部のライブラリと Node.js の組み込みモジュールは、下で個別に禁止しない限り使ってよい
  { allow: { to: { module: { origin: ["external", "core"] } } } },

  // core/web はブラウザで動くので、db もコアのサーバー側も import させない(どちらも許可しない)
  { from: from("core"), allow: to("db") },

  // 自分のモジュールの中は、相対パスで自由に import してよい
  {
    from: from("module-*", "module"),
    allow: { to: { element: { captured: { moduleId: "{{ from.element.captured.moduleId }}" } } } },
  },
  { from: from(...moduleServerSide), allow: [to("core", "db"), to("module-public")] },
  {
    from: from("module-web"),
    allow: [to("core-web", "ui"), { ...to("module-public"), dependency: { kind: "type" } }],
  },
  // 画面のコードはブラウザで動くので、サーバーのコードを入れない
  {
    from: from("module-web"),
    disallow: [to("module-server", "module-db"), { to: { module: { source: "hono" } } }],
    message:
      "モジュールの画面のコードから、サーバーのコード(server・db・Hono)を import してはいけない",
  },
  // domain は DB を知らない純粋なロジックにする。外部のライブラリは Zod だけ
  {
    from: from("module-domain"),
    disallow: [to("db", "module-db"), { to: { module: { origin: "external", source: "!zod" } } }],
    message: "domain から使えるのは、自分のモジュールの domain と Zod だけ",
  },

  {
    from: from("registry"),
    allow: [{ ...to("core"), dependency: { kind: "type" } }, to("module-server")],
  },
  { from: from("app-server"), allow: to("core", "db", "registry") },
  { from: from("app-web"), allow: to("core-web", "ui", "module-web") },
];

/**
 * module-system.md §5.2 の依存のルールを eslint-plugin-boundaries で検査する設定。
 * @param {{ rootDir: string, tsconfigPath: string | string[] }} options
 * @returns {import("eslint").Linter.Config[]}
 */
export function createBoundariesConfig({ rootDir, tsconfigPath }) {
  return [
    {
      files: ["**/*.ts"],
      languageOptions: { parser: tseslint.parser },
      plugins: { boundaries },
      settings: {
        "boundaries/root-path": rootDir,
        "boundaries/elements": elements,
        // 名前ではなくパスで指定する。pnpm では、各パッケージから名前でこの resolver を見つけられないため
        "import/resolver": {
          [resolverPath]: { project: tsconfigPath },
        },
      },
      rules: {
        "boundaries/dependencies": [
          "error",
          // checkAllOrigins: 外部のライブラリへの依存も検査する(既定ではローカルのファイルだけ)
          { default: "disallow", checkAllOrigins: true, policies },
        ],
      },
    },
  ];
}
