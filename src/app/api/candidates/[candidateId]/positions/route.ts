import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ candidateId: string }> }
) {
  const { candidateId } = await params;

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
  });

  if (!candidate) {
    return NextResponse.json(
      { error: "Candidate not found" },
      { status: 404 }
    );
  }

  const positions = await prisma.candidatePosition.findMany({
    where: { candidateId },
    include: {
      issue: {
        select: {
          id: true,
          name: true,
          displayNameEn: true,
          displayNameZh: true,
        },
      },
    },
    orderBy: { issue: { name: "asc" } },
  });

  const result = positions.map((p) => ({
    id: p.id,
    issueId: p.issue.id,
    issueName: p.issue.displayNameEn,
    issueNameZh: p.issue.displayNameZh,
    positionSummary: p.positionSummary,
    positionScore: p.positionScore,
    confidence: p.confidence,
    source: p.source,
    supportingEvidence: p.supportingEvidence,
    notes: p.notes,
  }));

  return NextResponse.json(result);
}
