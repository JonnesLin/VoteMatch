import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * MVP zip-to-district mapping.
 * In production, this would call a geocoding service or district-lookup API.
 */
const ZIP_TO_DISTRICT: Record<string, string[]> = {
  // Madison-area zips → WI Assembly District 42
  "53703": ["WI-Assembly-42"],
  "53704": ["WI-Assembly-42"],
  "53705": ["WI-Assembly-42"],
  "53706": ["WI-Assembly-42"],
  "53711": ["WI-Assembly-42"],
  "53713": ["WI-Assembly-42"],
  "53714": ["WI-Assembly-42"],
  "53715": ["WI-Assembly-42"],
  "53716": ["WI-Assembly-42"],
  "53717": ["WI-Assembly-42"],
  "53718": ["WI-Assembly-42"],
  "53719": ["WI-Assembly-42"],
};

export async function GET(request: NextRequest) {
  const zip = request.nextUrl.searchParams.get("zip");

  if (zip) {
    const districts = ZIP_TO_DISTRICT[zip];
    if (!districts) {
      return NextResponse.json([]);
    }

    const elections = await prisma.election.findMany({
      where: { district: { in: districts } },
      orderBy: { electionDate: "asc" },
    });
    return NextResponse.json(elections);
  }

  // No zip filter → return all elections
  const elections = await prisma.election.findMany({
    orderBy: { electionDate: "asc" },
  });
  return NextResponse.json(elections);
}
