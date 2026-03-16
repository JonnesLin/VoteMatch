"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Question = {
  id: string;
  issueId: string;
  issueName: string;
  questionText: string;
  positiveDirection: string;
  background: string;
  displayOrder: number;
};

type AnswerOption =
  | "strongly_agree"
  | "agree"
  | "neutral"
  | "disagree"
  | "strongly_disagree"
  | "not_interested";

const ANSWER_OPTIONS: { value: AnswerOption; label: string }[] = [
  { value: "strongly_agree", label: "Strongly Agree" },
  { value: "agree", label: "Agree" },
  { value: "neutral", label: "Neutral" },
  { value: "disagree", label: "Disagree" },
  { value: "strongly_disagree", label: "Strongly Disagree" },
  { value: "not_interested", label: "Not Interested" },
];

type MatchCandidate = {
  candidateId: string;
  name: string;
  party: string | null;
  matchPercentage: number;
  issueBreakdown: {
    issueId: string;
    userScore: number;
    candidateScore: number;
    similarity: number;
    weight: number;
  }[];
};

type MatchResult = {
  sessionId: string;
  candidates: MatchCandidate[];
};

export default function QuizQuestionsPage() {
  const params = useParams<{ electionId: string }>();
  const router = useRouter();
  const electionId = params.electionId;

  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerOption>>({});
  const [expandedBg, setExpandedBg] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<MatchResult | null>(null);

  useEffect(() => {
    async function fetchQuestions() {
      const res = await fetch(`/api/elections/${electionId}/questions`);
      if (!res.ok) {
        setError("Election not found.");
        setLoading(false);
        return;
      }
      const data: Question[] = await res.json();
      if (data.length === 0) {
        setError("No questions available for this election.");
        setLoading(false);
        return;
      }
      setQuestions(data);
      setLoading(false);
    }
    fetchQuestions();
  }, [electionId]);

  function selectAnswer(questionId: string, answer: AnswerOption) {
    setAnswers((prev) => ({ ...prev, [questionId]: answer }));
  }

  function goNext() {
    setExpandedBg(false);
    setCurrentIndex((i) => Math.min(i + 1, questions.length - 1));
  }

  function goPrev() {
    setExpandedBg(false);
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }

  async function handleSubmit() {
    setSubmitting(true);

    const answerPayload = questions.map((q) => ({
      question_id: q.id,
      answer: answers[q.id] ?? "not_interested",
    }));

    const res = await fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        election_id: electionId,
        answers: answerPayload,
      }),
    });

    if (!res.ok) {
      setError("Failed to calculate results. Please try again.");
      setSubmitting(false);
      return;
    }

    const data: MatchResult = await res.json();
    setResults(data);
    setSubmitting(false);
  }

  // --- Loading / Error states ---

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-500 dark:text-zinc-400">Loading questions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-black">
        <div className="text-center">
          <p className="mb-4 text-zinc-600 dark:text-zinc-400">{error}</p>
          <button
            onClick={() => router.push("/quiz")}
            className="rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Back to Elections
          </button>
        </div>
      </div>
    );
  }

  // --- Results view (inline until results page exists) ---

  if (results) {
    return (
      <div className="flex min-h-screen items-start justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
        <div className="w-full max-w-xl">
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Your Results
          </h1>
          <p className="mb-8 text-zinc-500 dark:text-zinc-400">
            Candidates whose policy positions are closest to yours.
          </p>
          <div className="space-y-4">
            {results.candidates.map((candidate, i) => (
              <div
                key={candidate.candidateId}
                className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                      {i + 1}. {candidate.name}
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {candidate.party ?? "Independent"}
                    </p>
                  </div>
                  <span className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                    {candidate.matchPercentage}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                  <div
                    className="h-full rounded-full bg-zinc-900 transition-all dark:bg-zinc-50"
                    style={{ width: `${candidate.matchPercentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => {
              setResults(null);
              setAnswers({});
              setCurrentIndex(0);
            }}
            className="mt-8 inline-block w-full rounded-lg border border-zinc-300 py-3 text-center font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            Retake Quiz
          </button>
        </div>
      </div>
    );
  }

  // --- Quiz view ---

  const question = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const isLast = currentIndex === questions.length - 1;
  const currentAnswer = answers[question.id] ?? null;

  return (
    <div className="flex min-h-screen items-start justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="w-full max-w-xl">
        {/* Progress */}
        <div className="mb-8">
          <div className="mb-2 flex justify-between text-sm text-zinc-500 dark:text-zinc-400">
            <span>
              Question {currentIndex + 1} of {questions.length}
            </span>
            <span>{answeredCount} answered</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className="h-full rounded-full bg-zinc-900 transition-all dark:bg-zinc-50"
              style={{
                width: `${((currentIndex + 1) / questions.length) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Issue tag */}
        <span className="mb-3 inline-block rounded-full bg-zinc-200 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {question.issueName}
        </span>

        {/* Question text */}
        <h2 className="mb-4 text-xl font-semibold leading-relaxed text-zinc-900 dark:text-zinc-50">
          {question.questionText}
        </h2>

        {/* Background (expandable) */}
        <div className="mb-6">
          <button
            onClick={() => setExpandedBg(!expandedBg)}
            className="flex items-center gap-1 text-sm text-zinc-500 transition-colors hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          >
            <svg
              className={`h-4 w-4 transition-transform ${expandedBg ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
            Background
          </button>
          {expandedBg && (
            <p className="mt-2 rounded-lg bg-zinc-100 p-4 text-sm leading-relaxed text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
              {question.background}
            </p>
          )}
        </div>

        {/* Answer options */}
        <div className="mb-8 space-y-2">
          {ANSWER_OPTIONS.map((option) => {
            const isSelected = currentAnswer === option.value;
            return (
              <button
                key={option.value}
                onClick={() => selectAnswer(question.id, option.value)}
                className={`w-full rounded-lg border px-4 py-3 text-left font-medium transition-colors ${
                  isSelected
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                    : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="flex-1 rounded-lg border border-zinc-300 py-3 text-center font-medium text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-800"
          >
            Previous
          </button>
          {isLast ? (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 rounded-lg bg-zinc-900 py-3 text-center font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {submitting ? "Calculating..." : "See Results"}
            </button>
          ) : (
            <button
              onClick={goNext}
              className="flex-1 rounded-lg bg-zinc-900 py-3 text-center font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
