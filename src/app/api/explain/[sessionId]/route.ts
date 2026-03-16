import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ANSWER_SCORES, type AnswerOption } from "@/types/answers";
import { calculateMatch } from "@/lib/match-engine";
import { generateExplanations } from "@/lib/explainer";

/**
 * GET /api/explain/[sessionId]
 *
 * Generates LLM-powered natural language match explanations for a session.
 * RE-001: LLM generates natural language match explanation per candidate
 * RE-002: Neutral, non-directive language
 * RE-003: Cacheable — returns same result for same session
 */
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
                select: { id: true, displayNameEn: true },
              },
            },
          },
        },
      },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Build user answers
  const userAnswers: Record<string, number> = {};
  const issueNames: Record<string, string> = {};

  for (const a of session.answers) {
    const score = ANSWER_SCORES[a.answer as AnswerOption];
    issueNames[a.question.issue.id] = a.question.issue.displayNameEn;
    if (score === null) continue;
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
          issue: { select: { id: true, displayNameEn: true } },
        },
      },
    },
  });

  const candidatesWithMatch = candidates.map((candidate) => {
    const candidatePositions: Record<string, number> = {};
    const positionDetails: Record<string, { summary: string | null }> = {};

    for (const p of candidate.positions) {
      if (p.positionScore !== null) {
        candidatePositions[p.issueId] = p.positionScore;
      }
      positionDetails[p.issueId] = { summary: p.positionSummary };
    }

    const { matchPercentage, issueBreakdown } = calculateMatch({
      userAnswers,
      candidatePositions,
    });

    const enrichedBreakdown = issueBreakdown.map((item) => ({
      ...item,
      issueName: issueNames[item.issueId] ?? item.issueId,
      candidatePosition: positionDetails[item.issueId] ?? null,
    }));

    return {
      candidateId: candidate.id,
      name: candidate.name,
      party: candidate.party,
      matchPercentage,
      issueBreakdown: enrichedBreakdown,
    };
  });

  const explanations = await generateExplanations(candidatesWithMatch);

  return NextResponse.json({
    sessionId,
    explanations,
  });
}
