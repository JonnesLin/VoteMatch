import { NextResponse } from "next/server";
import { authenticateRequest, getAuthenticatedCandidate } from "@/lib/auth";

/**
 * GET /api/candidates/me/positions
 * Returns the authenticated candidate's position data.
 *
 * PUT /api/candidates/me/positions
 * Update/add a position (marked as candidate_self_report).
 * Body: { issue_id, position_summary, position_score, notes? }
 */
export async function GET(request: Request) {
  let auth;
  try {
    auth = await authenticateRequest(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const candidate = await getAuthenticatedCandidate(auth.userId);
  if (!candidate) {
    return NextResponse.json(
      { error: "No claimed candidate profile found. Claim a profile first." },
      { status: 404 }
    );
  }

  const positions = candidate.positions.map((p) => ({
    id: p.id,
    issueId: p.issueId,
    issueName: p.issue.name,
    issueDisplayName: p.issue.displayNameEn,
    positionSummary: p.positionSummary,
    positionScore: p.positionScore,
    confidence: p.confidence,
    source: p.source,
    notes: p.notes,
    updatedAt: p.updatedAt,
  }));

  return NextResponse.json({
    candidateId: candidate.id,
    candidateName: candidate.name,
    positions,
  });
}

export async function PUT(request: Request) {
  let auth;
  try {
    auth = await authenticateRequest(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const candidate = await getAuthenticatedCandidate(auth.userId);
  if (!candidate) {
    return NextResponse.json(
      { error: "No claimed candidate profile found. Claim a profile first." },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body?.issue_id || !body?.position_summary || body?.position_score === undefined) {
    return NextResponse.json(
      { error: "issue_id, position_summary, and position_score are required" },
      { status: 400 }
    );
  }

  const { issue_id, position_summary, position_score, notes } = body as {
    issue_id: string;
    position_summary: string;
    position_score: number;
    notes?: string;
  };

  // Validate score range
  if (position_score < -2 || position_score > 2) {
    return NextResponse.json(
      { error: "position_score must be between -2.0 and +2.0" },
      { status: 400 }
    );
  }

  // Upsert position
  const { prisma } = await import("@/lib/db");
  const position = await prisma.candidatePosition.upsert({
    where: {
      candidateId_issueId: {
        candidateId: candidate.id,
        issueId: issue_id,
      },
    },
    update: {
      positionSummary: position_summary,
      positionScore: position_score,
      source: "candidate_self_report",
      confidence: "high",
      notes: notes ?? null,
    },
    create: {
      candidateId: candidate.id,
      issueId: issue_id,
      positionSummary: position_summary,
      positionScore: position_score,
      source: "candidate_self_report",
      confidence: "high",
      notes: notes ?? null,
    },
    include: { issue: true },
  });

  return NextResponse.json({
    id: position.id,
    issueId: position.issueId,
    issueName: position.issue.name,
    positionSummary: position.positionSummary,
    positionScore: position.positionScore,
    source: position.source,
    notes: position.notes,
  });
}
