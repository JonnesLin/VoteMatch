import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { scrapeStateCandidates } from "../src/lib/ballotpedia";

const prisma = new PrismaClient();

// All 50 states + DC, using Ballotpedia's URL naming convention
const STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California",
  "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
  "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri",
  "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey",
  "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina",
  "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
];

// State name → 2-letter abbreviation
const STATE_ABBR: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA",
  Hawaii: "HI", Idaho: "ID", Illinois: "IL", Indiana: "IN", Iowa: "IA",
  Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO",
  Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH",
  Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
};

function officeToType(office: string): string {
  const lower = office.toLowerCase();
  if (lower.includes("u.s.") || lower.includes("united states")) return "federal";
  if (
    lower.includes("governor") ||
    lower.includes("attorney general") ||
    lower.includes("secretary of state") ||
    lower.includes("treasurer") ||
    lower.includes("state senate") ||
    lower.includes("state assembly") ||
    lower.includes("state house") ||
    lower.includes("state rep")
  ) return "state";
  return "local";
}

async function scrapeState(stateName: string, year: number) {
  const abbr = STATE_ABBR[stateName];
  if (!abbr) throw new Error(`Unknown state: ${stateName}`);

  console.log(`Scraping ${stateName}...`);

  const candidates = await scrapeStateCandidates(stateName, year);
  console.log(`  Found ${candidates.length} candidates`);

  // Group candidates by office → one Election per office
  const byOffice = new Map<string, typeof candidates>();
  for (const c of candidates) {
    const list = byOffice.get(c.office) ?? [];
    list.push(c);
    byOffice.set(c.office, list);
  }

  // November general election date for the year
  const electionDate = new Date(`${year}-11-03`);

  let electionCount = 0;
  let candidateCount = 0;

  for (const [office, officeCandidates] of byOffice) {
    const type = officeToType(office);

    const election = await prisma.election.upsert({
      where: {
        district_electionDate: { district: office, electionDate },
      },
      update: { name: office, type, state: abbr },
      create: {
        name: office,
        type,
        district: office,
        state: abbr,
        electionDate,
      },
    });
    electionCount++;

    for (const c of officeCandidates) {
      await prisma.candidate.upsert({
        where: {
          electionId_name: { electionId: election.id, name: c.name },
        },
        update: {
          party: c.party || null,
          incumbent: c.incumbent,
        },
        create: {
          electionId: election.id,
          name: c.name,
          party: c.party || null,
          incumbent: c.incumbent,
        },
      });
      candidateCount++;
    }
  }

  console.log(`  Upserted ${electionCount} elections, ${candidateCount} candidates`);
}

async function main() {
  const year = 2026;
  const targetState = process.argv[2]; // Optional: single state name

  if (targetState) {
    await scrapeState(targetState, year);
  } else {
    for (const state of STATES) {
      try {
        await scrapeState(state, year);
        // Rate limit: 1 second between requests
        await new Promise((r) => setTimeout(r, 1000));
      } catch (err) {
        console.error(`  ERROR scraping ${state}:`, err instanceof Error ? err.message : err);
      }
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
