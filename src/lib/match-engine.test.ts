import { describe, it, expect } from "vitest";
import { calculateMatch, type MatchInput } from "./match-engine";

/**
 * MATCH-001 through MATCH-008: Unit tests for the VoteMatch match engine.
 * Scores: strongly_agree=+2, agree=+1, neutral=0, disagree=-1, strongly_disagree=-2
 * not_interested is excluded before calling calculateMatch (score = null → omitted).
 */

describe("calculateMatch", () => {
  // MATCH-001: Identical positions → 100%
  describe("MATCH-001: identical positions", () => {
    it("returns 100.0 when user and candidate positions are identical", () => {
      const input: MatchInput = {
        userAnswers: { iss1: 2, iss2: 1, iss3: -1, iss4: -2 },
        candidatePositions: { iss1: 2, iss2: 1, iss3: -1, iss4: -2 },
      };
      const result = calculateMatch(input);
      expect(result.matchPercentage).toBe(100);
    });

    it("returns 100.0 for a single identical neutral position", () => {
      const result = calculateMatch({
        userAnswers: { iss1: 0 },
        candidatePositions: { iss1: 0 },
      });
      expect(result.matchPercentage).toBe(100);
    });
  });

  // MATCH-002: Opposite positions → 0%
  describe("MATCH-002: opposite positions", () => {
    it("returns 0.0 when all positions are maximally opposed", () => {
      const input: MatchInput = {
        userAnswers: { iss1: 2, iss2: -2, iss3: 2 },
        candidatePositions: { iss1: -2, iss2: 2, iss3: -2 },
      };
      const result = calculateMatch(input);
      expect(result.matchPercentage).toBe(0);
    });
  });

  // MATCH-003: Stronger weight for strong stances
  describe("MATCH-003: weighting by stance intensity", () => {
    it("strongly-held issues influence the score more than weakly-held ones", () => {
      const candidatePositions = { issA: 2, issB: -2 };

      // Scenario 1: user strongly agrees on issA (high alignment), weakly agrees on issB (low alignment)
      const strongOnAligned = calculateMatch({
        userAnswers: { issA: 2, issB: 1 },
        candidatePositions,
      });
      // issA: diff=0, sim=1.0, weight=2 → contributes 2.0
      // issB: diff=3, sim=0.25, weight=1 → contributes 0.25
      // total = 2.25/3 = 75.0%

      // Scenario 2: user weakly agrees on issA, strongly agrees on issB (low alignment)
      const strongOnMisaligned = calculateMatch({
        userAnswers: { issA: 1, issB: 2 },
        candidatePositions,
      });
      // issA: diff=1, sim=0.75, weight=1 → contributes 0.75
      // issB: diff=4, sim=0.0, weight=2  → contributes 0.0
      // total = 0.75/3 = 25.0%

      expect(strongOnAligned.matchPercentage).toBe(75);
      expect(strongOnMisaligned.matchPercentage).toBe(25);
      expect(strongOnAligned.matchPercentage).toBeGreaterThan(
        strongOnMisaligned.matchPercentage
      );
    });

    it("neutral stance gets weight 0.5, weaker than agree/disagree", () => {
      // Single neutral issue
      const neutralResult = calculateMatch({
        userAnswers: { iss1: 0 },
        candidatePositions: { iss1: 1 },
      });
      // diff=1, sim=0.75, weight=0.5 → 0.75*0.5/0.5 = 75.0%

      // Single agree issue with same candidate position
      const agreeResult = calculateMatch({
        userAnswers: { iss1: 1 },
        candidatePositions: { iss1: 1 },
      });
      // diff=0, sim=1.0, weight=1 → 100%

      // Both calculated correctly; neutral has lower weight
      expect(neutralResult.matchPercentage).toBe(75);
      expect(agreeResult.matchPercentage).toBe(100);
    });
  });

  // MATCH-004: not_interested excluded
  describe("MATCH-004: not_interested exclusion", () => {
    it("omitting an issue from userAnswers excludes it from calculation", () => {
      const candidatePositions = { iss1: 2, iss2: 2 };

      // With both issues answered
      const withBoth = calculateMatch({
        userAnswers: { iss1: 2, iss2: -2 },
        candidatePositions,
      });
      // iss1: sim=1.0, w=2; iss2: sim=0.0, w=2 → 2/4 = 50%

      // With iss2 as not_interested (omitted)
      const withoutIss2 = calculateMatch({
        userAnswers: { iss1: 2 },
        candidatePositions,
      });
      // iss1: sim=1.0, w=2 → 2/2 = 100%

      expect(withBoth.matchPercentage).toBe(50);
      expect(withoutIss2.matchPercentage).toBe(100);
    });
  });

  // MATCH-005: All not_interested → 0%
  describe("MATCH-005: all issues not_interested", () => {
    it("returns 0 with empty issueBreakdown when userAnswers is empty", () => {
      const result = calculateMatch({
        userAnswers: {},
        candidatePositions: { iss1: 2, iss2: -1, iss3: 0 },
      });
      expect(result.matchPercentage).toBe(0);
      expect(result.issueBreakdown).toEqual([]);
    });
  });

  // MATCH-006: Candidate missing positions on some issues
  describe("MATCH-006: candidate with missing positions", () => {
    it("skips issues where candidate has no position", () => {
      const result = calculateMatch({
        userAnswers: { iss1: 2, iss2: 1, iss3: -1 },
        candidatePositions: { iss1: 2 }, // missing iss2 and iss3
      });
      // Only iss1 compared: sim=1.0, w=2 → 100%
      expect(result.matchPercentage).toBe(100);
      expect(result.issueBreakdown).toHaveLength(1);
      expect(result.issueBreakdown[0].issueId).toBe("iss1");
    });

    it("returns 0 when candidate has no overlapping positions", () => {
      const result = calculateMatch({
        userAnswers: { iss1: 2, iss2: 1 },
        candidatePositions: { iss3: 2, iss4: -1 },
      });
      expect(result.matchPercentage).toBe(0);
      expect(result.issueBreakdown).toEqual([]);
    });
  });

  // MATCH-007: Ranking multiple candidates
  describe("MATCH-007: ranking multiple candidates", () => {
    it("correctly ranks candidates by match percentage", () => {
      const userAnswers = { iss1: 2, iss2: -2, iss3: 1 };

      const candidates = [
        { id: "perfect", positions: { iss1: 2, iss2: -2, iss3: 1 } },
        { id: "partial", positions: { iss1: 1, iss2: -1, iss3: 0 } },
        { id: "opposite", positions: { iss1: -2, iss2: 2, iss3: -1 } },
      ];

      const ranked = candidates
        .map((c) => ({
          id: c.id,
          ...calculateMatch({ userAnswers, candidatePositions: c.positions }),
        }))
        .sort((a, b) => b.matchPercentage - a.matchPercentage);

      expect(ranked[0].id).toBe("perfect");
      expect(ranked[0].matchPercentage).toBe(100);

      expect(ranked[1].id).toBe("partial");
      expect(ranked[1].matchPercentage).toBeGreaterThan(0);
      expect(ranked[1].matchPercentage).toBeLessThan(100);

      expect(ranked[2].id).toBe("opposite");
      expect(ranked[2].matchPercentage).toBeLessThan(ranked[1].matchPercentage);
    });
  });

  // MATCH-008: Issue-by-issue breakdown
  describe("MATCH-008: issue breakdown structure", () => {
    it("returns breakdown entry for each compared issue with correct fields", () => {
      const result = calculateMatch({
        userAnswers: { iss1: 2, iss2: -1 },
        candidatePositions: { iss1: 1, iss2: -1, iss3: 2 },
      });

      // iss3 not in user answers → excluded. Only iss1 and iss2 compared.
      expect(result.issueBreakdown).toHaveLength(2);

      const iss1 = result.issueBreakdown.find((b) => b.issueId === "iss1")!;
      expect(iss1.userScore).toBe(2);
      expect(iss1.candidateScore).toBe(1);
      expect(iss1.similarity).toBe(0.75); // 1 - 1/4
      expect(iss1.weight).toBe(2); // |2|

      const iss2 = result.issueBreakdown.find((b) => b.issueId === "iss2")!;
      expect(iss2.userScore).toBe(-1);
      expect(iss2.candidateScore).toBe(-1);
      expect(iss2.similarity).toBe(1); // 1 - 0/4
      expect(iss2.weight).toBe(1); // |-1|
    });

    it("breakdown entries sum correctly to the final matchPercentage", () => {
      const result = calculateMatch({
        userAnswers: { iss1: 2, iss2: -1, iss3: 0 },
        candidatePositions: { iss1: 0, iss2: 1, iss3: -1 },
      });

      const totalWeight = result.issueBreakdown.reduce(
        (sum, b) => sum + b.weight,
        0
      );
      const weightedSim = result.issueBreakdown.reduce(
        (sum, b) => sum + b.similarity * b.weight,
        0
      );
      const expectedPct = Math.round((weightedSim / totalWeight) * 1000) / 10;

      expect(result.matchPercentage).toBe(expectedPct);
    });
  });
});
