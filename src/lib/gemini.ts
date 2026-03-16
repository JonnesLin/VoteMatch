import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai";

const globalForGemini = globalThis as unknown as { _gemini?: GoogleGenerativeAI };

/**
 * Lazily-initialized Gemini client.
 * Defers API key validation to first use so test files that import
 * modules transitively depending on gemini.ts don't blow up.
 */
function getClient(): GoogleGenerativeAI {
  if (globalForGemini._gemini) return globalForGemini._gemini;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY environment variable is required. Set it in .env"
    );
  }

  const client = new GoogleGenerativeAI(apiKey);
  if (process.env.NODE_ENV !== "production") {
    globalForGemini._gemini = client;
  }
  return client;
}

/**
 * Returns a Gemini GenerativeModel configured with optional system instruction.
 */
export function getGeminiModel(opts?: {
  systemInstruction?: string;
}): GenerativeModel {
  return getClient().getGenerativeModel({
    model: "gemini-3-flash-preview",
    ...(opts?.systemInstruction && {
      systemInstruction: opts.systemInstruction,
    }),
  });
}

/**
 * Returns a Gemini GenerativeModel with Google Search grounding enabled.
 */
export function getGeminiModelWithSearch(opts?: {
  systemInstruction?: string;
}): GenerativeModel {
  return getClient().getGenerativeModel({
    model: "gemini-3-flash-preview",
    tools: [{ googleSearch: {} } as never],
    ...(opts?.systemInstruction && {
      systemInstruction: opts.systemInstruction,
    }),
  });
}
