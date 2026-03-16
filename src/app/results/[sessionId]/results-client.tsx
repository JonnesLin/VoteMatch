"use client";

import { useState } from "react";
import Link from "next/link";
import { useT } from "@/i18n/provider";

type SupportingEvidenceItem = {
  relevantQuote: string;
  sourceUrl: string;
  sourceType: string;
};

type CandidatePosition = {
  summary: string | null;
  summaryZh: string | null;
  score: number | null;
  confidence: string | null;
  source: string | null;
  supportingEvidence?: SupportingEvidenceItem[] | null;
  aiOriginalSummary?: string | null;
  aiOriginalScore?: number | null;
  aiOriginalConfidence?: string | null;
};

type IssueBreakdownItem = {
  issueId: string;
  issueName: string;
  issueNameZh: string;
  userScore: number;
  candidateScore: number;
  similarity: number;
  weight: number;
  userAnswer: string;
  candidatePosition: CandidatePosition | null;
};

export type MatchCandidate = {
  candidateId: string;
  name: string;
  party: string | null;
  matchPercentage: number;
  issueBreakdown: IssueBreakdownItem[];
};

export type SessionResult = {
  sessionId: string;
  electionId: string;
  electionName: string;
  candidates: MatchCandidate[];
};

function scoreToLabel(
  score: number | null,
  t: (key: string) => string
): string {
  if (score === null) return t("score.noPosition");
  if (score >= 1.5) return t("score.stronglySupport");
  if (score >= 0.5) return t("score.support");
  if (score > -0.5) return t("score.neutral");
  if (score > -1.5) return t("score.oppose");
  return t("score.stronglyOppose");
}

function sourceLabel(
  source: string | null,
  t: (key: string) => string
): string {
  if (!source) return "";
  return t(`source.${source}`);
}

function similarityColor(similarity: number): string {
  if (similarity >= 0.75) return "bg-emerald-500";
  if (similarity >= 0.5) return "bg-yellow-500";
  if (similarity >= 0.25) return "bg-orange-500";
  return "bg-red-500";
}

