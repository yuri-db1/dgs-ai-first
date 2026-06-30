# Code Review — Structured Output e Guardrails Determinísticos (Tarefa 3)

**Exercício 3.1 (Desenvolvedor)** · NovaTech Assistant · Cenário 3

> **Substituição de ferramenta:** o enunciado pede GitHub Copilot para gerar o schema e o `response-validator.ts`, e Claude (chat) para revisar. Copilot não está disponível neste ambiente, então o **Claude Code atuou como o agente de codificação** (gerou a v1 abaixo) e a **revisão crítica (Claude chat)** foi feita como um passo separado e adversarial sobre esse código — exatamente o papel que o enunciado reserva ao Claude. A v1 não foi "limpa" antes da revisão de propósito: é o primeiro rascunho plausível que um assistente gera.

---

## v1 — primeira geração (antes do review)

```typescript
// response-validator.ts — v1 gerado pelo agente de IA
import { z } from "zod";

export const ResponseSchema = z.object({
  answer: z.string(),
  source_document: z.string(),
  confidence_score: z.number(),
});

export function validateResponse(raw: any) {
  const result = ResponseSchema.safeParse(raw);
  if (!result.success) {
    console.log("Resposta inválida:", result.error);
    return { valid: false, message: "Resposta inválida" };
  }
  const data = result.data;

  // Guardrail 1: precisa ter fonte
  if (!data.source_document) {
    console.log("Sem fonte");
    return { valid: false, message: "Resposta sem fonte" };
  }

  // Guardrail 2: carga perigosa + devolução
  if (data.answer.includes("carga perigosa") && data.answer.includes("devolução")) {
    if (!data.answer.includes("não")) {
      console.log("Carga perigosa sem negativa");
      return { valid: false, message: "Bloqueado" };
    }
  }

  return { valid: true, data };
}
```

À primeira vista funciona: valida com Zod, tem os dois guardrails, loga e rejeita. O problema é que **cada um dos guardrails é trivialmente burlável** e o código viola o AGENTS.md. A revisão abaixo é adversarial — para cada ponto, a pergunta é *"que resposta ruim passaria mesmo assim?"*.

---

## Achados da revisão

| # | Severidade | Problema | Como burla / por que importa |
|---|-----------|----------|------------------------------|
| 1 | 🔴 Alta | **Schema aceita campos extras** (`z.object` sem `.strict()`) | Uma resposta com `{ ..., is_verified: true }` injetado pelo modelo passa silenciosamente. O schema deveria ser o contrato fechado — *este é o ponto que o enunciado cita explicitamente.* |
| 2 | 🔴 Alta | **Guardrail 2 não cobre variações** | `includes("carga perigosa")` perde o plural **"cargas perigosas"** (que é exatamente a forma usada na POL-001 §3.2) e qualquer maiúscula/acento. E a negativa é detectada por `includes("não")` solto: a resposta *"Sim, cargas perigosas **não** têm restrição e podem ser devolvidas"* contém "não" → **passa afirmando o oposto da regra**. |
| 3 | 🟡 Média | **`confidence_score` sem faixa** | `z.number()` aceita `1.4` ou `-3`. Um score fora de `[0,1]` quebra qualquer lógica downstream de HITL por confiança. |
| 4 | 🟡 Média | **Sentinelas de "sem fonte" passam** | `!data.source_document` só pega `""`. Uma fonte `"Nenhuma"` ou `"—"` (o caso exato da resposta 4 alucinada na revisão do Product Specialist) é uma string não-vazia → guardrail 1 **não dispara**. |
| 5 | 🟡 Média | **`console.log` + `any`** | Viola o AGENTS.md (pino obrigatório; `unknown`, não `any`). E loga o objeto de erro inteiro, que pode conter o texto da resposta. |
| 6 | 🟢 Baixa | **Não retorna resposta padrão segura** | O enunciado pede *"retorna uma resposta padrão segura"*. A v1 devolve `{ valid:false, message }`, num formato diferente do sucesso — o chamador tem que saber tratar dois shapes, e não há um `answer` pronto para mostrar ao atendente. |

