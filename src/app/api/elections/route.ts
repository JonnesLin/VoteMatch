import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  geocodeAddress,
  buildDistrictIdentifiers,
} from "@/lib/geocoding";

/**
 * MVP zip-to-district mapping (fast path for known zips).
 * Falls through to Census Geocoder for unknown zips or full addresses.
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

/**
 * GET /api/elections?zip=53703
 * GET /api/elections?address=123+Main+St+Madison+WI+53703
 *
 * GEO-001: Supports address input in addition to zip code
 * GEO-002: Geocoding API maps address/zip to legislative district
 */
export async function GET(request: NextRequest) {
  const zip = request.nextUrl.searchParams.get("zip");
  const address = request.nextUrl.searchParams.get("address");

  // Address-based lookup via Census Geocoder (GEO-001, GEO-002)
  if (address) {
    const geoResult = await geocodeAddress(address);
    const districtIds = buildDistrictIdentifiers(geoResult);

    if (districtIds.length === 0) {
      return NextResponse.json([]);
    }

    const elections = await prisma.election.findMany({
      where: { district: { in: districtIds } },
      orderBy: { electionDate: "asc" },
    });
    return NextResponse.json(elections);
  }

  if (zip) {
    // Fast path: static mapping for known zips
    const districts = ZIP_TO_DISTRICT[zip];
    if (districts) {
      const elections = await prisma.election.findMany({
        where: { district: { in: districts } },
        orderBy: { electionDate: "asc" },
      });
      return NextResponse.json(elections);
    }

    // Slow path: Census Geocoder for unknown zips
    const geoResult = await geocodeAddress(zip);
    const districtIds = buildDistrictIdentifiers(geoResult);

    if (districtIds.length === 0) {
      return NextResponse.json([]);
    }

    const elections = await prisma.election.findMany({
      where: { district: { in: districtIds } },
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
