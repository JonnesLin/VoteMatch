/**
 * Pipeline Orchestrator — ties collector, verifier, and analyzer together.
 *
 * Supports:
 * - Single candidate pipeline run
 * - Batch run for all candidates in an election
 * - Incremental updates (only new sources)
 * - Idempotent re-runs (no duplicates)
 */

import { prisma } from "../db";
import { runCollector, persistCollectorOutput } from "./collector";
import { verifyAllForCandidate } from "./verifier";
import { runAnalyzer, persistAnalyzerOutput } from "./analyzer";
import type {
  CollectorInput,
  PipelineResult,
  BatchPipelineResult,
} from "./types";

/**
 * Runs the full pipeline for a single candidate:
 * 1. Collector → gather raw materials from public sources
 * 2. Verifier → validate URLs and content
 * 3. Analyzer → extract structured positions from verified materials
 */
export async function runPipelineForCandidate(
  candidateId: string
): Promise<PipelineResult> {
  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { id: candidateId },
    include: { election: true },
  });

  const result: PipelineResult = {
    candidateId,
    candidateName: candidate.name,
    collectResult: { materialsCreated: 0, notFound: [] },
    verifyResult: {
      urlVerified: 0,
      urlFailed: 0,
      contentVerified: 0,
      contentFailed: 0,
    },
    analyzeResult: { positionsCreated: 0, positionsUpdated: 0 },
    errors: [],
  };

  // Step 1: Collect
  const collectorInput: CollectorInput = {
    candidateId,
    candidateName: candidate.name,
    office: candidate.election.name,
    district: candidate.election.district,
    incumbent: candidate.incumbent,
    officialWebsite: candidate.officialWebsite,
  };

  try {
    console.log(`[Collect] ${candidate.name} — starting...`);
    const collectorOutput = await runCollector(collectorInput);
    const persistResult = await persistCollectorOutput(collectorOutput);
    result.collectResult.materialsCreated = persistResult.created;
    result.collectResult.notFound = collectorOutput.notFound;
    console.log(
      `[Collect] ${candidate.name} — ${persistResult.created} new materials, ${persistResult.skipped} skipped, ${collectorOutput.notFound.length} source types not found`
    );
  } catch (err) {
    const msg = `Collector failed for ${candidate.name}: ${err instanceof Error ? err.message : String(err)}`;
    result.errors.push(msg);
    console.error(`[Collect] ${msg}`);
  }

  // Step 2: Verify
  try {
    console.log(`[Verify] ${candidate.name} — starting...`);
    const verifyResults = await verifyAllForCandidate(candidateId);
    for (const v of verifyResults) {
      if (v.urlVerified) result.verifyResult.urlVerified++;
      else result.verifyResult.urlFailed++;
      if (v.contentVerified) result.verifyResult.contentVerified++;
      else result.verifyResult.contentFailed++;
    }
    console.log(
      `[Verify] ${candidate.name} — URL: ${result.verifyResult.urlVerified}/${verifyResults.length} OK, Content: ${result.verifyResult.contentVerified}/${verifyResults.length} OK`
    );
  } catch (err) {
    const msg = `Verifier failed for ${candidate.name}: ${err instanceof Error ? err.message : String(err)}`;
    result.errors.push(msg);
    console.error(`[Verify] ${msg}`);
  }

  // Step 3: Analyze (only verified materials)
  try {
    console.log(`[Analyze] ${candidate.name} — starting...`);
    const verifiedMaterials = await prisma.rawMaterial.findMany({
      where: {
        candidateId,
        urlVerified: true,
      },
      select: {
        id: true,
        sourceUrl: true,
        sourceType: true,
        rawText: true,
      },
    });

    const issueCategories = await prisma.issueCategory.findMany({
      where: { level: candidate.election.type },
    });

    const analyzerOutput = await runAnalyzer({
      candidateId,
      candidateName: candidate.name,
      issueCategories: issueCategories.map((ic) => ({
        id: ic.id,
        name: ic.name,
        displayNameEn: ic.displayNameEn,
        level: ic.level,
      })),
      rawMaterials: verifiedMaterials.map((m) => ({
        id: m.id,
        sourceUrl: m.sourceUrl,
        sourceType: m.sourceType,
        rawText: m.rawText,
      })),
    });

    const persistResult = await persistAnalyzerOutput(analyzerOutput);
    result.analyzeResult.positionsCreated = persistResult.created;
    result.analyzeResult.positionsUpdated = persistResult.updated;
    console.log(
      `[Analyze] ${candidate.name} — ${persistResult.created} new positions, ${persistResult.updated} updated`
    );
  } catch (err) {
    const msg = `Analyzer failed for ${candidate.name}: ${err instanceof Error ? err.message : String(err)}`;
    result.errors.push(msg);
    console.error(`[Analyze] ${msg}`);
  }

  return result;
}

/**
 * Runs the pipeline for ALL candidates in an election.
 * Processes candidates sequentially to manage LLM API rate limits.
 */
export async function runPipelineForElection(
  electionId: string
): Promise<BatchPipelineResult> {
  const election = await prisma.election.findUniqueOrThrow({
    where: { id: electionId },
    include: { candidates: true },
  });

  console.log(
    `\n=== Pipeline: ${election.name} (${election.candidates.length} candidates) ===\n`
  );

  const results: PipelineResult[] = [];
  let totalErrors = 0;

  for (const candidate of election.candidates) {
    const candidateResult = await runPipelineForCandidate(candidate.id);
    results.push(candidateResult);
    totalErrors += candidateResult.errors.length;
    console.log(""); // spacer between candidates
  }

  console.log(`\n=== Pipeline complete: ${results.length} candidates processed, ${totalErrors} errors ===\n`);

  return { electionId, candidates: results, totalErrors };
}
