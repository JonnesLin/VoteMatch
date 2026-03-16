"use client";

import { useState } from "react";
import { useT } from "@/i18n/provider";

type Election = {
  id: string;
  name: string;
  type: string;
  district: string;
  electionDate: string;
  status: string;
};

type Candidate = {
  id: string;
  name: string;
  party: string | null;
  incumbent: boolean;
  officialWebsite: string | null;
};

export default function QuizPage() {
  const { t } = useT();
  const [zip, setZip] = useState("");
  const [address, setAddress] = useState("");
  const [useAddress, setUseAddress] = useState(false);
  const [zipError, setZipError] = useState("");
  const [elections, setElections] = useState<Election[] | null>(null);
  const [selectedElection, setSelectedElection] = useState<Election | null>(
    null
  );
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleZipSubmit(e: React.FormEvent) {
    e.preventDefault();
    setZipError("");
    setElections(null);
    setSelectedElection(null);
    setCandidates(null);

    // GEO-001: Support address input in addition to zip code
    if (useAddress) {
      if (!address.trim()) {
        setZipError(t("district.addressError"));
        return;
      }
      setLoading(true);
      const res = await fetch(
        `/api/elections?address=${encodeURIComponent(address)}`
      );
      const data: Election[] = await res.json();
      setElections(data);
      setLoading(false);
      return;
    }

    if (!/^\d{5}$/.test(zip)) {
      setZipError(t("district.zipError"));
      return;
    }

    setLoading(true);
    const res = await fetch(`/api/elections?zip=${zip}`);
    const data: Election[] = await res.json();
    setElections(data);
    setLoading(false);
  }

  async function handleElectionSelect(election: Election) {
    setSelectedElection(election);
    setCandidates(null);
    setLoading(true);
    const res = await fetch(`/api/elections/${election.id}/candidates`);
    const data: Candidate[] = await res.json();
    setCandidates(data);
    setLoading(false);
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="w-full max-w-xl">
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          {t("district.title")}
        </h1>
        <p className="mb-8 text-zinc-500 dark:text-zinc-400">
          {t("district.subtitle")}
        </p>

        {/* Step 1: Zip Code or Address (GEO-001) */}
        <form onSubmit={handleZipSubmit} className="mb-8">
          <div className="mb-2 flex gap-4 text-sm">
            <button
              type="button"
              onClick={() => setUseAddress(false)}
              className={`pb-1 ${!useAddress ? "border-b-2 border-zinc-900 font-medium text-zinc-900 dark:border-zinc-50 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"}`}
            >
              {t("district.zipTab")}
            </button>
            <button
              type="button"
              onClick={() => setUseAddress(true)}
              className={`pb-1 ${useAddress ? "border-b-2 border-zinc-900 font-medium text-zinc-900 dark:border-zinc-50 dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"}`}
            >
              {t("district.addressTab")}
            </button>
          </div>
          <div className="flex gap-3">
            {useAddress ? (
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t("district.addressPlaceholder")}
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400"
              />
            ) : (
              <input
                type="text"
                inputMode="numeric"
                maxLength={5}
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
                placeholder={t("district.zipPlaceholder")}
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400"
              />
            )}
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading && !selectedElection
                ? t("district.searching")
                : t("district.search")}
            </button>
          </div>
          {zipError && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">
              {zipError}
            </p>
          )}
        </form>

        {/* Step 2: Election List */}
        {elections !== null && elections.length === 0 && (
          <div className="rounded-lg border border-zinc-200 bg-white p-6 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-600 dark:text-zinc-400">
              {t("district.noElections", { zip })}
            </p>
          </div>
        )}

        {elections !== null && elections.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {t("district.electionsTitle")}
            </h2>
            <div className="space-y-3">
              {elections.map((election) => {
                const isSelected = selectedElection?.id === election.id;
                return (
                  <button
                    key={election.id}
                    onClick={() => handleElectionSelect(election)}
                    className={`w-full rounded-lg border p-4 text-left transition-colors ${
                      isSelected
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                        : "border-zinc-200 bg-white hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
                    }`}
                  >
                    <p
                      className={`font-medium ${isSelected ? "" : "text-zinc-900 dark:text-zinc-50"}`}
                    >
                      {election.name}
                    </p>
                    <p
                      className={`mt-1 text-sm ${isSelected ? "opacity-80" : "text-zinc-500 dark:text-zinc-400"}`}
                    >
                      {formatDate(election.electionDate)} &middot;{" "}
                      {election.district}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Candidates */}
        {loading && selectedElection && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("district.loadingCandidates")}
          </p>
        )}

        {candidates !== null && candidates.length > 0 && selectedElection && (
          <div>
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              {t("district.candidatesTitle")}
            </h2>
            <div className="mb-6 space-y-3">
              {candidates.map((candidate) => (
                <div
                  key={candidate.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-zinc-50">
                      {candidate.name}
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {candidate.party ?? t("district.independent")}
                      {candidate.incumbent &&
                        ` · ${t("district.incumbent")}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <a
              href={`/quiz/${selectedElection.id}`}
              className="inline-block w-full rounded-lg bg-zinc-900 py-3 text-center font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {t("district.startQuiz")}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
