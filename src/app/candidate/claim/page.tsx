"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useT } from "@/i18n/provider";

type Candidate = {
  id: string;
  name: string;
  party: string | null;
  incumbent: boolean;
};

export default function ClaimPage() {
  return (
    <Suspense>
      <ClaimPageInner />
    </Suspense>
  );
}

function ClaimPageInner() {
  const { t } = useT();
  const searchParams = useSearchParams();
  const electionId = searchParams.get("electionId");

  const [mode, setMode] = useState<"register" | "login">("register");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [verificationToken, setVerificationToken] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [step, setStep] = useState<"auth" | "verify" | "claim" | "done">("auth");
  const [error, setError] = useState("");
  const [claimMessage, setClaimMessage] = useState("");

  useEffect(() => {
    if (electionId) {
      fetch(`/api/elections/${electionId}/candidates`)
        .then((r) => r.json())
        .then((data) => setCandidates(data.candidates || data))
        .catch(() => {});
    }
  }, [electionId]);

  async function handleAuth() {
    setError("");
    const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      return;
    }

    setToken(data.token);
    if (mode === "register") {
      setVerificationToken(data.verificationToken || "");
      setStep("verify");
    } else {
      // Login — check if already verified
      setEmailVerified(data.user?.emailVerified ?? true);
      setStep(data.user?.emailVerified ? "claim" : "verify");
    }
  }

  async function handleVerify() {
    setError("");
    const res = await fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: verificationToken }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      return;
    }

    setEmailVerified(true);
    setStep("claim");
  }

  async function handleClaim(candidateId: string) {
    setError("");
    const res = await fetch("/api/candidates/claim", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ candidate_id: candidateId }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error);
      return;
    }

    setClaimMessage(data.message);
    setStep("done");
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-zinc-50 px-4 py-12 dark:bg-black sm:py-16">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {t("candidate.claimTitle")}
        </h1>
        <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
          {t("candidate.claimSubtitle")}
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        {step === "auth" && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {mode === "register" ? t("candidate.registerTitle") : t("candidate.loginTitle")}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {t("candidate.email")}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  {t("candidate.password")}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
                />
              </div>
              <button
                onClick={handleAuth}
                className="w-full rounded-lg bg-zinc-900 py-2.5 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {mode === "register" ? t("candidate.register") : t("candidate.login")}
              </button>
              <button
                onClick={() => setMode(mode === "register" ? "login" : "register")}
                className="w-full text-center text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                {mode === "register" ? t("candidate.switchToLogin") : t("candidate.switchToRegister")}
              </button>
            </div>
          </div>
        )}

        {step === "verify" && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {t("candidate.verifyEmail")}
            </h2>
            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
              {t("candidate.verificationSent")}
            </p>
            <div className="space-y-4">
              <input
                type="text"
                value={verificationToken}
                onChange={(e) => setVerificationToken(e.target.value)}
                placeholder="Verification token"
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50"
              />
              <button
                onClick={handleVerify}
                className="w-full rounded-lg bg-zinc-900 py-2.5 font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {t("candidate.verifyEmail")}
              </button>
            </div>
          </div>
        )}

        {step === "claim" && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            {emailVerified && (
              <p className="mb-4 text-sm text-emerald-600 dark:text-emerald-400">
                {t("candidate.verificationSuccess")}
              </p>
            )}
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              {t("candidate.selectCandidate")}
            </p>
            <div className="space-y-2">
              {candidates.map((c) => (
                <button
                  key={c.id}
                  onClick={() => handleClaim(c.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-zinc-200 p-3 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">{c.name}</p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {c.party ?? "Independent"}
                      {c.incumbent ? " · Incumbent" : ""}
                    </p>
                  </div>
                  <span className="text-sm text-blue-600 dark:text-blue-400">
                    {t("candidate.claimButton")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-800 dark:bg-emerald-950">
            <p className="font-medium text-emerald-700 dark:text-emerald-300">
              {claimMessage || t("candidate.claimPending")}
            </p>
            <Link
              href="/candidate/dashboard"
              className="mt-4 inline-block text-sm text-blue-600 hover:underline dark:text-blue-400"
            >
              {t("candidate.dashboardTitle")}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
