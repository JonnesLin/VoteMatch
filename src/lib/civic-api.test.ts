import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { lookupElections, scopeToElectionType } from "./civic-api";

// Mock fetch globally
const originalFetch = global.fetch;

function mockFetch(response: {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}) {
  global.fetch = vi.fn().mockResolvedValue(response);
}

beforeEach(() => {
  process.env.GOOGLE_CIVIC_API_KEY = "test-key";
});

afterEach(() => {
  global.fetch = originalFetch;
  delete process.env.GOOGLE_CIVIC_API_KEY;
});

describe("scopeToElectionType", () => {
  it("maps national and congressional to federal", () => {
    expect(scopeToElectionType("national")).toBe("federal");
    expect(scopeToElectionType("congressional")).toBe("federal");
  });

  it("maps state-level scopes to state", () => {
    expect(scopeToElectionType("statewide")).toBe("state");
    expect(scopeToElectionType("stateUpper")).toBe("state");
    expect(scopeToElectionType("stateLower")).toBe("state");
  });

  it("maps local-level scopes to local", () => {
    expect(scopeToElectionType("countywide")).toBe("local");
    expect(scopeToElectionType("countyCouncil")).toBe("local");
    expect(scopeToElectionType("citywide")).toBe("local");
    expect(scopeToElectionType("cityCouncil")).toBe("local");
    expect(scopeToElectionType("ward")).toBe("local");
    expect(scopeToElectionType("township")).toBe("local");
    expect(scopeToElectionType("schoolBoard")).toBe("local");
    expect(scopeToElectionType("judicial")).toBe("local");
    expect(scopeToElectionType("special")).toBe("local");
  });

  it("defaults unknown/missing scope to local", () => {
    expect(scopeToElectionType(undefined)).toBe("local");
    expect(scopeToElectionType("somethingNew")).toBe("local");
  });
});

describe("lookupElections", () => {
  it("throws when GOOGLE_CIVIC_API_KEY is not set", async () => {
    delete process.env.GOOGLE_CIVIC_API_KEY;
    await expect(lookupElections("53703")).rejects.toThrow(
      "GOOGLE_CIVIC_API_KEY is not configured"
    );
  });

  it("calls correct endpoint with address, key, and returnAllAvailableData", async () => {
    mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        election: { name: "Test Election", electionDay: "2026-11-03" },
        contests: [],
        normalizedInput: { line1: "", city: "", state: "WI", zip: "53703" },
      }),
    });

    await lookupElections("53703");

    const calledUrl = (global.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as string;
    expect(calledUrl).toContain("civicinfo/v2/voterinfo");
    expect(calledUrl).toContain("address=53703");
    expect(calledUrl).toContain("key=test-key");
    expect(calledUrl).toContain("returnAllAvailableData=true");
  });

  it("parses federal contest correctly", async () => {
    mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        election: { name: "2026 General Election", electionDay: "2026-11-03" },
        contests: [
          {
            office: "U.S. Senator",
            level: ["country"],
            district: { name: "Wisconsin", scope: "statewide" },
            candidates: [
              { name: "Jane Doe", party: "Democratic", candidateUrl: "https://jane.com" },
              { name: "John Smith", party: "Republican" },
            ],
          },
        ],
        normalizedInput: { line1: "123 Main", city: "Madison", state: "WI", zip: "53703" },
      }),
    });

    const result = await lookupElections("123 Main Madison WI");
    expect(result.election.name).toBe("2026 General Election");
    expect(result.contests).toHaveLength(1);
    expect(result.contests[0].office).toBe("U.S. Senator");
    expect(result.contests[0].candidates).toHaveLength(2);
    expect(result.normalizedInput.state).toBe("WI");
  });

  it("parses state and local contests", async () => {
    mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        election: { name: "2026 General", electionDay: "2026-11-03" },
        contests: [
          {
            office: "State Assembly District 42",
            district: { name: "WI Assembly 42", scope: "stateLower" },
            candidates: [{ name: "A", party: "D" }],
          },
          {
            office: "County Board Supervisor",
            district: { name: "Dane County", scope: "countyCouncil" },
            candidates: [{ name: "B", party: "R" }],
          },
        ],
        normalizedInput: { line1: "", city: "", state: "WI", zip: "53703" },
      }),
    });

    const result = await lookupElections("53703");
    expect(result.contests).toHaveLength(2);
    expect(result.contests[0].district.scope).toBe("stateLower");
    expect(result.contests[1].district.scope).toBe("countyCouncil");
  });

  it("returns empty contests when no election data (off-season 400)", async () => {
    mockFetch({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          errors: [{ reason: "electionNotFound" }],
        },
        normalizedInput: { line1: "", city: "", state: "WI", zip: "53703" },
      }),
    });

    const result = await lookupElections("53703");
    expect(result.contests).toEqual([]);
    expect(result.normalizedInput.state).toBe("WI");
  });

  it("throws on HTTP 500 error", async () => {
    mockFetch({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal Server Error" }),
    });

    await expect(lookupElections("53703")).rejects.toThrow(
      "Google Civic API HTTP 500"
    );
  });

  it("throws on HTTP 400 with non-electionNotFound reason", async () => {
    mockFetch({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          errors: [{ reason: "invalidParameter" }],
        },
      }),
    });

    await expect(lookupElections("bad-input")).rejects.toThrow(
      "Google Civic API HTTP 400"
    );
  });

  it("handles missing contests in 200 response", async () => {
    mockFetch({
      ok: true,
      status: 200,
      json: async () => ({
        election: { name: "Empty", electionDay: "2026-11-03" },
        normalizedInput: { line1: "", city: "", state: "WI", zip: "53703" },
      }),
    });

    const result = await lookupElections("53703");
    expect(result.contests).toEqual([]);
  });
});
