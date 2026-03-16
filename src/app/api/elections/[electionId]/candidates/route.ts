import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ electionId: string }> }
) {
  const { electionId } = await params;

  const election = await prisma.election.findUnique({
    where: { id: electionId },
  });

  if (!election) {
    return NextResponse.json(
      { error: "Election not found" },
      { status: 404 }
    );
  }

  const candidates = await prisma.candidate.findMany({
    where: { electionId },
    select: {
      id: true,
      name: true,
      party: true,
      incumbent: true,
      officialWebsite: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(candidates);
}
