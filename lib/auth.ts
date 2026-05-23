import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import type { Role, SessionUser } from "./types";

const ACCESS_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET_KEY || "dev-insecure-access-secret-change-me"
);
const REFRESH_SECRET = new TextEncoder().encode(
  process.env.JWT_REFRESH_SECRET_KEY || "dev-insecure-refresh-secret-change-me"
);

export const ACCESS_COOKIE = "axis_access";
export const REFRESH_COOKIE = "axis_refresh";

// Session lifetimes (seconds). Spec: 8h users / 4h operators. Access JWT 1h.
export const ACCESS_TTL_SEC = 60 * 60; // 1h
export const REFRESH_TTL_SEC = 60 * 60 * 24 * 7; // 7d

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function signAccessToken(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email, role: user.role, fullName: user.fullName })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SEC}s`)
    .sign(ACCESS_SECRET);
}

export async function signRefreshToken(userId: string): Promise<string> {
  return new SignJWT({ type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TTL_SEC}s`)
    .sign(REFRESH_SECRET);
}

export async function verifyAccessToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, ACCESS_SECRET);
    return {
      id: String(payload.sub),
      email: String(payload.email),
      role: payload.role as Role,
      fullName: String(payload.fullName),
    };
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, REFRESH_SECRET);
    return String(payload.sub);
  } catch {
    return null;
  }
}

/** Read the session from the access cookie (server components / route handlers). */
export async function getSession(): Promise<SessionUser | null> {
  const token = cookies().get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}

/** Read session directly off a NextRequest (used in API route handlers). */
export async function getSessionFromRequest(
  req: NextRequest
): Promise<SessionUser | null> {
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}

export function hasRole(user: SessionUser | null, ...roles: Role[]): boolean {
  return !!user && roles.includes(user.role);
}
