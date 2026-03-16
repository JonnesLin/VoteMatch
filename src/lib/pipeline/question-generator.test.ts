import { describe, it, expect } from "vitest";
import { selectTopIssues, type IssueDivergence } from "./question-generator";

function mockDivergence(id: string, div: number): IssueDivergence {
  return {
    issueId: id,
    issueName: id,
    displayNameEn: id,
    divergence: div,
    candidatePositions: [
      { candidateName: "A", positionScore: div / 2, positionSummary: null },
      { candidateName: "B", positionScore: -div / 2, positionSummary: null },
    ],
  };
}

describe("selectTopIssues", () => {
  it("returns max 15 issues even if more are available", () => {
    const issues = Array.from({ length: 20 }, (_, i) =>
      mockDivergence(`issue-${i}`, 4 - i * 0.1)
    );
    const selected = selectTopIssues(issues);
    expect(selected.length).toBe(15);
  });

  it("returns min 8 issues (or all if fewer available)", () => {
    const issues = Array.from({ length: 5 }, (_, i) =>
      mockDivergence(`issue-${i}`, 4 - i)
    );
    const selected = selectTopIssues(issues);
    // Only 5 available, so returns all 5 (can't reach 8)
    expect(selected.length).toBe(5);
  });

  it("selects highest divergence issues first", () => {
    const issues = [
      mockDivergence("low", 0.5),
      mockDivergence("high", 4.0),
      mockDivergence("mid", 2.0),
    ];
    // Pre-sort (selectTopIssues expects pre-sorted input from calculateDivergence)
    issues.sort((a, b) => b.divergence - a.divergence);
    const selected = selectTopIssues(issues);
    expect(selected[0].issueId).toBe("high");
    expect(selected[1].issueId).toBe("mid");
    expect(selected[2].issueId).toBe("low");
  });

  it("returns empty array for empty input", () => {
    const selected = selectTopIssues([]);
    expect(selected.length).toBe(0);
  });

  it("handles exactly 8 issues", () => {
    const issues = Array.from({ length: 8 }, (_, i) =>
      mockDivergence(`issue-${i}`, 4 - i * 0.4)
    );
    const selected = selectTopIssues(issues);
    expect(selected.length).toBe(8);
  });

  it("issues with divergence 0 (identical positions) can still be selected", () => {
    const issues = [
      mockDivergence("zero", 0),
      mockDivergence("some", 1.0),
    ];
    issues.sort((a, b) => b.divergence - a.divergence);
    const selected = selectTopIssues(issues);
    expect(selected).toHaveLength(2);
    expect(selected[0].divergence).toBe(1.0);
    expect(selected[1].divergence).toBe(0);
  });
});
