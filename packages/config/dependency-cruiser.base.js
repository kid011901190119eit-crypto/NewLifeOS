// ワークスペースの中のコード(外部のライブラリは含まない)
const local = "^(packages|apps)/";
// @lifeos/core は exports によって dist(ビルドの成果物)に解決されるので、src と dist の両方を見る
const coreWeb = "packages/core/(src|dist)/web/";
const coreServer = "packages/core/(?!(src|dist)/web/)";
// モジュールも exports によって dist に解決されるので、行き先は src と dist の両方を見る
const anyPublic = "packages/modules/[^/]+/(src|dist)/public/";
const anyModuleServer = "packages/modules/[^/]+/(src|dist)/server/";
const dbMigrate = "packages/db/(src|dist)/migrate/";
const dbTesting = "packages/db/(src|dist)/testing/";
// テストのファイル(結合テストの *.integration.test.ts も含む)
const testFile = "\\.test\\.ts$";
// 開発用の設定の共有(vitest.config.ts などから読む)は §5.2 の表の対象外なので、どこからでも import してよい
const tooling = "^packages/config/";

/**
 * module-system.md §5.2 の表の1行を、「from から import してよいのは allowed だけ」というルールにする。
 * from の () で取り出した値は、allowed の中で $1 として使える(モジュール名を設定に書かないため)。
 */
function row(name, comment, fromPath, allowed) {
  return {
    name,
    comment,
    severity: "error",
    from: { path: fromPath },
    to: { path: local, pathNot: [`^(${allowed.join("|")})`, tooling] },
  };
}

const domain = "^packages/modules/[^/]+/src/domain/";
const domainTest = `${domain}.*\\.test\\.ts$`;

/**
 * domain から外部のライブラリへの依存を、libraries に挙げたものだけに制限するルールにする。
 * from で、domain の中のどのファイル(本体かテストか)に当てはめるかを選ぶ。
 */
function domainExternalLibraries(name, comment, from, libraries) {
  const names = libraries.join("|");
  return {
    name,
    comment,
    severity: "error",
    from,
    to: {
      dependencyTypes: [
        "npm",
        "npm-dev",
        "npm-optional",
        "npm-peer",
        "npm-no-pkg",
        "npm-unknown",
        "unknown",
      ],
      pathNot: `^(${names})$|(^|/)node_modules/(${names})/`,
    },
  };
}

