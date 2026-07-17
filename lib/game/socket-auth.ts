import { prisma } from "@/lib/db/client";

export interface AuthedSocketUser {
  userId: string;
  isGuest: boolean;
}

function sessionCookieName() {
  return process.env.NODE_ENV === "production"
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, decodeURIComponent(rest.join("="))];
    }),
  );
}

// Socket.io connections authenticate off the same Auth.js database session
// cookie the HTTP side uses, so a browser tab and its socket always share
// one identity.
export async function authenticateSocket(
  cookieHeader: string | undefined,
): Promise<AuthedSocketUser | null> {
  const cookies = parseCookies(cookieHeader);
  const token = cookies[sessionCookieName()];
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    include: { user: true },
  });

  if (!session || session.expires < new Date()) return null;

  return { userId: session.user.id, isGuest: session.user.isGuest };
}
