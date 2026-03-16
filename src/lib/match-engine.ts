/**
 * VoteMatch matching algorithm.
 *
 * Calculates weighted similarity between user answers and candidate positions.
 * Derived directly from the tech spec's Python pseudocode (TECH_SPEC.md §5.2).
 */

export interface MatchInput {
  /** Map of issueId → user score (-2 to +2). "not_interested" excluded. */
  userAnswers: Record<string, number>;
  /** Map of issueId → candidate position score (-2.0 to +2.0). */
  candidatePositions: Record<string, number>;
}

export interface MatchResult {
  matchPercentage: number;
  issueBreakdown: IssueMatch[];
}

export interface IssueMatch {
  issueId: string;
  userScore: number;
  candidateScore: number;
  similarity: number;
  weight: number;
}

const MAX_SCORE_DIFFERENCE = 4; // -2 vs +2

export function calculateMatch({
  userAnswers,
  candidatePositions,
}: MatchInput): MatchResult {
  let totalWeight = 0;
  let weightedSimilarity = 0;
  const issueBreakdown: IssueMatch[] = [];

  for (const [issueId, userScore] of Object.entries(userAnswers)) {
    const candidateScore = candidatePositions[issueId];
    if (candidateScore === undefined) continue;

    const difference = Math.abs(userScore - candidateScore);
    const similarity = 1 - difference / MAX_SCORE_DIFFERENCE;

    // Stronger user stance → higher weight. Neutral gets 0.5.
    const weight = userScore !== 0 ? Math.abs(userScore) : 0.5;

    weightedSimilarity += similarity * weight;
    totalWeight += weight;

    issueBreakdown.push({
      issueId,
      userScore,
      candidateScore,
      similarity,
      weight,
    });
  }

  if (totalWeight === 0) {
    return { matchPercentage: 0, issueBreakdown };
  }

  const matchPercentage =
    Math.round((weightedSimilarity / totalWeight) * 1000) / 10;

  return { matchPercentage, issueBreakdown };
}
