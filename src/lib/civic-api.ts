/**
 * Google Civic Information API client.
 *
 * Queries the voterInfoQuery endpoint to look up elections and candidates
 * for a given address or zip code.
 */

const CIVIC_API_BASE =
  "https://www.googleapis.com/civicinfo/v2/voterInfoQuery";

export interface CivicCandidate {
  name: string;
  party: string;
  candidateUrl?: string;
}

export interface CivicContest {
  office: string;
  level?: string[];
  district: {
    name: string;
    scope?: string;
  };
  candidates?: CivicCandidate[];
}

export interface CivicElectionResult {
  election: {
    name: string;
    electionDay: string;
  };
  contests: CivicContest[];
  normalizedInput: {
    line1: string;
    city: string;
    state: string;
    zip: string;
  };
}

/**
 * Map Google Civic API district.scope to our Election.type.
 * Must align with IssueCategory.level values: "federal" | "state" | "local".
 */
const SCOPE_TO_TYPE: Record<string, string> = {
  national: "federal",
  congressional: "federal",
  statewide: "state",
  stateUpper: "state",
  stateLower: "state",
  countywide: "local",
  countyCouncil: "local",
  citywide: "local",
  cityCouncil: "local",
  ward: "local",
  township: "local",
  schoolBoard: "local",
  judicial: "local",
  special: "local",
};

export function scopeToElectionType(scope: string | undefined): string {
  if (!scope) return "local";
  return SCOPE_TO_TYPE[scope] ?? "local";
}

/**
 * Query Google Civic Information API for elections at the given address.
 *
 * - Passes returnAllAvailableData=true (critical for bare zip codes).
 * - 15-second timeout via AbortSignal.timeout().
 * - Throws on HTTP errors.
 * - Returns empty contests array (not throw) when no election data.
 */
export async function lookupElections(
  address: string
): Promise<CivicElectionResult> {
  const apiKey = process.env.GOOGLE_CIVIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_CIVIC_API_KEY is not configured. " +
        "Get one at: Google Cloud Console → APIs & Services → Enable Civic Information API → Create API key."
    );
  }

  const params = new URLSearchParams({
    address,
    key: apiKey,
    returnAllAvailableData: "true",
  });

  const response = await fetch(`${CIVIC_API_BASE}?${params}`, {
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    // Civic API returns 400 with election info but no contests during off-season.
    // Treat this as "no contests" rather than an error.
    if (response.status === 400) {
      const body = await response.json().catch(() => null);
      if (body?.error?.errors?.[0]?.reason === "electionNotFound") {
        return {
          election: { name: "", electionDay: "" },
          contests: [],
          normalizedInput: body.normalizedInput ?? {
            line1: "",
            city: "",
            state: "",
            zip: "",
          },
        };
      }
    }
    throw new Error(`Google Civic API HTTP ${response.status}`);
  }

  const data = await response.json();

  return {
    election: data.election ?? { name: "", electionDay: "" },
    contests: data.contests ?? [],
    normalizedInput: data.normalizedInput ?? {
      line1: "",
      city: "",
      state: "",
      zip: "",
    },
  };
}
