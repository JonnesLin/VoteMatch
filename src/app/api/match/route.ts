import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ANSWER_SCORES, type AnswerOption } from "@/types/answers";
import { calculateMatch } from "@/lib/match-engine";

const VALID_ANSWERS = new Set(Object.keys(ANSWER_SCORES));

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || !body.election_id || !Array.isArray(body.answers) || body.answers.length === 0) {
    return NextResponse.json(
      { error: "Request must include election_id and non-empty answers array" },
      { status: 400 }
    );
  }

  const { election_id, answers } = body as {
    election_id: string;
    answers: { question_id: string; answer: string }[];
  };

  // Validate all answer values
  for (const a of answers) {
    if (!a.question_id || !a.answer || !VALID_ANSWERS.has(a.answer)) {
      return NextResponse.json(
        { error: `Invalid answer: each entry must have question_id and answer (one of ${[...VALID_ANSWERS].join(", ")})` },
        { status: 400 }
      );
    }
  }

  // Verify election exists
  const election = await prisma.election.findUnique({
    where: { id: election_id },
  });

  if (!election) {
    return NextResponse.json(
      { error: "Election not found" },
      { status: 404 }
    );
  }

  // Fetch questions to map question_id → issueId
  const questionIds = answers.map((a) => a.question_id);
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: { id: true, issueId: true },
  });

  const questionToIssue = new Map(questions.map((q) => [q.id, q.issueId]));

  // Check all question_ids are valid
  for (const a of answers) {
    if (!questionToIssue.has(a.question_id)) {
      return NextResponse.json(
        { error: `Question not found: ${a.question_id}` },
        { status: 400 }
      );
    }
  }

  // Build userAnswers map: issueId → numeric score (skip not_interested)
  const userAnswers: Record<string, number> = {};
  for (const a of answers) {
    const score = ANSWER_SCORES[a.answer as AnswerOption];
    if (score === null) continue; // not_interested
    const issueId = questionToIssue.get(a.question_id)!;
    userAnswers[issueId] = score;
  }

  // Fetch all candidates + positions for this election
  const candidates = await prisma.candidate.findMany({
    where: { electionId: election_id },
    select: {
      id: true,
      name: true,
      party: true,
      positions: {
        select: {
          issueId: true,
          positionScore: true,
        },
      },
    },
  });

  // Calculate match per candidate
  const results = candidates
    .map((candidate) => {
      const candidatePositions: Record<string, number> = {};
      for (const p of candidate.positions) {
        if (p.positionScore !== null) {
          candidatePositions[p.issueId] = p.positionScore;
        }
      }

      const { matchPercentage, issueBreakdown } = calculateMatch({
        userAnswers,
        candidatePositions,
      });

      return {
        candidateId: candidate.id,
        name: candidate.name,
        party: candidate.party,
        matchPercentage,
        issueBreakdown,
      };
    })
    .sort((a, b) => b.matchPercentage - a.matchPercentage);

  // Persist anonymous session + answers
  const session = await prisma.userSession.create({
    data: {
      electionId: election_id,
      answers: {
        create: answers.map((a) => ({
          questionId: a.question_id,
          answer: a.answer,
          answerScore: ANSWER_SCORES[a.answer as AnswerOption] ?? null,
        })),
      },
    },
  });

  return NextResponse.json({
    sessionId: session.id,
    candidates: results,
  });
}
