import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/auth/verify-email
 * Verify email with token received during registration.
 * Body: { token: string }
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body?.token) {
    return NextResponse.json(
      { error: "verification token is required" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findFirst({
    where: { verificationToken: body.token },
  });

  if (!user) {
    return NextResponse.json(
      { error: "Invalid or expired verification token" },
      { status: 404 }
    );
  }

  if (user.emailVerified) {
    return NextResponse.json({ message: "Email already verified" });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, verificationToken: null },
  });

  return NextResponse.json({ message: "Email verified successfully" });
}
