import { describe, it, expect } from "vitest";
import { parseQueryRequest } from "../../src/functions/query/validator";
import { ValidationError } from "../../src/shared/errors";

describe("parseQueryRequest", () => {
  it("should return the parsed request when given a minimal valid body", () => {
    const result = parseQueryRequest({ query: "Qual o prazo de devolução?" });
    expect(result.query).toBe("Qual o prazo de devolução?");
    expect(result.tier).toBeUndefined();
  });

  it("should accept an optional tier and up to 3 history turns", () => {
    const result = parseQueryRequest({
      query: "Qual o SLA do cliente Gold?",
      tier: "Gold",
      history: [
        { role: "user", content: "oi" },
        { role: "assistant", content: "olá" },
        { role: "user", content: "e o SLA?" },
      ],
    });
    expect(result.tier).toBe("Gold");
    expect(result.history).toHaveLength(3);
  });

  it("should throw ValidationError with field 'query' when query is missing", () => {
    try {
      parseQueryRequest({ tier: "Gold" });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).issues.map((i) => i.field)).toContain("query");
    }
  });

  it("should throw ValidationError when query is shorter than 3 chars", () => {
    expect(() => parseQueryRequest({ query: "oi" })).toThrowError(ValidationError);
  });

  it("should reject an invented tier such as 'Platinum'", () => {
    try {
      parseQueryRequest({ query: "Qual o SLA do cliente Platinum?", tier: "Platinum" });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).issues.map((i) => i.field)).toContain("tier");
    }
  });

  it("should reject history with more than 3 turns (context budget ADR-0002)", () => {
    const fourTurns = Array.from({ length: 4 }, (_, i) => ({
      role: "user" as const,
      content: `turn ${i}`,
    }));
    try {
      parseQueryRequest({ query: "pergunta válida", history: fourTurns });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).issues.map((i) => i.field)).toContain("history");
    }
  });
});
