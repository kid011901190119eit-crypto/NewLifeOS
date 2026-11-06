import { createRequire } from "node:module";
import boundaries from "eslint-plugin-boundaries";
import tseslint from "typescript-eslint";

const resolverPath = createRequire(import.meta.url).resolve("eslint-import-resolver-typescript");

// モジュールも exports によって dist に解決されるので、src と dist の両方を見る
const moduleDir = (part) => ({
  type: `module-${part}`,
  pattern: [`packages/modules/*/src/${part}`, `packages/modules/*/dist/${part}`],
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
  // マイグレーションの適用は migrate だけが使う(api などが起動時に適用しないようにする。module-system.md §4.4)
  {
    type: "db-migrate",
    pattern: ["packages/db/src/migrate", "packages/db/dist/migrate"],
    partialMatch: false,
  },
  // テスト用の道具は、テストのファイルだけが使う(ADR 0030)
  {
    type: "db-testing",
    pattern: ["packages/db/src/testing", "packages/db/dist/testing"],
    partialMatch: false,
  },
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
  { type: "app-migrate", pattern: "apps/migrate", partialMatch: false },
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

/** domain から使えるのを、自分のモジュールの domain と、libraries に挙げた外部のライブラリだけにするポリシー */
const domainPolicyAllowing = (libraries, message) => ({
  from: from("module-domain"),
  disallow: [
    to("db", "db-testing", "module-db"),
    { to: { module: { origin: "external", source: `!(${libraries.join("|")})` } } },
  ],
  message,
});
const domainPolicy = domainPolicyAllowing(
  ["zod"],
  "domain から使えるのは、自分のモジュールの domain と Zod だけ",
);
const domainTestPolicy = domainPolicyAllowing(
  ["zod", "vitest"],
  "domain のテストから使えるのは、自分のモジュールの domain と Zod・Vitest だけ",
);

// module-system.md §5.2 の表。複数のポリシーに当てはまるときは、後に書いたものが優先される
const policies = [
  // 外部のライブラリと Node.js の組み込みモジュールは、下で個別に禁止しない限り使ってよい
  { allow: { to: { module: { origin: ["external", "core"] } } } },

  // core/web はブラウザで動くので、db もコアのサーバー側も import させない(どちらも許可しない)
  { from: from("core"), allow: to("db") },
  { from: from("db-migrate"), allow: to("db") },
  // テスト用の道具は、本番と同じ処理でテストの DB を作るためにマイグレーションの適用を使ってよい(ADR 0030)
  { from: from("db-testing"), allow: to("db", "db-migrate") },

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
  // domain は DB を知らない純粋なロジックにする。外部のライブラリは本体では Zod だけ、テストでは Zod と Vitest だけ
  // (テストのファイルだけ、下の createBoundariesConfig で差し替える)
  domainPolicy,

  {
    from: from("registry"),
    allow: [{ ...to("core"), dependency: { kind: "type" } }, to("module-server")],
  },
  { from: from("app-server"), allow: to("core", "db", "registry") },
  { from: from("app-migrate"), allow: to("core", "db", "db-migrate", "registry") },
  { from: from("app-web"), allow: to("core-web", "ui", "module-web") },
];

// テストのファイル用。db を使ってよい種類(画面のコードを除く)のテストだけが、db のテスト用の道具も使える。
// domain の禁止(後ろにある domainPolicy)が優先されるよう、先頭に置く
const testPolicies = [
  {
    from: from(
      "core",
      "db",
      "db-migrate",
      "db-testing",
      ...moduleServerSide,
      "app-server",
      "app-migrate",
    ),
    allow: to("db-testing"),
  },
  ...policies,
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
    // テストのファイルだけ、db のテスト用の道具を使ってよい(ADR 0030)
    {
      files: ["**/*.test.ts"],
      rules: {
        "boundaries/dependencies": [
          "error",
          { default: "disallow", checkAllOrigins: true, policies: testPolicies },
        ],
      },
    },
    // domain のテストだけ、テストの道具の Vitest を使ってよい(ADR 0028)
    {
      files: ["**/src/domain/**/*.test.ts"],
      rules: {
        "boundaries/dependencies": [
          "error",
          {
            default: "disallow",
            checkAllOrigins: true,
            policies: testPolicies.map((policy) =>
              policy === domainPolicy ? domainTestPolicy : policy,
            ),
          },
        ],
      },
    },
  ];
}
