/**
 * CLI script to generate quiz questions for an election.
 *
 * Usage:
 *   npx tsx scripts/generate-questions.ts --election <electionId>
 */

import "dotenv/config";
import { generateQuestionsForElection } from "../src/lib/pipeline";

async function main() {
  const args = process.argv.slice(2);

  const electionIdx = args.indexOf("--election");
  if (electionIdx === -1 || !args[electionIdx + 1]) {
    console.log(`
VoteMatch Question Generator

Usage:
  npx tsx scripts/generate-questions.ts --election <electionId>

Generates voter-facing quiz questions based on candidate position divergence.
Requires ANTHROPIC_API_KEY and DATABASE_URL in .env
`);
    process.exit(0);
  }

  const electionId = args[electionIdx + 1];
  const result = await generateQuestionsForElection(electionId);

  console.log(`\nDone: ${result.questionsCreated} questions in QuestionSet ${result.questionSetId}`);
}

main().catch((err) => {
  console.error("Question generation failed:", err);
  process.exit(1);
});
