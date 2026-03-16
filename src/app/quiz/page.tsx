"use client";

import { useState } from "react";

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
  const [zip, setZip] = useState("");
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

    if (!/^\d{5}$/.test(zip)) {
      setZipError("Please enter a valid 5-digit zip code.");
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
          Find Your Election
        </h1>
        <p className="mb-8 text-zinc-500 dark:text-zinc-400">
          Enter your zip code to see elections in your area.
        </p>

        {/* Step 1: Zip Code */}
        <form onSubmit={handleZipSubmit} className="mb-8">
          <div className="flex gap-3">
            <input
              type="text"
              inputMode="numeric"
              maxLength={5}
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
              placeholder="e.g. 53703"
              className="flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-3 text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400"
            />
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {loading && !selectedElection ? "Searching..." : "Search"}
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
              No elections found for zip code{" "}
              <span className="font-medium text-zinc-900 dark:text-zinc-50">
                {zip}
              </span>
              . Try a different zip code.
            </p>
          </div>
        )}

        {elections !== null && elections.length > 0 && (
          <div className="mb-8">
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Elections in your area
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
            Loading candidates...
          </p>
        )}

        {candidates !== null && candidates.length > 0 && selectedElection && (
          <div>
            <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Candidates
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
                      {candidate.party ?? "Independent"}
                      {candidate.incumbent && " · Incumbent"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <a
              href={`/quiz/${selectedElection.id}`}
              className="inline-block w-full rounded-lg bg-zinc-900 py-3 text-center font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Start Quiz
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
