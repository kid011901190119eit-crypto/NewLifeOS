import { getContainerRuntimeClient } from "testcontainers";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { postgresImageFromCompose, postgresVersionOf } from "./testing/postgres-image.js";
import { RYUK_IMAGE } from "./testing/ryuk-image.js";
import { startPostgres, type TestPostgres } from "./testing/start-postgres.js";

const uuidV7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("Testcontainers で起動した使い捨ての PostgreSQL", () => {
  let postgres: TestPostgres;

  beforeAll(async () => {
    postgres = await startPostgres();
  });

  afterAll(async () => {
    await postgres?.stop();
  });

  it("接続して SELECT 1 の結果を受け取れる", async () => {
    const result = await postgres.client.query<{ one: number }>("SELECT 1 AS one");
    expect(result.rows).toEqual([{ one: 1 }]);
  });

  it("compose.yaml と同じ版の PostgreSQL が動いている", async () => {
    const result = await postgres.client.query<{ server_version: string }>("SHOW server_version");
    const expected = postgresVersionOf(postgresImageFromCompose());
    expect(result.rows[0]?.server_version.split(" ")[0]).toBe(expected);
  });

  it("uuidv7() が、版7の形の UUID を返す(主キーの既定値に使う。ADR 0013)", async () => {
    const result = await postgres.client.query<{ id: string }>("SELECT uuidv7()::text AS id");
    expect(result.rows[0]?.id).toMatch(uuidV7);
  });

  it("後片付け係の Ryuk は、digest で固定したイメージで動いている", async () => {
    const client = await getContainerRuntimeClient();
    const ryuk = (await client.container.list()).filter(
      (container) => container.Labels["org.testcontainers.ryuk"] === "true",
    );
    expect(ryuk.map((container) => container.Image)).toContain(RYUK_IMAGE);
  });
});
