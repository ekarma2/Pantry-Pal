import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { AI_TASKS, type AiTask } from "@/lib/server/ai-config";
import { HttpError } from "@/lib/server/auth";

let client: Anthropic | undefined;

function anthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(503, "AI is not configured");
  client ??= new Anthropic();
  return client;
}

type GenerateArgs<S extends z.ZodType> = {
  task: AiTask;
  system: string;
  content: Anthropic.MessageParam["content"];
  schema: S;
};

/**
 * One Claude call that must return JSON matching `schema`.
 * Retries once if the output fails to parse or validate.
 */
export async function generateObject<S extends z.ZodType>({
  task,
  system,
  content,
  schema,
}: GenerateArgs<S>): Promise<z.infer<S>> {
  const { model, effort, maxTokens } = AI_TASKS[task];

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await anthropic().messages.parse({
        model,
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content }],
        output_config: { effort, format: zodOutputFormat(schema) },
      });

      if (res.stop_reason === "refusal") {
        throw new HttpError(422, "The AI declined this request");
      }
      if (res.parsed_output != null) return res.parsed_output as z.infer<S>;
      console.warn(`[ai:${task}] empty output (stop_reason=${res.stop_reason}), attempt ${attempt}`);
    } catch (err) {
      if (err instanceof HttpError) throw err;
      if (err instanceof Anthropic.RateLimitError) throw new HttpError(503, "AI is busy, try again shortly");
      if (err instanceof Anthropic.APIError) {
        console.error(`[ai:${task}] API error ${err.status}`, err.message);
        throw new HttpError(502, "AI request failed");
      }
      // Any other AnthropicError here is a JSON/schema parse failure: retry once.
      if (!(err instanceof Anthropic.AnthropicError)) throw err;
      console.warn(`[ai:${task}] invalid output, attempt ${attempt}:`, err.message);
    }
  }
  throw new HttpError(502, "AI returned an invalid response");
}
