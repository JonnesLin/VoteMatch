import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, createToken } from "@/lib/auth";

/**
 * POST /api/auth/login
 * Authenticate a candidate user and return JWT.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body?.email || !body?.password) {
    return NextResponse.json(
      { error: "email and password are required" },
      { status: 400 }
    );
  }

  const { email, password } = body as { email: string; password: string };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }

  const token = await createToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return NextResponse.json({
    token,
    user: { id: user.id, email: user.email, role: user.role },
  });
}
