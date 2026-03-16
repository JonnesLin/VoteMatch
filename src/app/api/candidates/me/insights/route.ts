import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authenticateRequest, getAuthenticatedCandidate } from "@/lib/auth";

const MIN_SESSIONS = 50;

/**
 * GET /api/candidates/me/insights
 * Returns anonymized, aggregated voter insights for the candidate's election district.
 * Requires minimum 50 sessions for privacy (TECH_SPEC §8).
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
      { error: "No claimed candidate profile found" },
      { status: 404 }
    );
  }

  // Check minimum session count
  const sessionCount = await prisma.userSession.count({
    where: { electionId: candidate.electionId },
  });

  if (sessionCount < MIN_SESSIONS) {
    return NextResponse.json(
      {
        error: "Insufficient data for insights",
        message: `At least ${MIN_SESSIONS} voter sessions are required. Current: ${sessionCount}`,
        sessionCount,
        required: MIN_SESSIONS,
      },
      { status: 403 }
    );
  }

  // Get all answers for this election
  const answers = await prisma.userAnswer.findMany({
    where: {
      session: { electionId: candidate.electionId },
      answer: { not: "not_interested" },
    },
    include: {
      question: { include: { issue: true } },
    },
  });

  // 1. Issue priority ranking: which issues voters care most about
  const issueEngagement = new Map<
    string,
    { issueName: string; displayNameEn: string; answered: number; strongStances: number; avgScore: number; totalScore: number }
  >();

  for (const answer of answers) {
    const issueId = answer.question.issueId;
    if (!issueEngagement.has(issueId)) {
      issueEngagement.set(issueId, {
        issueName: answer.question.issue.name,
        displayNameEn: answer.question.issue.displayNameEn,
        answered: 0,
        strongStances: 0,
        avgScore: 0,
        totalScore: 0,
      });
    }
    const entry = issueEngagement.get(issueId)!;
    entry.answered++;
    if (answer.answerScore !== null) {
      entry.totalScore += answer.answerScore;
      if (Math.abs(answer.answerScore) >= 1.5) {
        entry.strongStances++;
      }
    }
  }

  const issuePriorities = Array.from(issueEngagement.entries())
    .map(([issueId, data]) => ({
      issueId,
      issueName: data.displayNameEn,
      voterEngagement: data.answered,
      strongStanceRate: data.answered > 0 ? data.strongStances / data.answered : 0,
      avgVoterPosition: data.answered > 0 ? data.totalScore / data.answered : 0,
    }))
    .sort((a, b) => b.voterEngagement - a.voterEngagement);

  // 2. Candidate match analysis: average match against district voters
  const allCandidates = await prisma.candidate.findMany({
    where: { electionId: candidate.electionId },
    include: { positions: true },
  });

  const candidateMatchAnalysis = allCandidates.map((c) => {
    const positionMap = new Map(
      c.positions
        .filter((p) => p.positionScore !== null)
        .map((p) => [p.issueId, p.positionScore!])
    );

    let totalSimilarity = 0;
    let totalWeight = 0;

    for (const answer of answers) {
      if (answer.answerScore === null) continue;
      const candidateScore = positionMap.get(answer.question.issueId);
      if (candidateScore === undefined) continue;

      const difference = Math.abs(answer.answerScore - candidateScore);
      const similarity = 1 - difference / 4;
      const weight = Math.abs(answer.answerScore) || 0.5;

      totalSimilarity += similarity * weight;
      totalWeight += weight;
    }

    const avgMatch = totalWeight > 0 ? (totalSimilarity / totalWeight) * 100 : 0;

    // Per-issue alignment
    const issueAlignment = Array.from(issueEngagement.entries()).map(
      ([issueId, data]) => {
        const candidateScore = positionMap.get(issueId) ?? null;
        return {
          issueId,
          issueName: data.displayNameEn,
          candidatePosition: candidateScore,
          avgVoterPosition: data.answered > 0 ? data.totalScore / data.answered : 0,
          alignment:
            candidateScore !== null && data.answered > 0
              ? 1 - Math.abs(candidateScore - data.totalScore / data.answered) / 4
              : null,
        };
      }
    );

    return {
      candidateId: c.id,
      candidateName: c.name,
      party: c.party,
      avgMatchPercentage: Math.round(avgMatch * 10) / 10,
      issueAlignment,
      isCurrentCandidate: c.id === candidate.id,
    };
  });

  // Sort by match percentage
  candidateMatchAnalysis.sort((a, b) => b.avgMatchPercentage - a.avgMatchPercentage);

  // 3. Competitive gap: issues where competitors outperform
  const currentCandidateAnalysis = candidateMatchAnalysis.find(
    (c) => c.isCurrentCandidate
  );

  const competitiveGaps = currentCandidateAnalysis
    ? currentCandidateAnalysis.issueAlignment
        .filter((ia) => ia.alignment !== null)
        .map((ia) => {
          const bestCompetitor = candidateMatchAnalysis
            .filter((c) => !c.isCurrentCandidate)
            .map((c) => {
              const compIssue = c.issueAlignment.find(
                (ci) => ci.issueId === ia.issueId
              );
              return {
                candidateName: c.candidateName,
                alignment: compIssue?.alignment ?? 0,
              };
            })
            .sort((a, b) => (b.alignment ?? 0) - (a.alignment ?? 0))[0];

          return {
            issueId: ia.issueId,
            issueName: ia.issueName,
            yourAlignment: ia.alignment,
            bestCompetitorName: bestCompetitor?.candidateName,
            bestCompetitorAlignment: bestCompetitor?.alignment,
            gap: bestCompetitor
              ? (bestCompetitor.alignment ?? 0) - (ia.alignment ?? 0)
              : 0,
          };
        })
        .sort((a, b) => b.gap - a.gap)
    : [];

  return NextResponse.json({
    electionName: candidate.election.name,
    totalVoterSessions: sessionCount,
    issuePriorities,
    candidateMatchAnalysis,
    competitiveGaps,
  });
}
