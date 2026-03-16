/**
 * Collector — Step 1 of the data pipeline.
 *
 * Uses Claude with web_search tool to find candidate policy information
 * from public sources: campaign websites, voting records, news, social media.
 * Outputs raw materials without stance judgment.
 */

import { getGeminiModelWithSearch } from "../gemini";
import { prisma } from "../db";
import type {
  CollectorInput,
  CollectorOutput,
  CollectedMaterial,
  SourceType,
} from "./types";

const COLLECTOR_SYSTEM_PROMPT = `You are a political information collector. Your job is to search for and collect all publicly available policy-related information for a candidate.

IMPORTANT RULES:
- Search each source type thoroughly before moving on
- Output ONLY factual information found — no stance judgments or summaries
- If a source type yields no results, explicitly state "NOT FOUND" for that type
- Include the full URL of every source
- Include the raw text of policy-relevant excerpts
- Be thorough: check /issues, /platform, /about pages on campaign websites`;

function buildCollectorPrompt(input: CollectorInput): string {
  return `Search for and collect all policy-related public information for this candidate.

Candidate: ${input.candidateName}
Office: ${input.office}
District: ${input.district}
${input.incumbent ? "This is an incumbent official — also search voting records." : "This is NOT an incumbent — skip voting record databases."}
${input.officialWebsite ? `Known official website: ${input.officialWebsite}` : "No known official website."}

Search strategy (follow this order):
1. Candidate's official campaign website, especially /issues, /platform, /about pages
2. ${input.incumbent ? "Voting record databases (e.g. VoteSmart, state legislature records)" : "Skip voting records (not an incumbent)"}
3. Local news media interviews and coverage about this candidate's policy positions
4. Candidate's public social media posts about policy topics

For each piece of information found, output a JSON array of objects with these fields:
- source_url: the full URL where the information was found
- source_type: one of "official_website", "voting_record", "news", "social_media"
- raw_text: the policy-relevant text excerpt (verbatim from the source, no interpretation)

For source types where nothing was found, include an entry with:
- source_type: the type
- not_found: true
- reason: brief explanation of what was searched

Output ONLY valid JSON. No commentary outside the JSON.`;
}

interface CollectorRawResult {
  source_url?: string;
  source_type: SourceType;
  raw_text?: string;
  not_found?: boolean;
  reason?: string;
}

function parseCollectorResponse(text: string): CollectorRawResult[] {
  // Extract JSON from response (may be wrapped in markdown code blocks)
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Collector response does not contain a JSON array");
  }
  return JSON.parse(jsonMatch[0]) as CollectorRawResult[];
}

export async function runCollector(
  input: CollectorInput
): Promise<CollectorOutput> {
  const model = getGeminiModelWithSearch({
    systemInstruction: COLLECTOR_SYSTEM_PROMPT,
  });

  const response = await model.generateContent(buildCollectorPrompt(input));
  const fullText = response.response.text();

  const rawResults = parseCollectorResponse(fullText);

  const materials: CollectedMaterial[] = [];
  const notFound: SourceType[] = [];

  for (const result of rawResults) {
    if (result.not_found) {
      notFound.push(result.source_type);
      continue;
    }
    if (!result.source_url || !result.raw_text) continue;

    materials.push({
      sourceUrl: result.source_url,
      sourceType: result.source_type,
      rawText: result.raw_text,
      accessDate: new Date(),
    });
  }

  return { candidateId: input.candidateId, materials, notFound };
}

/**
 * Persists collector output to RawMaterial table.
 * Skips duplicates by checking source_url + candidate_id.
 */
export async function persistCollectorOutput(
  output: CollectorOutput
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  for (const material of output.materials) {
    // Check for existing material with same URL for this candidate
    const existing = await prisma.rawMaterial.findFirst({
      where: {
        candidateId: output.candidateId,
        sourceUrl: material.sourceUrl,
      },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.rawMaterial.create({
      data: {
        candidateId: output.candidateId,
        sourceUrl: material.sourceUrl,
        sourceType: material.sourceType,
        rawText: material.rawText,
        accessDate: material.accessDate,
        urlVerified: false,
        contentVerified: false,
      },
    });
    created++;
  }

  return { created, skipped };
}
