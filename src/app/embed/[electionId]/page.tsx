"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

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

const ANSWER_KEYS: AnswerOption[] = [
  "strongly_agree",
  "agree",
  "neutral",
  "disagree",
  "strongly_disagree",
  "not_interested",
];

const ANSWER_LABELS: Record<AnswerOption, string> = {
  strongly_agree: "Strongly Agree",
  agree: "Agree",
  neutral: "Neutral",
  disagree: "Disagree",
  strongly_disagree: "Strongly Disagree",
  not_interested: "Not Interested",
};

type MatchResult = {
  candidateId: string;
  name: string;
  party: string | null;
  matchPercentage: number;
};

/**
 * Embeddable quiz widget — minimal chrome, customizable styling.
 * URL params: ?theme=light|dark&primaryColor=#hex&hideFooter=true&domain=example.com
 */
export default function EmbedQuizPage() {
  return (
    <Suspense>
      <EmbedQuizPageInner />
    </Suspense>
  );
}

function EmbedQuizPageInner() {
  const { electionId } = useParams<{ electionId: string }>();
  const searchParams = useSearchParams();

  const theme = searchParams.get("theme") || "light";
  const primaryColor = searchParams.get("primaryColor") || "#000000";
  const hideFooter = searchParams.get("hideFooter") === "true";
  const allowedDomain = searchParams.get("domain");

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerOption>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [domainBlocked] = useState(() => {
    if (typeof window === "undefined" || !allowedDomain) return false;
    const parentOrigin = document.referrer
      ? new URL(document.referrer).hostname
      : window.location.hostname;
    return (
      parentOrigin !== allowedDomain &&
      parentOrigin !== "localhost" &&
      parentOrigin !== window.location.hostname
    );
  });

  useEffect(() => {
    fetch(`/api/elections/${electionId}/questions`)
      .then((r) => r.json())
      .then((data) => {
        setQuestions(data.questions || data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [electionId]);

  async function submitAnswers() {
    setSubmitting(true);
    const formattedAnswers = questions.map((q) => ({
      question_id: q.id,
      answer: answers[q.id] || "not_interested",
    }));

    const res = await fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ election_id: electionId, answers: formattedAnswers }),
    });
    const data = await res.json();
    setResults(data.results || []);
    setSubmitting(false);
  }

  const isDark = theme === "dark";
  const bgColor = isDark ? "#111" : "#fafafa";
  const textColor = isDark ? "#f5f5f5" : "#18181b";
  const mutedColor = isDark ? "#a1a1aa" : "#71717a";
  const cardBg = isDark ? "#1c1c1e" : "#ffffff";
  const borderColor = isDark ? "#27272a" : "#e4e4e7";

  if (domainBlocked) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#ef4444", fontFamily: "system-ui" }}>
        This embed is not authorized for this domain.
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: mutedColor, fontFamily: "system-ui" }}>
        Loading...
      </div>
    );
  }

  if (results) {
    return (
      <div
        style={{
          padding: 16,
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: bgColor,
          color: textColor,
          minHeight: "100vh",
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Your Results</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {results.map((r, i) => (
            <div
              key={r.candidateId}
              style={{
                padding: 12,
                background: cardBg,
                border: `1px solid ${borderColor}`,
                borderRadius: 8,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span
                    style={{
                      display: "inline-flex",
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: isDark ? "#27272a" : "#f4f4f5",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      marginRight: 8,
                    }}
                  >
                    {i + 1}
                  </span>
                  <strong>{r.name}</strong>
                  <span style={{ color: mutedColor, marginLeft: 8, fontSize: 14 }}>
                    {r.party || "Independent"}
                  </span>
                </div>
                <strong style={{ fontSize: 20 }}>{r.matchPercentage}%</strong>
              </div>
              <div
                style={{
                  marginTop: 8,
                  height: 6,
                  background: isDark ? "#27272a" : "#e4e4e7",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${r.matchPercentage}%`,
                    background: primaryColor,
                    borderRadius: 3,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
        {!hideFooter && (
          <p style={{ textAlign: "center", fontSize: 12, color: mutedColor, marginTop: 16 }}>
            Powered by VoteMatch
          </p>
        )}
      </div>
    );
  }

  const q = questions[currentIdx];
  if (!q) return null;

  return (
    <div
      style={{
        padding: 16,
        fontFamily: "system-ui, -apple-system, sans-serif",
        background: bgColor,
        color: textColor,
        minHeight: "100vh",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: mutedColor }}>
          Question {currentIdx + 1} of {questions.length}
        </span>
        <span style={{ fontSize: 13, color: mutedColor }}>
          {Object.keys(answers).length} answered
        </span>
      </div>

      <div
        style={{
          height: 4,
          background: isDark ? "#27272a" : "#e4e4e7",
          borderRadius: 2,
          marginBottom: 16,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${((currentIdx + 1) / questions.length) * 100}%`,
            background: primaryColor,
            borderRadius: 2,
            transition: "width 0.3s",
          }}
        />
      </div>

      <p style={{ fontSize: 12, color: mutedColor, marginBottom: 4 }}>{q.issueName}</p>
      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, lineHeight: 1.4 }}>
        {q.questionText}
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {ANSWER_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: key }))}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: `1px solid ${answers[q.id] === key ? primaryColor : borderColor}`,
              background: answers[q.id] === key ? (isDark ? "#27272a" : "#f4f4f5") : cardBg,
              color: textColor,
              textAlign: "left",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: answers[q.id] === key ? 600 : 400,
            }}
          >
            {ANSWER_LABELS[key]}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        {currentIdx > 0 && (
          <button
            onClick={() => setCurrentIdx((i) => i - 1)}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 8,
              border: `1px solid ${borderColor}`,
              background: cardBg,
              color: textColor,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Previous
          </button>
        )}
        {currentIdx < questions.length - 1 ? (
          <button
            onClick={() => setCurrentIdx((i) => i + 1)}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 8,
              border: "none",
              background: primaryColor,
              color: "#ffffff",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Next
          </button>
        ) : (
          <button
            onClick={submitAnswers}
            disabled={submitting}
            style={{
              flex: 1,
              padding: "10px 0",
              borderRadius: 8,
              border: "none",
              background: primaryColor,
              color: "#ffffff",
              cursor: submitting ? "wait" : "pointer",
              fontSize: 14,
              fontWeight: 600,
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Calculating..." : "See Results"}
          </button>
        )}
      </div>

      {!hideFooter && (
        <p style={{ textAlign: "center", fontSize: 12, color: mutedColor, marginTop: 16 }}>
          Powered by VoteMatch
        </p>
      )}
    </div>
  );
}
