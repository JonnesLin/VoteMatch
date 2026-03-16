import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ANSWER_SCORES, type AnswerOption } from "@/types/answers";
import { calculateMatch } from "@/lib/match-engine";
import { ResultsClient, type SessionResult } from "./results-client";

type Props = {
  params: Promise<{ sessionId: string }>;
};

async function getSessionData(
  sessionId: string
): Promise<SessionResult | null> {
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

  if (!session) return null;

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
    if (score === null) continue;
    userAnswers[a.question.issue.id] = score;
  }

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
        };
      }

      const { matchPercentage, issueBreakdown } = calculateMatch({
        userAnswers,
        candidatePositions,
      });

      const enrichedBreakdown = issueBreakdown.map((item) => ({
        ...item,
        issueName: issueNames[item.issueId]?.en ?? item.issueId,
        issueNameZh: issueNames[item.issueId]?.zh ?? "",
        userAnswer: userAnswerLabels[item.issueId] ?? "not_interested",
        candidatePosition: positionDetails[item.issueId] ?? null,
      }));

      const answeredIssueIds = Object.keys(userAnswers);
      for (const issueId of answeredIssueIds) {
        if (
          !candidatePositions[issueId] &&
          candidatePositions[issueId] !== 0
        ) {
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

  return {
    sessionId: session.id,
    electionId: session.electionId,
    electionName: session.election.name,
    candidates: results,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sessionId } = await params;
  const data = await getSessionData(sessionId);

  if (!data) {
    return { title: "Results Not Found — VoteMatch" };
  }

  const topMatch = data.candidates[0];
  const description = topMatch
    ? `Top match: ${topMatch.name} (${topMatch.matchPercentage}%) — ${data.electionName}`
    : data.electionName;

  return {
    title: `Your Results — ${data.electionName} — VoteMatch`,
    description,
  };
}

export default async function ResultsPage({ params }: Props) {
  const { sessionId } = await params;
  const data = await getSessionData(sessionId);

  if (!data) {
    notFound();
  }

  return <ResultsClient data={data} />;
}
