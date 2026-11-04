import { PostgreSqlContainer } from "@testcontainers/postgresql";
import pg from "pg";
import { postgresImageFromCompose } from "./postgres-image.js";
import { RYUK_IMAGE } from "./ryuk-image.js";

export interface TestPostgres {
  readonly client: pg.Client;
  stop(): Promise<void>;
}

/**
 * 結合テスト用に、使い捨ての PostgreSQL を起動して接続する。
 * 呼び出し側は afterAll で stop() を呼ぶ。プロセスごと落ちたときは Ryuk が片付ける。
 * パスワードは Testcontainers がコンテナごとに設定する既定値を使い、コードには書かない。
 */
export async function startPostgres(): Promise<TestPostgres> {
  // Testcontainers は Ryuk の起動時にこの環境変数を読む
  process.env.RYUK_CONTAINER_IMAGE = RYUK_IMAGE;

  const container = await new PostgreSqlContainer(postgresImageFromCompose()).start();
  const client = new pg.Client({ connectionString: container.getConnectionUri() });
  try {
    await client.connect();
  } catch (error) {
    await container.stop();
    throw error;
  }

  return {
    client,
    async stop() {
      try {
        await client.end();
      } finally {
        await container.stop();
      }
    },
  };
}
