/**
 * Data accuracy monitoring — MON-003
 *
 * Compares pipeline-extracted positions against a ground truth file.
 * Ground truth format: JSON array of { candidateName, issueName, expectedScore, expectedSummary }
 *
 * Usage:
 *   npx tsx scripts/accuracy-check.ts <ground-truth.json> [election_id]
 */

import "dotenv/config";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface GroundTruth {
  candidateName: string;
  issueName: string;
  expectedScore: number;
  expectedSummary?: string;
}

async function main() {
  const groundTruthPath = process.argv[2];
  const electionId = process.argv[3];

  if (!groundTruthPath) {
    console.error("Usage: npx tsx scripts/accuracy-check.ts <ground-truth.json> [election_id]");
    process.exit(1);
  }

  const fs = await import("fs");
  const groundTruth: GroundTruth[] = JSON.parse(
    fs.readFileSync(groundTruthPath, "utf-8")
  );

  console.log(`\n=== VoteMatch Accuracy Check ===`);
  console.log(`Ground truth: ${groundTruth.length} entries from ${groundTruthPath}\n`);

  // Fetch candidates with positions
  const where = electionId ? { electionId } : {};
  const candidates = await prisma.candidate.findMany({
    where,
    include: {
      positions: {
        include: { issue: true },
      },
    },
  });

  let totalChecked = 0;
  let scoreMatches = 0;
  let scoreClose = 0; // within 1.0
  let missing = 0;

  const results: Array<{
    candidate: string;
    issue: string;
    expected: number;
    actual: number | null;
    diff: number | null;
    status: "exact" | "close" | "mismatch" | "missing";
  }> = [];

  for (const gt of groundTruth) {
    totalChecked++;

    const candidate = candidates.find(
      (c) => c.name.toLowerCase() === gt.candidateName.toLowerCase()
    );

    if (!candidate) {
      results.push({
        candidate: gt.candidateName,
        issue: gt.issueName,
        expected: gt.expectedScore,
        actual: null,
        diff: null,
        status: "missing",
      });
      missing++;
      continue;
    }

    const position = candidate.positions.find(
      (p) =>
        p.issue.name.toLowerCase() === gt.issueName.toLowerCase() ||
        p.issue.displayNameEn.toLowerCase() === gt.issueName.toLowerCase()
    );

    if (!position || position.positionScore === null) {
      results.push({
        candidate: gt.candidateName,
        issue: gt.issueName,
        expected: gt.expectedScore,
        actual: null,
        diff: null,
        status: "missing",
      });
      missing++;
      continue;
    }

    const diff = Math.abs(position.positionScore - gt.expectedScore);

    if (diff === 0) {
      scoreMatches++;
      results.push({
        candidate: gt.candidateName,
        issue: gt.issueName,
        expected: gt.expectedScore,
        actual: position.positionScore,
        diff,
        status: "exact",
      });
    } else if (diff <= 1.0) {
      scoreClose++;
      results.push({
        candidate: gt.candidateName,
        issue: gt.issueName,
        expected: gt.expectedScore,
        actual: position.positionScore,
        diff,
        status: "close",
      });
    } else {
      results.push({
        candidate: gt.candidateName,
        issue: gt.issueName,
        expected: gt.expectedScore,
        actual: position.positionScore,
        diff,
        status: "mismatch",
      });
    }
  }

  // Report
  console.log("--- Results ---");
  for (const r of results) {
    const icon =
      r.status === "exact"
        ? "✅"
        : r.status === "close"
          ? "🟡"
          : r.status === "missing"
            ? "❌"
            : "🔴";
    const actualStr = r.actual !== null ? r.actual.toFixed(1) : "N/A";
    const diffStr = r.diff !== null ? `(diff: ${r.diff.toFixed(1)})` : "(not found)";
    console.log(
      `${icon} ${r.candidate} | ${r.issue}: expected=${r.expected.toFixed(1)}, actual=${actualStr} ${diffStr}`
    );
  }

  const accuracy = totalChecked > 0 ? ((scoreMatches / totalChecked) * 100).toFixed(1) : "0.0";
  const closeAccuracy =
    totalChecked > 0 ? (((scoreMatches + scoreClose) / totalChecked) * 100).toFixed(1) : "0.0";

  console.log(`\n--- Summary ---`);
  console.log(`Total checked:     ${totalChecked}`);
  console.log(`Exact matches:     ${scoreMatches} (${accuracy}%)`);
  console.log(`Close (±1.0):      ${scoreMatches + scoreClose} (${closeAccuracy}%)`);
  console.log(`Missing positions: ${missing}`);
  console.log(
    `Mismatches:        ${totalChecked - scoreMatches - scoreClose - missing}`
  );

  // Output machine-readable JSON
  const report = {
    timestamp: new Date().toISOString(),
    totalChecked,
    exactMatches: scoreMatches,
    closeMatches: scoreMatches + scoreClose,
    missing,
    exactAccuracy: parseFloat(accuracy),
    closeAccuracy: parseFloat(closeAccuracy),
    details: results,
  };

  fs.writeFileSync(
    "accuracy-report.json",
    JSON.stringify(report, null, 2)
  );
  console.log(`\nFull report written to accuracy-report.json`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
