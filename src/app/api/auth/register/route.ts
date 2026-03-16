import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, createToken } from "@/lib/auth";

/**
 * POST /api/auth/register
 * Register a new candidate user account.
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

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  // Check for existing user
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists" },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const verificationToken = crypto.randomUUID();
  const user = await prisma.user.create({
    data: { email, passwordHash, role: "candidate", verificationToken },
  });

  const token = await createToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return NextResponse.json(
    {
      token,
      user: { id: user.id, email: user.email, role: user.role, emailVerified: false },
      verificationToken: verificationToken,
    },
    { status: 201 }
  );
}
