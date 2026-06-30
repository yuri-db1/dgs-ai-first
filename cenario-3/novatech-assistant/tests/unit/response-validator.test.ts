import { describe, it, expect } from "vitest";
import {
  validateResponse,
  AssistantResponseSchema,
} from "../../src/services/response-validator";

const valid = {
  answer: "O prazo de devolução é de 7 dias úteis.",
  source_document: "POL-001, seção 3.2",
  confidence_score: 0.9,
};

describe("AssistantResponseSchema (structured output)", () => {
  it("accepts a well-formed response", () => {
    expect(AssistantResponseSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects extra fields (.strict)", () => {
    const withExtra = { ...valid, is_verified: true };
    expect(AssistantResponseSchema.safeParse(withExtra).success).toBe(false);
  });

  it("rejects confidence_score outside [0,1]", () => {
    expect(AssistantResponseSchema.safeParse({ ...valid, confidence_score: 1.4 }).success).toBe(
      false,
    );
    expect(AssistantResponseSchema.safeParse({ ...valid, confidence_score: -0.1 }).success).toBe(
      false,
    );
  });

  it("rejects wrong types", () => {
    expect(AssistantResponseSchema.safeParse({ ...valid, source_document: 5 }).success).toBe(false);
  });
});

describe("validateResponse — schema layer", () => {
  it("passes a valid object through unchanged", () => {
    const out = validateResponse(valid);
    expect(out.status).toBe("valid");
    expect(out.response).toEqual(valid);
  });

  it("accepts a JSON string", () => {
    expect(validateResponse(JSON.stringify(valid)).status).toBe("valid");
  });

  it("rejects malformed JSON string with a safe fallback (no throw)", () => {
    const out = validateResponse("{ not json");
    expect(out.status).toBe("rejected");
    expect(out.reason).toBe("SCHEMA_INVALID");
    expect(out.response.confidence_score).toBe(0);
  });

  it("rejects an extra-field response before reading content", () => {
    const out = validateResponse({ ...valid, hacked: "x" });
    expect(out.reason).toBe("SCHEMA_INVALID");
  });
});

describe("validateResponse — G1: source_document required", () => {
  it("rejects empty source", () => {
    expect(validateResponse({ ...valid, source_document: "" }).reason).toBe("MISSING_SOURCE");
  });

  it("rejects 'no source' sentinels (Nenhuma, —, N/A)", () => {
    for (const s of ["Nenhuma", "—", "N/A", "  none  "]) {
      expect(validateResponse({ ...valid, source_document: s }).reason).toBe("MISSING_SOURCE");
    }
  });

  it("returns the safe fallback when source is missing", () => {
    const out = validateResponse({ ...valid, source_document: "Nenhuma" });
    expect(out.response.answer).toMatch(/supervisor/i);
  });
});

describe("validateResponse — G2: dangerous cargo return must be denied", () => {
  const src = "POL-001, seção 3.2";

  it("allows a correct denial (resposta 3)", () => {
    const out = validateResponse({
      answer:
        "Não. Cargas perigosas (classes 1 a 6 da ANTT) não podem ser devolvidas pelo " +
        "processo padrão. Recomendo escalar para o supervisor.",
      source_document: src,
      confidence_score: 0.95,
    });
    expect(out.status).toBe("valid");
  });

  it("blocks an affirmation that the return is possible", () => {
    const out = validateResponse({
      answer: "Sim, cargas perigosas podem ser devolvidas mediante autorização.",
      source_document: src,
      confidence_score: 0.9,
    });
    expect(out.reason).toBe("DANGEROUS_CARGO_RETURN_NOT_DENIED");
  });

  it("blocks an ambiguous response with no explicit negativa", () => {
    const out = validateResponse({
      answer: "A devolução de carga perigosa depende da análise da Gestão de Riscos.",
      source_document: src,
      confidence_score: 0.6,
    });
    expect(out.reason).toBe("DANGEROUS_CARGO_RETURN_NOT_DENIED");
  });

  it("catches case/accent/plural variations (DEVOLVER CARGAS PERIGOSAS)", () => {
    const out = validateResponse({
      answer: "É POSSÍVEL DEVOLVER CARGAS PERIGOSAS com frete expresso.",
      source_document: src,
      confidence_score: 0.8,
    });
    expect(out.reason).toBe("DANGEROUS_CARGO_RETURN_NOT_DENIED");
  });

  it("does not touch responses unrelated to dangerous-cargo returns", () => {
    const out = validateResponse({
      answer: "O prazo de devolução para produtos standard é de 7 dias úteis.",
      source_document: "POL-001, seção 3.1",
      confidence_score: 0.9,
    });
    expect(out.status).toBe("valid");
  });
});
