/**
 * URL Verifier — Intermediate validation step.
 *
 * Programmatically visits each source_url in RawMaterial records:
 * 1. Confirms HTTP 200 → sets url_verified = true/false
 * 2. Checks if raw_text exists on the page → sets content_verified = true/false
 * Failed verifications are excluded from analyzer input.
 */

import { prisma } from "../db";
import type { VerificationResult } from "./types";

const FETCH_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(
  url: string,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; VoteMatch/1.0; +https://votematch.org)",
      },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Normalizes text for fuzzy content matching.
 * Strips HTML tags, collapses whitespace, lowercases.
 */
function normalizeText(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

/**
 * Checks if a significant portion of rawText appears in the page content.
 * Uses a sliding window of keywords rather than exact match,
 * since page content may have changed slightly.
 */
function contentContainsText(
  pageContent: string,
  rawText: string
): boolean {
  const normalizedPage = normalizeText(pageContent);
  const normalizedRaw = normalizeText(rawText);

  // Extract significant words (4+ chars) from raw text
  const keywords = normalizedRaw
    .split(/\s+/)
    .filter((w) => w.length >= 4);

  if (keywords.length === 0) return false;

  // Require at least 60% of keywords to appear on page
  const threshold = Math.ceil(keywords.length * 0.6);
  let found = 0;
  for (const keyword of keywords) {
    if (normalizedPage.includes(keyword)) found++;
  }

  return found >= threshold;
}

/**
 * Verifies a single RawMaterial record.
 */
export async function verifySingle(
  rawMaterialId: string
): Promise<VerificationResult> {
  const record = await prisma.rawMaterial.findUniqueOrThrow({
    where: { id: rawMaterialId },
  });

  const result: VerificationResult = {
    rawMaterialId,
    sourceUrl: record.sourceUrl,
    urlVerified: false,
    contentVerified: false,
  };

  try {
    const response = await fetchWithTimeout(record.sourceUrl, FETCH_TIMEOUT_MS);

    if (response.ok) {
      result.urlVerified = true;

      // Check content
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/html") || contentType.includes("text/plain")) {
        const body = await response.text();
        result.contentVerified = contentContainsText(body, record.rawText);
        if (!result.contentVerified) {
          result.failureReason = "Content not found on page";
        }
      } else {
        // Non-text content (PDF, etc.) — mark content as unverifiable but URL is valid
        result.contentVerified = false;
        result.failureReason = `Non-text content type: ${contentType}`;
      }
    } else {
      result.failureReason = `HTTP ${response.status}`;
    }
  } catch (err) {
    result.failureReason =
      err instanceof Error ? err.message : "Unknown fetch error";
  }

  // Persist verification results
  await prisma.rawMaterial.update({
    where: { id: rawMaterialId },
    data: {
      urlVerified: result.urlVerified,
      contentVerified: result.contentVerified,
    },
  });

  return result;
}

/**
 * Verifies all unverified RawMaterial records for a candidate.
 * Runs verifications sequentially to avoid rate limiting.
 */
export async function verifyAllForCandidate(
  candidateId: string
): Promise<VerificationResult[]> {
  const records = await prisma.rawMaterial.findMany({
    where: {
      candidateId,
      urlVerified: false,
    },
    select: { id: true },
  });

  const results: VerificationResult[] = [];
  for (const record of records) {
    results.push(await verifySingle(record.id));
  }
  return results;
}
