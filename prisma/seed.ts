import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Clean existing data in dependency order
  await prisma.userAnswer.deleteMany();
  await prisma.userSession.deleteMany();
  await prisma.question.deleteMany();
  await prisma.questionSet.deleteMany();
  await prisma.candidatePosition.deleteMany();
  await prisma.rawMaterial.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.issueCategory.deleteMany();
  await prisma.election.deleteMany();

  // --- Election ---
  const election = await prisma.election.create({
    data: {
      name: "2026 Wisconsin State Assembly District 42",
      type: "state",
      district: "WI-Assembly-42",
      state: "WI",
      electionDate: new Date("2026-11-03"),
      status: "upcoming",
    },
  });

  // --- Candidates ---
  const candidates = await Promise.all([
    prisma.candidate.create({
      data: {
        electionId: election.id,
        name: "Sarah Chen",
        party: "Democratic",
        incumbent: true,
        officialWebsite: "https://sarahchen2026.com",
      },
    }),
    prisma.candidate.create({
      data: {
        electionId: election.id,
        name: "James Rodriguez",
        party: "Republican",
        incumbent: false,
        officialWebsite: "https://rodriguez4assembly.com",
      },
    }),
    prisma.candidate.create({
      data: {
        electionId: election.id,
        name: "Emily Nakamura",
        party: "Independent",
        incumbent: false,
        officialWebsite: "https://nakamura2026.com",
      },
    }),
    // Candidate with incomplete positions (SEED-002 edge case)
    prisma.candidate.create({
      data: {
        electionId: election.id,
        name: "David Kim",
        party: "Green",
        incumbent: false,
      },
    }),
  ]);

  const [chen, rodriguez, nakamura, kim] = candidates;

  // --- Issue Categories (12 state-level issues) ---
  const issueData = [
    { name: "healthcare", level: "state", displayNameEn: "Healthcare", displayNameZh: "医疗保健" },
    { name: "education", level: "state", displayNameEn: "Education", displayNameZh: "教育" },
    { name: "taxation", level: "state", displayNameEn: "Taxation", displayNameZh: "税收" },
    { name: "housing", level: "state", displayNameEn: "Housing", displayNameZh: "住房" },
    { name: "environment", level: "state", displayNameEn: "Environment", displayNameZh: "环境" },
    { name: "gun_policy", level: "state", displayNameEn: "Gun Policy", displayNameZh: "枪支政策" },
    { name: "criminal_justice", level: "state", displayNameEn: "Criminal Justice", displayNameZh: "刑事司法" },
    { name: "immigration", level: "state", displayNameEn: "Immigration", displayNameZh: "移民" },
    { name: "labor_rights", level: "state", displayNameEn: "Labor Rights", displayNameZh: "劳工权益" },
    { name: "infrastructure", level: "state", displayNameEn: "Infrastructure", displayNameZh: "基础设施" },
    { name: "drug_policy", level: "state", displayNameEn: "Drug Policy", displayNameZh: "药物政策" },
    { name: "abortion_rights", level: "state", displayNameEn: "Abortion Rights", displayNameZh: "堕胎权" },
  ] as const;

  const issues = await Promise.all(
    issueData.map((d) => prisma.issueCategory.create({ data: d })),
  );

  const issueMap = Object.fromEntries(issues.map((i) => [i.name, i.id]));

  // --- Candidate Positions ---
  // Format: [candidateId, issueName, score, confidence, source, summary]
  type PosRow = [string, string, number, string, string, string];

  const positionRows: PosRow[] = [
    // Sarah Chen (incumbent Democrat) — full coverage, mostly progressive
    [chen.id, "healthcare", 1.5, "high", "ai_extracted", "Supports expanding Medicaid and lowering prescription drug costs"],
    [chen.id, "education", 2.0, "high", "ai_extracted", "Strong advocate for increasing public school funding"],
    [chen.id, "taxation", 1.0, "high", "ai_extracted", "Supports progressive income tax and closing corporate loopholes"],
    [chen.id, "housing", 1.5, "medium", "ai_extracted", "Favors rent stabilization and affordable housing mandates"],
    [chen.id, "environment", 2.0, "high", "ai_extracted", "Aggressive clean energy transition and emissions targets"],
    [chen.id, "gun_policy", 1.5, "high", "ai_extracted", "Supports universal background checks and red flag laws"],
    [chen.id, "criminal_justice", 1.0, "medium", "ai_extracted", "Supports sentencing reform and rehabilitation programs"],
    [chen.id, "immigration", 1.0, "medium", "ai_extracted", "Supports path to residency for undocumented state residents"],
    [chen.id, "labor_rights", 2.0, "high", "ai_extracted", "Strong union supporter, backs $17 minimum wage"],
    [chen.id, "infrastructure", 1.0, "medium", "ai_extracted", "Favors public transit expansion over highway spending"],
    [chen.id, "drug_policy", 1.5, "medium", "ai_extracted", "Supports marijuana legalization and treatment-first approach"],
    [chen.id, "abortion_rights", 2.0, "high", "candidate_self_report", "Strongly supports codifying abortion rights in state law"],

    // James Rodriguez (Republican) — full coverage, mostly conservative
    [rodriguez.id, "healthcare", -1.5, "high", "ai_extracted", "Opposes Medicaid expansion, favors market-based solutions"],
    [rodriguez.id, "education", -1.0, "high", "ai_extracted", "Supports school choice and voucher programs"],
    [rodriguez.id, "taxation", -2.0, "high", "ai_extracted", "Wants to eliminate state income tax entirely"],
    [rodriguez.id, "housing", -1.0, "medium", "ai_extracted", "Opposes rent control, favors deregulating zoning"],
    [rodriguez.id, "environment", -1.5, "medium", "ai_extracted", "Opposes emission mandates, supports natural gas"],
    [rodriguez.id, "gun_policy", -2.0, "high", "ai_extracted", "Opposes all new gun regulations"],
    [rodriguez.id, "criminal_justice", -1.5, "high", "ai_extracted", "Tough-on-crime stance, opposes bail reform"],
    [rodriguez.id, "immigration", -2.0, "high", "ai_extracted", "Supports strict enforcement and cooperation with ICE"],
    [rodriguez.id, "labor_rights", -1.0, "medium", "ai_extracted", "Opposes minimum wage increases, supports right-to-work"],
    [rodriguez.id, "infrastructure", -0.5, "low", "ai_extracted", "Prefers private-public partnerships for road projects"],
    [rodriguez.id, "drug_policy", -1.0, "medium", "ai_extracted", "Opposes marijuana legalization"],
    [rodriguez.id, "abortion_rights", -2.0, "high", "candidate_self_report", "Supports strict abortion restrictions"],

    // Emily Nakamura (Independent) — full coverage, centrist/mixed
    [nakamura.id, "healthcare", 0.5, "medium", "ai_extracted", "Supports modest Medicaid expansion with cost controls"],
    [nakamura.id, "education", 1.0, "medium", "ai_extracted", "Supports increased funding with accountability measures"],
    [nakamura.id, "taxation", -0.5, "medium", "ai_extracted", "Favors modest tax cuts for middle class, no corporate tax hikes"],
    [nakamura.id, "housing", 1.0, "medium", "ai_extracted", "Supports mixed-income development incentives"],
    [nakamura.id, "environment", 1.0, "medium", "ai_extracted", "Supports clean energy incentives without mandates"],
    [nakamura.id, "gun_policy", 0.5, "low", "ai_extracted", "Supports background checks but opposes assault weapon bans"],
    [nakamura.id, "criminal_justice", 0.5, "medium", "ai_extracted", "Supports police reform with increased funding for training"],
    [nakamura.id, "immigration", 0.0, "low", "ai_extracted", "Position unclear, calls for comprehensive reform"],
    [nakamura.id, "labor_rights", 0.5, "medium", "ai_extracted", "Supports gradual minimum wage increase tied to inflation"],
    [nakamura.id, "infrastructure", 1.5, "high", "ai_extracted", "Major advocate for state infrastructure investment"],
    [nakamura.id, "drug_policy", 0.5, "low", "ai_extracted", "Open to decriminalization but cautious on full legalization"],
    [nakamura.id, "abortion_rights", 1.0, "medium", "ai_extracted", "Supports current abortion access with some restrictions"],

    // David Kim (Green) — INCOMPLETE: only 9 of 12 issues (missing gun_policy, criminal_justice, immigration)
    [kim.id, "healthcare", 2.0, "medium", "ai_extracted", "Supports single-payer healthcare at state level"],
    [kim.id, "education", 1.5, "medium", "ai_extracted", "Supports free community college and trade programs"],
    [kim.id, "taxation", 1.5, "low", "ai_extracted", "Supports wealth tax and corporate tax increases"],
    [kim.id, "housing", 2.0, "medium", "ai_extracted", "Supports public housing expansion and rent caps"],
    [kim.id, "environment", 2.0, "high", "candidate_self_report", "Zero-emissions target by 2035, ban fracking immediately"],
    [kim.id, "labor_rights", 2.0, "high", "candidate_self_report", "Supports $20 minimum wage and universal union rights"],
    [kim.id, "infrastructure", 1.5, "medium", "ai_extracted", "Prioritizes bike lanes, rail, and green infrastructure"],
    [kim.id, "drug_policy", 2.0, "medium", "ai_extracted", "Supports full drug decriminalization and safe injection sites"],
    [kim.id, "abortion_rights", 2.0, "high", "candidate_self_report", "Supports unrestricted abortion access"],
  ];

  await Promise.all(
    positionRows.map(([candidateId, issueName, score, confidence, source, summary]) =>
      prisma.candidatePosition.create({
        data: {
          candidateId,
          issueId: issueMap[issueName],
          positionScore: score,
          confidence,
          source,
          positionSummary: summary,
        },
      }),
    ),
  );

  // --- Question Set + Questions ---
  const questionSet = await prisma.questionSet.create({
    data: { electionId: election.id },
  });

  const questionData = [
    {
      issueName: "healthcare",
      text: "The state government should spend more money to help people pay for doctor visits and medicine.",
      positiveDirection: "Agreeing means you support more government spending on healthcare.",
      background: "Right now, some people in Wisconsin can't afford to see a doctor. The state could help pay for more people's healthcare, but that would mean spending more tax money.",
    },
    {
      issueName: "education",
      text: "Public schools should get more money from the state, even if it means higher taxes.",
      positiveDirection: "Agreeing means you support increasing taxes to fund public schools.",
      background: "Wisconsin's public schools get money from the state and local property taxes. Some schools have much less money than others. More state funding could help even things out.",
    },
    {
      issueName: "taxation",
      text: "People who earn more money should pay a bigger share of their income in state taxes.",
      positiveDirection: "Agreeing means you support progressive taxation.",
      background: "Wisconsin currently has different tax rates depending on how much you earn. Some people think the rates for higher earners should go up, while others think all tax rates should go down.",
    },
    {
      issueName: "housing",
      text: "The government should set rules to keep rent prices from going up too fast.",
      positiveDirection: "Agreeing means you support rent control or stabilization measures.",
      background: "Rent prices have gone up a lot in many Wisconsin cities. Some people want the government to limit how much landlords can raise rent each year. Others say this makes it harder to build new housing.",
    },
    {
      issueName: "environment",
      text: "Wisconsin should require businesses to switch to clean energy sources like wind and solar, even if it costs more.",
      positiveDirection: "Agreeing means you support mandatory clean energy transition.",
      background: "Burning coal and gas for energy contributes to climate change. Switching to wind and solar is cleaner but can be expensive at first. Some say it creates new jobs, others worry about costs.",
    },
    {
      issueName: "gun_policy",
      text: "There should be stricter rules about who can buy a gun in Wisconsin.",
      positiveDirection: "Agreeing means you support stricter gun purchase regulations.",
      background: "Currently, private gun sales in Wisconsin don't require a background check. Some people want all gun buyers to pass a background check, while others say current rules are enough.",
    },
    {
      issueName: "criminal_justice",
      text: "People convicted of non-violent crimes should get shorter sentences and more help getting back into society.",
      positiveDirection: "Agreeing means you support sentencing reform and rehabilitation.",
      background: "Wisconsin's prisons are overcrowded. Some people think shorter sentences and job training programs would help. Others think longer sentences keep communities safer.",
    },
    {
      issueName: "immigration",
      text: "The state should make it easier for immigrants without legal papers to get driver's licenses and in-state college tuition.",
      positiveDirection: "Agreeing means you support expanding services for undocumented immigrants.",
      background: "There are thousands of undocumented immigrants living in Wisconsin. Some people think giving them access to services helps everyone. Others think it encourages illegal immigration.",
    },
    {
      issueName: "labor_rights",
      text: "The minimum wage in Wisconsin should be raised significantly, even if some businesses say it will hurt them.",
      positiveDirection: "Agreeing means you support a substantial minimum wage increase.",
      background: "Wisconsin's minimum wage is currently $7.25 per hour, the same as the federal minimum. Many workers say that's not enough to live on. Some business owners worry about higher costs.",
    },
    {
      issueName: "infrastructure",
      text: "The state should spend more on buses, trains, and bike paths instead of building new highways.",
      positiveDirection: "Agreeing means you support prioritizing public transit over highways.",
      background: "Wisconsin spends most of its transportation money on roads. Some people want more money for buses and trains, especially in cities. Others say roads are more important for most people.",
    },
    {
      issueName: "drug_policy",
      text: "Marijuana should be legal for adults to buy and use in Wisconsin.",
      positiveDirection: "Agreeing means you support marijuana legalization.",
      background: "Many states have legalized marijuana for adults. Wisconsin hasn't yet. Supporters say it would bring in tax money and reduce arrests. Opponents worry about health and safety.",
    },
    {
      issueName: "abortion_rights",
      text: "Women in Wisconsin should be able to choose to have an abortion without government restrictions.",
      positiveDirection: "Agreeing means you support unrestricted abortion access.",
      background: "Abortion laws have changed a lot recently across the country. Some people think women should decide for themselves. Others think the government should set limits on when abortion is allowed.",
    },
  ];

  await Promise.all(
    questionData.map((q, index) =>
      prisma.question.create({
        data: {
          questionSetId: questionSet.id,
          issueId: issueMap[q.issueName],
          questionText: q.text,
          positiveDirection: q.positiveDirection,
          background: q.background,
          displayOrder: index + 1,
        },
      }),
    ),
  );

  console.log("Seed complete:");
  console.log(`  - 1 election: ${election.name}`);
  console.log(`  - ${candidates.length} candidates`);
  console.log(`  - ${issues.length} issue categories`);
  console.log(`  - ${positionRows.length} candidate positions`);
  console.log(`  - ${questionData.length} questions`);
  console.log(`  - David Kim missing positions on: gun_policy, criminal_justice, immigration`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
