import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * POST /api/feedback
 * Submit anonymous satisfaction feedback after completing a quiz.
 * Body: { rating: 1-5, session_id?: string, election_id?: string, comment?: string }
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!body?.rating || typeof body.rating !== "number") {
    return NextResponse.json(
      { error: "rating (1-5) is required" },
      { status: 400 }
    );
  }

  const { rating, session_id, election_id, comment } = body as {
    rating: number;
    session_id?: string;
    election_id?: string;
    comment?: string;
  };

  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    return NextResponse.json(
      { error: "rating must be an integer between 1 and 5" },
      { status: 400 }
    );
  }

  const feedback = await prisma.userFeedback.create({
    data: {
      rating,
      sessionId: session_id ?? null,
      electionId: election_id ?? null,
      comment: comment ?? null,
    },
  });

  return NextResponse.json(
    { id: feedback.id, status: "received" },
    { status: 201 }
  );
}

/**
 * GET /api/feedback?election_id=...
 * Returns aggregated satisfaction data (admin/internal use).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const electionId = url.searchParams.get("election_id");

  const where = electionId ? { electionId } : {};

  const [feedbacks, count] = await Promise.all([
    prisma.userFeedback.findMany({
      where,
      select: { rating: true },
    }),
    prisma.userFeedback.count({ where }),
  ]);

  if (count === 0) {
    return NextResponse.json({
      totalResponses: 0,
      averageRating: null,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
  }

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>;
  let totalRating = 0;
  for (const f of feedbacks) {
    distribution[f.rating]++;
    totalRating += f.rating;
  }

  return NextResponse.json({
    totalResponses: count,
    averageRating: Math.round((totalRating / count) * 10) / 10,
    distribution,
  });
}
