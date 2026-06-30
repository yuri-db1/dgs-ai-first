# Relatório — Exercício 3.1 (Desenvolvedor): Structured Output e Verificações Determinísticas

**Cenário-Âncora 3 — Fase de Governança e Validação** · Papel: **Desenvolvedor** · Projeto: **NovaTech Assistant**
**Tópico:** Harness Engineering · **Ferramentas:** Claude Code (agente de codificação, no lugar do Copilot) + Claude (chat) para revisão crítica.

> **Substituição de ferramenta:** o ambiente não tem GitHub Copilot. O Claude Code gerou o código (papel do Copilot) e a revisão crítica foi um passo separado de Claude chat sobre o que foi gerado — mesma abordagem dos cenários 1 e 2.

---

## Sumário

Transformei dois guardrails de produto (formalizados pelo PS no cenário 2) em um harness de código determinístico: um **structured output** validado com Zod e **duas verificações** que bloqueiam respostas inválidas antes de chegarem ao atendente. Gerei uma primeira versão, fiz a revisão crítica adversarial (6 achados reais, 2 deles os que o critério exige), corrigi, e **provei com testes** que os guardrails bloqueiam de fato (não apenas logam).

## Entregáveis

| # | Entregável | Arquivo |
|---|-----------|---------|
| T1 | Schema Zod do structured output | [`src/services/response-validator.ts`](../../novatech-assistant/src/services/response-validator.ts) (`AssistantResponseSchema`) |
| T2 | `response-validator.ts` (schema + 2 guardrails + fallback seguro) | mesmo arquivo |
| T3 | Code review (v1 → achados → v2) | [`01-code-review-structured-output.md`](01-code-review-structured-output.md) |
| — | Testes do validador (16 casos) | [`src/.../tests/unit/response-validator.test.ts`](../../novatech-assistant/tests/unit/response-validator.test.ts) |
| — | Evidência (tsc + vitest) | [`evidencia/`](evidencia/) |

## T1 — Schema do structured output

`AssistantResponseSchema` = `{ answer: string(min 1), source_document: string, confidence_score: number[0,1] }`, com **`.strict()`** (rejeita campos extras). Decisão: o schema é o contrato *estrutural*; as regras de negócio (fonte real, negativa de carga perigosa) ficam nos guardrails *semânticos*, separados de propósito — schema valida forma, guardrail valida conteúdo.

> Nota de contrato: o repositório já tem `QueryResponse` com `source_document: SourceDocument[]`. Aqui o **output do modelo** usa `source_document: string` (o formato que o LLM emite, ex.: "POL-001, seção 3.2"), conforme o schema literal do enunciado `{ answer, source_document, confidence_score }`. O mapeamento string → `SourceDocument[]` é responsabilidade da camada de resposta, downstream do validador.

## T2 — O validador e os 2 guardrails

`validateResponse(raw): ValidationOutcome` em duas camadas:

1. **Estrutural:** parseia (aceita objeto ou string JSON; JSON malformado vira `SCHEMA_INVALID`, nunca throw) e valida contra o schema **antes** de olhar o conteúdo.
2. **Semântica:**
   - **G1 — fonte obrigatória:** rejeita se `source_document` é vazio ou uma sentinela de "sem fonte" (`Nenhuma`, `—`, `N/A`…). Conecta diretamente à alucinação da resposta 4 da revisão do PS.
   - **G2 — carga perigosa + devolução:** detecta o tema (plural e acento cobertos) e bloqueia se a resposta **afirma** a devolução ou é **ambígua** (sem negativa explícita). Fundamento: POL-001 §3.2 (classes 1–6 da ANTT não são devolvíveis pelo processo padrão).

Em qualquer falha: `logger.warn` com o motivo (só metadados, nunca o `answer`) + `SAFE_FALLBACK` no mesmo shape, com mensagem de "encaminhe ao supervisor". **Bloqueia, não só loga.**

## T3 — Revisão crítica

6 achados em [`01-code-review-structured-output.md`](01-code-review-structured-output.md), com a v1 (rascunho) e a v2 (corrigida). Os dois exigidos pelo critério: **(#1) schema aceita campos extras** e **(#2) o match de "carga perigosa + devolução" não cobre variações** (plural, caixa, e a negativa por `includes("não")` é burlável). Os demais (faixa do score, sentinelas de fonte, `console.log`/`any`, ausência de fallback) são reais e saíram do mesmo código.

## Verificação (evidência real)

A partir de `cenario-3/novatech-assistant/`:

```
npx tsc -p . --noEmit  → exit 0
npx vitest run         → 3 arquivos, 27 testes (16 novos do validador), exit 0
```

- [`evidencia/tsc-output.txt`](evidencia/tsc-output.txt) — type-check limpo sob strict mode.
- [`evidencia/vitest-output.txt`](evidencia/vitest-output.txt) — os logs `response_rejected` na saída comprovam que o caminho de bloqueio é exercitado e que **só o motivo** é logado.

## Aderência aos critérios de avaliação

| Critério | Como foi atendido |
|----------|-------------------|
| Schema válido com Zod, campos obrigatórios e tipos corretos | `AssistantResponseSchema` `.strict()`, `confidence_score` em `[0,1]` |
| Os 2 guardrails realmente bloqueiam (não só logam) | `validateResponse` retorna `SAFE_FALLBACK`; provado por 16 testes |
| Code review identifica problemas reais | 6 achados do código gerado, 2 deles os exigidos; sem inventar |
| Distinção probabilístico vs determinístico clara | Seção dedicada no code review: prompt reduz probabilidade, código garante o piso |
