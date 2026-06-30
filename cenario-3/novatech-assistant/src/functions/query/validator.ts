import { z } from "zod";
import { ValidationError, type FieldIssue } from "../../shared/errors";

/**
 * Input schema for POST /api/query.
 *
 * - `query`: the attendant's question. Bounded to keep prompts within budget.
 * - `tier`: optional customer tier. Enum mirrors the Tier domain type — an
 *   invented tier like "Platinum" is rejected here (guardrail: só Gold/Silver/Standard).
 * - `history`: prior turns, capped at 3 (context budget — ADR-0002).
 * - `conversationId`: optional correlation id for multi-turn sessions.
 */
export const QueryRequestSchema = z.object({
  query: z.string().min(3).max(500),
  tier: z.enum(["Gold", "Silver", "Standard"]).optional(),
  conversationId: z.string().min(1).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      }),
    )
    .max(3)
    .optional(),
});

export type QueryRequest = z.infer<typeof QueryRequestSchema>;

/**
 * Parse and validate a raw request body.
 *
 * @throws {ValidationError} when the body does not satisfy the schema. Zod issues
 *   are flattened to field/message pairs — the raw value and stack are never leaked.
 */
export function parseQueryRequest(raw: unknown): QueryRequest {
  const result = QueryRequestSchema.safeParse(raw);
  if (!result.success) {
    const issues: FieldIssue[] = result.error.issues.map((issue) => ({
      field: issue.path.join(".") || "(root)",
      message: issue.message,
    }));
    throw new ValidationError("Invalid query request", issues);
  }
  return result.data;
}
