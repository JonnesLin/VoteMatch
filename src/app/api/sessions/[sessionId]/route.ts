import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ANSWER_SCORES, type AnswerOption } from "@/types/answers";
import { calculateMatch } from "@/lib/match-engine";
import { getCachedResults, cacheResults } from "@/lib/cache";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  // CACHE-002: Check Redis cache for shareable result URLs
  const cached = await getCachedResults(sessionId);
  if (cached) {
    return NextResponse.json(cached);
  }

  const session = await prisma.userSession.findUnique({
    where: { id: sessionId },
    include: {
      answers: {
        include: {
          question: {
            include: {
              issue: {
                select: {
                  id: true,
                  displayNameEn: true,
                  displayNameZh: true,
                },
              },
            },
          },
        },
      },
      election: { select: { id: true, name: true } },
    },
  });

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Build userAnswers map: issueId → numeric score
  const userAnswers: Record<string, number> = {};
  const userAnswerLabels: Record<string, string> = {};
  const issueNames: Record<string, { en: string; zh: string }> = {};

  for (const a of session.answers) {
    const score = ANSWER_SCORES[a.answer as AnswerOption];
    issueNames[a.question.issue.id] = {
      en: a.question.issue.displayNameEn,
      zh: a.question.issue.displayNameZh,
    };
    userAnswerLabels[a.question.issue.id] = a.answer;
    if (score === null) continue; // not_interested
    userAnswers[a.question.issue.id] = score;
  }

  // Fetch candidates + positions
  const candidates = await prisma.candidate.findMany({
    where: { electionId: session.electionId },
    select: {
      id: true,
      name: true,
      party: true,
      positions: {
        include: {
          issue: {
            select: {
              id: true,
              displayNameEn: true,
            },
          },
        },
      },
    },
  });

  // Collect all rawMaterialIds from supportingEvidence JSON across all candidates
  const allRawMaterialIds = new Set<string>();
  for (const candidate of candidates) {
    for (const p of candidate.positions) {
      const evidence = p.supportingEvidence as Array<{ rawMaterialId: string }> | null;
      if (Array.isArray(evidence)) {
        for (const ev of evidence) {
          if (ev.rawMaterialId) allRawMaterialIds.add(ev.rawMaterialId);
        }
      }
    }
  }

  // Batch-fetch RawMaterial records to get actual source URLs
  const rawMaterials = allRawMaterialIds.size > 0
    ? await prisma.rawMaterial.findMany({
        where: { id: { in: [...allRawMaterialIds] } },
        select: { id: true, sourceUrl: true, sourceType: true },
      })
    : [];
  const rawMaterialMap = new Map(rawMaterials.map((rm) => [rm.id, rm]));

  const results = candidates
    .map((candidate) => {
      const candidatePositions: Record<string, number> = {};
      const positionDetails: Record<
        string,
        {
          summary: string | null;
          score: number | null;
          confidence: string | null;
          source: string | null;
          supportingEvidence: Array<{
            relevantQuote: string;
            sourceUrl: string;
            sourceType: string;
          }> | null;
          aiOriginalSummary: string | null;
          aiOriginalScore: number | null;
          aiOriginalConfidence: string | null;
        }
      > = {};

      for (const p of candidate.positions) {
        if (p.positionScore !== null) {
          candidatePositions[p.issueId] = p.positionScore;
        }

        // Hydrate supportingEvidence JSON with actual source URLs
        const rawEvidence = p.supportingEvidence as Array<{
          rawMaterialId: string;
          relevantQuote: string;
        }> | null;
        const enrichedEvidence = Array.isArray(rawEvidence)
          ? rawEvidence
              .map((ev) => {
                const rm = rawMaterialMap.get(ev.rawMaterialId);
                if (!rm) return null;
                return {
                  relevantQuote: ev.relevantQuote,
                  sourceUrl: rm.sourceUrl,
                  sourceType: rm.sourceType,
                };
              })
              .filter((ev): ev is NonNullable<typeof ev> => ev !== null)
          : null;

        positionDetails[p.issueId] = {
          summary: p.positionSummary,
          score: p.positionScore,
          confidence: p.confidence,
          source: p.source,
          supportingEvidence: enrichedEvidence && enrichedEvidence.length > 0 ? enrichedEvidence : null,
          aiOriginalSummary: p.aiOriginalSummary,
          aiOriginalScore: p.aiOriginalScore,
          aiOriginalConfidence: p.aiOriginalConfidence,
        };
      }

      const { matchPercentage, issueBreakdown } = calculateMatch({
        userAnswers,
        candidatePositions,
      });

      // Enrich breakdown with issue names and position details
      const enrichedBreakdown = issueBreakdown.map((item) => ({
        ...item,
        issueName: issueNames[item.issueId]?.en ?? item.issueId,
        issueNameZh: issueNames[item.issueId]?.zh ?? "",
        userAnswer: userAnswerLabels[item.issueId] ?? "not_interested",
        candidatePosition: positionDetails[item.issueId] ?? null,
      }));

      // Add issues where candidate has no position but user answered
      const answeredIssueIds = Object.keys(userAnswers);
      for (const issueId of answeredIssueIds) {
        if (!candidatePositions[issueId] && candidatePositions[issueId] !== 0) {
          enrichedBreakdown.push({
            issueId,
            userScore: userAnswers[issueId],
            candidateScore: 0,
            similarity: 0,
            weight: 0,
            issueName: issueNames[issueId]?.en ?? issueId,
            issueNameZh: issueNames[issueId]?.zh ?? "",
            userAnswer: userAnswerLabels[issueId] ?? "not_interested",
            candidatePosition: positionDetails[issueId] ?? null,
          });
        }
      }

      return {
        candidateId: candidate.id,
        name: candidate.name,
        party: candidate.party,
        matchPercentage,
        issueBreakdown: enrichedBreakdown,
      };
    })
    .sort((a, b) => b.matchPercentage - a.matchPercentage);

  const responseData = {
    sessionId: session.id,
    electionId: session.electionId,
    electionName: session.election.name,
    createdAt: session.createdAt,
    candidates: results,
  };

  // CACHE-002: Store in Redis for shareable URLs
  await cacheResults(sessionId, responseData);

  return NextResponse.json(responseData);
}
