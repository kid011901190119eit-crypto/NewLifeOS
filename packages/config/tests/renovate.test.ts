import { readFileSync } from "node:fs";
import path from "node:path";
import lint from "@commitlint/lint";
import load from "@commitlint/load";
import { describe, expect, it } from "vitest";

const configDir = path.join(import.meta.dirname, "..");
const repoRoot = path.join(configDir, "..", "..");

interface PackageRule {
  enabled?: boolean;
  matchPackageNames?: string[];
  matchManagers?: string[];
  matchUpdateTypes?: string[];
  allowedVersions?: string;
  groupName?: string;
  semanticCommitType?: string;
  automerge?: boolean;
}

interface CustomManager {
  customType?: string;
  managerFilePatterns?: string[];
  matchStrings?: string[];
  datasourceTemplate?: string;
}

interface RenovateConfig {
  extends?: string[];
  customManagers?: CustomManager[];
  automerge?: boolean;
  timezone?: string;
  schedule?: string[];
  prConcurrentLimit?: number;
  prHourlyLimit?: number;
  minimumReleaseAge?: string;
  rangeStrategy?: string;
  semanticCommits?: string;
  semanticCommitScope?: string;
  packageRules?: PackageRule[];
}

const config = JSON.parse(
  readFileSync(path.join(repoRoot, "renovate.json"), "utf8"),
) as RenovateConfig;
const rules = config.packageRules ?? [];

function ruleFor(packageName: string): PackageRule | undefined {
  return rules.find((rule) => rule.matchPackageNames?.includes(packageName));
}

function ruleForManager(manager: string): PackageRule | undefined {
  return rules.find((rule) => rule.matchManagers?.includes(manager) && rule.groupName);
}

async function failedRules(message: string): Promise<string[]> {
  const commitlint = await load({}, { cwd: configDir, file: "commitlint.config.js" });
  const result = await lint(
    message,
    commitlint.rules,
    commitlint.parserPreset ? { parserOpts: commitlint.parserPreset.parserOpts as object } : {},
  );
  return result.errors.map((error) => error.name);
}

describe("Renovate の設定(Issue #21)", () => {
  it("プルリクエストを自動でマージしない(オーナーがレビューしてからマージする)", () => {
    expect(config.automerge).not.toBe(true);
    expect(rules.filter((rule) => rule.automerge === true)).toEqual([]);
  });

  it("GitHub Actions のコミットの SHA も更新の対象にする", () => {
    expect(config.extends).toContain("helpers:pinGitHubActionDigests");
  });

  it("TypeScript は 6.0 系にとどめ、6.1 や 7 への更新を提案しない(ADR 0017)", () => {
    expect(ruleFor("typescript")?.allowedVersions).toBe("<6.1.0");
  });

  it.each(["node", "@types/node"])(
    "%s は 24 系にとどめる(package.json の engines と合わせる)",
    (name) => {
      expect(ruleFor(name)?.allowedVersions).toBe("<25");
    },
  );

  it("公開から7日たった版だけを提案する(公開直後に乗っ取られた版を避ける)", () => {
    expect(config.minimumReleaseAge).toBe("7 days");
  });

  it("毎週月曜の朝(日本時間)にだけプルリクエストを作る", () => {
    expect(config.timezone).toBe("Asia/Tokyo");
    expect(config.schedule).toEqual(["before 9am on monday"]);
  });

  it("開いているプルリクエストは5本まで、1時間に作るのは2本まで", () => {
    expect(config.prConcurrentLimit).toBe(5);
    expect(config.prHourlyLimit).toBe(2);
  });

  it("package.json の版の範囲の下限も上げる(bump)", () => {
    expect(config.rangeStrategy).toBe("bump");
  });

  describe("マイナー・パッチの更新は種類ごとにまとめ、メジャーは個別にする", () => {
    it.each(["npm", "github-actions"])("%s", (manager) => {
      const rule = ruleForManager(manager);
      expect(rule?.groupName).toBeDefined();
      expect(rule?.matchUpdateTypes).toContain("minor");
      expect(rule?.matchUpdateTypes).toContain("patch");
      expect(rule?.matchUpdateTypes).not.toContain("major");
    });
  });

  // 説明の部分は Renovate の既定のテンプレートの形。semantic commits のとき、Renovate は1行目を小文字にする
  describe("プルリクエストのタイトルが commitlint を通る(ADR 0020)", () => {
    it.each([
      ["npm", "build", "update npm non-major dependencies"],
      ["npm", "build", "update dependency eslint to v11"],
      ["npm", "build", "update typescript-eslint monorepo to v9"],
      ["npm", "build", "update dependency eslint-import-resolver-typescript to v4.4.6 [security]"],
      ["github-actions", "ci", "update github-actions non-major"],
      ["github-actions", "ci", "update actions/checkout action to v8"],
      ["github-actions", "ci", "update aquasec/trivy docker tag to v0.77.0"],
      ["github-actions", "ci", "update aquasec/trivy:0.76.1 docker digest to 1a2b3c4"],
      ["docker-compose", "build", "update postgres docker tag to v18.7"],
      ["docker-compose", "build", "update valkey/valkey:9.1.3 docker digest to 1a2b3c4"],
      ["custom.regex", "build", "update testcontainers/ryuk:0.14.0 docker digest to 1a2b3c4"],
    ])("%s の更新は %s(deps): %s", async (manager, expectedType, subject) => {
      const type = rules.find(
        (rule) => rule.matchManagers?.includes(manager) && rule.semanticCommitType,
      )?.semanticCommitType;
      expect(config.semanticCommits).toBe("enabled");
      expect(type).toBe(expectedType);
      expect(await failedRules(`${type}(${config.semanticCommitScope}): ${subject}`)).toEqual([]);
    });
  });
});

describe("Testcontainers の Ryuk のイメージの更新(Issue #29)", () => {
  const ryukFile = "packages/db/src/testing/ryuk-image.ts";
  // managerFilePatterns の "/…/" は正規表現として扱われる
  const manager = (config.customManagers ?? []).find((custom) =>
    custom.managerFilePatterns?.some((pattern) => new RegExp(pattern.slice(1, -1)).test(ryukFile)),
  );

  it("ryuk-image.ts の Ryuk のイメージを、Docker のイメージとして読み取る", () => {
    expect(manager?.customType).toBe("regex");
    expect(manager?.datasourceTemplate).toBe("docker");
    // Renovate の matchStrings は JavaScript と同じ名前つきグループの書き方なので、そのまま試せる
    const text = readFileSync(path.join(repoRoot, ryukFile), "utf8");
    const groups = new RegExp(manager?.matchStrings?.[0] ?? "^$").exec(text)?.groups;
    expect(groups?.depName).toBe("testcontainers/ryuk");
    expect(groups?.currentValue).toMatch(/^\d+\.\d+\.\d+$/);
    expect(groups?.currentDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("Ryuk は digest の更新だけを提案し、版は Testcontainers の更新に合わせて手で上げる", () => {
    const rule = ruleFor("testcontainers/ryuk");
    expect(rule?.enabled).toBe(false);
    expect([...(rule?.matchUpdateTypes ?? [])].sort()).toEqual(["major", "minor", "patch"]);
  });
});