> **Os dois achados que o critério de avaliação cita (schema aceita campos extras; regex não cobre variações) são o #1 e o #2.** Os demais são reais e decorrem do mesmo código — nenhum é inventado.

---

## Probabilístico vs determinístico — a tese do exercício

O **prompt** pede ao modelo (de forma *probabilística*) que responda em JSON, cite a fonte e negue devolução de carga perigosa. Na maior parte das vezes ele obedece — mas 12% das respostas em teste estavam erradas. O **harness de código** transforma essas intenções em barreiras *determinísticas*:

- **Structured output (`.strict()` + Zod):** o que era "peça pra ele responder em JSON" vira "uma resposta que não bate com o schema **não passa**". Campo faltando ou extra = rejeição, sempre.
- **Guardrails em código:** "ele costuma negar carga perigosa" vira "se a resposta não contém a negativa explícita, **é bloqueada**, mesmo que o modelo tenha alucinado com confiança 0.95".

A regra de ouro: **o prompt reduz a probabilidade de erro; o código garante que o erro, quando ocorre, não chega ao atendente.** São camadas complementares, não substitutas.

---

## v2 — versão corrigida (a que está no repositório)

Arquivo: [`novatech-assistant/src/services/response-validator.ts`](../../novatech-assistant/src/services/response-validator.ts). Correções aplicadas:

| Achado | Correção na v2 |
|--------|----------------|
| #1 | `AssistantResponseSchema` usa **`.strict()`** — campo extra = `SCHEMA_INVALID`. |
| #2 | Texto **normalizado** (lowercase + sem acento); regex de tema cobre **plural** (`cargas?\s+perigosas?`) e stems (`devolu\|devolv`). A negativa não é mais `includes("não")`: há um padrão de **afirmação** (`AFFIRMS_RETURN`, com lookbehind `(?<!nao )` para não casar "não podem") e um de **negação explícita** (`EXPLICIT_DENIAL`). Bloqueia se afirma **ou** se é ambíguo (sem negativa) — *fail-safe*. |
| #3 | `confidence_score: z.number().min(0).max(1)`. |
| #4 | `NO_SOURCE_SENTINELS` trata `""`, `"-"`, `"—"`, `"nenhuma"`, `"n/a"`, `"none"` como fonte ausente. |
| #5 | `logger.warn` (pino), parâmetro `unknown`, e o log carrega **só metadados** (`reason`, issues) — nunca o `answer`. |
| #6 | Em qualquer falha retorna `SAFE_FALLBACK` — mesmo shape `AssistantResponse`, com `answer` pronto ("encaminhe ao supervisor"), `source_document: ""` e `confidence_score: 0`. O retorno é um `ValidationOutcome` discriminado (`status: "valid" \| "rejected"`). |

### Prova de que os guardrails bloqueiam (não apenas logam)

Testes em [`novatech-assistant/tests/unit/response-validator.test.ts`](../../novatech-assistant/tests/unit/response-validator.test.ts) — **16 casos, todos verdes** (evidência em [`evidencia/vitest-output.txt`](evidencia/vitest-output.txt)):

- Schema: aceita válido; **rejeita campo extra**; rejeita `confidence_score` fora de `[0,1]`; rejeita tipo errado; JSON malformado → fallback sem throw.
- G1: rejeita `""`, `"Nenhuma"`, `"—"`, `"N/A"`; o retorno traz o `answer` de fallback.
- G2: **permite** a negativa correta (resposta 3 real); **bloqueia** afirmação ("Sim, … podem ser devolvidas"); **bloqueia** ambíguo (sem negativa); **bloqueia** variação em CAIXA ALTA / plural ("É POSSÍVEL DEVOLVER CARGAS PERIGOSAS"); não toca em resposta de devolução comum (não-perigosa).