/** @type {import("dependency-cruiser").IForbiddenRuleType[]} */
const forbidden = [
  {
    name: "no-circular",
    comment: "循環依存を禁止する",
    severity: "error",
    from: {},
    to: { circular: true },
  },
  {
    name: "no-unresolvable-workspace-package",
    comment:
      "@lifeos/ のパッケージが解決できないと、依存のルールを検査できない(ビルド前に実行したときなど)",
    severity: "error",
    from: {},
    to: { path: "^@lifeos/", couldNotResolve: true },
  },
  row(
    "db-deps",
    "db はいちばん下の層なので、ワークスペースの中で import してよいのは自分のパッケージだけ",
    "^packages/db/",
    ["packages/db/"],
  ),
  row(
    "ui-deps",
    "ui はいちばん下の層なので、ワークスペースの中で import してよいのは自分のパッケージだけ",
    "^packages/ui/",
    ["packages/ui/"],
  ),
  row(
    "core-deps",
    "コアのサーバー側が import してよいのは、コアのサーバー側と db だけ(モジュールと core/web を知らない)",
    `^${coreServer}`,
    [coreServer, "packages/db/"],
  ),
  row(
    "core-web-deps",
    "core/web はブラウザで動くので、import してよいのは core/web の中だけ(db・コアのサーバー側は禁止)",
    `^${coreWeb}`,
    [coreWeb],
  ),
  row(
    "module-server-side-deps",
    "モジュールの server・operations・domain・public が import してよいのは、自分のモジュール・core・db・他のモジュールの public だけ",
    "^packages/modules/([^/]+)/(?!src/web/)",
    ["packages/modules/$1/", coreServer, "packages/db/", anyPublic],
  ),
  row(
    "module-web-deps",
    "モジュールの web が import してよいのは、自分のモジュール(server・db を除く)・core/web・ui・他のモジュールの public だけ",
    "^packages/modules/([^/]+)/src/web/",
    ["packages/modules/$1/(?!(src|dist)/(server|db)/)", coreWeb, "packages/ui/", anyPublic],
  ),
  {
    name: "module-web-other-public-type-only",
    comment: "モジュールの web から他のモジュールの public を import するときは、型だけにする",
    severity: "error",
    from: { path: "^packages/modules/([^/]+)/src/web/" },
    to: { path: anyPublic, pathNot: "^packages/modules/$1/", dependencyTypesNot: ["type-only"] },
  },
  {
    name: "module-web-no-hono",
    comment: "モジュールの web はブラウザで動くので、Hono を import しない",
    severity: "error",
    from: { path: "^packages/modules/[^/]+/src/web/" },
    to: { path: "^hono$|(^|/)node_modules/hono/" },
  },
  {
    name: "domain-no-db",
    comment: "domain は DB を知らない",
    severity: "error",
    from: { path: "^packages/modules/[^/]+/src/domain/" },
    to: { path: "^(packages/db/|packages/modules/[^/]+/(src|dist)/db/)" },
  },
  domainExternalLibraries(
    "domain-only-zod",
    "domain の本体が使ってよい外部のライブラリは Zod だけ",
    { path: domain, pathNot: domainTest },
    ["zod"],
  ),
  domainExternalLibraries(
    "domain-test-only-zod-and-vitest",
    "domain のテストが使ってよい外部のライブラリは Zod とテストの道具の Vitest だけ",
    { path: domainTest },
    ["zod", "vitest"],
  ),
  row(
    "registry-deps",
    "registry が import してよいのは、core(型だけ)と各モジュールの server だけ",
    "^packages/registry/",
    ["packages/registry/", coreServer, anyModuleServer],
  ),
  {
    name: "registry-core-type-only",
    comment: "registry から core を import するときは、型だけにする",
    severity: "error",
    from: { path: "^packages/registry/" },
    to: { path: "^packages/core/", dependencyTypesNot: ["type-only"] },
  },
  row(
    "app-server-deps",
    "api・mcp・worker が import してよいのは、core・db・registry だけ",
    "^apps/(api|mcp|worker)/",
    ["apps/$1/", coreServer, "packages/db/", "packages/registry/"],
  ),
  row(
    "app-migrate-deps",
    "migrate が import してよいのは、core・db・registry だけ(モジュールの一覧は registry から読む)",
    "^apps/migrate/",
    ["apps/migrate/", coreServer, "packages/db/", "packages/registry/"],
  ),
  {
    name: "db-migrate-only-from-migrate-app",
    comment:
      "マイグレーションの適用は migrate だけが行う(api・mcp・worker などが起動時に適用しないようにする。module-system.md §4.4)",
    severity: "error",
    // db のテスト用の道具は、本番と同じ処理でテストの DB を作るために使ってよい(起動の処理ではないため。ADR 0030)
    from: { pathNot: `^(apps/migrate/|${dbMigrate}|${dbTesting})` },
    to: { path: `^${dbMigrate}` },
  },
  {
    name: "db-testing-only-from-tests",
    comment:
      "db のテスト用の道具を import してよいのはテストのファイルだけ(本番のコードがテスト用の道具を経由してマイグレーションの適用に届かないようにする。ADR 0030)",
    severity: "error",
    from: { pathNot: [testFile, `^${dbTesting}`] },
    to: { path: `^${dbTesting}` },
  },
  row(
    "app-web-deps",
    "apps/web が import してよいのは、core/web・ui・各モジュールの web だけ",
    "^apps/web/",
    ["apps/web/", coreWeb, "packages/ui/", "packages/modules/[^/]+/(src|dist)/web/"],
  ),
];

/**
 * module-system.md §5.2 の依存のルールと循環依存の禁止を、dependency-cruiser で検査する設定。
 * @param {{ tsconfigPath?: string }} [options]
 */
export function createDependencyCruiserConfig({ tsconfigPath } = {}) {
  return {
    forbidden,
    options: {
      // dist は exclude にしない。exclude すると、dist に解決される @lifeos/core への依存まで消えるため。
      // 検査の出発点を src だけにし(package.json の lint:deps)、dist の中はたどらないことで、
      // 古いビルド結果が検査されないようにする
      doNotFollow: { path: ["node_modules", "(^|/)dist/"] },
      exclude: { path: "(^|/)(tests/fixtures|coverage|\\.turbo)/" },
      // import type も依存として数える(型だけの import かどうかを検査するため)
      tsPreCompilationDeps: true,
      // package.json の exports を読む(既定では読まず、@lifeos/ のパッケージを解決できない)。
      // 実行するときと同じ dist の .js に解決させるため、types の条件は使わない
      enhancedResolveOptions: {
        exportsFields: ["exports"],
        conditionNames: ["import", "node", "default"],
      },
      ...(tsconfigPath === undefined ? {} : { tsConfig: { fileName: tsconfigPath } }),
    },
  };
}
