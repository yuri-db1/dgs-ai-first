# Relatório — Exercício 3.2 (Desenvolvedor): Revisão Crítica de Código Gerado por IA

**Cenário-Âncora 3 — Fase de Governança e Validação** · Papel: **Desenvolvedor** · Projeto: **NovaTech Assistant**
**Tópico:** Revisão Crítica de Outputs de IA · **Ferramentas:** revisão própria + Claude (chat) + reescrita.

---

## Sumário

Revisei o módulo de feedback gerado pelo Copilot **antes** de usar o Claude, identificando as 4 violações obrigatórias (`as any`, `console.log`, `require` dinâmico, `attendantEmail` logado) mais 5 problemas reais. Usei o Claude como 2º revisor, comparei honestamente (cada um pegou coisas que o outro não pegou), e reescrevi o módulo aderente ao AGENTS.md — **provado por 34 testes verdes**, incluindo um que garante que PII nunca chega ao logger.

## Entregáveis

| # | Entregável | Arquivo |
|---|-----------|---------|
| T1 | Revisão própria (antes do Claude), classificada por tipo | [`01-revisao-critica-feedback.md`](01-revisao-critica-feedback.md) §1 |
| T2 | Revisão do Claude + comparação | [`01-revisao-critica-feedback.md`](01-revisao-critica-feedback.md) §2–3 |
| T3 | Código reescrito (segue o AGENTS.md) | `novatech-assistant/src/functions/feedback/` |
| — | Testes (7 do feedback) | [`tests/integration/feedback-handler.test.ts`](../../novatech-assistant/tests/integration/feedback-handler.test.ts) |
| — | Evidência (tsc + vitest) | [`evidencia/`](evidencia/) |

## Revisão (T1–T2)

9 problemas na revisão própria, classificados em **violação do AGENTS.md** (4), **segurança** (2) e **bug potencial / qualidade** (3). As 4 armadilhas obrigatórias do exercício estão entre eles. O Claude confirmou os obrigatórios e acrescentou regras de domínio do Zod (faixa de `rating`, `.strict()`) e a extensão do conceito de PII ao `comment`/stack. A comparação mostra divergência real nos dois sentidos — não é "concordamos em tudo".

## Reescrita (T3)

Estrutura espelhando o padrão do `query/` do repo: `validator.ts` (Zod), `store.ts` (Cosmos com import estático + DI), `handler.ts` (pino, sem PII, status corretos), `index.ts` (registro isolado com `authLevel`). O handler recebe um `FeedbackStore` injetável → testável sem Cosmos.

**Pontos de segurança na reescrita:**
- E-mail e comentário são **persistidos** (o domínio pode precisar contatar o atendente) mas **nunca logados** — log carrega só `queryId`, `rating`, `feedbackId`.
- Falha de persistência → 502 com mensagem genérica; o `errorMeta` reduz o erro a `{name, message}` para não vazar payload no stack.

## Verificação (evidência real)

A partir de `cenario-3/novatech-assistant/`:

```
npx tsc -p . --noEmit  → exit 0
npx vitest run         → 4 arquivos, 34 testes, exit 0 (7 do feedback)
```

- [`evidencia/tsc-output.txt`](evidencia/tsc-output.txt) — type-check limpo (strict).
- [`evidencia/vitest-output.txt`](evidencia/vitest-output.txt) — os logs `feedback_received` na saída mostram **só metadados** (sem e-mail/comment), confirmando o fix da armadilha de PII.

## Aderência aos critérios de avaliação

| Critério | Como foi atendido |
|----------|-------------------|
| Identifica `as any`, `console.log`, `require` dinâmico, `attendantEmail` logado | Os 4 na revisão própria (§1, itens #1–#4) |
| Comparação humano vs Claude honesta | Tabela §3: cada um pegou itens que o outro não pegou |
| Código reescrito resolve os problemas e segue o AGENTS.md | Tabela "antes/depois"; tsc + 34 testes provam |
