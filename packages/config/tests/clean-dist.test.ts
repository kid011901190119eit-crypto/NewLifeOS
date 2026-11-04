import { execSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.join(import.meta.dirname, "..", "..", "..");
const buildPackages = ["packages/core"];

interface PackageJson {
  scripts: Record<string, string>;
}

interface TurboJson {
  tasks: Record<string, { dependsOn?: string[]; cache?: boolean }>;
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), "utf8")) as T;
}

describe("ビルドのときに dist を掃除する(Issue #10)", () => {
  describe.each(buildPackages)("%s", (packageDir) => {
    const { scripts } = readJson<PackageJson>(`${packageDir}/package.json`);
    let workDir: string | undefined;

    afterEach(() => {
      if (workDir !== undefined) {
        rmSync(workDir, { recursive: true, force: true });
      }
    });

    it("clean スクリプトは、dist を中身ごと消す", () => {
      workDir = mkdtempSync(path.join(os.tmpdir(), "lifeos-clean-"));
      mkdirSync(path.join(workDir, "dist", "nested"), { recursive: true });
      writeFileSync(path.join(workDir, "dist", "nested", "stale.js"), "");

      execSync(scripts.clean ?? "", { cwd: workDir });

      expect(existsSync(path.join(workDir, "dist"))).toBe(false);
    });

    it("clean スクリプトは、dist がなくても失敗しない", () => {
      workDir = mkdtempSync(path.join(os.tmpdir(), "lifeos-clean-"));

      expect(() => execSync(scripts.clean ?? "", { cwd: workDir })).not.toThrow();
    });

    it("build スクリプトは、最初に clean を実行する(turbo を通さずに直接ビルドしたとき用)", () => {
      expect(scripts.build).toMatch(/^pnpm run clean && /);
    });
  });

  it("Turborepo の build は clean のあとに実行され、clean はキャッシュしない(キャッシュから復元したとき用)", () => {
    const { tasks } = readJson<TurboJson>("turbo.json");

    expect(tasks.build?.dependsOn).toContain("clean");
    expect(tasks.clean?.cache).toBe(false);
  });
});
