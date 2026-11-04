import { readFileSync } from "node:fs";
import path from "node:path";

const composeFile = path.join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "..",
  "deploy",
  "compose",
  "compose.yaml",
);

const pinnedImage = /^postgres:(\d+\.\d+)@sha256:[0-9a-f]{64}$/;

/**
 * 結合テストの PostgreSQL のイメージは compose.yaml を正とし、ここから読む(ADR 0025)。
 * YAML パーサを足さないため、字下げ2つの services 直下の postgres の image 行を探す。
 */
export function postgresImageFromCompose(compose = readFileSync(composeFile, "utf8")): string {
  const service = /^ {2}postgres:\n((?: {4}.*\n?|\s*\n)*)/m.exec(compose)?.[1];
  if (service === undefined) {
    throw new Error("compose.yaml に postgres のサービスがない");
  }
  const image = /^ {4}image:\s*(\S+)\s*$/m.exec(service)?.[1] ?? "";
  if (!pinnedImage.test(image)) {
    throw new Error(`postgres のイメージは版と digest で固定する(実際: "${image}")`);
  }
  return image;
}

/** `postgres:18.6@sha256:…` から `18.6` を取り出す */
export function postgresVersionOf(image: string): string {
  const version = pinnedImage.exec(image)?.[1];
  if (version === undefined) {
    throw new Error(`postgres のイメージは版と digest で固定する(実際: "${image}")`);
  }
  return version;
}
