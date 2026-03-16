import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCachedQuestions, cacheQuestions } from "@/lib/cache";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ electionId: string }> }
) {
  const { electionId } = await params;

  // CACHE-001: Check Redis cache first
  const cached = await getCachedQuestions(electionId);
  if (cached) {
    return NextResponse.json(cached);
  }

  const election = await prisma.election.findUnique({
    where: { id: electionId },
  });

  if (!election) {
    return NextResponse.json(
      { error: "Election not found" },
      { status: 404 }
    );
  }

  const questionSet = await prisma.questionSet.findFirst({
    where: { electionId },
    orderBy: { generatedAt: "desc" },
    include: {
      questions: {
        orderBy: { displayOrder: "asc" },
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
      },
    },
  });

  if (!questionSet) {
    return NextResponse.json([]);
  }

  const questions = questionSet.questions.map((q) => ({
    id: q.id,
    issueId: q.issueId,
    issueName: q.issue.displayNameEn,
    issueNameZh: q.issue.displayNameZh,
    questionText: q.questionText,
    questionTextZh: q.questionTextZh,
    positiveDirection: q.positiveDirection,
    background: q.background,
    backgroundZh: q.backgroundZh,
    displayOrder: q.displayOrder,
  }));

  // CACHE-001: Store in Redis
  await cacheQuestions(electionId, questions);

  return NextResponse.json(questions);
}
