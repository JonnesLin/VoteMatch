/**
 * @deprecated Replaced by Google Civic Information API (src/lib/civic-api.ts).
 * The Census Geocoder cannot resolve bare zip codes to districts.
 * Kept for backward compatibility with existing tests — do not use in new code.
 *
 * Geocoding — GEO-001, GEO-002
 *
 * Maps address/zip to legislative districts using the US Census Geocoder API.
 * Free, no API key required.
 * https://geocoding.geo.census.gov/geocoder/
 */

const CENSUS_GEOCODER_BASE =
  "https://geocoding.geo.census.gov/geocoder/geographies";

interface GeocodingResult {
  matchedAddress: string;
  coordinates: { lat: number; lng: number };
  districts: {
    stateFips: string;
    stateAbbrev: string;
    congressionalDistrict: string | null;
    stateUpperDistrict: string | null;
    stateLowerDistrict: string | null;
  };
}

/**
 * Geocode a full street address to legislative districts.
 */
export async function geocodeAddress(
  address: string
): Promise<GeocodingResult> {
  const params = new URLSearchParams({
    address,
    benchmark: "Public_AR_Current",
    vintage: "Current_Current",
    layers: "all",
    format: "json",
  });

  const response = await fetch(
    `${CENSUS_GEOCODER_BASE}/onelineaddress?${params}`,
    { signal: AbortSignal.timeout(15_000) }
  );

  if (!response.ok) {
    throw new Error(`Census geocoder HTTP ${response.status}`);
  }

  const data = await response.json();
  const matches = data.result?.addressMatches;

  if (!matches || matches.length === 0) {
    throw new Error("Address not found — check the address and try again");
  }

  const match = matches[0];
  const geographies = match.geographies ?? {};

  // Keys include year/session prefixes that change (e.g., "119th Congressional Districts",
  // "2024 State Legislative Districts - Upper"), so match by substring.
  function findGeo(pattern: string): Record<string, string> | null {
    for (const [key, val] of Object.entries(geographies)) {
      if (key.includes(pattern) && Array.isArray(val) && val.length > 0) {
        return val[0] as Record<string, string>;
      }
    }
    return null;
  }

  const congressional = findGeo("Congressional Districts");
  const stateUpper = findGeo("Legislative Districts - Upper");
  const stateLower = findGeo("Legislative Districts - Lower");
  const state = findGeo("States");

  return {
    matchedAddress: match.matchedAddress,
    coordinates: {
      lat: parseFloat(match.coordinates.y),
      lng: parseFloat(match.coordinates.x),
    },
    districts: {
      stateFips: state?.STATEFP ?? match.addressComponents?.state ?? "",
      stateAbbrev: state?.STUSAB ?? "",
      congressionalDistrict: congressional?.BASENAME ?? null,
      stateUpperDistrict: stateUpper?.BASENAME ?? null,
      stateLowerDistrict: stateLower?.BASENAME ?? null,
    },
  };
}

/**
 * Build district identifiers from geocoding result for election matching.
 * Returns an array of district strings that can be matched against election.district.
 */
export function buildDistrictIdentifiers(result: GeocodingResult): string[] {
  const ids: string[] = [];
  const { districts } = result;

  if (districts.stateAbbrev) {
    if (districts.congressionalDistrict) {
      ids.push(`${districts.stateAbbrev}-CD-${districts.congressionalDistrict}`);
    }
    if (districts.stateUpperDistrict) {
      ids.push(
        `${districts.stateAbbrev}-Senate-${districts.stateUpperDistrict}`
      );
    }
    if (districts.stateLowerDistrict) {
      ids.push(
        `${districts.stateAbbrev}-Assembly-${districts.stateLowerDistrict}`
      );
    }
  }

  return ids;
}
