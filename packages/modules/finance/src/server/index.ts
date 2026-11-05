import { fileURLToPath } from "node:url";
import type { AnyModuleDefinition } from "@lifeos/core";

// src/server と dist/server のどちらから見ても、2つ上がパッケージの直下になる
const finance = {
  id: "finance",
  migrations: { folder: fileURLToPath(new URL("../../migrations", import.meta.url)) },
} as const satisfies AnyModuleDefinition;

export default finance;
