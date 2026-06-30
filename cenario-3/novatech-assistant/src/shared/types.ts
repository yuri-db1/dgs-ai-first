// Domain contract types shared across the NovaTech Assistant backend.
// Comments and code in English; user-facing strings are Portuguese (see system prompt).

/**
 * Customer SLA tiers recognized by NovaTech. These are the ONLY valid tiers
 * (see chunk SLA-2024-A: "Não existem outros tiers além dos três listados").
 * Used to reject invented tiers such as "Platinum" at the edge.
 */
export type Tier = "Gold" | "Silver" | "Standard";

/**
 * Citation to an indexed source document. A response MUST always carry an
 * (possibly empty) array of these — product guardrail "citar fonte em toda resposta".
 */
export interface SourceDocument {
  /** Document identifier, e.g. "POL-001" or chunk id "POL-001-B". */
  documentId: string;
  /** Section reference within the document, e.g. "3.2". */
  section?: string;
  /** Retrieval confidence in [0,1], when available. */
  confidence?: number;
}

/** A single prior conversation turn. History is capped at 3 turns (ADR-0002). */
export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

/** Public response contract for POST /api/query. */
export interface QueryResponse {
  /** Assistant answer in formal Portuguese. Empty while the pipeline is not wired. */
  answer: string;
  /** Source citations. Present even when empty or when confidence is low. */
  source_document: SourceDocument[];
  /** True while the RAG pipeline (tasks T3–T9) is not yet connected. */
  pending?: boolean;
}
