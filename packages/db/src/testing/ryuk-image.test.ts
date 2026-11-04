import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RYUK_IMAGE } from "./ryuk-image.js";

// getReaperImage は公開されていないので、Testcontainers の本体から既定のイメージ名を読む
function defaultRyukImageOfTestcontainers(): string {
  const entry = createRequire(import.meta.url).resolve("testcontainers");
  const reaper = readFileSync(path.join(path.dirname(entry), "reaper", "reaper.js"), "utf8");
  const image = /"(testcontainers\/ryuk:[^"]+)"/.exec(reaper)?.[1];
  if (!image) throw new Error("Testcontainers の既定の Ryuk のイメージが見つからない");
  return image;
}

describe("Ryuk(Testcontainers の後片付け係)のイメージ", () => {
  it("版と digest の両方で固定する(Docker を操作できる強い権限を持つため)", () => {
    expect(RYUK_IMAGE).toMatch(/^testcontainers\/ryuk:\d+\.\d+\.\d+@sha256:[0-9a-f]{64}$/);
  });

  it("版は、入っている Testcontainers が既定で使う版と同じ(組で動作が確かめられているため)", () => {
    expect(RYUK_IMAGE.split("@")[0]).toBe(defaultRyukImageOfTestcontainers());
  });
});
