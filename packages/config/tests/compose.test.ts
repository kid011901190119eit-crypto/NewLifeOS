import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.join(import.meta.dirname, "..", "..", "..");
const composeDir = path.join(repoRoot, "deploy", "compose");
const composeFile = path.join(composeDir, "compose.yaml");
const envExampleFile = path.join(composeDir, ".env.example");

function read(file: string): string {
  return existsSync(file) ? readFileSync(file, "utf8") : "";
}

const compose = read(composeFile);

// YAML パーサを足さないため、services 直下(字下げ2つ)のキーで区切って各サービスの本文を取り出す
function servicesOf(text: string): Map<string, string> {
  const block = /^services:\n([\s\S]*?)(?=^\S|(?![\s\S]))/m.exec(text)?.[1] ?? "";
  const services = new Map<string, string>();
  for (const part of block.split(/^(?= {2}[\w-]+:\s*$)/m)) {
    const name = /^ {2}([\w-]+):/.exec(part)?.[1];
    if (name) services.set(name, part);
  }
  return services;
}

const services = servicesOf(compose);

function service(name: string): string {
  return services.get(name) ?? "";
}

function listOf(body: string, key: string): string[] {
  const block = new RegExp(`^ {4}${key}:\\n((?: {6}- .*\\n?)*)`, "m").exec(body)?.[1] ?? "";
  return [...block.matchAll(/^ {6}- "?([^"\n]+)"?$/gm)].map((match) => match[1] ?? "");
}

describe("ローカル開発用の Docker Compose(Issue #23)", () => {
  it("PostgreSQL と Valkey の2つのサービスがある", () => {
    expect([...services.keys()].sort()).toEqual(["postgres", "valkey"]);
  });

  it("PostgreSQL は 18 系(uuidv7() を既定値に使うため。finance-data-model.md §3)", () => {
    expect(service("postgres")).toMatch(/^ {4}image: postgres:18\.\d+@/m);
  });

  it("Valkey は 9.1 系", () => {
    expect(service("valkey")).toMatch(/^ {4}image: valkey\/valkey:9\.1\.\d+@/m);
  });

  describe.each(["postgres", "valkey"])("%s", (name) => {
    it("イメージは版と digest の両方で固定する(Renovate が両方を更新できる形)", () => {
      expect(service(name)).toMatch(/^ {4}image: [\w./-]+:\d+\.\d+\.?\d*@sha256:[0-9a-f]{64}$/m);
    });

    it("ポートは 127.0.0.1 にだけ公開する(同じネットワークの他の機器から見えない)", () => {
      const ports = listOf(service(name), "ports");
      expect(ports.length).toBeGreaterThan(0);
      expect(ports.filter((port) => !port.startsWith("127.0.0.1:"))).toEqual([]);
    });

    it("ヘルスチェックで準備完了がわかる", () => {
      expect(service(name)).toMatch(/^ {4}healthcheck:\n {6}test:/m);
    });

    it("データは名前付きボリュームに保存する(コンテナを作り直しても残る)", () => {
      const volumes = listOf(service(name), "volumes");
      expect(volumes.length).toBeGreaterThan(0);
      expect(volumes.every((volume) => /^[\w-]+:\//.test(volume))).toBe(true);
    });
  });

  it("PostgreSQL のボリュームは /var/lib/postgresql に付ける(18 からデータの場所が変わった)", () => {
    expect(listOf(service("postgres"), "volumes")).toEqual(["postgres-data:/var/lib/postgresql"]);
  });

  it("Valkey は AOF で書き込みのたびに記録する(異常終了してもキューのジョブが残る)", () => {
    expect(service("valkey")).toMatch(/--appendonly yes/);
  });

  it("パスワードは平文で書かず、環境変数から受け取る(値が無ければ起動を止める)", () => {
    const passwordValues = [...compose.matchAll(/^\s*\w*PASSWORD:\s*(.*)$/gm)].map(
      (match) => match[1] ?? "",
    );
    expect(passwordValues.length).toBeGreaterThan(0);
    expect(passwordValues.filter((value) => !value.startsWith("${"))).toEqual([]);
    expect(compose).toMatch(/\$\{POSTGRES_PASSWORD:\?/);
    expect(compose).toMatch(/\$\{VALKEY_PASSWORD:\?/);
  });
});

describe("秘密情報の見本ファイル(.env.example)", () => {
  const variables = [...compose.matchAll(/\$\{(\w+)/g)].map((match) => match[1] ?? "");

  it("compose.yaml が使う環境変数をすべて載せている", () => {
    const example = read(envExampleFile);
    expect(variables.length).toBeGreaterThan(0);
    const missing = [...new Set(variables)].filter(
      (name) => !new RegExp(`^${name}=`, "m").test(example),
    );
    expect(missing).toEqual([]);
  });

  it("本物の .env は Git の管理から外れている", () => {
    // check-ignore は無視される場合に終了コード0を返し、そうでなければ例外を投げる
    expect(() =>
      execFileSync("git", ["check-ignore", "-q", "deploy/compose/.env"], { cwd: repoRoot }),
    ).not.toThrow();
  });
});

describe("ルートの package.json のコマンド", () => {
  const scripts = (
    JSON.parse(read(path.join(repoRoot, "package.json"))) as { scripts: Record<string, string> }
  ).scripts;
  const base = "docker compose -f deploy/compose/compose.yaml";

  it.each([
    ["db:up", `${base} up -d --wait`],
    ["db:down", `${base} down`],
    ["db:status", `${base} ps`],
    ["db:logs", `${base} logs -f`],
    ["db:reset", `${base} down --volumes && ${base} up -d --wait`],
  ])("%s は「%s」を実行する", (name, command) => {
    expect(scripts[name]).toBe(command);
  });
});
