import { NextResponse } from "next/server";
import { getGeminiModel } from "@/lib/gemini";

/**
 * POST /api/translate
 *
 * I18N-002: LLM dynamic translation for content beyond static UI strings.
 * Translates dynamic content (position summaries, question text, explanations)
 * that can't be pre-translated in message dictionaries.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { texts, targetLanguage } = body as {
    texts: string[];
    targetLanguage: string;
  };

  if (!texts || !Array.isArray(texts) || texts.length === 0) {
    return NextResponse.json(
      { error: "texts array is required and must not be empty" },
      { status: 400 }
    );
  }

  if (!targetLanguage || typeof targetLanguage !== "string") {
    return NextResponse.json(
      { error: "targetLanguage is required" },
      { status: 400 }
    );
  }

  if (texts.length > 50) {
    return NextResponse.json(
      { error: "Maximum 50 texts per request" },
      { status: 400 }
    );
  }

  const model = getGeminiModel({
    systemInstruction: `You are a precise translator. Translate the given texts to ${targetLanguage}. Maintain the original meaning, tone, and any technical/political terminology. Output ONLY a JSON array of translated strings in the same order as input. Do not add commentary.`,
  });

  const prompt = `Translate each of the following texts to ${targetLanguage}. Output a JSON array of strings, one per input text, in the same order.

Input texts:
${JSON.stringify(texts, null, 2)}

Output ONLY the JSON array.`;

  const response = await model.generateContent(prompt);
  const text = response.response.text();

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error("Translation response does not contain a JSON array");
  }

  const translations = JSON.parse(jsonMatch[0]) as string[];

  if (translations.length !== texts.length) {
    throw new Error(
      `Translation count mismatch: expected ${texts.length}, got ${translations.length}`
    );
  }

  return NextResponse.json({ translations, targetLanguage });
}
