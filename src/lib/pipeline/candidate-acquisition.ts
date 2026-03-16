/**
 * Candidate List Acquisition — CLA-001 through CLA-004
 *
 * Fetches candidate lists from multiple sources and deduplicates.
 * Sources:
 *   CLA-001: State election commission websites (via Gemini search)
 *   CLA-002: FEC public data API (federal elections)
 *   CLA-003: Third-party aggregators (BallotReady, Vote Smart, Ballotpedia via search)
 *   CLA-004: Deduplication across sources
 */

import { getGeminiModelWithSearch } from "../gemini";

export interface AcquiredCandidate {
  name: string;
  party: string | null;
  incumbent: boolean;
  officialWebsite: string | null;
  sources: string[];
}

interface FECCandidate {
  name: string;
  party_full: string;
  office_full: string;
  state: string;
  district: string;
  incumbent_challenge_full: string;
}

/**
 * CLA-002: Fetch from FEC API for federal elections.
 * Free, no API key needed (public data).
 */
export async function fetchFromFEC(
  state: string,
  office: "H" | "S",
  district?: string,
  electionYear?: number
): Promise<AcquiredCandidate[]> {
  const year = electionYear ?? new Date().getFullYear();
  const params = new URLSearchParams({
    state,
    office,
    election_year: String(year),
    sort: "name",
    per_page: "50",
    api_key: "DEMO_KEY",
  });
  if (district) params.set("district", district);

  const response = await fetch(
    `https://api.open.fec.gov/v1/candidates/?${params}`,
    { signal: AbortSignal.timeout(15_000) }
  );

  if (!response.ok) {
    throw new Error(`FEC API returned HTTP ${response.status}`);
  }

  const data = await response.json();
  const results: FECCandidate[] = data.results ?? [];

  return results.map((c) => ({
    name: formatFECName(c.name),
    party: c.party_full || null,
    incumbent: c.incumbent_challenge_full === "Incumbent",
    officialWebsite: null,
    sources: ["fec"],
  }));
}

/** FEC names are "LASTNAME, FIRSTNAME" — flip them. */
function formatFECName(name: string): string {
  const parts = name.split(", ");
  if (parts.length === 2) {
    const [last, first] = parts;
    return `${titleCase(first)} ${titleCase(last)}`;
  }
  return titleCase(name);
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * CLA-001 + CLA-003: Search state election commissions and third-party
 * aggregators using Gemini's Google Search grounding.
 */
export async function fetchFromSearchSources(
  electionName: string,
  state: string,
  district: string
): Promise<AcquiredCandidate[]> {
  const model = getGeminiModelWithSearch({
    systemInstruction: `You are a political data researcher. Search for candidate lists from official sources. Return ONLY factual data found in search results. Never fabricate candidates.`,
  });

  const prompt = `Find all candidates running in the following election:
Election: ${electionName}
State: ${state}
District: ${district}

Search these sources:
1. The state's official election commission / Secretary of State website
2. Ballotpedia
3. BallotReady
4. Vote Smart

For each candidate found, output a JSON array of objects:
- name: full name
- party: political party (or null if independent/nonpartisan)
- incumbent: boolean
- official_website: campaign website URL if found (or null)
- sources: array of source names where this candidate was found

Output ONLY the JSON array. If no candidates are found, output an empty array [].`;

  const response = await model.generateContent(prompt);
  const text = response.response.text();

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  const raw = JSON.parse(jsonMatch[0]) as Array<{
    name: string;
    party: string | null;
    incumbent: boolean;
    official_website: string | null;
    sources: string[];
  }>;

  return raw.map((c) => ({
    name: c.name,
    party: c.party,
    incumbent: c.incumbent ?? false,
    officialWebsite: c.official_website,
    sources: c.sources ?? ["search"],
  }));
}

/**
 * CLA-004: Deduplicate candidates across multiple sources.
 * Merges by fuzzy name matching, combines source lists.
 */
export function deduplicateCandidates(
  candidates: AcquiredCandidate[]
): AcquiredCandidate[] {
  const merged: AcquiredCandidate[] = [];

  for (const candidate of candidates) {
    const normalized = candidate.name.toLowerCase().replace(/[^a-z ]/g, "");
    const existing = merged.find((m) => {
      const mNorm = m.name.toLowerCase().replace(/[^a-z ]/g, "");
      // Same name or one contains the other (handles "John Smith" vs "John A. Smith")
      return (
        mNorm === normalized ||
        mNorm.includes(normalized) ||
        normalized.includes(mNorm)
      );
    });

    if (existing) {
      // Merge sources
      existing.sources = [
        ...new Set([...existing.sources, ...candidate.sources]),
      ];
      // Prefer non-null values
      if (!existing.officialWebsite && candidate.officialWebsite) {
        existing.officialWebsite = candidate.officialWebsite;
      }
      if (!existing.party && candidate.party) {
        existing.party = candidate.party;
      }
    } else {
      merged.push({ ...candidate });
    }
  }

  return merged;
}

/**
 * Full acquisition flow: fetch from all sources + deduplicate.
 */
export async function acquireCandidates(opts: {
  electionName: string;
  state: string;
  district: string;
  office?: "H" | "S";
  electionYear?: number;
}): Promise<AcquiredCandidate[]> {
  const allCandidates: AcquiredCandidate[] = [];

  // FEC (federal elections only)
  if (opts.office) {
    try {
      const fecCandidates = await fetchFromFEC(
        opts.state,
        opts.office,
        undefined,
        opts.electionYear
      );
      allCandidates.push(...fecCandidates);
    } catch (err) {
      console.warn(
        `[CLA] FEC fetch failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Search-based sources (state commissions + aggregators)
  try {
    const searchCandidates = await fetchFromSearchSources(
      opts.electionName,
      opts.state,
      opts.district
    );
    allCandidates.push(...searchCandidates);
  } catch (err) {
    console.warn(
      `[CLA] Search fetch failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  return deduplicateCandidates(allCandidates);
}
