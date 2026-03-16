import Anthropic from "@anthropic-ai/sdk";

const globalForClaude = globalThis as unknown as { _claude?: Anthropic };

/**
 * Lazily-initialized Claude client.
 * Defers API key validation to first use so test files that import
 * modules transitively depending on claude.ts don't blow up.
 */
export function getClaude(): Anthropic {
  if (globalForClaude._claude) return globalForClaude._claude;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY environment variable is required. Set it in .env"
    );
  }

  const client = new Anthropic({ apiKey });
  if (process.env.NODE_ENV !== "production") {
    globalForClaude._claude = client;
  }
  return client;
}
