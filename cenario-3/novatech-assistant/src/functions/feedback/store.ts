// Persistence for attendant feedback. The CosmosClient import is STATIC and at
// the top (AGENTS.md: never `require` dynamically). The handler depends on the
// FeedbackStore interface, not on Cosmos directly, so it stays unit-testable with
// an in-memory fake.

import { CosmosClient } from "@azure/cosmos";
import { logger } from "../../shared/logger";
import type { FeedbackRequest } from "./validator";

/** What gets persisted: the validated input plus server-stamped metadata. */
export interface FeedbackRecord extends FeedbackRequest {
  id: string;
  timestamp: string;
}

export interface FeedbackStore {
  save(record: FeedbackRecord): Promise<void>;
}

/**
 * Build a Cosmos-backed store. Reads the connection string from the environment
 * and fails fast (at startup, not per-request) if it is missing.
 */
export function createCosmosFeedbackStore(): FeedbackStore {
  const connectionString = process.env.COSMOS_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error("COSMOS_CONNECTION_STRING is not set");
  }
  const container = new CosmosClient(connectionString)
    .database("novatech")
    .container("feedbacks");

  return {
    async save(record) {
      await container.items.create(record);
      // Metadata only — no email, no comment.
      logger.info({ feedbackId: record.id, queryId: record.queryId }, "feedback_persisted");
    },
  };
}
