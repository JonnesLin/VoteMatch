/**
 * CLI script to run the VoteMatch data pipeline.
 *
 * Usage:
 *   npx tsx scripts/run-pipeline.ts --election <electionId>
 *   npx tsx scripts/run-pipeline.ts --candidate <candidateId>
 */

import "dotenv/config";
import { runPipelineForElection, runPipelineForCandidate } from "../src/lib/pipeline";

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.length === 0) {
    console.log(`
VoteMatch Data Pipeline

Usage:
  npx tsx scripts/run-pipeline.ts --election <electionId>   Run pipeline for all candidates in an election
  npx tsx scripts/run-pipeline.ts --candidate <candidateId> Run pipeline for a single candidate

Required environment:
  GEMINI_API_KEY      Gemini API key for collector and analyzer
  DATABASE_URL        PostgreSQL connection string
`);
    process.exit(0);
  }

  const electionIdx = args.indexOf("--election");
  const candidateIdx = args.indexOf("--candidate");

  if (electionIdx !== -1) {
    const electionId = args[electionIdx + 1];
    if (!electionId) {
      console.error("Error: --election requires an election ID");
      process.exit(1);
    }
    const result = await runPipelineForElection(electionId);
    console.log("\n=== Summary ===");
    for (const c of result.candidates) {
      console.log(`${c.candidateName}:`);
      console.log(`  Collected: ${c.collectResult.materialsCreated} materials`);
      console.log(
        `  Verified: ${c.verifyResult.urlVerified} URLs, ${c.verifyResult.contentVerified} content`
      );
      console.log(
        `  Analyzed: ${c.analyzeResult.positionsCreated} new + ${c.analyzeResult.positionsUpdated} updated positions`
      );
      if (c.errors.length > 0) {
        console.log(`  Errors: ${c.errors.join("; ")}`);
      }
    }
    process.exit(result.totalErrors > 0 ? 1 : 0);
  }

  if (candidateIdx !== -1) {
    const candidateId = args[candidateIdx + 1];
    if (!candidateId) {
      console.error("Error: --candidate requires a candidate ID");
      process.exit(1);
    }
    const result = await runPipelineForCandidate(candidateId);
    console.log("\n=== Result ===");
    console.log(`${result.candidateName}:`);
    console.log(`  Collected: ${result.collectResult.materialsCreated} materials`);
    console.log(
      `  Verified: ${result.verifyResult.urlVerified} URLs, ${result.verifyResult.contentVerified} content`
    );
    console.log(
      `  Analyzed: ${result.analyzeResult.positionsCreated} new + ${result.analyzeResult.positionsUpdated} updated positions`
    );
    if (result.errors.length > 0) {
      console.log(`  Errors: ${result.errors.join("; ")}`);
    }
    process.exit(result.errors.length > 0 ? 1 : 0);
  }

  console.error("Error: specify --election or --candidate");
  process.exit(1);
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
