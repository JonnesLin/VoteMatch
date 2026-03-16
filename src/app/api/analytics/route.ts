import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/analytics?election_id=...
 *
 * Consulting Analytics Dashboard — aggregated voter data for consultants.
 * Returns:
 * - Issue priority ranking across all voter sessions
 * - Per-candidate match analysis against aggregate voter positions
 * - Voter stance distribution per issue
 * - Competitive landscape summary
 *
 * CA-001: Aggregated data dashboard
 * CA-003: Voter issue priority ranking
 * CA-004: Campaign strategy insights
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const electionId = url.searchParams.get("election_id");

  if (!electionId) {
    return NextResponse.json(
      { error: "election_id is required" },
      { status: 400 }
    );
  }

  const election = await prisma.election.findUnique({
    where: { id: electionId },
    include: {
      candidates: {
        include: {
          positions: { include: { issue: true } },
        },
      },
    },
  });

  if (!election) {
    return NextResponse.json({ error: "Election not found" }, { status: 404 });
  }

  const sessionCount = await prisma.userSession.count({
    where: { electionId },
  });

  // Get all answers (excluding not_interested)
  const answers = await prisma.userAnswer.findMany({
    where: {
      session: { electionId },
      answer: { not: "not_interested" },
    },
    include: {
      question: { include: { issue: true } },
    },
  });

  // 1. Issue priority ranking
  const issueStats = new Map<
    string,
    {
      name: string;
      displayName: string;
      engagement: number;
      scores: number[];
      strongAgree: number;
      agree: number;
      neutral: number;
      disagree: number;
      strongDisagree: number;
    }
  >();

  for (const answer of answers) {
    const issueId = answer.question.issueId;
    if (!issueStats.has(issueId)) {
      issueStats.set(issueId, {
        name: answer.question.issue.name,
        displayName: answer.question.issue.displayNameEn,
        engagement: 0,
        scores: [],
        strongAgree: 0,
        agree: 0,
        neutral: 0,
        disagree: 0,
        strongDisagree: 0,
      });
    }
    const stats = issueStats.get(issueId)!;
    stats.engagement++;
    if (answer.answerScore !== null) stats.scores.push(answer.answerScore);

    switch (answer.answer) {
      case "strongly_agree": stats.strongAgree++; break;
      case "agree": stats.agree++; break;
      case "neutral": stats.neutral++; break;
      case "disagree": stats.disagree++; break;
      case "strongly_disagree": stats.strongDisagree++; break;
    }
  }

  const issuePriorities = Array.from(issueStats.entries())
    .map(([issueId, stats]) => {
      const avg =
        stats.scores.length > 0
          ? stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length
          : 0;

      return {
        issueId,
        issueName: stats.displayName,
        voterEngagement: stats.engagement,
        avgVoterPosition: Math.round(avg * 100) / 100,
        distribution: {
          stronglyAgree: stats.strongAgree,
          agree: stats.agree,
          neutral: stats.neutral,
          disagree: stats.disagree,
          stronglyDisagree: stats.strongDisagree,
        },
        polarization:
          stats.scores.length > 1
            ? Math.round(
                Math.sqrt(
                  stats.scores.reduce((sum, s) => sum + (s - avg) ** 2, 0) /
                    stats.scores.length
                ) * 100
              ) / 100
            : 0,
      };
    })
    .sort((a, b) => b.voterEngagement - a.voterEngagement);

  // 2. Candidate match analysis
  const candidateAnalysis = election.candidates.map((candidate) => {
    const positionMap = new Map(
      candidate.positions
        .filter((p) => p.positionScore !== null)
        .map((p) => [p.issueId, p.positionScore!])
    );

    let totalSim = 0;
    let totalWeight = 0;

    for (const answer of answers) {
      if (answer.answerScore === null) continue;
      const cScore = positionMap.get(answer.question.issueId);
      if (cScore === undefined) continue;

      const sim = 1 - Math.abs(answer.answerScore - cScore) / 4;
      const weight = Math.abs(answer.answerScore) || 0.5;
      totalSim += sim * weight;
      totalWeight += weight;
    }

    const avgMatch = totalWeight > 0 ? (totalSim / totalWeight) * 100 : 0;

    // Per-issue alignment
    const issueAlignment = issuePriorities.map((ip) => {
      const cScore = positionMap.get(ip.issueId) ?? null;
      const gap = cScore !== null ? cScore - ip.avgVoterPosition : null;
      return {
        issueId: ip.issueId,
        issueName: ip.issueName,
        candidatePosition: cScore,
        avgVoterPosition: ip.avgVoterPosition,
        gap: gap !== null ? Math.round(gap * 100) / 100 : null,
        recommendation:
          gap !== null
            ? Math.abs(gap) < 0.5
              ? "aligned"
              : gap > 0
                ? "candidate_more_progressive"
                : "candidate_more_conservative"
            : "no_data",
      };
    });

    return {
      candidateId: candidate.id,
      candidateName: candidate.name,
      party: candidate.party,
      avgMatchWithVoters: Math.round(avgMatch * 10) / 10,
      positionCoverage: `${positionMap.size}/${issuePriorities.length}`,
      issueAlignment,
    };
  });

  candidateAnalysis.sort(
    (a, b) => b.avgMatchWithVoters - a.avgMatchWithVoters
  );

  // 3. Competitive landscape
  const landscape = {
    leadingCandidate: candidateAnalysis[0]?.candidateName ?? null,
    matchSpread:
      candidateAnalysis.length >= 2
        ? Math.round(
            (candidateAnalysis[0].avgMatchWithVoters -
              candidateAnalysis[candidateAnalysis.length - 1]
                .avgMatchWithVoters) *
              10
          ) / 10
        : 0,
    mostPolarizingIssue: issuePriorities.sort(
      (a, b) => b.polarization - a.polarization
    )[0]?.issueName ?? null,
    highestEngagement: issuePriorities.sort(
      (a, b) => b.voterEngagement - a.voterEngagement
    )[0]?.issueName ?? null,
  };

  return NextResponse.json({
    electionId,
    electionName: election.name,
    totalVoterSessions: sessionCount,
    totalAnswers: answers.length,
    issuePriorities,
    candidateAnalysis,
    competitiveLandscape: landscape,
  });
}
