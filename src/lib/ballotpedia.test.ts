import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { scrapeStateCandidates, type BallotpediaCandidate } from "./ballotpedia";

// Minimal fixture matching real Ballotpedia table structure.
// Two sections: "Federal Candidates" and "State Candidates".
const FIXTURE_HTML = `
<html><body>
<table><caption>Federal Candidates</caption>
<thead><tr><th>candidate</th><th>office</th><th>party</th><th>status</th></tr></thead>
<tbody>
<tr><td>Bryan Steil Incumbent</td><td>U.S. House Wisconsin District 1</td><td>Republican</td><td>Candidacy Declared Primary</td></tr>
<tr><td>Miguel Aranda</td><td>U.S. House Wisconsin District 1</td><td>Democratic</td><td>Candidacy Declared Primary</td></tr>
<tr><td>Mark Pocan Incumbent</td><td>U.S. House Wisconsin District 2</td><td>Democratic</td><td>Candidacy Declared Primary</td></tr>
</tbody></table>

<table><caption>State Candidates</caption>
<thead><tr><th>candidate</th><th>office</th><th>party</th><th>status</th></tr></thead>
<tbody>
<tr><td>Tom Tiffany</td><td>Governor of Wisconsin</td><td>Republican</td><td>Candidacy Declared Primary</td></tr>
<tr><td>Mandela Barnes</td><td>Governor of Wisconsin</td><td>Democratic</td><td>Candidacy Declared Primary</td></tr>
</tbody></table>
</body></html>
`;

// Mock global fetch so no HTTP calls are made.
const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    text: async () => FIXTURE_HTML,
  });
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe("scrapeStateCandidates", () => {
  it("parses federal and state candidates from HTML tables", async () => {
    const candidates = await scrapeStateCandidates("Wisconsin", 2026);
    expect(candidates).toHaveLength(5);
  });

  it("extracts name, office, party, and incumbent correctly", async () => {
    const candidates = await scrapeStateCandidates("Wisconsin", 2026);
    const steil = candidates.find((c) => c.name === "Bryan Steil");
    expect(steil).toBeDefined();
    expect(steil!.office).toBe("U.S. House Wisconsin District 1");
    expect(steil!.party).toBe("Republican");
    expect(steil!.incumbent).toBe(true);
  });

  it("marks non-incumbents correctly", async () => {
    const candidates = await scrapeStateCandidates("Wisconsin", 2026);
    const aranda = candidates.find((c) => c.name === "Miguel Aranda");
    expect(aranda).toBeDefined();
    expect(aranda!.incumbent).toBe(false);
  });

  it("includes state-level candidates", async () => {
    const candidates = await scrapeStateCandidates("Wisconsin", 2026);
    const barnes = candidates.find((c) => c.name === "Mandela Barnes");
    expect(barnes).toBeDefined();
    expect(barnes!.office).toBe("Governor of Wisconsin");
  });

  it("throws on HTTP error", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(scrapeStateCandidates("Fake", 2026)).rejects.toThrow(
      "Ballotpedia returned HTTP 404"
    );
  });
});
