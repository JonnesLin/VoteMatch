"use client";

import { useState, useEffect } from "react";
import { useT } from "@/i18n/provider";

type Position = {
  id: string;
  issueId: string;
  issueName: string;
  issueDisplayName: string;
  positionSummary: string | null;
  positionScore: number | null;
  confidence: string | null;
  source: string | null;
  notes: string | null;
  updatedAt: string;
};

type DashboardData = {
  candidateId: string;
  candidateName: string;
  positions: Position[];
};

const SCORE_OPTIONS = [
  { value: -2, label: "Strongly Oppose" },
  { value: -1, label: "Oppose" },
  { value: 0, label: "Neutral" },
  { value: 1, label: "Support" },
  { value: 2, label: "Strongly Support" },
];

export default function DashboardPage() {
  const { t } = useT();
  const [token, setToken] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSummary, setEditSummary] = useState("");
  const [editScore, setEditScore] = useState(0);
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("votematch_token");
    if (saved) {
      setToken(saved);
      loadPositions(saved);
    }
  }, []);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password"),
      }),
    });
    const result = await res.json();
    if (!res.ok) {
      setError(result.error);
      return;
    }
    setToken(result.token);
    localStorage.setItem("votematch_token", result.token);
    loadPositions(result.token);
  }

  async function loadPositions(authToken: string) {
    const res = await fetch("/api/candidates/me/positions", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    const result = await res.json();
    if (!res.ok) {
      setError(result.error);
      return;
    }
    setData(result);
  }

  async function savePosition(issueId: string) {
    setError("");
    const res = await fetch("/api/candidates/me/positions", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        issue_id: issueId,
        position_summary: editSummary,
        position_score: editScore,
        notes: editNotes || undefined,
      }),
    });
    const result = await res.json();
    if (!res.ok) {
      setError(result.error);
      return;
    }
    setEditingId(null);
    loadPositions(token);
  }

  function startEdit(pos: Position) {
    setEditingId(pos.issueId);
    setEditSummary(pos.positionSummary || "");
    setEditScore(pos.positionScore || 0);
    setEditNotes(pos.notes || "");
  }

  function sourceTag(source: string | null) {
    if (source === "candidate_self_report") {
      return (
        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900 dark:text-blue-300">
          {t("candidate.sourceSelf")}
        </span>
      );
    }
    return (
      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
        {t("candidate.sourceAI")}
      </span>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-start justify-center bg-zinc-50 px-4 py-12 dark:bg-black sm:py-16">
        <div className="w-full max-w-md">
          <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
            {t("candidate.dashboardTitle")}
          </h1>
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}
          <form onSubmit={handleLogin} className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {t("candidate.loginTitle")}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {t("candidate.email")}
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {t("candidate.password")}
                </label>
                <input
                  type="password"
                  name="password"
                  required
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-lg bg-zinc-900 py-2.5 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {t("candidate.login")}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-zinc-50 px-4 py-12 dark:bg-black sm:py-16">
      <div className="w-full max-w-2xl">
        <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {t("candidate.dashboardTitle")}
        </h1>
        {data && (
          <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
            {data.candidateName}
          </p>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {t("candidate.positionsTitle")}
        </h2>

        {data && data.positions.length === 0 && (
          <p className="text-zinc-500 dark:text-zinc-400">{t("candidate.noPositions")}</p>
        )}

        <div className="space-y-3">
          {data?.positions.map((pos) => (
            <div
              key={pos.issueId}
              className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              {editingId === pos.issueId ? (
                <div className="space-y-3">
                  <p className="font-medium text-zinc-900 dark:text-zinc-50">
                    {pos.issueDisplayName}
                  </p>
                  <textarea
                    value={editSummary}
                    onChange={(e) => setEditSummary(e.target.value)}
                    rows={2}
                    placeholder="Position summary"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                  <select
                    value={editScore}
                    onChange={(e) => setEditScore(Number(e.target.value))}
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  >
                    {SCORE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <input
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Notes (optional)"
                    className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => savePosition(pos.issueId)}
                      className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
                    >
                      {t("candidate.savePosition")}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      {t("candidate.cancel")}
                    </button>
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    {t("candidate.contradictionNote")}
                  </p>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">
                        {pos.issueDisplayName}
                      </p>
                      {sourceTag(pos.source)}
                      {pos.confidence && (
                        <span className="text-xs text-zinc-400 dark:text-zinc-500">
                          {pos.confidence}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {pos.positionSummary || "No position summary"}
                    </p>
                    {pos.notes && (
                      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                        {pos.notes}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => startEdit(pos)}
                    className="ml-3 shrink-0 text-sm text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {t("candidate.editPosition")}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
