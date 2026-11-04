import { describe, expect, it } from "vitest";
import { postgresImageFromCompose, postgresVersionOf } from "./postgres-image.js";

const digest = "sha256:" + "a".repeat(64);

function composeWith(postgresImage: string): string {
  return [
    "name: test",
    "",
    "services:",
    "  postgres:",
    `    image: ${postgresImage}`,
    "    ports:",
    '      - "127.0.0.1:5432:5432"',
    "",
    "  valkey:",
    `    image: valkey/valkey:9.1.3@${digest}`,
    "",
    "volumes:",
    "  postgres-data:",
    "",
  ].join("\n");
}

describe("compose.yaml から結合テスト用の PostgreSQL のイメージを読む", () => {
  it("postgres サービスのイメージを、版と digest のついた形のまま返す", () => {
    expect(postgresImageFromCompose(composeWith(`postgres:18.6@${digest}`))).toBe(
      `postgres:18.6@${digest}`,
    );
  });

  it("リポジトリの compose.yaml から、版と digest で固定されたイメージを読める", () => {
    expect(postgresImageFromCompose()).toMatch(/^postgres:\d+\.\d+@sha256:[0-9a-f]{64}$/);
  });

  it.each([
    ["digest がない", "postgres:18.6"],
    ["版がない", `postgres@${digest}`],
    ["latest を使っている", `postgres:latest@${digest}`],
  ])("イメージの%sときはエラーにする(どのイメージで試したかが曖昧になるため)", (_, image) => {
    expect(() => postgresImageFromCompose(composeWith(image))).toThrow(/版と digest/);
  });

  it("postgres サービスがないときはエラーにする", () => {
    expect(() => postgresImageFromCompose("services:\n  valkey:\n    image: x\n")).toThrow(
      /postgres/,
    );
  });

  it("イメージから PostgreSQL の版を取り出す", () => {
    expect(postgresVersionOf(`postgres:18.6@${digest}`)).toBe("18.6");
  });
});
