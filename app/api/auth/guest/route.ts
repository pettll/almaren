import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { spawnEntityForUser } from "@/lib/game/entities";

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

function sessionCookieName() {
  const useSecureCookies = process.env.NODE_ENV === "production";
  return useSecureCookies
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
}

function randomGuestName() {
  return `Guest-${randomBytes(3).toString("hex")}`;
}

// Creates a throwaway guest User + Session directly in the same tables
// Auth.js's database session strategy reads from, so `auth()` treats guests
// exactly like GitHub-authenticated users everywhere else in the app.
export async function POST() {
  const user = await prisma.user.create({
    data: { name: randomGuestName(), isGuest: true },
  });

  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await prisma.session.create({
    data: { sessionToken: token, userId: user.id, expires },
  });

  await spawnEntityForUser(user.id, user.name ?? "Guest");

  const response = NextResponse.json({
    id: user.id,
    name: user.name,
    isGuest: true,
  });

  response.cookies.set(sessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires,
    path: "/",
  });

  return response;
}
