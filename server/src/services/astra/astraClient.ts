import axios from "axios";
import { env, isAstraConfigured } from "../../config/env";

export interface AstraChatMessage {
  role: "system" | "user";
  content: string;
}

export interface AstraCompletionResult {
  ok: boolean;
  content?: string;
  error?: string;
}

/**
 * Thin client around the Astra LLM API. The exact Astra request/response contract
 * is environment-specific, so this client assumes an OpenAI-compatible chat
 * completions endpoint (POST { model, messages } -> { choices: [{ message: { content } }] }),
 * which is the most common shape for hosted LLM gateways. If your Astra deployment
 * uses a different contract, adjust `callAstra` only — nothing else in the app
 * depends on this shape.
 *
 * This call fails soft: any network error, timeout, or missing configuration
 * returns { ok: false } rather than throwing, so the rest of the app (deterministic
 * detection) never depends on Astra being reachable.
 */
export async function callAstra(messages: AstraChatMessage[]): Promise<AstraCompletionResult> {
  if (!isAstraConfigured()) {
    return { ok: false, error: "Astra is not configured (ASTRA_API_KEY/ASTRA_API_URL/ASTRA_MODEL missing)" };
  }

  try {
    const response = await axios.post(
      env.astraApiUrl,
      {
        model: env.astraModel,
        messages,
        temperature: 0.2,
        // Generous headroom: a report with several findings and 8 prose sections can run long,
        // and a truncated response is invalid JSON — safeParse then fails and the officer sees
        // a misleading "unavailable" instead of a real (if occasionally verbose) report.
        max_tokens: 3000,
      },
      {
        headers: {
          Authorization: `Bearer ${env.astraApiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 20000,
      }
    );

    const content: string | undefined =
      response.data?.choices?.[0]?.message?.content ?? response.data?.content ?? response.data?.output;

    if (!content) {
      return { ok: false, error: "Astra response did not contain a recognizable content field" };
    }
    return { ok: true, content };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Astra error";
    return { ok: false, error: message };
  }
}
