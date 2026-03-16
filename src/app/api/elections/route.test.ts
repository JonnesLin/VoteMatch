import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";
import { NextRequest } from "next/server";

vi.mock("@/lib/zip-to-state", () => ({
  zipToState: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    election: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

import { zipToState } from "@/lib/zip-to-state";
import { prisma } from "@/lib/db";

const mockZipToState = zipToState as ReturnType<typeof vi.fn>;
const mockFindMany = prisma.election.findMany as ReturnType<typeof vi.fn>;

function makeRequest(params: string) {
  return new NextRequest(`http://localhost/api/elections?${params}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/elections", () => {
  it("returns 422 unrecognized_zip when ZIP does not map to a state", async () => {
    mockZipToState.mockReturnValue(null);

    const res = await GET(makeRequest("zip=00000"));
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toBe("unrecognized_zip");
  });

  it("queries DB by state when ZIP is valid", async () => {
    mockZipToState.mockReturnValue("WI");
    mockFindMany.mockResolvedValue([
      { id: "1", name: "Governor of Wisconsin", type: "state", district: "Governor of Wisconsin", state: "WI" },
    ]);

    const res = await GET(makeRequest("zip=53703"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].state).toBe("WI");
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { state: "WI" },
      orderBy: { electionDate: "asc" },
    });
  });

  it("returns empty array when no elections for state", async () => {
    mockZipToState.mockReturnValue("WA");
    mockFindMany.mockResolvedValue([]);

    const res = await GET(makeRequest("zip=98004"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });

  it("returns all elections when no params provided", async () => {
    mockFindMany.mockResolvedValue([{ id: "1" }, { id: "2" }]);

    const res = await GET(makeRequest(""));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(2);
  });
});
