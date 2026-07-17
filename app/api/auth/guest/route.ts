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

// The same Sindarin/Quenya words this repo already uses for commit
// subjects (see CONTRIBUTING.md) — attested in Tolkien's published texts
// rather than invented, and already vetted by that convention.
const GUEST_NAME_WORDS = [
  "Mellon", // friend
  "Estel", // hope
  "Gwaith", // people, folk
  "Tirith", // watch, guard
  "Amon", // hill
  "Ithil", // moon
  "Anor", // sun
  "Menel", // heavens
  "Nen", // water
  "Ered", // mountains
  "Dor", // land
  "Tol", // isle
  "Taur", // forest
  "Cened", // sight
  "Parf", // book
  "Lam", // tongue
  "Cuil", // life
  "Echuir", // stirring, spring
  "Minno", // enter
  "Ephel", // fence, enclosure
  "Suilad", // greeting
  "Hen", // eye
  "Echad", // camp
  "Bar", // home
];

function randomGuestName() {
  const word =
    GUEST_NAME_WORDS[Math.floor(Math.random() * GUEST_NAME_WORDS.length)];
  return `${word}-${randomBytes(2).toString("hex")}`;
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
    docs: "/api/docs/agents",
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
