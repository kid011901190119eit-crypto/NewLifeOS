/** @type {import("@commitlint/types").UserConfig} */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // パッケージ・モジュール・アプリを足したら、ここにも足す(テストで確かめている)
    "scope-enum": [
      2,
      "always",
      [
        "repo",
        "config",
        "deps",
        "core",
        "db",
        "ui",
        "finance",
        "calendar",
        "api",
        "web",
        "mcp",
        "worker",
      ],
    ],
  },
};
