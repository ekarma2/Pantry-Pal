import "server-only";

import type Anthropic from "@anthropic-ai/sdk";

export type Effort = NonNullable<NonNullable<Anthropic.MessageCreateParams["output_config"]>["effort"]>;

/** Every Claude model choice lives here. */
export const AI_TASKS = {
  // Cheap + fast: text/receipt parsing and shelf-life estimates.
  estimateExpiry: { model: "claude-haiku-5-5", effort: "low", maxTokens: 4000 },
  parseText: { model: "claude-haiku-5-5", effort: "low", maxTokens: 8000 },
  parseReceipt: { model: "claude-haiku-5-5", effort: "low", maxTokens: 16000 },
  // Meal ideas need judgment about what goes together, so they get Opus. Haiku has
  // no server-side refusal fallback; Opus opts in so a false-positive decline
  // is retried on Anthropic's recommended model instead of failing.
  suggestMeals: { model: "claude-opus-5-5", effort: "low", maxTokens: 16000, fallbacks: true },
} as const satisfies Record<string, { model: string; effort: Effort; maxTokens: number; fallbacks?: boolean }>;

export type AiTask = keyof typeof AI_TASKS;
