import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_TTL_SEC,
  REFRESH_TTL_SEC,
} from "@/lib/auth";
import { ok, apiError, badRequest } from "@/lib/api";
import { isValidEmail } from "@/lib/validation";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  // Max 5 failed attempts per IP per 15 minutes.
  const rl = rateLimit(`login:${ip}`, 5, 15 * 60 * 1000);
  if (!rl.allowed) {
    return apiError(429, "Too many login attempts. Please try again later.");
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid request body");
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";

  if (!isValidEmail(email)) {
    return badRequest("Invalid email format", { field: "email", value: email });
  }
  if (!password) {
    return badRequest("Password is required", { field: "password" });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    return apiError(401, "Invalid credentials");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return apiError(401, "Invalid credentials");
  }

  const sessionUser = {
    id: user.id,
    email: user.email,
    role: user.role as Role,
    fullName: user.fullName,
  };

  const accessToken = await signAccessToken(sessionUser);
  const refreshToken = await signRefreshToken(user.id);

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  // Reset the rate-limit bucket on success.
  rateLimit(`login:${ip}:reset`, 1, 1);

  const res = ok({
    access_token: accessToken,
    user: sessionUser,
    expires_in: ACCESS_TTL_SEC,
  });

  const secure = process.env.NODE_ENV === "production";
  res.cookies.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TTL_SEC,
  });
  res.cookies.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TTL_SEC,
  });

  return res;
}
