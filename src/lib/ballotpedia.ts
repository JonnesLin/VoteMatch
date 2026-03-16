import * as cheerio from "cheerio";

const BALLOTPEDIA_BASE = "https://ballotpedia.org";

export interface BallotpediaCandidate {
  name: string;
  office: string;
  party: string;
  incumbent: boolean;
  status: string;
}

/**
 * Scrape candidates from a Ballotpedia state elections page.
 *
 * Parses the "Federal Candidates" and "State Candidates" tables at:
 *   ballotpedia.org/{State}_elections,_{year}
 *
 * Each table has 4 columns: candidate | office | party | status.
 * Incumbent is indicated by "Incumbent" suffix in the name cell.
 */
export async function scrapeStateCandidates(
  state: string,
  year: number
): Promise<BallotpediaCandidate[]> {
  const url = `${BALLOTPEDIA_BASE}/${state.replace(/ /g, "_")}_elections,_${year}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
    headers: { "User-Agent": "VoteMatch/1.0 (election research tool)" },
  });

  if (!response.ok) {
    throw new Error(`Ballotpedia returned HTTP ${response.status} for ${state}`);
  }

  const html = await response.text();
  return parseCandidateTables(html);
}

/**
 * Parse candidate rows from "Federal Candidates" and "State Candidates"
 * tables in the raw HTML.
 */
export function parseCandidateTables(html: string): BallotpediaCandidate[] {
  const $ = cheerio.load(html);
  const candidates: BallotpediaCandidate[] = [];

  // Both candidate tables have a <caption> containing "Candidates"
  $("table").each((_, table) => {
    const caption = $(table).find("caption").text();
    if (!caption.includes("Candidates")) return;

    $(table)
      .find("tbody tr")
      .each((_, row) => {
        const cells = $(row).find("td");
        if (cells.length < 4) return;

        const rawName = $(cells[0]).text().trim();
        const office = $(cells[1]).text().trim();
        const party = $(cells[2]).text().trim();
        const status = $(cells[3]).text().trim();

        const incumbent = rawName.includes("Incumbent");
        const name = rawName.replace(/\s*Incumbent\s*/, "").trim();

        if (name && office) {
          candidates.push({ name, office, party, incumbent, status });
        }
      });
  });

  return candidates;
}
