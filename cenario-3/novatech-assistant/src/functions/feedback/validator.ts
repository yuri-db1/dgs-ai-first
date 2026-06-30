import { z } from "zod";
import { ValidationError, type FieldIssue } from "../../shared/errors";

/**
 * Input schema for POST /api/feedback.
 *
 * - `queryId`: the query this feedback refers to (correlation, not PII).
 * - `rating`: integer 1–5. `z.number().int()` rejects 4.5 and "5".
 * - `comment`: optional free text, bounded. May contain PII → never logged.
 * - `attendantEmail`: who gave the feedback. PII — stored, but NEVER logged.
 *
 * `.strict()` rejects unexpected fields so a client cannot smuggle extra keys
 * (e.g. an `isAdmin` flag) into the persisted document.
 */
export const FeedbackRequestSchema = z
  .object({
    queryId: z.string().min(1),
    rating: z.number().int().min(1).max(5),
    comment: z.string().max(1000).optional(),
    attendantEmail: z.string().email(),
  })
  .strict();

export type FeedbackRequest = z.infer<typeof FeedbackRequestSchema>;

/**
 * Parse and validate a raw feedback body.
 *
 * @throws {ValidationError} when the body does not satisfy the schema. Zod issues
 *   are flattened to field/message pairs — the raw value is never leaked.
 */
export function parseFeedbackRequest(raw: unknown): FeedbackRequest {
  const result = FeedbackRequestSchema.safeParse(raw);
  if (!result.success) {
    const issues: FieldIssue[] = result.error.issues.map((issue) => ({
      field: issue.path.join(".") || "(root)",
      message: issue.message,
    }));
    throw new ValidationError("Invalid feedback request", issues);
  }
  return result.data;
}
