"use client";

import { useState } from "react";
import Link from "next/link";

type CandidatePosition = {
  summary: string | null;
  score: number | null;
  confidence: string | null;
  source: string | null;
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

const ANSWER_LABELS: Record<string, string> = {
  strongly_agree: "Strongly Agree",
  agree: "Agree",
  neutral: "Neutral",
  disagree: "Disagree",
  strongly_disagree: "Strongly Disagree",
  not_interested: "Not Interested",
};

function scoreToLabel(score: number | null): string {
  if (score === null) return "No position";
  if (score >= 1.5) return "Strongly Support";
  if (score >= 0.5) return "Support";
  if (score > -0.5) return "Neutral";
  if (score > -1.5) return "Oppose";
  return "Strongly Oppose";
}

function sourceLabel(source: string | null): string {
  if (!source) return "";
  const labels: Record<string, string> = {
    ai_extracted: "Public Record",
    candidate_self_report: "Candidate Statement",
    official_website: "Official Website",
    voting_record: "Voting Record",
  };
  return labels[source] ?? source;
}

function similarityColor(similarity: number): string {
  if (similarity >= 0.75) return "bg-emerald-500";
  if (similarity >= 0.5) return "bg-yellow-500";
  if (similarity >= 0.25) return "bg-orange-500";
  return "bg-red-500";
}

export function ResultsClient({ data }: { data: SessionResult }) {
  const [expandedCandidate, setExpandedCandidate] = useState<string | null>(
    null
  );

  return (
    <div className="flex min-h-screen items-start justify-center bg-zinc-50 px-4 py-12 dark:bg-black sm:py-16">
      <div className="w-full max-w-2xl">
        <h1 className="mb-1 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Your Results
        </h1>
        <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">
          {data.electionName}
        </p>
        <p className="mb-8 text-zinc-500 dark:text-zinc-400">
          Candidates whose policy positions are closest to yours.
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
                      {candidate.party ?? "Independent"}
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
                        Issue-by-Issue Comparison
                      </h3>
                      <div className="space-y-3">
                        {candidate.issueBreakdown.map((item) => (
                          <div
                            key={item.issueId}
                            className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-950"
                          >
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                                {item.issueName}
                              </span>
                              <span
                                className={`inline-block h-2 w-2 rounded-full ${similarityColor(item.similarity)}`}
                                title={`${Math.round(item.similarity * 100)}% match`}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="mb-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                                  Your Position
                                </p>
                                <p className="font-medium text-zinc-700 dark:text-zinc-300">
                                  {ANSWER_LABELS[item.userAnswer] ??
                                    item.userAnswer}
                                </p>
                              </div>

                              <div>
                                <p className="mb-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                                  {candidate.name.split(" ")[0]}&apos;s
                                  Position
                                </p>
                                {item.candidatePosition ? (
                                  <>
                                    <p className="font-medium text-zinc-700 dark:text-zinc-300">
                                      {item.candidatePosition.summary ??
                                        scoreToLabel(
                                          item.candidatePosition.score
                                        )}
                                    </p>
                                    {item.candidatePosition.source && (
                                      <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                                        Source:{" "}
                                        {sourceLabel(
                                          item.candidatePosition.source
                                        )}
                                      </p>
                                    )}
                                    {item.candidatePosition.confidence && (
                                      <p className="text-xs text-zinc-400 dark:text-zinc-500">
                                        Confidence:{" "}
                                        {item.candidatePosition.confidence}
                                      </p>
                                    )}
                                  </>
                                ) : (
                                  <p className="italic text-zinc-400 dark:text-zinc-500">
                                    No public position found
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
            Retake Quiz
          </Link>
          <Link
            href="/quiz"
            className="flex-1 rounded-lg border border-zinc-300 py-3 text-center font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            Try Different Election
          </Link>
        </div>
      </div>
    </div>
  );
}
