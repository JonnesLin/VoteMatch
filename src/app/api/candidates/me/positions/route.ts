import { NextResponse } from "next/server";
import { authenticateRequest, getAuthenticatedCandidate } from "@/lib/auth";
import { calculateDivergence, selectTopIssues } from "@/lib/pipeline/question-generator";

/**
 * GET /api/candidates/me/positions
 * Returns the authenticated candidate's position data.
 *
 * PUT /api/candidates/me/positions
 * Update/add a position (marked as candidate_self_report).
 * Body: { issue_id, position_summary, position_score, notes? }
 */
export async function GET(request: Request) {
  let auth;
  try {
    auth = await authenticateRequest(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const candidate = await getAuthenticatedCandidate(auth.userId);
  if (!candidate) {
    return NextResponse.json(
      { error: "No claimed candidate profile found. Claim a profile first." },
      { status: 404 }
    );
  }

  const positions = candidate.positions.map((p) => ({
    id: p.id,
    issueId: p.issueId,
    issueName: p.issue.name,
    issueDisplayName: p.issue.displayNameEn,
    positionSummary: p.positionSummary,
    positionScore: p.positionScore,
    confidence: p.confidence,
    source: p.source,
    notes: p.notes,
    updatedAt: p.updatedAt,
  }));

  return NextResponse.json({
    candidateId: candidate.id,
    candidateName: candidate.name,
    positions,
  });
}

export async function PUT(request: Request) {
  let auth;
  try {
    auth = await authenticateRequest(request);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const candidate = await getAuthenticatedCandidate(auth.userId);
  if (!candidate) {
    return NextResponse.json(
      { error: "No claimed candidate profile found. Claim a profile first." },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body?.issue_id || !body?.position_summary || body?.position_score === undefined) {
    return NextResponse.json(
      { error: "issue_id, position_summary, and position_score are required" },
      { status: 400 }
    );
  }

  const { issue_id, position_summary, position_score, notes } = body as {
    issue_id: string;
    position_summary: string;
    position_score: number;
    notes?: string;
  };

  // Validate score range
  if (position_score < -2 || position_score > 2) {
    return NextResponse.json(
      { error: "position_score must be between -2.0 and +2.0" },
      { status: 400 }
    );
  }

  // Check for existing AI-extracted position to preserve
  const { prisma } = await import("@/lib/db");
  const existing = await prisma.candidatePosition.findUnique({
    where: {
      candidateId_issueId: {
        candidateId: candidate.id,
        issueId: issue_id,
      },
    },
  });

  // If overwriting an AI-extracted position, preserve original data
  const aiOriginalFields =
    existing && existing.source === "ai_extracted"
      ? {
          aiOriginalSummary: existing.positionSummary,
          aiOriginalScore: existing.positionScore,
          aiOriginalConfidence: existing.confidence,
        }
      : {};

  const position = await prisma.candidatePosition.upsert({
    where: {
      candidateId_issueId: {
        candidateId: candidate.id,
        issueId: issue_id,
      },
    },
    update: {
      positionSummary: position_summary,
      positionScore: position_score,
      source: "candidate_self_report",
      confidence: "high",
      notes: notes ?? null,
      ...aiOriginalFields,
    },
    create: {
      candidateId: candidate.id,
      issueId: issue_id,
      positionSummary: position_summary,
      positionScore: position_score,
      source: "candidate_self_report",
      confidence: "high",
      notes: notes ?? null,
    },
    include: { issue: true },
  });

  // Trigger question set regeneration (fire-and-forget)
  triggerRegeneration(candidate.election.id).catch((err) => {
    console.error("[Regeneration] Failed:", err);
  });

  return NextResponse.json({
    id: position.id,
    issueId: position.issueId,
    issueName: position.issue.name,
    positionSummary: position.positionSummary,
    positionScore: position.positionScore,
    source: position.source,
    notes: position.notes,
    aiOriginalSummary: position.aiOriginalSummary,
    aiOriginalScore: position.aiOriginalScore,
    regenerationTriggered: true,
  });
}

/**
 * Recalculates divergence after a position change.
 * If divergence landscape changed significantly, regenerates the QuestionSet.
 * Falls back to divergence-only check if LLM is unavailable.
 */
async function triggerRegeneration(electionId: string): Promise<void> {
  const { prisma } = await import("@/lib/db");

  const newDivergences = await calculateDivergence(electionId);
  const newSelected = selectTopIssues(newDivergences);

  // Get current question set's issue IDs
  const currentQS = await prisma.questionSet.findFirst({
    where: { electionId },
    orderBy: { generatedAt: "desc" },
    include: { questions: { select: { issueId: true } } },
  });

  if (!currentQS) {
    console.log("[Regeneration] No existing QuestionSet — skipping");
    return;
  }

  const currentIssueIds = new Set(currentQS.questions.map((q) => q.issueId));
  const newIssueIds = new Set(newSelected.map((s) => s.issueId));

  // Check if the top issues changed
  const added = [...newIssueIds].filter((id) => !currentIssueIds.has(id));
  const removed = [...currentIssueIds].filter((id) => !newIssueIds.has(id));

  if (added.length === 0 && removed.length === 0) {
    console.log("[Regeneration] Divergence landscape unchanged — no regeneration needed");
    return;
  }

  console.log(
    `[Regeneration] Divergence changed: +${added.length} issues, -${removed.length} issues. Attempting regeneration...`
  );

  // Try full LLM regeneration, fall back to logging if no API key
  try {
    const { generateQuestionsForElection } = await import("@/lib/pipeline/question-generator");
    await generateQuestionsForElection(electionId);
    console.log("[Regeneration] QuestionSet regenerated successfully");
  } catch (err) {
    console.warn("[Regeneration] LLM unavailable, regeneration deferred:", err);
  }
}