function FeedbackWidget({
  sessionId,
  electionId,
}: {
  sessionId: string;
  electionId: string;
}) {
  const { t } = useT();
  const [rating, setRating] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function submitFeedback(r: number) {
    setRating(r);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating: r,
          session_id: sessionId,
          election_id: electionId,
        }),
      });
      setSubmitted(true);
    } catch {
      // Silently fail — feedback is best-effort
    }
  }

  if (submitted) {
    return (
      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        {t("feedback.thankYou")}
      </p>
    );
  }

  return (
    <div className="text-center">
      <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
        {t("feedback.prompt")}
      </p>
      <div className="flex justify-center gap-2">
        {[1, 2, 3, 4, 5].map((r) => (
          <button
            key={r}
            onClick={() => submitFeedback(r)}
            className={`h-10 w-10 rounded-full border text-sm font-medium transition-colors ${
              rating === r
                ? "border-blue-500 bg-blue-500 text-white"
                : "border-zinc-300 text-zinc-600 hover:border-blue-400 hover:bg-blue-50 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-blue-500 dark:hover:bg-zinc-800"
            }`}
            aria-label={`${t("feedback.rate")} ${r}`}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ResultsClient({ data }: { data: SessionResult }) {
  const { locale, t } = useT();
  const [expandedCandidate, setExpandedCandidate] = useState<string | null>(
    null
  );

  return (
    <div className="flex min-h-screen items-start justify-center bg-zinc-50 px-4 py-12 dark:bg-black sm:py-16">
      <div className="w-full max-w-2xl">
        <h1 className="mb-1 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {t("results.title")}
        </h1>
        <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">
          {data.electionName}
        </p>
        <p className="mb-8 text-zinc-500 dark:text-zinc-400">
          {t("results.subtitle")}
        </p>

        <div className="space-y-4">
          {data.candidates.map((candidate, i) => {
            const isExpanded = expandedCandidate === candidate.candidateId;

            return (
              <div
                key={candidate.candidateId}
                className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              >
                <button
                  onClick={() =>
                    setExpandedCandidate(
                      isExpanded ? null : candidate.candidateId
                    )
                  }
                  className="flex w-full items-center justify-between p-5 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {i + 1}
                      </span>
                      <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
                        {candidate.name}
                      </p>
                    </div>
                    <p className="ml-9 text-sm text-zinc-500 dark:text-zinc-400">
                      {candidate.party ?? t("results.independent")}
                    </p>
                  </div>
                  <div className="ml-4 flex items-center gap-3">
                    <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                      {candidate.matchPercentage}%
                    </span>
                    <svg
                      className={`h-5 w-5 shrink-0 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </button>

                <div className="px-5 pb-4">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                    <div
                      className="h-full rounded-full bg-zinc-900 transition-all dark:bg-zinc-50"
                      style={{ width: `${candidate.matchPercentage}%` }}
                    />
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-zinc-200 dark:border-zinc-800">
                    <div className="px-5 py-4">
                      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        {t("results.issueComparison")}
                      </h3>
                      <div className="space-y-3">
                        {candidate.issueBreakdown.map((item) => (
                          <div
                            key={item.issueId}
                            className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                                {locale === "zh" ? item.issueNameZh : item.issueName}
                              </span>
                              <span
                                className={`inline-block h-2 w-2 rounded-full ${similarityColor(item.similarity)}`}
                                title={t("results.matchPercent", {
                                  percent: Math.round(item.similarity * 100),
                                })}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="mb-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                                  {t("results.yourPosition")}
                                </p>
                                <p className="font-medium text-zinc-700 dark:text-zinc-300">
                                  {t(`answer.${item.userAnswer}`)}
                                </p>
                              </div>

                              <div>
                                <p className="mb-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                                  {t("results.candidatePosition", {
                                    name: candidate.name.split(" ")[0],
                                  })}
                                </p>
                                {item.candidatePosition ? (
                                  <>
                                    <p className="font-medium text-zinc-700 dark:text-zinc-300">
                                      {(locale === "zh"
                                        ? item.candidatePosition.summaryZh ?? item.candidatePosition.summary
                                        : item.candidatePosition.summary) ??
                                        scoreToLabel(
                                          item.candidatePosition.score,
                                          t
                                        )}
                                    </p>
                                    {item.candidatePosition.source && (
                                      <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                                        {t("results.source", { source: "" })}
                                        {item.candidatePosition.supportingEvidence &&
                                        item.candidatePosition.supportingEvidence.length > 0 ? (
                                          item.candidatePosition.supportingEvidence.map(
                                            (ev, idx) => (
                                              <span key={idx}>
                                                {idx > 0 && ", "}
                                                <a
                                                  href={ev.sourceUrl}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-blue-600 hover:underline dark:text-blue-400"
                                                >
                                                  {t(`source.${ev.sourceType}`)}
                                                </a>
                                              </span>
                                            )
                                          )
                                        ) : (
                                          sourceLabel(item.candidatePosition.source, t)
                                        )}
                                      </p>
                                    )}
                                    {item.candidatePosition.confidence && (
                                      <p className="text-xs text-zinc-400 dark:text-zinc-500">
                                        {t("results.confidence", {
                                          level:
                                            item.candidatePosition.confidence,
                                        })}
                                      </p>
                                    )}
                                    {item.candidatePosition.aiOriginalSummary && (
                                      <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 dark:border-amber-800 dark:bg-amber-950">
                                        <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                                          {t("source.ai_extracted")}:
                                        </p>
                                        <p className="text-xs text-amber-600 dark:text-amber-400">
                                          {item.candidatePosition.aiOriginalSummary}
                                        </p>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <p className="italic text-zinc-400 dark:text-zinc-500">
                                    {t("results.noPosition")}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="mt-2">
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                                <div
                                  className={`h-full rounded-full transition-all ${similarityColor(item.similarity)}`}
                                  style={{
                                    width: `${Math.round(item.similarity * 100)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/quiz/${data.electionId}`}
            className="flex-1 rounded-lg border border-zinc-300 py-3 text-center font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            {t("results.retakeQuiz")}
          </Link>
          <Link
            href="/quiz"
            className="flex-1 rounded-lg border border-zinc-300 py-3 text-center font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            {t("results.tryDifferent")}
          </Link>
        </div>

        <div className="mt-4 text-center">
          <Link
            href={`/candidate/claim?electionId=${data.electionId}`}
            className="text-sm text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
          >
            {t("candidate.claimProfile")}
          </Link>
        </div>

        <div className="mt-8 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <FeedbackWidget
            sessionId={data.sessionId}
            electionId={data.electionId}
          />
        </div>
      </div>
    </div>
  );
}
