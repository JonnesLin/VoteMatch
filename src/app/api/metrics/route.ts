import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/metrics?election_id=...
 * Returns monitoring metrics for an election.
 * Internal/admin use for tracking PRD §9 success metrics.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const electionId = url.searchParams.get("election_id");

  if (!electionId) {
    return NextResponse.json(
      { error: "election_id query parameter is required" },
      { status: 400 }
    );
  }

  const election = await prisma.election.findUnique({
    where: { id: electionId },
    include: {
      candidates: {
        include: {
          _count: { select: { positions: true } },
        },
      },
    },
  });

  if (!election) {
    return NextResponse.json({ error: "Election not found" }, { status: 404 });
  }

  // MON-001: Quiz completion rate
  const totalSessions = await prisma.userSession.count({
    where: { electionId },
  });

  const completedSessions = await prisma.userSession.count({
    where: {
      electionId,
      answers: { some: {} },
    },
  });

  const completionRate =
    totalSessions > 0
      ? Math.round((completedSessions / totalSessions) * 1000) / 10
      : 0;

  // MON-004: Candidate data coverage
  const totalCandidates = election.candidates.length;
  const candidatesWithPositions = election.candidates.filter(
    (c) => c._count.positions > 0
  ).length;

  const dataCoverage =
    totalCandidates > 0
      ? Math.round((candidatesWithPositions / totalCandidates) * 1000) / 10
      : 0;

  // MON-006: Voter coverage (unique sessions / estimated eligible voters)
  // Note: actual eligible voters requires external data; using session count for now
  const uniqueSessions = totalSessions;

  // Per-candidate position completeness
  const candidateDetails = await Promise.all(
    election.candidates.map(async (c) => {
      const issueCats = await prisma.issueCategory.count({
        where: { level: election.type },
      });
      return {
        candidateId: c.id,
        candidateName: c.name,
        positionCount: c._count.positions,
        totalIssues: issueCats,
        coveragePercent:
          issueCats > 0
            ? Math.round((c._count.positions / issueCats) * 1000) / 10
            : 0,
      };
    })
  );

  // MON-005 reference: feedback stats
  const feedbackStats = await prisma.userFeedback.aggregate({
    where: { electionId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  return NextResponse.json({
    electionId,
    electionName: election.name,
    metrics: {
      quizCompletionRate: {
        value: completionRate,
        target: 70,
        totalSessions,
        completedSessions,
        unit: "%",
      },
      candidateDataCoverage: {
        value: dataCoverage,
        target: 100,
        candidatesWithPositions,
        totalCandidates,
        unit: "%",
      },
      voterSessions: {
        value: uniqueSessions,
        description: "Total unique voter sessions",
      },
      userSatisfaction: {
        value: feedbackStats._avg.rating
          ? Math.round(feedbackStats._avg.rating * 10) / 10
          : null,
        target: 4,
        responses: feedbackStats._count.rating,
        unit: "/5",
      },
    },
    candidateDetails,
  });
}
