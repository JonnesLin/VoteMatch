import "dotenv/config";
import { PrismaClient } from "@prisma/client";

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

  // --- Issue Categories ---
  // State level (12 issues — used by the seed election)
  const stateIssues = [
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

  // Federal level (12 issues — for congressional / presidential races)
  const federalIssues = [
    { name: "fed_immigration", level: "federal", displayNameEn: "Immigration", displayNameZh: "移民政策" },
    { name: "fed_defense", level: "federal", displayNameEn: "National Defense", displayNameZh: "国防" },
    { name: "fed_foreign_policy", level: "federal", displayNameEn: "Foreign Policy", displayNameZh: "外交政策" },
    { name: "fed_social_security", level: "federal", displayNameEn: "Social Security", displayNameZh: "社会保障" },
    { name: "fed_healthcare", level: "federal", displayNameEn: "Healthcare & Medicare", displayNameZh: "医疗与医保" },
    { name: "fed_economy", level: "federal", displayNameEn: "Economy & Jobs", displayNameZh: "经济与就业" },
    { name: "fed_climate", level: "federal", displayNameEn: "Climate & Energy", displayNameZh: "气候与能源" },
    { name: "fed_gun_control", level: "federal", displayNameEn: "Gun Control", displayNameZh: "枪支管控" },
    { name: "fed_education", level: "federal", displayNameEn: "Education Policy", displayNameZh: "教育政策" },
    { name: "fed_trade", level: "federal", displayNameEn: "Trade & Tariffs", displayNameZh: "贸易与关税" },
    { name: "fed_civil_rights", level: "federal", displayNameEn: "Civil Rights", displayNameZh: "公民权利" },
    { name: "fed_national_debt", level: "federal", displayNameEn: "National Debt", displayNameZh: "国债" },
  ] as const;

  // Local level (10 issues — for city/county/school board races)
  const localIssues = [
    { name: "local_zoning", level: "local", displayNameEn: "Zoning & Land Use", displayNameZh: "分区与土地使用" },
    { name: "local_schools", level: "local", displayNameEn: "School Districts", displayNameZh: "学区" },
    { name: "local_transit", level: "local", displayNameEn: "Public Transit", displayNameZh: "公共交通" },
    { name: "local_public_safety", level: "local", displayNameEn: "Public Safety", displayNameZh: "公共安全" },
    { name: "local_parks", level: "local", displayNameEn: "Parks & Recreation", displayNameZh: "公园与休闲" },
    { name: "local_utilities", level: "local", displayNameEn: "Utilities & Water", displayNameZh: "公用事业与水务" },
    { name: "local_budget", level: "local", displayNameEn: "City Budget & Taxes", displayNameZh: "市政预算与税收" },
    { name: "local_housing", level: "local", displayNameEn: "Affordable Housing", displayNameZh: "经济适用房" },
    { name: "local_business", level: "local", displayNameEn: "Small Business", displayNameZh: "小企业" },
    { name: "local_environment", level: "local", displayNameEn: "Local Environment", displayNameZh: "本地环境" },
  ] as const;

  const issueData = [...stateIssues, ...federalIssues, ...localIssues];

  const issues = await Promise.all(
    issueData.map((d) => prisma.issueCategory.create({ data: d })),
  );

  const issueMap = Object.fromEntries(issues.map((i) => [i.name, i.id]));

  // --- Candidate Positions ---
  // Format: [candidateId, issueName, score, confidence, source, summary, summaryZh]
  type PosRow = [string, string, number, string, string, string, string];

  const positionRows: PosRow[] = [
    // Sarah Chen (incumbent Democrat) — full coverage, mostly progressive
    [chen.id, "healthcare", 1.5, "high", "ai_extracted", "Supports expanding Medicaid and lowering prescription drug costs", "支持扩大医疗补助并降低处方药费用"],
    [chen.id, "education", 2.0, "high", "ai_extracted", "Strong advocate for increasing public school funding", "大力倡导增加公立学校拨款"],
    [chen.id, "taxation", 1.0, "high", "ai_extracted", "Supports progressive income tax and closing corporate loopholes", "支持累进所得税并堵住企业税收漏洞"],
    [chen.id, "housing", 1.5, "medium", "ai_extracted", "Favors rent stabilization and affordable housing mandates", "支持租金稳定政策和经济适用房建设要求"],
    [chen.id, "environment", 2.0, "high", "ai_extracted", "Aggressive clean energy transition and emissions targets", "积极推进清洁能源转型和减排目标"],
    [chen.id, "gun_policy", 1.5, "high", "ai_extracted", "Supports universal background checks and red flag laws", "支持全面背景调查和红旗法案"],
    [chen.id, "criminal_justice", 1.0, "medium", "ai_extracted", "Supports sentencing reform and rehabilitation programs", "支持量刑改革和康复项目"],
    [chen.id, "immigration", 1.0, "medium", "ai_extracted", "Supports path to residency for undocumented state residents", "支持为无证州居民提供合法居留途径"],
    [chen.id, "labor_rights", 2.0, "high", "ai_extracted", "Strong union supporter, backs $17 minimum wage", "坚定的工会支持者，支持17美元最低工资"],
    [chen.id, "infrastructure", 1.0, "medium", "ai_extracted", "Favors public transit expansion over highway spending", "倾向于扩大公共交通而非公路支出"],
    [chen.id, "drug_policy", 1.5, "medium", "ai_extracted", "Supports marijuana legalization and treatment-first approach", "支持大麻合法化和治疗优先的方针"],
    [chen.id, "abortion_rights", 2.0, "high", "candidate_self_report", "Strongly supports codifying abortion rights in state law", "强烈支持将堕胎权写入州法律"],

    // James Rodriguez (Republican) — full coverage, mostly conservative
    [rodriguez.id, "healthcare", -1.5, "high", "ai_extracted", "Opposes Medicaid expansion, favors market-based solutions", "反对扩大医疗补助，倾向于市场化解决方案"],
    [rodriguez.id, "education", -1.0, "high", "ai_extracted", "Supports school choice and voucher programs", "支持择校权和教育券项目"],
    [rodriguez.id, "taxation", -2.0, "high", "ai_extracted", "Wants to eliminate state income tax entirely", "希望完全取消州所得税"],
    [rodriguez.id, "housing", -1.0, "medium", "ai_extracted", "Opposes rent control, favors deregulating zoning", "反对租金管控，倾向于放松分区管制"],
    [rodriguez.id, "environment", -1.5, "medium", "ai_extracted", "Opposes emission mandates, supports natural gas", "反对排放强制要求，支持天然气"],
    [rodriguez.id, "gun_policy", -2.0, "high", "ai_extracted", "Opposes all new gun regulations", "反对所有新的枪支管制法规"],
    [rodriguez.id, "criminal_justice", -1.5, "high", "ai_extracted", "Tough-on-crime stance, opposes bail reform", "主张严厉打击犯罪，反对保释改革"],
    [rodriguez.id, "immigration", -2.0, "high", "ai_extracted", "Supports strict enforcement and cooperation with ICE", "支持严格执法并与移民和海关执法局合作"],
    [rodriguez.id, "labor_rights", -1.0, "medium", "ai_extracted", "Opposes minimum wage increases, supports right-to-work", "反对提高最低工资，支持工作权法案"],
    [rodriguez.id, "infrastructure", -0.5, "low", "ai_extracted", "Prefers private-public partnerships for road projects", "倾向于通过公私合作推进道路项目"],
    [rodriguez.id, "drug_policy", -1.0, "medium", "ai_extracted", "Opposes marijuana legalization", "反对大麻合法化"],
    [rodriguez.id, "abortion_rights", -2.0, "high", "candidate_self_report", "Supports strict abortion restrictions", "支持严格限制堕胎"],

    // Emily Nakamura (Independent) — full coverage, centrist/mixed
    [nakamura.id, "healthcare", 0.5, "medium", "ai_extracted", "Supports modest Medicaid expansion with cost controls", "支持适度扩大医疗补助并加强成本控制"],
    [nakamura.id, "education", 1.0, "medium", "ai_extracted", "Supports increased funding with accountability measures", "支持增加拨款并加强问责措施"],
    [nakamura.id, "taxation", -0.5, "medium", "ai_extracted", "Favors modest tax cuts for middle class, no corporate tax hikes", "倾向于对中产阶级适度减税，不增加企业税"],
    [nakamura.id, "housing", 1.0, "medium", "ai_extracted", "Supports mixed-income development incentives", "支持混合收入住房开发激励措施"],
    [nakamura.id, "environment", 1.0, "medium", "ai_extracted", "Supports clean energy incentives without mandates", "支持清洁能源激励措施但不强制要求"],
    [nakamura.id, "gun_policy", 0.5, "low", "ai_extracted", "Supports background checks but opposes assault weapon bans", "支持背景调查但反对禁止攻击性武器"],
    [nakamura.id, "criminal_justice", 0.5, "medium", "ai_extracted", "Supports police reform with increased funding for training", "支持警察改革并增加培训经费"],
    [nakamura.id, "immigration", 0.0, "low", "ai_extracted", "Position unclear, calls for comprehensive reform", "立场不明确，呼吁进行全面改革"],
    [nakamura.id, "labor_rights", 0.5, "medium", "ai_extracted", "Supports gradual minimum wage increase tied to inflation", "支持与通胀挂钩的逐步提高最低工资"],
    [nakamura.id, "infrastructure", 1.5, "high", "ai_extracted", "Major advocate for state infrastructure investment", "大力倡导州基础设施投资"],
    [nakamura.id, "drug_policy", 0.5, "low", "ai_extracted", "Open to decriminalization but cautious on full legalization", "对去刑事化持开放态度但对全面合法化持谨慎态度"],
    [nakamura.id, "abortion_rights", 1.0, "medium", "ai_extracted", "Supports current abortion access with some restrictions", "支持当前的堕胎权并加以一定限制"],

    // David Kim (Green) — INCOMPLETE: only 9 of 12 issues (missing gun_policy, criminal_justice, immigration)
    [kim.id, "healthcare", 2.0, "medium", "ai_extracted", "Supports single-payer healthcare at state level", "支持州级单一支付者医疗体系"],
    [kim.id, "education", 1.5, "medium", "ai_extracted", "Supports free community college and trade programs", "支持免费社区大学和职业培训项目"],
    [kim.id, "taxation", 1.5, "low", "ai_extracted", "Supports wealth tax and corporate tax increases", "支持征收财富税和增加企业税"],
    [kim.id, "housing", 2.0, "medium", "ai_extracted", "Supports public housing expansion and rent caps", "支持扩大公共住房并设置租金上限"],
    [kim.id, "environment", 2.0, "high", "candidate_self_report", "Zero-emissions target by 2035, ban fracking immediately", "2035年零排放目标，立即禁止水力压裂"],
    [kim.id, "labor_rights", 2.0, "high", "candidate_self_report", "Supports $20 minimum wage and universal union rights", "支持20美元最低工资和普遍工会权利"],
    [kim.id, "infrastructure", 1.5, "medium", "ai_extracted", "Prioritizes bike lanes, rail, and green infrastructure", "优先发展自行车道、铁路和绿色基础设施"],
    [kim.id, "drug_policy", 2.0, "medium", "ai_extracted", "Supports full drug decriminalization and safe injection sites", "支持全面药物去刑事化和安全注射站"],
    [kim.id, "abortion_rights", 2.0, "high", "candidate_self_report", "Supports unrestricted abortion access", "支持不受限制的堕胎权"],
  ];

  await Promise.all(
    positionRows.map(([candidateId, issueName, score, confidence, source, summary, summaryZh]) =>
      prisma.candidatePosition.create({
        data: {
          candidateId,
          issueId: issueMap[issueName],
          positionScore: score,
          confidence,
          source,
          positionSummary: summary,
          positionSummaryZh: summaryZh,
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
      textZh: "州政府应该花更多的钱来帮助人们支付看病和买药的费用。",
      positiveDirection: "Agreeing means you support more government spending on healthcare.",
      background: "Right now, some people in Wisconsin can't afford to see a doctor. The state could help pay for more people's healthcare, but that would mean spending more tax money.",
      backgroundZh: "目前，威斯康星州的一些人看不起病。州政府可以帮助更多人支付医疗费用，但这意味着要花更多的税收收入。",
    },
    {
      issueName: "education",
      text: "Public schools should get more money from the state, even if it means higher taxes.",
      textZh: "公立学校应该从州政府获得更多资金，即使这意味着更高的税收。",
      positiveDirection: "Agreeing means you support increasing taxes to fund public schools.",
      background: "Wisconsin's public schools get money from the state and local property taxes. Some schools have much less money than others. More state funding could help even things out.",
      backgroundZh: "威斯康星州的公立学校从州政府和地方房产税中获得资金。一些学校的资金远少于其他学校。更多的州级拨款可以帮助缩小差距。",
    },
    {
      issueName: "taxation",
      text: "People who earn more money should pay a bigger share of their income in state taxes.",
      textZh: "收入更高的人应该缴纳更大比例的州所得税。",
      positiveDirection: "Agreeing means you support progressive taxation.",
      background: "Wisconsin currently has different tax rates depending on how much you earn. Some people think the rates for higher earners should go up, while others think all tax rates should go down.",
      backgroundZh: "威斯康星州目前根据收入水平设有不同的税率。一些人认为高收入者的税率应该提高，而另一些人则认为所有税率都应该降低。",
    },
    {
      issueName: "housing",
      text: "The government should set rules to keep rent prices from going up too fast.",
      textZh: "政府应该制定规则，防止房租价格上涨过快。",
      positiveDirection: "Agreeing means you support rent control or stabilization measures.",
      background: "Rent prices have gone up a lot in many Wisconsin cities. Some people want the government to limit how much landlords can raise rent each year. Others say this makes it harder to build new housing.",
      backgroundZh: "威斯康星州许多城市的房租大幅上涨。一些人希望政府限制房东每年的租金涨幅。另一些人则说这会使建造新住房变得更加困难。",
    },
    {
      issueName: "environment",
      text: "Wisconsin should require businesses to switch to clean energy sources like wind and solar, even if it costs more.",
      textZh: "威斯康星州应该要求企业转向风能和太阳能等清洁能源，即使成本更高。",
      positiveDirection: "Agreeing means you support mandatory clean energy transition.",
      background: "Burning coal and gas for energy contributes to climate change. Switching to wind and solar is cleaner but can be expensive at first. Some say it creates new jobs, others worry about costs.",
      backgroundZh: "燃烧煤炭和天然气发电会加剧气候变化。转向风能和太阳能更清洁，但初期可能很贵。一些人说这会创造新的就业机会，另一些人则担心成本问题。",
    },
    {
      issueName: "gun_policy",
      text: "There should be stricter rules about who can buy a gun in Wisconsin.",
      textZh: "威斯康星州应该对谁可以购买枪支实施更严格的规定。",
      positiveDirection: "Agreeing means you support stricter gun purchase regulations.",
      background: "Currently, private gun sales in Wisconsin don't require a background check. Some people want all gun buyers to pass a background check, while others say current rules are enough.",
      backgroundZh: "目前，威斯康星州的私人枪支交易不需要背景调查。一些人希望所有购枪者都通过背景调查，而另一些人则认为现行规定已经足够。",
    },
    {
      issueName: "criminal_justice",
      text: "People convicted of non-violent crimes should get shorter sentences and more help getting back into society.",
      textZh: "非暴力犯罪的罪犯应该获得更短的刑期和更多重返社会的帮助。",
      positiveDirection: "Agreeing means you support sentencing reform and rehabilitation.",
      background: "Wisconsin's prisons are overcrowded. Some people think shorter sentences and job training programs would help. Others think longer sentences keep communities safer.",
      backgroundZh: "威斯康星州的监狱过度拥挤。一些人认为缩短刑期和提供职业培训会有所帮助。另一些人则认为更长的刑期能让社区更安全。",
    },
    {
      issueName: "immigration",
      text: "The state should make it easier for immigrants without legal papers to get driver's licenses and in-state college tuition.",
      textZh: "州政府应该让没有合法身份的移民更容易获得驾照和州内大学学费优惠。",
      positiveDirection: "Agreeing means you support expanding services for undocumented immigrants.",
      background: "There are thousands of undocumented immigrants living in Wisconsin. Some people think giving them access to services helps everyone. Others think it encourages illegal immigration.",
      backgroundZh: "威斯康星州有数千名无证移民。一些人认为给予他们服务渠道对所有人都有好处。另一些人则认为这会助长非法移民。",
    },
    {
      issueName: "labor_rights",
      text: "The minimum wage in Wisconsin should be raised significantly, even if some businesses say it will hurt them.",
      textZh: "威斯康星州的最低工资应该大幅提高，即使一些企业表示这会伤害他们。",
      positiveDirection: "Agreeing means you support a substantial minimum wage increase.",
      background: "Wisconsin's minimum wage is currently $7.25 per hour, the same as the federal minimum. Many workers say that's not enough to live on. Some business owners worry about higher costs.",
      backgroundZh: "威斯康星州目前的最低工资为每小时7.25美元，与联邦最低工资相同。许多工人表示这不足以维持生活。一些企业主则担心成本上升。",
    },
    {
      issueName: "infrastructure",
      text: "The state should spend more on buses, trains, and bike paths instead of building new highways.",
      textZh: "州政府应该把更多资金用于公共汽车、火车和自行车道，而不是修建新的高速公路。",
      positiveDirection: "Agreeing means you support prioritizing public transit over highways.",
      background: "Wisconsin spends most of its transportation money on roads. Some people want more money for buses and trains, especially in cities. Others say roads are more important for most people.",
      backgroundZh: "威斯康星州的大部分交通资金都用于道路建设。一些人希望把更多资金用于公共汽车和火车，尤其是在城市地区。另一些人则认为公路对大多数人更重要。",
    },
    {
      issueName: "drug_policy",
      text: "Marijuana should be legal for adults to buy and use in Wisconsin.",
      textZh: "威斯康星州应该允许成年人合法购买和使用大麻。",
      positiveDirection: "Agreeing means you support marijuana legalization.",
      background: "Many states have legalized marijuana for adults. Wisconsin hasn't yet. Supporters say it would bring in tax money and reduce arrests. Opponents worry about health and safety.",
      backgroundZh: "许多州已经将成人使用大麻合法化。威斯康星州尚未这样做。支持者表示这会带来税收并减少逮捕。反对者则担心健康和安全问题。",
    },
    {
      issueName: "abortion_rights",
      text: "Women in Wisconsin should be able to choose to have an abortion without government restrictions.",
      textZh: "威斯康星州的女性应该能够在没有政府限制的情况下选择堕胎。",
      positiveDirection: "Agreeing means you support unrestricted abortion access.",
      background: "Abortion laws have changed a lot recently across the country. Some people think women should decide for themselves. Others think the government should set limits on when abortion is allowed.",
      backgroundZh: "近年来全美各地的堕胎法律发生了很大变化。一些人认为女性应该自己做决定。另一些人则认为政府应该对允许堕胎的时间设置限制。",
    },
  ];

  await Promise.all(
    questionData.map((q, index) =>
      prisma.question.create({
        data: {
          questionSetId: questionSet.id,
          issueId: issueMap[q.issueName],
          questionText: q.text,
          questionTextZh: q.textZh,
          positiveDirection: q.positiveDirection,
          background: q.background,
          backgroundZh: q.backgroundZh,
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
