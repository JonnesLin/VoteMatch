/**
 * Admin CLI for managing elections, candidates, and issue categories.
 *
 * Usage:
 *   npx tsx scripts/admin-create.ts election --name "..." --type state --district "..." --state WI --date 2026-11-03
 *   npx tsx scripts/admin-create.ts candidate --election <id> --name "..." --party "D" [--incumbent] [--website "..."]
 *   npx tsx scripts/admin-create.ts issue --name "healthcare" --level state --en "Healthcare" --zh "医疗保健"
 *   npx tsx scripts/admin-create.ts edit-issue --id <id> --en "New Name" [--zh "新名称"]
 *   npx tsx scripts/admin-create.ts list-elections
 *   npx tsx scripts/admin-create.ts list-candidates --election <id>
 *   npx tsx scripts/admin-create.ts list-issues [--level state]
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseArgs(args: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        parsed[key] = next;
        i++;
      } else {
        parsed[key] = "true";
      }
    }
  }
  return parsed;
}

async function createElection(args: Record<string, string>) {
  const required = ["name", "type", "district", "date"];
  for (const key of required) {
    if (!args[key]) {
      console.error(`Error: --${key} is required`);
      process.exit(1);
    }
  }

  const validTypes = ["federal", "state", "city", "local"];
  if (!validTypes.includes(args.type)) {
    console.error(`Error: --type must be one of: ${validTypes.join(", ")}`);
    process.exit(1);
  }

  const election = await prisma.election.create({
    data: {
      name: args.name,
      type: args.type,
      district: args.district,
      state: args.state || null,
      electionDate: new Date(args.date),
      status: args.status || "upcoming",
    },
  });

  console.log(`Election created:`);
  console.log(`  ID: ${election.id}`);
  console.log(`  Name: ${election.name}`);
  console.log(`  Type: ${election.type}`);
  console.log(`  District: ${election.district}`);
  console.log(`  Date: ${election.electionDate.toISOString().split("T")[0]}`);
}

async function createCandidate(args: Record<string, string>) {
  if (!args.election) {
    console.error("Error: --election is required");
    process.exit(1);
  }
  if (!args.name) {
    console.error("Error: --name is required");
    process.exit(1);
  }

  // Verify election exists
  await prisma.election.findUniqueOrThrow({
    where: { id: args.election },
  });

  const candidate = await prisma.candidate.create({
    data: {
      electionId: args.election,
      name: args.name,
      party: args.party || null,
      incumbent: args.incumbent === "true",
      officialWebsite: args.website || null,
    },
  });

  console.log(`Candidate created:`);
  console.log(`  ID: ${candidate.id}`);
  console.log(`  Name: ${candidate.name}`);
  console.log(`  Party: ${candidate.party || "(none)"}`);
  console.log(`  Incumbent: ${candidate.incumbent}`);
  console.log(`  Election: ${args.election}`);
}

async function listElections() {
  const elections = await prisma.election.findMany({
    include: { _count: { select: { candidates: true } } },
    orderBy: { electionDate: "desc" },
  });

  if (elections.length === 0) {
    console.log("No elections found.");
    return;
  }

  console.log("Elections:");
  for (const e of elections) {
    console.log(
      `  ${e.id}  ${e.name}  (${e.type}, ${e.district})  ${e.electionDate.toISOString().split("T")[0]}  [${e._count.candidates} candidates]`
    );
  }
}

async function listCandidates(args: Record<string, string>) {
  if (!args.election) {
    console.error("Error: --election is required");
    process.exit(1);
  }

  const candidates = await prisma.candidate.findMany({
    where: { electionId: args.election },
    include: { _count: { select: { positions: true, rawMaterials: true } } },
    orderBy: { name: "asc" },
  });

  if (candidates.length === 0) {
    console.log("No candidates found for this election.");
    return;
  }

  console.log("Candidates:");
  for (const c of candidates) {
    console.log(
      `  ${c.id}  ${c.name}  (${c.party || "no party"})  ${c.incumbent ? "INCUMBENT" : ""}  [${c._count.positions} positions, ${c._count.rawMaterials} raw materials]`
    );
  }
}

async function createIssue(args: Record<string, string>) {
  if (!args.name || !args.level || !args.en || !args.zh) {
    console.error("Error: --name, --level, --en, --zh are all required");
    process.exit(1);
  }

  const validLevels = ["federal", "state", "local"];
  if (!validLevels.includes(args.level)) {
    console.error(`Error: --level must be one of: ${validLevels.join(", ")}`);
    process.exit(1);
  }

  const issue = await prisma.issueCategory.create({
    data: {
      name: args.name,
      level: args.level,
      displayNameEn: args.en,
      displayNameZh: args.zh,
    },
  });

  console.log(`Issue created:`);
  console.log(`  ID: ${issue.id}`);
  console.log(`  Name: ${issue.name}`);
  console.log(`  Level: ${issue.level}`);
  console.log(`  EN: ${issue.displayNameEn}`);
  console.log(`  ZH: ${issue.displayNameZh}`);
}

async function editIssue(args: Record<string, string>) {
  if (!args.id) {
    console.error("Error: --id is required");
    process.exit(1);
  }

  const data: Record<string, string> = {};
  if (args.name) data.name = args.name;
  if (args.level) data.level = args.level;
  if (args.en) data.displayNameEn = args.en;
  if (args.zh) data.displayNameZh = args.zh;

  if (Object.keys(data).length === 0) {
    console.error("Error: provide at least one field to update (--name, --level, --en, --zh)");
    process.exit(1);
  }

  const issue = await prisma.issueCategory.update({
    where: { id: args.id },
    data,
  });

  console.log(`Issue updated:`);
  console.log(`  ID: ${issue.id}`);
  console.log(`  Name: ${issue.name}`);
  console.log(`  Level: ${issue.level}`);
  console.log(`  EN: ${issue.displayNameEn}`);
  console.log(`  ZH: ${issue.displayNameZh}`);
}

async function listIssues(args: Record<string, string>) {
  const where = args.level ? { level: args.level } : {};
  const issues = await prisma.issueCategory.findMany({
    where,
    include: { _count: { select: { positions: true } } },
    orderBy: [{ level: "asc" }, { name: "asc" }],
  });

  if (issues.length === 0) {
    console.log("No issues found.");
    return;
  }

  let currentLevel = "";
  for (const i of issues) {
    if (i.level !== currentLevel) {
      currentLevel = i.level;
      console.log(`\n  [${currentLevel.toUpperCase()}]`);
    }
    console.log(
      `  ${i.id}  ${i.name}  ${i.displayNameEn} / ${i.displayNameZh}  [${i._count.positions} positions]`
    );
  }
}

async function listClaims() {
  const pendingClaims = await prisma.candidate.findMany({
    where: { claimedBy: { not: null }, claimed: false },
    include: { claimedByUser: true, election: true },
  });

  if (pendingClaims.length === 0) {
    console.log("No pending claims.");
    return;
  }

  console.log("Pending claims:");
  for (const c of pendingClaims) {
    console.log(
      `  ${c.id}  ${c.name}  claimed by ${c.claimedByUser?.email ?? "unknown"}  (${c.election.name})`
    );
  }
}

async function approveClaim(args: Record<string, string>) {
  if (!args.candidate) {
    console.error("Error: --candidate is required");
    process.exit(1);
  }

  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { id: args.candidate },
  });

  if (!candidate.claimedBy) {
    console.error("Error: No claim exists for this candidate");
    process.exit(1);
  }

  await prisma.candidate.update({
    where: { id: args.candidate },
    data: { claimed: true },
  });

  console.log(`Claim approved: ${candidate.name} (${args.candidate})`);
}

async function rejectClaim(args: Record<string, string>) {
  if (!args.candidate) {
    console.error("Error: --candidate is required");
    process.exit(1);
  }

  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { id: args.candidate },
  });

  if (!candidate.claimedBy) {
    console.error("Error: No claim exists for this candidate");
    process.exit(1);
  }

  await prisma.candidate.update({
    where: { id: args.candidate },
    data: { claimedBy: null, claimed: false },
  });

  console.log(`Claim rejected: ${candidate.name} (${args.candidate})`);
}

async function main() {
  const command = process.argv[2];
  const args = parseArgs(process.argv.slice(3));

  switch (command) {
    case "election":
      await createElection(args);
      break;
    case "candidate":
      await createCandidate(args);
      break;
    case "issue":
      await createIssue(args);
      break;
    case "edit-issue":
      await editIssue(args);
      break;
    case "list-claims":
      await listClaims();
      break;
    case "approve-claim":
      await approveClaim(args);
      break;
    case "reject-claim":
      await rejectClaim(args);
      break;
    case "list-elections":
      await listElections();
      break;
    case "list-candidates":
      await listCandidates(args);
      break;
    case "list-issues":
      await listIssues(args);
      break;
    default:
      console.log(`
VoteMatch Admin CLI

Commands:
  election           Create a new election
    --name "..."     Election name (required)
    --type state     Election type: federal|state|city|local (required)
    --district "..." District identifier (required)
    --state WI       State abbreviation
    --date 2026-11-03 Election date (required)

  candidate          Create a new candidate
    --election <id>  Election ID (required)
    --name "..."     Candidate name (required)
    --party "D"      Party affiliation
    --incumbent      Mark as incumbent
    --website "..."  Official campaign website

  issue              Create a new issue category
    --name "..."     Internal key, e.g. "healthcare" (required)
    --level state    Level: federal|state|local (required)
    --en "..."       English display name (required)
    --zh "..."       Chinese display name (required)

  edit-issue         Edit an existing issue category
    --id <id>        Issue ID (required)
    --name "..."     New internal key
    --en "..."       New English display name
    --zh "..."       New Chinese display name

  list-claims        List pending candidate profile claims
  approve-claim      Approve a candidate profile claim
    --candidate <id> Candidate ID (required)
  reject-claim       Reject a candidate profile claim
    --candidate <id> Candidate ID (required)

  list-elections     List all elections
  list-candidates    List candidates for an election
    --election <id>  Election ID (required)
  list-issues        List all issue categories
    --level state    Filter by level (optional)
`);
      process.exit(command ? 1 : 0);
  }
}

main()
  .catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
