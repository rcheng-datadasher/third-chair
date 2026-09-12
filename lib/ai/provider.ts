import OpenAI, {
  BadRequestError,
  NotFoundError,
  UnprocessableEntityError,
} from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { type ZodType, z } from "zod";
import { config } from "../config";

/** Options for a single model completion request. */
export interface CompleteOptions<T> {
  tier: "fast" | "smart";
  system: string;
  prompt: string;
  schema: ZodType<T>;
  /** Name attached to the JSON Schema and used in the thrown error/log line. Defaults to "output". */
  schemaName?: string;
}

/** Module-scope OpenAI client for the Kilo Gateway, built from the typed config (D-05). */
const client = new OpenAI({
  apiKey: config.ai.apiKey,
  baseURL: config.ai.baseUrl,
});

/**
 * Decides whether a structured-output failure should fall back to the
 * narrow JSON-mode retry path, or propagate unchanged.
 *
 * Only a response shape/validation problem (the gateway/model rejecting or
 * mangling structured output) qualifies. Auth, billing, rate-limit,
 * network and 5xx errors are never retried here — they mean the request
 * itself is broken, not the output format.
 *
 * @param err - The error thrown by the structured-output attempt.
 * @returns `true` when the JSON-mode fallback should run.
 */
export function shouldUseJsonFallback(err: unknown): boolean {
  return (
    err instanceof BadRequestError ||
    err instanceof NotFoundError ||
    err instanceof UnprocessableEntityError ||
    err instanceof SyntaxError ||
    err instanceof z.ZodError
  );
}

/**
 * Strips a Markdown code-fence wrapper (```json ... ``` or ``` ... ```)
 * from a model response, if present, so `JSON.parse` sees bare JSON.
 *
 * @param text - Raw model output.
 * @returns `text` with any surrounding code fence removed.
 */
function stripCodeFence(text: string): string {
  const match = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return match ? match[1] : text;
}

/**
 * The single seam every model call in this repo goes through
 * (CLAUDE.md "Single sources of truth"). No other file may import an AI SDK
 * client directly.
 *
 * Tries `chat.completions.parse` with a Zod-derived JSON Schema
 * (structured output) first. On a schema/shape failure only — a 400/404/422
 * response, a JSON syntax error, or a Zod validation error — falls back to
 * at most two plain `chat.completions.create` calls in `json_object` mode,
 * each carrying the schema's JSON Schema in the system prompt. Every other
 * error (auth, credits, rate limit, network, 5xx) propagates unchanged.
 *
 * @param opts - Model tier, system/prompt strings, the Zod schema the
 *   result must satisfy, and an optional schema name for logging/errors.
 * @returns The parsed, schema-validated result.
 * @throws The original error for anything that isn't a shape failure.
 * @throws An `Error` naming `schemaName` when both JSON-mode attempts fail
 *   to produce schema-valid output.
 */
export async function complete<T>(opts: CompleteOptions<T>): Promise<T> {
  const { tier, system, prompt, schema, schemaName = "output" } = opts;
  const requestedModel =
    tier === "fast" ? config.ai.modelFast : config.ai.modelSmart;

  try {
    // The `provider.require_parameters` field is a Kilo Gateway
    // (OpenRouter-compatible) routing hint with no typed home in the SDK's
    // params type (05-RESEARCH Pitfall B). Spreading a cast object in
    // avoids widening the whole params type, which would otherwise break
    // the SDK's generic inference of `message.parsed`'s type from
    // `response_format`.
    const completion = await client.chat.completions.parse({
      model: requestedModel,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      response_format: zodResponseFormat(schema, schemaName),
      ...({ provider: { require_parameters: true } } as Record<
        string,
        unknown
      >),
    });
    const parsed = completion.choices[0]?.message.parsed;
    if (parsed != null) {
      logCompletion(
        tier,
        requestedModel,
        completion.model,
        schemaName,
        "structured",
      );
      return parsed;
    }
  } catch (err) {
    if (!shouldUseJsonFallback(err)) {
      throw err;
    }
  }

  const jsonSchema = z.toJSONSchema(schema);
  const jsonSystem = `${system}\n\nRespond with a single JSON object matching this JSON Schema, and nothing else:\n${JSON.stringify(jsonSchema)}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const completion = await client.chat.completions.create({
        model: requestedModel,
        messages: [
          { role: "system", content: jsonSystem },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      });
      const raw = completion.choices[0]?.message.content ?? "";
      const parsed = JSON.parse(stripCodeFence(raw));
      const result = schema.safeParse(parsed);
      if (result.success) {
        logCompletion(
          tier,
          requestedModel,
          completion.model,
          schemaName,
          "json",
        );
        return result.data;
      }
    } catch {
      // Swallow and retry (up to the loop's own 2-attempt cap); the final
      // throw below covers a caller who exhausts both attempts.
    }
  }

  throw new Error(
    `complete: model output never matched schema "${schemaName}"`,
  );
}

/**
 * Logs one line per completed model call. Never logs the API key or any
 * prompt/message text.
 *
 * @param tier - The requested tier ("fast" or "smart").
 * @param requested - The model id requested from config.
 * @param served - The model id the gateway reports it actually served.
 * @param schemaName - The schema name this call validated against.
 * @param path - Which path produced the result: "structured" or "json".
 */
function logCompletion(
  tier: "fast" | "smart",
  requested: string,
  served: string,
  schemaName: string,
  path: "structured" | "json",
): void {
  console.log(
    `[ai] tier=${tier} requested=${requested} served=${served} schema=${schemaName} path=${path}`,
  );
}
