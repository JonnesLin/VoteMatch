import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ANSWER_SCORES, type AnswerOption } from "@/types/answers";
import { calculateMatch } from "@/lib/match-engine";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const session = await prisma.userSession.findUnique({
    where: { id: sessionId },
    include: {
      answers: {
        include: {
          question: {
            include: {
              issue: {
                select: {
                  id: true,
                  displayNameEn: true,
                  displayNameZh: true,
                },
              },
            },
          },
        },
      },
      election: { select: { id: true, name: true } },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Build userAnswers map: issueId → numeric score
  const userAnswers: Record<string, number> = {};
  const userAnswerLabels: Record<string, string> = {};
  const issueNames: Record<string, { en: string; zh: string }> = {};

  for (const a of session.answers) {
    const score = ANSWER_SCORES[a.answer as AnswerOption];
    issueNames[a.question.issue.id] = {
      en: a.question.issue.displayNameEn,
      zh: a.question.issue.displayNameZh,
    };
    userAnswerLabels[a.question.issue.id] = a.answer;
    if (score === null) continue; // not_interested
    userAnswers[a.question.issue.id] = score;
  }

  // Fetch candidates + positions
  const candidates = await prisma.candidate.findMany({
    where: { electionId: session.electionId },
    select: {
      id: true,
      name: true,
      party: true,
      positions: {
        include: {
          issue: {
            select: {
              id: true,
              displayNameEn: true,
            },
          },
        },
      },
    },
  });

  const results = candidates
    .map((candidate) => {
      const candidatePositions: Record<string, number> = {};
      const positionDetails: Record<
        string,
        {
          summary: string | null;
          score: number | null;
          confidence: string | null;
          source: string | null;
          aiOriginalSummary: string | null;
          aiOriginalScore: number | null;
          aiOriginalConfidence: string | null;
        }
      > = {};

      for (const p of candidate.positions) {
        if (p.positionScore !== null) {
          candidatePositions[p.issueId] = p.positionScore;
        }
        positionDetails[p.issueId] = {
          summary: p.positionSummary,
          score: p.positionScore,
          confidence: p.confidence,
          source: p.source,
          aiOriginalSummary: p.aiOriginalSummary,
          aiOriginalScore: p.aiOriginalScore,
          aiOriginalConfidence: p.aiOriginalConfidence,
        };
      }

      const { matchPercentage, issueBreakdown } = calculateMatch({
        userAnswers,
        candidatePositions,
      });

      // Enrich breakdown with issue names and position details
      const enrichedBreakdown = issueBreakdown.map((item) => ({
        ...item,
        issueName: issueNames[item.issueId]?.en ?? item.issueId,
        issueNameZh: issueNames[item.issueId]?.zh ?? "",
        userAnswer: userAnswerLabels[item.issueId] ?? "not_interested",
        candidatePosition: positionDetails[item.issueId] ?? null,
      }));

      // Add issues where candidate has no position but user answered
      const answeredIssueIds = Object.keys(userAnswers);
      for (const issueId of answeredIssueIds) {
        if (!candidatePositions[issueId] && candidatePositions[issueId] !== 0) {
          enrichedBreakdown.push({
            issueId,
            userScore: userAnswers[issueId],
            candidateScore: 0,
            similarity: 0,
            weight: 0,
            issueName: issueNames[issueId]?.en ?? issueId,
            issueNameZh: issueNames[issueId]?.zh ?? "",
            userAnswer: userAnswerLabels[issueId] ?? "not_interested",
            candidatePosition: positionDetails[issueId] ?? null,
          });
        }
      }

      return {
        candidateId: candidate.id,
        name: candidate.name,
        party: candidate.party,
        matchPercentage,
        issueBreakdown: enrichedBreakdown,
      };
    })
    .sort((a, b) => b.matchPercentage - a.matchPercentage);

  return NextResponse.json({
    sessionId: session.id,
    electionId: session.electionId,
    electionName: session.election.name,
    createdAt: session.createdAt,
    candidates: results,
  });
}
