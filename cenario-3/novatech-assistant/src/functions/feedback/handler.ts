import type {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { randomUUID } from "node:crypto";
import { logger } from "../../shared/logger";
import { AppError, ValidationError } from "../../shared/errors";
import { parseFeedbackRequest } from "./validator";
import {
  createCosmosFeedbackStore,
  type FeedbackRecord,
  type FeedbackStore,
} from "./store";

// Lazily-built default store so importing this module (in tests) neither constructs
// a CosmosClient nor requires COSMOS_CONNECTION_STRING. Tests inject a fake store.
let defaultStore: FeedbackStore | undefined;

/**
 * HTTP trigger for POST /api/feedback.
 *
 * Reescrita do módulo gerado pelo Copilot, aderente ao AGENTS.md:
 * - input validado com Zod (`parseFeedbackRequest`), nunca `as any`;
 * - logging estruturado com pino — e SÓ metadados (queryId, rating). O e-mail do
 *   atendente e o comentário (PII) são persistidos mas NUNCA logados;
 * - imports estáticos no topo (sem `require` dinâmico);
 * - JSON malformado → 400, não 500; falha de persistência → 502, sem vazar payload.
 *
 * @param store injectable for tests; defaults to the Cosmos-backed store.
 */
export async function feedbackHandler(
  request: HttpRequest,
  context: InvocationContext,
  store?: FeedbackStore,
): Promise<HttpResponseInit> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logger.warn({ invocationId: context.invocationId }, "feedback_invalid_json");
    return jsonResponse(400, {
      error: { code: "INVALID_JSON", message: "Request body is not valid JSON" },
    });
  }

  let input;
  try {
    input = parseFeedbackRequest(body);
  } catch (err) {
    if (err instanceof ValidationError) {
      logger.warn(
        { invocationId: context.invocationId, code: err.code, issues: err.issues },
        "feedback_validation_failed",
      );
      return jsonResponse(err.status, {
        error: { code: err.code, message: err.message, issues: err.issues },
      });
    }
    throw err;
  }

  const record: FeedbackRecord = {
    ...input,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };

  try {
    const target = store ?? (defaultStore ??= createCosmosFeedbackStore());
    await target.save(record);
  } catch (err) {
    // Never echo the payload (PII). Log the error and a correlation id only.
    logger.error(
      { invocationId: context.invocationId, feedbackId: record.id, err: errorMeta(err) },
      "feedback_persist_failed",
    );
    return jsonResponse(502, {
      error: { code: "PERSIST_FAILED", message: "Could not store feedback" },
    });
  }

  // Metadata only — no attendantEmail, no comment.
  logger.info(
    { invocationId: context.invocationId, feedbackId: record.id, rating: record.rating },
    "feedback_received",
  );
  return jsonResponse(201, { id: record.id });
}

/** Build a JSON HTTP response with the correct content type. */
function jsonResponse(status: number, body: unknown): HttpResponseInit {
  return {
    status,
    headers: { "Content-Type": "application/json" },
    jsonBody: body,
  };
}

/** Reduce an unknown error to safe, loggable metadata (no payload). */
function errorMeta(err: unknown): { name: string; message: string } {
  if (err instanceof AppError) return { name: err.name, message: err.message };
  if (err instanceof Error) return { name: err.name, message: err.message };
  return { name: "Unknown", message: String(err) };
}
