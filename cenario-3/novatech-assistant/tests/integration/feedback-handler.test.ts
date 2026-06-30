import { describe, it, expect, vi } from "vitest";
import type { HttpRequest, InvocationContext } from "@azure/functions";
import { feedbackHandler } from "../../src/functions/feedback/handler";
import type { FeedbackRecord, FeedbackStore } from "../../src/functions/feedback/store";
import { logger } from "../../src/shared/logger";

/** Minimal HttpRequest double whose json() is driven by the provided fn. */
function makeRequest(json: () => Promise<unknown>): HttpRequest {
  return { json } as unknown as HttpRequest;
}

const ctx = { invocationId: "test-invocation" } as unknown as InvocationContext;

/** In-memory store so the handler is tested without Cosmos. */
function fakeStore(): FeedbackStore & { saved: FeedbackRecord[] } {
  const saved: FeedbackRecord[] = [];
  return {
    saved,
    async save(record) {
      saved.push(record);
    },
  };
}

const validBody = {
  queryId: "q1",
  rating: 5,
  comment: "great",
  attendantEmail: "ana@novatech.com.br",
};

describe("feedbackHandler", () => {
  it("returns 400 when the body is not valid JSON", async () => {
    const store = fakeStore();
    const res = await feedbackHandler(
      makeRequest(async () => {
        throw new SyntaxError("bad");
      }),
      ctx,
      store,
    );
    expect(res.status).toBe(400);
    expect(store.saved).toHaveLength(0);
  });

  it("returns 400 when rating is out of range (Zod, not as any)", async () => {
    const store = fakeStore();
    const res = await feedbackHandler(makeRequest(async () => ({ ...validBody, rating: 9 })), ctx, store);
    expect(res.status).toBe(400);
    const body = res.jsonBody as { error: { code: string; issues: { field: string }[] } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.issues.map((i) => i.field)).toContain("rating");
    expect(store.saved).toHaveLength(0);
  });

  it("returns 400 when attendantEmail is not a valid email", async () => {
    const store = fakeStore();
    const res = await feedbackHandler(
      makeRequest(async () => ({ ...validBody, attendantEmail: "not-an-email" })),
      ctx,
      store,
    );
    expect(res.status).toBe(400);
  });

  it("rejects unexpected extra fields (.strict)", async () => {
    const store = fakeStore();
    const res = await feedbackHandler(
      makeRequest(async () => ({ ...validBody, isAdmin: true })),
      ctx,
      store,
    );
    expect(res.status).toBe(400);
  });

  it("persists a valid feedback and returns 201 with the new id", async () => {
    const store = fakeStore();
    const res = await feedbackHandler(makeRequest(async () => validBody), ctx, store);
    expect(res.status).toBe(201);
    expect(store.saved).toHaveLength(1);
    const record = store.saved[0];
    expect(record.queryId).toBe("q1");
    expect(record.id).toBeTruthy();
    expect(record.timestamp).toBeTruthy();
    expect((res.jsonBody as { id: string }).id).toBe(record.id);
  });

  it("never passes the attendant email or comment (PII) to the logger", async () => {
    const store = fakeStore();
    // Spy on the logger methods directly — robust regardless of pino's transport
    // (pino writes to fd 1, bypassing process.stdout.write). Capture every payload
    // handed to the logger and assert no PII value appears anywhere in it.
    const captured: unknown[] = [];
    const record = (obj: unknown) => captured.push(obj);
    const info = vi.spyOn(logger, "info").mockImplementation(((obj: unknown) => record(obj)) as never);
    const warn = vi.spyOn(logger, "warn").mockImplementation(((obj: unknown) => record(obj)) as never);
    const error = vi.spyOn(logger, "error").mockImplementation(((obj: unknown) => record(obj)) as never);

    await feedbackHandler(makeRequest(async () => validBody), ctx, store);

    info.mockRestore();
    warn.mockRestore();
    error.mockRestore();

    expect(captured.length).toBeGreaterThan(0); // proves the spy actually intercepted
    const serialized = JSON.stringify(captured);
    expect(serialized).not.toContain("ana@novatech.com.br");
    expect(serialized).not.toContain("great");
  });

  it("returns 502 (not 500, no payload leak) when persistence fails", async () => {
    const failing: FeedbackStore = {
      async save() {
        throw new Error("cosmos down");
      },
    };
    const res = await feedbackHandler(makeRequest(async () => validBody), ctx, failing);
    expect(res.status).toBe(502);
    expect((res.jsonBody as { error: { code: string } }).error.code).toBe("PERSIST_FAILED");
  });
});
