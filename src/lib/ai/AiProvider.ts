import { GoogleGenerativeAI } from "@google/generative-ai";
import { DEFAULT_MODEL } from "lib/ai-descriptions/constants";
import { SYSTEM_PROMPT, buildUserPrompt } from "lib/ai-descriptions/prompt";
import { parseAiDescriptionJson } from "lib/ai-descriptions/qa";
import type { AiDescriptionOutput, BuildPromptInput } from "lib/ai-descriptions/types";

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1500;

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_API_KEY?.trim();
  if (!key) {
    throw new Error("GEMINI_API_KEY (or GOOGLE_API_KEY) is not set");
  }
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Gemini-backed AI provider for product description generation.
 * Uses structured JSON output via responseMimeType when supported.
 */
export class AiProvider {
  private readonly modelName: string;

  constructor(modelName: string = DEFAULT_MODEL) {
    this.modelName = modelName;
  }

  async generateDescription(input: BuildPromptInput): Promise<AiDescriptionOutput> {
    const client = new GoogleGenerativeAI(getApiKey());
    const model = client.getGenerativeModel({
      model: this.modelName,
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.85,
        responseMimeType: "application/json"
      }
    });

    const userPrompt = buildUserPrompt(input);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const result = await model.generateContent(userPrompt);
        const text = result.response.text()?.trim();
        if (!text) throw new Error("Gemini returned empty response");
        return parseAiDescriptionJson(text);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRIES - 1) {
          await sleep(RETRY_BASE_MS * (attempt + 1));
        }
      }
    }

    throw lastError ?? new Error("Gemini generation failed");
  }
}

export function createAiProvider(): AiProvider {
  return new AiProvider(DEFAULT_MODEL);
}
