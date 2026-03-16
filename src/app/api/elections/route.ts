import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  lookupElections,
  scopeToElectionType,
} from "@/lib/civic-api";

/**
 * GET /api/elections
 * GET /api/elections?zip=53703
 * GET /api/elections?address=123+Main+St+Madison+WI+53703
 *
 * With zip or address: queries Google Civic Information API, upserts
 * elections + candidates into DB, returns the upserted rows.
 * Without params: returns all elections in database.
 */
export async function GET(request: NextRequest) {
  const zip = request.nextUrl.searchParams.get("zip");
  const address = request.nextUrl.searchParams.get("address");

  const lookupAddress = address ?? zip;

  if (lookupAddress) {
    let civicResult;
    try {
      civicResult = await lookupElections(lookupAddress);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Election lookup failed";
      return NextResponse.json({ error: message }, { status: 422 });
    }

    const resolvedState = civicResult.normalizedInput.state || null;

    // Off-season: no contests from Civic API → return existing DB data
    if (civicResult.contests.length === 0) {
      const where = resolvedState ? { state: resolvedState } : {};
      const elections = await prisma.election.findMany({
        where,
        orderBy: { electionDate: "asc" },
      });
      return NextResponse.json(elections);
    }

    // Upsert each contest as an Election + its Candidates
    const electionIds: string[] = [];

    for (const contest of civicResult.contests) {
      const electionName = `${civicResult.election.name} — ${contest.office}`;
      const district = contest.district.name;
      const type = scopeToElectionType(contest.district.scope);
      const electionDate = new Date(civicResult.election.electionDay);

      const election = await prisma.election.upsert({
        where: {
          district_electionDate: {
            district,
            electionDate,
          },
        },
        update: {
          name: electionName,
          type,
          state: resolvedState,
        },
        create: {
          name: electionName,
          type,
          district,
          state: resolvedState,
          electionDate,
        },
      });

      electionIds.push(election.id);

      // Upsert candidates for this contest
      if (contest.candidates) {
        for (const candidate of contest.candidates) {
          await prisma.candidate.upsert({
            where: {
              electionId_name: {
                electionId: election.id,
                name: candidate.name,
              },
            },
            update: {
              party: candidate.party || null,
              officialWebsite: candidate.candidateUrl || null,
            },
            create: {
              electionId: election.id,
              name: candidate.name,
              party: candidate.party || null,
              officialWebsite: candidate.candidateUrl || null,
            },
          });
        }
      }
    }

    // Return the upserted elections
    const elections = await prisma.election.findMany({
      where: { id: { in: electionIds } },
      orderBy: { electionDate: "asc" },
    });
    return NextResponse.json(elections);
  }

  // No filter → return all elections
  const elections = await prisma.election.findMany({
    orderBy: { electionDate: "asc" },
  });
  return NextResponse.json(elections);
}
