/**
 * Analyzer — Step 2 of the data pipeline.
 *
 * Takes verified RawMaterial records for a candidate and uses Claude
 * to extract structured CandidatePosition data against the predefined
 * issue framework. Handles confidence levels, contradictions, and
 * "no substantive position" cases.
 */

import { getGeminiModel } from "../gemini";
import { prisma } from "../db";
import type { AnalyzerInput, AnalyzerOutput, ExtractedPosition } from "./types";

const ANALYZER_SYSTEM_PROMPT = `You are a political position analyst. Your job is to extract structured position data from raw materials.

CRITICAL RULES:
- Map every position to one of the provided issue categories using the exact issue_id
- Use the -2 to +2 scale: +2 = strongly supportive/progressive, -2 = strongly opposing/conservative, 0 = neutral/ambiguous
- Assign confidence: "high" for voting records or explicit statements, "medium" for inferred positions, "low" for vague references
- Mark low-confidence positions with notes: "Position unclear"
- If candidate discussed an issue without taking a stance, note: "No substantive position found"
- If contradictory statements exist, preserve both in supporting_evidence and note the contradiction
- NEVER fabricate or infer positions the candidate has not publicly expressed
- Include supporting_evidence with raw_material_id and relevant_quote for every position`;

function buildAnalyzerPrompt(input: AnalyzerInput): string {
  const issueList = input.issueCategories
    .map((ic) => `  - ${ic.id}: ${ic.displayNameEn} (${ic.name})`)
    .join("\n");

  const materialList = input.rawMaterials
    .map(
      (m) =>
        `[Material ID: ${m.id}]\nSource: ${m.sourceUrl} (${m.sourceType})\n---\n${m.rawText}\n---`
    )
    .join("\n\n");

  return `Analyze the following raw materials and extract structured positions for candidate "${input.candidateName}".

ISSUE CATEGORIES (use these exact IDs):
${issueList}

RAW MATERIALS:
${materialList}

For each issue category where evidence exists, output a JSON object. Output a JSON array of position objects with these fields:
- issue_id: string (must match one of the issue category IDs above)
- position_summary: string (one sentence summarizing the stance)
- position_score: number (-2.0 to +2.0)
- confidence: "high" | "medium" | "low"
- supporting_evidence: array of { raw_material_id: string, relevant_quote: string }
- notes: string (optional — use for contradictions, unclear positions, or "no substantive position")

Rules:
- Confidence "high": backed by voting records or explicit campaign platform statements
- Confidence "medium": inferred from news quotes or indirect statements
- Confidence "low": vague reference or tangential mention → add notes "Position unclear"
- If candidate says a lot about an issue without taking a stance → notes "No substantive position found"
- If contradictory statements exist → include both in supporting_evidence + notes describing the contradiction
- Skip issues with zero relevant evidence (do not fabricate)

Output ONLY the JSON array. No commentary.`;
}

function parseAnalyzerResponse(text: string): ExtractedPosition[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Analyzer response does not contain a JSON array");
  }

  const raw = JSON.parse(jsonMatch[0]) as Array<{
    issue_id: string;
    position_summary: string;
    position_score: number;
    confidence: "high" | "medium" | "low";
    supporting_evidence: Array<{
      raw_material_id: string;
      relevant_quote: string;
    }>;
    notes?: string;
  }>;

  return raw.map((p) => ({
    issueId: p.issue_id,
    positionSummary: p.position_summary,
    positionScore: Math.max(-2, Math.min(2, p.position_score)),
    confidence: p.confidence,
    supportingEvidence: p.supporting_evidence.map((e) => ({
      rawMaterialId: e.raw_material_id,
      relevantQuote: e.relevant_quote,
    })),
    notes: p.notes,
  }));
}

/**
 * Runs the analyzer for a candidate using their verified raw materials.
 */
export async function runAnalyzer(input: AnalyzerInput): Promise<AnalyzerOutput> {
  if (input.rawMaterials.length === 0) {
    return { candidateId: input.candidateId, positions: [] };
  }

  const model = getGeminiModel({
    systemInstruction: ANALYZER_SYSTEM_PROMPT,
  });

  const response = await model.generateContent(buildAnalyzerPrompt(input));
  const fullText = response.response.text();

  const positions = parseAnalyzerResponse(fullText);

  // Validate issue IDs against provided categories
  const validIssueIds = new Set(input.issueCategories.map((ic) => ic.id));
  const validPositions = positions.filter((p) => {
    if (!validIssueIds.has(p.issueId)) {
      console.warn(
        `Analyzer returned unknown issue_id "${p.issueId}" — skipping`
      );
      return false;
    }
    return true;
  });

  return { candidateId: input.candidateId, positions: validPositions };
}

/**
 * Persists analyzer output to CandidatePosition table.
 * Uses upsert to update existing positions or create new ones.
 */
export async function persistAnalyzerOutput(
  output: AnalyzerOutput
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const position of output.positions) {
    const existing = await prisma.candidatePosition.findUnique({
      where: {
        candidateId_issueId: {
          candidateId: output.candidateId,
          issueId: position.issueId,
        },
      },
    });

    const data = {
      positionSummary: position.positionSummary,
      positionScore: position.positionScore,
      confidence: position.confidence,
      source: "ai_extracted" as const,
      supportingEvidence: position.supportingEvidence,
      notes: position.notes ?? null,
    };

    if (existing) {
      await prisma.candidatePosition.update({
        where: { id: existing.id },
        data,
      });
      updated++;
    } else {
      await prisma.candidatePosition.create({
        data: {
          candidateId: output.candidateId,
          issueId: position.issueId,
          ...data,
        },
      });
      created++;
    }
  }

  return { created, updated };
}
