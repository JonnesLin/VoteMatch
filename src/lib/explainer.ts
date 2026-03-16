/**
 * Match Explanation Generator — RE-001, RE-002, RE-003
 *
 * Uses Gemini to generate natural language explanations of
 * why a voter matched (or didn't) with each candidate.
 * Explanations are neutral, non-directive, and cacheable.
 */

import { getGeminiModel } from "./gemini";

const EXPLAINER_SYSTEM_PROMPT = `You are a neutral political information assistant. Your job is to explain match results between a voter and candidates in a clear, factual way.

RULES:
- Use neutral, non-directive language — never recommend or endorse any candidate
- Reference specific policy areas where the voter and candidate agree or disagree
- Keep each explanation to 2-3 sentences
- Use plain language a general audience can understand
- Never say a candidate is "better" or "worse" — only describe alignment
- Do not include percentage numbers (the UI already shows those)`;

interface MatchInput {
  candidateName: string;
  party: string | null;
  matchPercentage: number;
  topAgreements: Array<{ issue: string; detail: string }>;
  topDisagreements: Array<{ issue: string; detail: string }>;
}

interface ExplanationResult {
  candidateId: string;
  explanation: string;
}

function buildExplainerPrompt(matches: MatchInput[]): string {
  const candidateBlocks = matches
    .map(
      (m) =>
        `Candidate: ${m.candidateName} (${m.party ?? "Independent"})
Match level: ${m.matchPercentage >= 70 ? "high" : m.matchPercentage >= 40 ? "moderate" : "low"}
Top agreements: ${m.topAgreements.length > 0 ? m.topAgreements.map((a) => `${a.issue}: ${a.detail}`).join("; ") : "none"}
Top disagreements: ${m.topDisagreements.length > 0 ? m.topDisagreements.map((d) => `${d.issue}: ${d.detail}`).join("; ") : "none"}`
    )
    .join("\n\n");

  return `Generate a brief, neutral explanation of the match results for each candidate below. Output a JSON array of objects with fields: candidate_name (string), explanation (string).

${candidateBlocks}

Each explanation should:
1. Mention 1-2 specific policy areas where the voter aligns with the candidate
2. Mention 1-2 areas of disagreement if applicable
3. Use neutral framing: "Your positions align on..." not "You should vote for..."

Output ONLY the JSON array.`;
}

export async function generateExplanations(
  candidates: Array<{
    candidateId: string;
    name: string;
    party: string | null;
    matchPercentage: number;
    issueBreakdown: Array<{
      issueName: string;
      similarity: number;
      userScore: number;
      candidateScore: number;
      candidatePosition: { summary: string | null } | null;
    }>;
  }>
): Promise<ExplanationResult[]> {
  const matchInputs: MatchInput[] = candidates.map((c) => {
    const sorted = [...c.issueBreakdown].sort(
      (a, b) => b.similarity - a.similarity
    );
    const topAgreements = sorted
      .filter((i) => i.similarity >= 0.7)
      .slice(0, 3)
      .map((i) => ({
        issue: i.issueName,
        detail: i.candidatePosition?.summary ?? "similar position",
      }));
    const topDisagreements = sorted
      .filter((i) => i.similarity < 0.4)
      .slice(-3)
      .map((i) => ({
        issue: i.issueName,
        detail: i.candidatePosition?.summary ?? "different position",
      }));

    return {
      candidateName: c.name,
      party: c.party,
      matchPercentage: c.matchPercentage,
      topAgreements,
      topDisagreements,
    };
  });

  const model = getGeminiModel({
    systemInstruction: EXPLAINER_SYSTEM_PROMPT,
  });

  const response = await model.generateContent(
    buildExplainerPrompt(matchInputs)
  );
  const text = response.response.text();

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Explainer response does not contain a JSON array");
  }

  const raw = JSON.parse(jsonMatch[0]) as Array<{
    candidate_name: string;
    explanation: string;
  }>;

  return candidates.map((c) => {
    const match = raw.find(
      (r) =>
        r.candidate_name.toLowerCase().includes(c.name.toLowerCase()) ||
        c.name.toLowerCase().includes(r.candidate_name.toLowerCase())
    );
    return {
      candidateId: c.candidateId,
      explanation: match?.explanation ?? `Your positions were compared across multiple policy areas with ${c.name}.`,
    };
  });
}
