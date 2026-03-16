import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getGeminiModel } from "@/lib/gemini";

/**
 * GET /api/analytics/report?election_id=...
 *
 * CA-002: LLM generates deep analysis report from aggregated voter data.
 * Takes raw analytics data and produces a consultant-ready narrative report.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const electionId = url.searchParams.get("election_id");

  if (!electionId) {
    return NextResponse.json(
      { error: "election_id is required" },
      { status: 400 }
    );
  }

  const election = await prisma.election.findUnique({
    where: { id: electionId },
    include: {
      candidates: {
        include: {
          positions: { include: { issue: true } },
        },
      },
    },
  });

  if (!election) {
    return NextResponse.json({ error: "Election not found" }, { status: 404 });
  }

  const sessionCount = await prisma.userSession.count({
    where: { electionId },
  });

  const answers = await prisma.userAnswer.findMany({
    where: {
      session: { electionId },
      answer: { not: "not_interested" },
    },
    include: {
      question: { include: { issue: true } },
    },
  });

  // Build summary data for LLM
  const issueStats = new Map<
    string,
    { name: string; scores: number[]; count: number }
  >();
  for (const a of answers) {
    const issueId = a.question.issueId;
    if (!issueStats.has(issueId)) {
      issueStats.set(issueId, {
        name: a.question.issue.displayNameEn,
        scores: [],
        count: 0,
      });
    }
    const stat = issueStats.get(issueId)!;
    stat.count++;
    if (a.answerScore !== null) stat.scores.push(a.answerScore);
  }

  const issueSummary = Array.from(issueStats.entries()).map(([, stat]) => {
    const avg =
      stat.scores.length > 0
        ? stat.scores.reduce((a, b) => a + b, 0) / stat.scores.length
        : 0;
    return {
      issue: stat.name,
      engagement: stat.count,
      avgPosition: Math.round(avg * 100) / 100,
    };
  });

  const candidateSummary = election.candidates.map((c) => ({
    name: c.name,
    party: c.party,
    positionCount: c.positions.length,
    positions: c.positions.map((p) => ({
      issue: p.issue.displayNameEn,
      score: p.positionScore,
      confidence: p.confidence,
    })),
  }));

  const prompt = `Generate a consulting-grade election analysis report based on the following aggregated voter data.

Election: ${election.name}
Total voter sessions: ${sessionCount}
Total issue responses: ${answers.length}

VOTER ISSUE PRIORITIES (sorted by engagement):
${issueSummary
  .sort((a, b) => b.engagement - a.engagement)
  .map((i) => `- ${i.issue}: ${i.engagement} responses, avg position: ${i.avgPosition}`)
  .join("\n")}

CANDIDATE PROFILES:
${candidateSummary
  .map(
    (c) =>
      `${c.name} (${c.party}): ${c.positionCount} positions
${c.positions.map((p) => `  - ${p.issue}: score ${p.score}, confidence: ${p.confidence}`).join("\n")}`
  )
  .join("\n\n")}

Generate a JSON object with these sections:
{
  "executive_summary": "2-3 paragraph overview of the competitive landscape",
  "key_findings": ["finding1", "finding2", ...],
  "candidate_assessments": [
    {
      "candidate_name": "...",
      "strengths": ["..."],
      "vulnerabilities": ["..."],
      "strategic_recommendation": "..."
    }
  ],
  "swing_issues": ["issues where voter opinion is closely divided"],
  "turnout_drivers": ["issues with highest engagement that could motivate turnout"]
}

Be specific and data-driven. Reference actual numbers from the data. Output ONLY the JSON.`;

  const model = getGeminiModel({
    systemInstruction:
      "You are a political analytics consultant. Generate data-driven, neutral analysis reports. Be specific, reference numbers, and avoid partisan language.",
  });

  const response = await model.generateContent(prompt);
  const text = response.response.text();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Analytics report response does not contain valid JSON");
  }

  const report = JSON.parse(jsonMatch[0]);

  return NextResponse.json({
    electionId,
    electionName: election.name,
    generatedAt: new Date().toISOString(),
    voterSessions: sessionCount,
    report,
  });
}
