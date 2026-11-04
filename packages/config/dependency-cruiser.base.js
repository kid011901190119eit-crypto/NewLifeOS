// ワークスペースの中のコード(外部のライブラリは含まない)
const local = "^(packages|apps)/";
// @lifeos/core は exports によって dist(ビルドの成果物)に解決されるので、src と dist の両方を見る
const coreWeb = "packages/core/(src|dist)/web/";
const coreServer = "packages/core/(?!(src|dist)/web/)";
const anyPublic = "packages/modules/[^/]+/src/public/";
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
    "core-deps",
    "コアが import してよいのは、自分と db だけ(モジュールを知らない)",
    "^packages/core/",
    ["packages/core/", "packages/db/"],
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
    ["packages/modules/$1/(?!src/(server|db)/)", coreWeb, "packages/ui/", anyPublic],
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
    to: { path: "^(packages/db/|packages/modules/[^/]+/src/db/)" },
  },
  {
    name: "domain-only-zod",
    comment: "domain が使ってよい外部のライブラリは Zod だけ",
    severity: "error",
    from: { path: "^packages/modules/[^/]+/src/domain/" },
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
      pathNot: "^zod$|(^|/)node_modules/zod/",
    },
  },
  row(
    "registry-deps",
    "registry が import してよいのは、core(型だけ)と各モジュールの server だけ",
    "^packages/registry/",
    ["packages/registry/", coreServer, "packages/modules/[^/]+/src/server/"],
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
    "app-web-deps",
    "apps/web が import してよいのは、core/web・ui・各モジュールの web だけ",
    "^apps/web/",
    ["apps/web/", coreWeb, "packages/ui/", "packages/modules/[^/]+/src/web/"],
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
      ...(tsconfigPath === undefined ? {} : { tsConfig: { fileName: tsconfigPath } }),
    },
  };
}
