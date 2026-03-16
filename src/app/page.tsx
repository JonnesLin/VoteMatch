"use client";

import Link from "next/link";
import { useT } from "@/i18n/provider";

export default function Home() {
  const { t } = useT();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col items-center gap-8 px-6 py-24 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          {t("landing.title")}
        </h1>
        <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          {t("landing.tagline")}
        </p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/quiz"
            className="rounded-full bg-zinc-900 px-8 py-3 text-base font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {t("landing.getStarted")}
          </Link>
        </div>
      </main>
    </div>
  );
}
