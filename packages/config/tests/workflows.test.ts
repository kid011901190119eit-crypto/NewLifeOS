import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const workflowsDir = path.join(import.meta.dirname, "..", "..", "..", ".github", "workflows");
const workflowFiles = readdirSync(workflowsDir).filter((name) => name.endsWith(".yml"));

function usesOf(file: string): string[] {
  const text = readFileSync(path.join(workflowsDir, file), "utf8");
  return [...text.matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)/gm)].map((match) => match[1] ?? "");
}

const pinnedAction = /^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/;
const pinnedImage = /^docker:\/\/[\w./:-]+@sha256:[0-9a-f]{64}$/;

describe("GitHub Actions のワークフロー", () => {
  it("検査するワークフローがある(CI・PR タイトル・CodeQL・Trivy)", () => {
    expect(workflowFiles).toEqual(
      expect.arrayContaining(["ci.yml", "pr-title.yml", "codeql.yml", "trivy.yml"]),
    );
  });

  it("CI で、結合テスト(pnpm test:integration)を integration というジョブで実行する(Issue #29)", () => {
    const ci = readFileSync(path.join(workflowsDir, "ci.yml"), "utf8");
    expect(ci).toMatch(/^ {8}task: \[.*\bintegration\b.*\]$/m);
    expect(ci).toMatch(/^ {10}- task: integration\n {12}command: pnpm test:integration$/m);
  });

  describe.each(workflowFiles)("%s", (file) => {
    it("外部のアクションはコミットの SHA で、コンテナイメージは digest で固定する", () => {
      const unpinned = usesOf(file).filter(
        (ref) => !pinnedAction.test(ref) && !pinnedImage.test(ref),
      );
      expect(unpinned).toEqual([]);
    });

    it("ワークフロー全体の権限は、コードを読むことだけにする", () => {
      const text = readFileSync(path.join(workflowsDir, file), "utf8");
      expect(text).toMatch(/^permissions:\n {2}contents: read\n/m);
    });
  });
});
