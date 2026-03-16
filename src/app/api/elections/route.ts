import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { zipToState } from "@/lib/zip-to-state";

/**
 * GET /api/elections
 * GET /api/elections?zip=53703
 * GET /api/elections?address=123+Main+St+Madison+WI+53703
 *
 * With zip or address: resolves state from ZIP, returns elections from DB for that state.
 * Without params: returns all elections in database.
 *
 * DB must be pre-populated via `npm run scrape`.
 */
export async function GET(request: NextRequest) {
  const zip = request.nextUrl.searchParams.get("zip");
  const address = request.nextUrl.searchParams.get("address");

  const lookupZip = zip ?? address;

  if (lookupZip) {
    // Extract ZIP from address if it contains one, otherwise use raw value
    const zipMatch = lookupZip.match(/\d{5}/);
    const fiveDigitZip = zipMatch ? zipMatch[0] : lookupZip;

    const state = zipToState(fiveDigitZip);
    if (!state) {
      return NextResponse.json(
        { error: "unrecognized_zip" },
        { status: 422 }
      );
    }

    const elections = await prisma.election.findMany({
      where: { state },
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
