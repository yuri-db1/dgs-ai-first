import type {
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { logger } from "../../shared/logger";
import { AppError, ValidationError } from "../../shared/errors";
import { parseQueryRequest } from "./validator";
import type { QueryResponse } from "../../shared/types";

/**
 * HTTP trigger for the query endpoint.
 *
 * Task T1 (SDD): endpoint skeleton + input validation only. The RAG pipeline —
 * retrieval, prompt building, completion, response validation — lands in tasks
 * T3–T9 and is intentionally NOT wired here.
 *
 * The `@azure/functions` imports above are type-only and are erased at compile
 * time, so this module has no runtime dependency on the Functions host and is
 * unit-testable by calling `queryHandler` directly. Registration via `app.http`
 * lives in `./index.ts`.
 */
export async function queryHandler(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  // 1. Parse the body defensively: malformed JSON yields 400, not a 500.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    logger.warn({ invocationId: context.invocationId }, "query_invalid_json");
    return jsonResponse(400, {
      error: { code: "INVALID_JSON", message: "Request body is not valid JSON" },
    });
  }

  // 2. Validate against the Zod schema and respond.
  try {
    const input = parseQueryRequest(body);

    // Log only metadata — never the raw question (PII / log-volume).
    logger.info(
      {
        invocationId: context.invocationId,
        tier: input.tier,
        queryLength: input.query.length,
        historyTurns: input.history?.length ?? 0,
      },
      "query_received",
    );

    // T1 stub: input is validated, but the pipeline is not wired yet.
    // `pending: true` makes that explicit instead of faking an answer.
    const response: QueryResponse = {
      answer: "",
      source_document: [],
      pending: true,
    };
    return jsonResponse(200, response);
  } catch (err) {
    if (err instanceof ValidationError) {
      logger.warn(
        { invocationId: context.invocationId, code: err.code, issues: err.issues },
        "query_validation_failed",
      );
      return jsonResponse(err.status, {
        error: { code: err.code, message: err.message, issues: err.issues },
      });
    }
    if (err instanceof AppError) {
      return jsonResponse(err.status, {
        error: { code: err.code, message: err.message },
      });
    }
    logger.error({ invocationId: context.invocationId, err }, "query_unexpected_error");
    return jsonResponse(500, {
      error: { code: "INTERNAL", message: "Internal server error" },
    });
  }
}

/** Build a JSON HTTP response with the correct content type. */
function jsonResponse(status: number, body: unknown): HttpResponseInit {
  return {
    status,
    headers: { "Content-Type": "application/json" },
    jsonBody: body,
  };
}
