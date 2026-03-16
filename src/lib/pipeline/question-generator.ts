/**
 * Question Generation Engine — TECH_SPEC §4
 *
 * Generates voter-facing quiz questions for an election by:
 * 1. Calculating divergence scores per issue across candidates
 * 2. Selecting top 8-15 most divergent issues
 * 3. Calling Claude to generate plain-language questions
 * 4. Storing as QuestionSet linked to the election
 */

import { getClaude } from "../claude";
import { prisma } from "../db";

const MIN_QUESTIONS = 8;
const MAX_QUESTIONS = 15;

// --- Step 1: Divergence calculation ---

export interface IssueDivergence {
  issueId: string;
  issueName: string;
  displayNameEn: string;
  divergence: number;
  candidatePositions: Array<{
    candidateName: string;
    positionScore: number;
    positionSummary: string | null;
  }>;
}

export async function calculateDivergence(
  electionId: string
): Promise<IssueDivergence[]> {
  const election = await prisma.election.findUniqueOrThrow({
    where: { id: electionId },
    include: {
      candidates: {
        include: {
          positions: {
            include: { issue: true },
          },
        },
      },
    },
  });

  // Group positions by issue
  const issueMap = new Map<
    string,
    {
      issueId: string;
      issueName: string;
      displayNameEn: string;
      positions: Array<{
        candidateName: string;
        positionScore: number;
        positionSummary: string | null;
      }>;
    }
  >();

  for (const candidate of election.candidates) {
    for (const position of candidate.positions) {
      if (position.positionScore === null) continue;

      if (!issueMap.has(position.issueId)) {
        issueMap.set(position.issueId, {
          issueId: position.issueId,
          issueName: position.issue.name,
          displayNameEn: position.issue.displayNameEn,
          positions: [],
        });
      }

      issueMap.get(position.issueId)!.positions.push({
        candidateName: candidate.name,
        positionScore: position.positionScore,
        positionSummary: position.positionSummary,
      });
    }
  }

  // Calculate divergence = max(scores) - min(scores) per issue
  const divergences: IssueDivergence[] = [];
  for (const [, data] of issueMap) {
    if (data.positions.length < 2) continue; // Need at least 2 candidates with positions

    const scores = data.positions.map((p) => p.positionScore);
    const divergence = Math.max(...scores) - Math.min(...scores);

    divergences.push({
      issueId: data.issueId,
      issueName: data.issueName,
      displayNameEn: data.displayNameEn,
      divergence,
      candidatePositions: data.positions,
    });
  }

  // Sort by divergence descending
  divergences.sort((a, b) => b.divergence - a.divergence);

  return divergences;
}

// --- Step 2: Select top issues ---

export function selectTopIssues(
  divergences: IssueDivergence[]
): IssueDivergence[] {
  const count = Math.min(
    MAX_QUESTIONS,
    Math.max(MIN_QUESTIONS, divergences.length)
  );
  return divergences.slice(0, count);
}

// --- Step 3: Generate questions via LLM ---

interface GeneratedQuestion {
  issueId: string;
  questionText: string;
  positiveDirection: string;
  background: string;
}

const QUESTION_GEN_SYSTEM_PROMPT = `You are a question writer for a voter information tool. Your job is to create clear, neutral questions that help voters express their policy preferences.

RULES:
- Use everyday language a 6th-grader can understand
- No political jargon or technical terms
- One question asks about one thing only
- Wording must be completely neutral — no leading
- Background must be 2-3 sentences, also in plain language
- Define clear positive_direction (what "agree" means)`;

function buildQuestionGenPrompt(issues: IssueDivergence[]): string {
  const issueDescriptions = issues
    .map(
      (issue) =>
        `Issue: ${issue.displayNameEn} (ID: ${issue.issueId})
Candidate positions:
${issue.candidatePositions.map((p) => `  - ${p.candidateName}: ${p.positionSummary} (score: ${p.positionScore})`).join("\n")}`
    )
    .join("\n\n");

  return `Generate one voter-facing question for each of the following policy issues. These questions will be shown to regular voters in a quiz format.

${issueDescriptions}

For each issue, output a JSON array of objects with:
- issue_id: string (use the exact ID provided)
- question_text: string (the voter question — plain language, neutral)
- positive_direction: string (what "Agree" means for this question)
- background: string (2-3 sentence context in plain language)

IMPORTANT:
- Questions must be answerable on a Strongly Agree ↔ Strongly Disagree scale
- Do NOT mention specific candidates by name
- Do NOT use words like "should" in a leading way — phrase as factual policy choices
- Each question must pass a 6th-grade reading level check

Output ONLY the JSON array.`;
}

function parseQuestionGenResponse(
  text: string,
  validIssueIds: Set<string>
): GeneratedQuestion[] {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Question generator response does not contain a JSON array");
  }

  const raw = JSON.parse(jsonMatch[0]) as Array<{
    issue_id: string;
    question_text: string;
    positive_direction: string;
    background: string;
  }>;

  return raw
    .filter((q) => {
      if (!validIssueIds.has(q.issue_id)) {
        console.warn(`Question gen returned unknown issue_id "${q.issue_id}" — skipping`);
        return false;
      }
      return true;
    })
    .map((q) => ({
      issueId: q.issue_id,
      questionText: q.question_text,
      positiveDirection: q.positive_direction,
      background: q.background,
    }));
}

export async function generateQuestions(
  issues: IssueDivergence[]
): Promise<GeneratedQuestion[]> {
  if (issues.length === 0) return [];

  const response = await getClaude().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: QUESTION_GEN_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildQuestionGenPrompt(issues),
      },
    ],
  });

  const textBlocks = response.content.filter((b) => b.type === "text");
  const fullText = textBlocks.map((b) => b.text).join("\n");

  const validIssueIds = new Set(issues.map((i) => i.issueId));
  return parseQuestionGenResponse(fullText, validIssueIds);
}

// --- Step 4: Persist as QuestionSet ---

export async function persistQuestionSet(
  electionId: string,
  questions: GeneratedQuestion[]
): Promise<{ questionSetId: string; questionsCreated: number }> {
  const questionSet = await prisma.questionSet.create({
    data: { electionId },
  });

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    await prisma.question.create({
      data: {
        questionSetId: questionSet.id,
        issueId: q.issueId,
        questionText: q.questionText,
        positiveDirection: q.positiveDirection,
        background: q.background,
        displayOrder: i + 1,
      },
    });
  }

  return { questionSetId: questionSet.id, questionsCreated: questions.length };
}

// --- Full question generation flow ---

export async function generateQuestionsForElection(
  electionId: string
): Promise<{ questionSetId: string; questionsCreated: number }> {
  console.log("[QuestionGen] Calculating divergence scores...");
  const divergences = await calculateDivergence(electionId);
  console.log(
    `[QuestionGen] Found ${divergences.length} issues with divergence`
  );

  const selectedIssues = selectTopIssues(divergences);
  console.log(
    `[QuestionGen] Selected ${selectedIssues.length} issues (divergence range: ${selectedIssues[0]?.divergence.toFixed(1)} - ${selectedIssues[selectedIssues.length - 1]?.divergence.toFixed(1)})`
  );

  console.log("[QuestionGen] Generating questions via LLM...");
  const questions = await generateQuestions(selectedIssues);
  console.log(`[QuestionGen] Generated ${questions.length} questions`);

  const result = await persistQuestionSet(electionId, questions);
  console.log(
    `[QuestionGen] Saved QuestionSet ${result.questionSetId} with ${result.questionsCreated} questions`
  );

  return result;
}
