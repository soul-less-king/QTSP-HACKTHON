import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/auth";
import { ok, unauthorized } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return unauthorized();

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: {
      id: true,
      email: true,
      role: true,
      fullName: true,
      phone: true,
      createdAt: true,
      lastLogin: true,
    },
  });
  if (!user) return unauthorized();

  return ok({
    id: user.id,
    email: user.email,
    role: user.role,
    full_name: user.fullName,
    phone: user.phone,
    created_at: user.createdAt,
    last_login: user.lastLogin,
  });
}
