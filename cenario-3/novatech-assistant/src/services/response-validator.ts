// Response harness — structured output + deterministic guardrails.
//
// Two complementary layers protect the attendant from a bad model output:
//
//   1. STRUCTURAL (the probabilistic boundary made deterministic): the model is
//      asked to answer as JSON `{ answer, source_document, confidence_score }`. We
//      parse it with Zod. A response that does not match the shape is rejected
//      BEFORE any content check — we never inspect a payload we could not validate.
//
//   2. SEMANTIC (business guardrails the prompt cannot guarantee): even a
//      well-formed response can be wrong. Two rules from the Product Specialist's
//      guardrails (cenário 2) are enforced in code, not left to the prompt:
//        - G1: a response MUST cite a real source_document.
//        - G2: a response about devolução de carga perigosa MUST carry the negativa
//              (POL-001 §3.2 — classes 1–6 da ANTT não são devolvíveis pelo processo
//              padrão). If it affirms the return is possible, it is blocked.
//
// On ANY failure the reason is logged (structured, no answer body) and a SAFE
// FALLBACK is returned, so a malformed or unsafe answer never reaches the attendant.

import { z } from "zod";
import { logger } from "../shared/logger";

/**
 * Structured output the model is required to emit. `.strict()` rejects any extra
 * field — a hallucinated `is_verified: true` or an injected key cannot ride along
 * silently. confidence_score is bounded to [0,1] so an out-of-range value is a
 * schema failure, not a downstream surprise.
 */
export const AssistantResponseSchema = z
  .object({
    answer: z.string().min(1),
    source_document: z.string(),
    confidence_score: z.number().min(0).max(1),
  })
  .strict();

export type AssistantResponse = z.infer<typeof AssistantResponseSchema>;

/** Machine-stable reason a response was rejected. */
export type RejectionReason =
  | "SCHEMA_INVALID"
  | "MISSING_SOURCE"
  | "DANGEROUS_CARGO_RETURN_NOT_DENIED";

export interface ValidationOutcome {
  status: "valid" | "rejected";
  /** The validated model response, or the safe fallback when rejected. */
  response: AssistantResponse;
  /** Present only when status === "rejected". */
  reason?: RejectionReason;
}

/** Returned to the attendant whenever a response cannot be trusted. */
const SAFE_FALLBACK: AssistantResponse = {
  answer:
    "Não consegui validar esta resposta com segurança. " +
    "Encaminhe a pergunta ao supervisor para tratamento manual.",
  source_document: "",
  confidence_score: 0,
};

/**
 * Sentinel values a model uses to mean "no source" — they pass a naive
 * `source_document is a string` check but must be treated as MISSING.
 * Compared after normalization (lowercase, accents stripped, trimmed).
 */
const NO_SOURCE_SENTINELS = new Set(["", "-", "—", "nenhuma", "nenhum", "n/a", "na", "none"]);

/** lowercase + strip diacritics, so "Devolução" / "DEVOLUÇÃO" / "devolucao" collapse. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Theme detectors run on normalized text. Plurals and stems are covered on purpose:
// "carga perigosa" / "cargas perigosas"; "devolução" / "devolver" / "devolvida".
const DANGEROUS_CARGO = /cargas?\s+perigosas?/;
const RETURN_THEME = /devolu|devolv/;

// Explicit denial that the return is allowed. Requires a NEGATION bound to the
// possibility/eligibility, not a stray "não" elsewhere in the text.
const EXPLICIT_DENIAL =
  /n[ao]o\s+(pode|podem|e\s+possivel|sao\s+elegiveis|sera|sao\s+permitid|e\s+permitid|e\s+elegivel)|^n[ao]o[.,;\s]/;

// Affirmation that the return IS possible. The `(?<!nao )` lookbehind keeps a
// negated phrase ("não podem ser devolvidas") from matching as an affirmation —
// only an UN-negated "podem ser devolvidas" counts. This wins over a stray leading
// "Não" so "Não há restrição: cargas perigosas podem ser devolvidas" is still blocked.
const AFFIRMS_RETURN =
  /(?<!nao )(?:pode|podem|e\s+possivel|sera|permitid[ao]s?|liberad[ao]s?)\s+(?:ser\s+)?(?:devolv|devolu)|(?:devolv|devolu)\w*\s+(?:e\s+)?(?:possivel|permitid|liberad)|^sim[,.\s]/;

/**
 * Validate a raw model output and apply the two guardrails.
 *
 * @param raw the model output. Accepts an object or a JSON string (the model may
 *   return either); anything else fails schema validation.
 * @returns the validated response, or a safe fallback with a logged reason.
 */
export function validateResponse(raw: unknown): ValidationOutcome {
  // Accept a JSON string too — but a malformed string is a schema failure, never a throw.
  let candidate: unknown = raw;
  if (typeof raw === "string") {
    try {
      candidate = JSON.parse(raw);
    } catch {
      return reject("SCHEMA_INVALID", { detail: "body is not valid JSON" });
    }
  }

  // Layer 1 — structural validation. Reject before reading content.
  const parsed = AssistantResponseSchema.safeParse(candidate);
  if (!parsed.success) {
    return reject("SCHEMA_INVALID", {
      issues: parsed.error.issues.map((i) => ({
        field: i.path.join(".") || "(root)",
        message: i.message,
      })),
    });
  }
  const response = parsed.data;

  // Layer 2 — semantic guardrails.

  // G1: must cite a real source. Empty or a "no source" sentinel is a rejection.
  if (NO_SOURCE_SENTINELS.has(normalize(response.source_document))) {
    return reject("MISSING_SOURCE", {});
  }

  // G2: devolução de carga perigosa must carry the negativa.
  const text = normalize(response.answer);
  const isDangerousReturn = DANGEROUS_CARGO.test(text) && RETURN_THEME.test(text);
  if (isDangerousReturn) {
    const affirms = AFFIRMS_RETURN.test(text);
    const denies = EXPLICIT_DENIAL.test(text);
    // Block if it affirms the return, OR if it is ambiguous (no explicit denial) —
    // fail safe: a response about returning dangerous cargo with no clear "não" is unsafe.
    if (affirms || !denies) {
      return reject("DANGEROUS_CARGO_RETURN_NOT_DENIED", { affirms, denies });
    }
  }

  return { status: "valid", response };
}

/** Log the rejection (metadata only — never the answer body) and return the fallback. */
function reject(reason: RejectionReason, meta: Record<string, unknown>): ValidationOutcome {
  logger.warn({ reason, ...meta }, "response_rejected");
  return { status: "rejected", reason, response: SAFE_FALLBACK };
}
