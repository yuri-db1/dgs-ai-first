import { describe, it, expect } from "vitest";
import type { HttpRequest, InvocationContext } from "@azure/functions";
import { queryHandler } from "../../src/functions/query/handler";

/** Minimal HttpRequest double whose body() is driven by the provided `json` fn. */
function makeRequest(json: () => Promise<unknown>): HttpRequest {
  return { json } as unknown as HttpRequest;
}

const ctx = { invocationId: "test-invocation" } as unknown as InvocationContext;

describe("queryHandler", () => {
  it("should return 400 when the body is not valid JSON", async () => {
    const request = makeRequest(async () => {
      throw new SyntaxError("Unexpected token");
    });
    const res = await queryHandler(request, ctx);
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: { code: string } }).error.code).toBe("INVALID_JSON");
  });

  it("should return 400 with field details when query is missing", async () => {
    const request = makeRequest(async () => ({ tier: "Gold" }));
    const res = await queryHandler(request, ctx);
    expect(res.status).toBe(400);
    const body = res.jsonBody as { error: { code: string; issues: { field: string }[] } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.issues.map((i) => i.field)).toContain("query");
  });

  it("should return 400 when query is shorter than 3 chars", async () => {
    const request = makeRequest(async () => ({ query: "oi" }));
    const res = await queryHandler(request, ctx);
    expect(res.status).toBe(400);
  });

  it("should return 400 when history exceeds 3 turns (ADR-0002)", async () => {
    const request = makeRequest(async () => ({
      query: "pergunta válida",
      history: Array.from({ length: 4 }, () => ({ role: "user", content: "x" })),
    }));
    const res = await queryHandler(request, ctx);
    expect(res.status).toBe(400);
    const body = res.jsonBody as { error: { issues: { field: string }[] } };
    expect(body.error.issues.map((i) => i.field)).toContain("history");
  });

  it("should return 200 with a pending, source-cited stub when input is valid", async () => {
    const request = makeRequest(async () => ({ query: "Qual o prazo de devolução?" }));
    const res = await queryHandler(request, ctx);
    expect(res.status).toBe(200);
    const body = res.jsonBody as { answer: string; source_document: unknown[]; pending: boolean };
    expect(body.pending).toBe(true);
    expect(body.source_document).toEqual([]);
  });
});
