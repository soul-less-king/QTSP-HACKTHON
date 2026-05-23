import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  verifyRefreshToken,
  signAccessToken,
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  ACCESS_TTL_SEC,
} from "@/lib/auth";
import { ok, apiError } from "@/lib/api";
import type { Role } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!token) return apiError(401, "Missing refresh token");

  const userId = await verifyRefreshToken(token);
  if (!userId) return apiError(401, "Invalid refresh token");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) return apiError(401, "Invalid refresh token");

  const accessToken = await signAccessToken({
    id: user.id,
    email: user.email,
    role: user.role as Role,
    fullName: user.fullName,
  });

  const res = ok({ access_token: accessToken, expires_in: ACCESS_TTL_SEC });
  res.cookies.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_TTL_SEC,
  });
  return res;
}
