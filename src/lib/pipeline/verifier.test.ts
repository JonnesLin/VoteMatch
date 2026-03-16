import { describe, it, expect } from "vitest";

// Test the content matching logic directly by extracting it
// (We can't import the private function, so we replicate the logic for testing)

function normalizeText(text: string): string {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function contentContainsText(pageContent: string, rawText: string): boolean {
  const normalizedPage = normalizeText(pageContent);
  const normalizedRaw = normalizeText(rawText);

  const keywords = normalizedRaw.split(/\s+/).filter((w) => w.length >= 4);
  if (keywords.length === 0) return false;

  const threshold = Math.ceil(keywords.length * 0.6);
  let found = 0;
  for (const keyword of keywords) {
    if (normalizedPage.includes(keyword)) found++;
  }

  return found >= threshold;
}

describe("contentContainsText", () => {
  it("matches when raw text is present verbatim", () => {
    const page = "Sarah Chen supports expanding Medicaid and lowering drug costs.";
    const raw = "supports expanding Medicaid and lowering drug costs";
    expect(contentContainsText(page, raw)).toBe(true);
  });

  it("matches through HTML tags", () => {
    const page = "<p>Sarah Chen <b>supports expanding</b> Medicaid</p>";
    const raw = "supports expanding Medicaid";
    expect(contentContainsText(page, raw)).toBe(true);
  });

  it("matches case-insensitively", () => {
    const page = "SUPPORTS EXPANDING MEDICAID";
    const raw = "supports expanding medicaid";
    expect(contentContainsText(page, raw)).toBe(true);
  });

  it("fails when content is absent", () => {
    const page = "This page is about cooking recipes.";
    const raw = "supports expanding Medicaid and lowering drug costs";
    expect(contentContainsText(page, raw)).toBe(false);
  });

  it("handles short raw text with few keywords", () => {
    const page = "The candidate voted for the bill.";
    const raw = "at on";
    // Both words are < 4 chars, so keywords is empty → returns false
    expect(contentContainsText(page, raw)).toBe(false);
  });

  it("tolerates minor page changes (60% threshold)", () => {
    const page = "The candidate supports education reform and funding increases for public schools.";
    const raw = "supports education reform and increased funding for schools and teachers";
    // Keywords from raw: "supports", "education", "reform", "increased", "funding", "schools", "teachers"
    // Found on page: "supports", "education", "reform", "funding", "schools" = 5/7 ≈ 71% > 60%
    expect(contentContainsText(page, raw)).toBe(true);
  });
});
