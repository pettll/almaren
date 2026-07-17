import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db/client";

const KEY_PREFIX = "almaren_";

export function generateApiKey(): { plaintext: string; hash: string } {
  const plaintext = `${KEY_PREFIX}${randomBytes(24).toString("hex")}`;
  return { plaintext, hash: hashApiKey(plaintext) };
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

function extractBearerToken(header: string | null): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() === "bearer" && token) return token;
  return null;
}

export interface ResolvedApiKey {
  userId: string;
  apiKeyId: string;
}

// Accepts either `Authorization: Bearer <key>` or `X-Api-Key: <key>`.
export async function resolveApiKeyFromHeaders(
  headers: Headers,
): Promise<ResolvedApiKey | null> {
  const token =
    extractBearerToken(headers.get("authorization")) ??
    headers.get("x-api-key");
  if (!token || !token.startsWith(KEY_PREFIX)) return null;

  const hash = hashApiKey(token);
  const record = await prisma.apiKey.findUnique({ where: { key: hash } });
  if (!record || record.revokedAt) return null;

  // Constant-time compare against the stored hash, even though we already
  // looked it up by exact match, to avoid any timing signal on lookup path.
  const a = Buffer.from(record.key);
  const b = Buffer.from(hash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  await prisma.apiKey.update({
    where: { id: record.id },
    data: { lastUsedAt: new Date() },
  });

  return { userId: record.userId, apiKeyId: record.id };
}
