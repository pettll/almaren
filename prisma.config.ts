import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@prisma/config";

// Absolute path, not `./prisma/dev.db`: see lib/db/client.ts for why.
const PROJECT_ROOT = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = path.join(PROJECT_ROOT, "prisma", "dev.db");

export default defineConfig({
  schema: path.join(PROJECT_ROOT, "prisma", "schema.prisma"),
  datasource: {
    url: process.env.DATABASE_URL ?? `file:${DEFAULT_DB_PATH}`,
  },
});
