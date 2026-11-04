import { readdirSync } from "node:fs";
import path from "node:path";
import lint from "@commitlint/lint";
import load from "@commitlint/load";
import { describe, expect, it } from "vitest";

const configDir = path.join(import.meta.dirname, "..");
const repoRoot = path.join(configDir, "..", "..");

async function failedRules(message: string): Promise<string[]> {
  const config = await load({}, { cwd: configDir, file: "commitlint.config.js" });
  const result = await lint(
    message,
    config.rules,
    config.parserPreset ? { parserOpts: config.parserPreset.parserOpts as object } : {},
  );
  return result.errors.map((error) => error.name).sort();
}

async function allowedScopes(): Promise<string[]> {
  const config = await load({}, { cwd: configDir, file: "commitlint.config.js" });
  const rule = config.rules["scope-enum"];
  return (rule?.[2] as string[] | undefined) ?? [];
}

function workspaceNames(dir: string): string[] {
  return readdirSync(path.join(repoRoot, dir), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "modules")
    .map((entry) => entry.name);
}

describe("commitlint のルール(Conventional Commits)", () => {
  describe("形式に合うメッセージは通る", () => {
    it.each([
      "feat(finance): 口座間移動の仕訳ルールを追加",
      "ci: プルリクエストのタイトルを検査する",
      "build(repo): ビルドの前に dist を掃除する",
      "chore(deps): commitlint を更新する",
      "feat(core)!: 認証の API を変える",
      "revert: feat(finance): 口座間移動の仕訳ルールを追加",
    ])("%s", async (message) => {
      expect(await failedRules(message)).toEqual([]);
    });
  });

  describe("形式に合わないメッセージは、該当するルールで失敗する", () => {
    it.each([
      ["種類がない", "口座間移動の仕訳ルールを追加", ["subject-empty", "type-empty"]],
      ["一覧にない種類", "feature(finance): 口座間移動を追加", ["type-enum"]],
      ["種類が大文字", "Feat(finance): 口座間移動を追加", ["type-case", "type-enum"]],
      ["一覧にない範囲", "feat(fin): 口座間移動を追加", ["scope-enum"]],
      ["コロンの後に空白がない", "feat(finance):口座間移動を追加", ["subject-empty", "type-empty"]],
      // 末尾の空白は、前後の空白を禁じる header-trim でも失敗する
      ["説明がない", "feat(finance): ", ["header-trim", "subject-empty"]],
      ["説明が半角のピリオドで終わる", "fix: 残高の計算を直す.", ["subject-full-stop"]],
      ["1行目が100文字を超える", `docs: ${"あ".repeat(95)}`, ["header-max-length"]],
    ])("%s: %s", async (_label, message, expected) => {
      expect(await failedRules(message)).toEqual(expected);
    });
  });

  it("範囲の一覧に、すべてのパッケージ・モジュール・アプリの名前が含まれる", async () => {
    const names = [
      ...workspaceNames("packages"),
      ...workspaceNames("packages/modules"),
      ...workspaceNames("apps"),
    ];
    expect(await allowedScopes()).toEqual(expect.arrayContaining(names));
  });
});
