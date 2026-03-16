import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateRequest } from "@/lib/auth";

/**
 * POST /api/candidates/claim
 * Candidate claims their profile. Requires authentication.
 * Body: { candidate_id, verification_info }
 *
 * In MVP: claim goes to "pending" state (claimed=false, claimedBy=userId).
 * Admin approves via CLI to set claimed=true.
 */
export async function POST(request: Request) {
  let auth;
  try {
    auth = await authenticateRequest(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.candidate_id) {
    return NextResponse.json(
      { error: "candidate_id is required" },
      { status: 400 }
    );
  }

  const { candidate_id, verification_info } = body as {
    candidate_id: string;
    verification_info?: string;
  };

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidate_id },
  });

  if (!candidate) {
    return NextResponse.json(
      { error: "Candidate not found" },
      { status: 404 }
    );
  }

  if (candidate.claimed) {
    return NextResponse.json(
      { error: "This candidate profile has already been claimed" },
      { status: 409 }
    );
  }

  // Check if user already claimed another candidate
  const existingClaim = await prisma.candidate.findFirst({
    where: { claimedBy: auth.userId },
  });

  if (existingClaim) {
    return NextResponse.json(
      { error: "You have already claimed a candidate profile" },
      { status: 409 }
    );
  }

  // Set claimedBy but keep claimed=false until admin approves
  await prisma.candidate.update({
    where: { id: candidate_id },
    data: {
      claimedBy: auth.userId,
      // claimed remains false until admin approval
    },
  });

  return NextResponse.json({
    status: "pending",
    message: "Claim submitted for admin review",
    candidateId: candidate_id,
    verificationInfo: verification_info || null,
  });
}
