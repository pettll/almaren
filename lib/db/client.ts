import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Resolved from this file's own location rather than left as a
// `./prisma/dev.db`-style relative path: a relative path is only correct
// if every entry point (dev server, `npm start`, Next's build-time module
// analysis, CI) happens to share the same process.cwd(), which they don't
// reliably do.
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_DB_PATH = path.join(PROJECT_ROOT, "prisma", "dev.db");

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? `file:${DEFAULT_DB_PATH}`,
});

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
