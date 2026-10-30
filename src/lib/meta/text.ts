import "server-only";

// Muse Spark. It reasons before it answers - a one-line reading of a comic page
// spent 771 tokens thinking - so every call needs room to think and then speak,
// or it stops at the token limit with content: null and nothing to show for it.

import { MODELS, metaPost } from "./client";

export type TextPart = { type: "text"; text: string };
export type ImagePart = { type: "image_url"; image_url: { url: string } };
export type Part = TextPart | ImagePart;

type Completion = {
  choices: { finish_reason: string; message: { content: string | null; refusal: string | null } }[];
};

export async function ask(parts: Part[], opts?: { maxTokens?: number }): Promise<string> {
  const res = await metaPost("/chat/completions", {
    model: MODELS.text,
    messages: [{ role: "user", content: parts }],
    max_tokens: opts?.maxTokens ?? 4000,
  });
  const json = (await res.json()) as Completion;
  const choice = json.choices[0];
  if (choice.message.refusal) throw new Error(`Muse Spark declined: ${choice.message.refusal}`);
  if (!choice.message.content) {
    throw new Error(
      choice.finish_reason === "length"
        ? "Muse Spark ran out of tokens while reasoning. Raise maxTokens."
        : "Muse Spark returned nothing.",
    );
  }
  return choice.message.content;
}

/** Asks for JSON and copes with it arriving wrapped in a code fence. */
export async function askJson<T>(parts: Part[], opts?: { maxTokens?: number }): Promise<T> {
  const raw = await ask(parts, opts);
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = (fenced?.[1] ?? raw).trim();
  const start = body.search(/[[{]/);
  if (start === -1) throw new Error(`Expected JSON, got: ${body.slice(0, 200)}`);
  const end = Math.max(body.lastIndexOf("]"), body.lastIndexOf("}"));
  return JSON.parse(body.slice(start, end + 1)) as T;
}
