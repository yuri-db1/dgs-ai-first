# Relatório — Exercício 2.2 (Desenvolvedor): Implementação de spec com SDD

**Cenário-Âncora 2 — Fase de Estruturação** · Papel: **Desenvolvedor** · Projeto: **NovaTech Assistant**
**Ferramentas:** Claude (chat/Claude Code) como agente de codificação + verificação real (npm/tsc/vitest).

> **Substituição de ferramenta:** o enunciado pede GitHub Copilot para implementar. Copilot não está disponível neste ambiente, então o Claude Code atuou como o agente de codificação de IA (mesma abordagem do 2.1). A Tarefa 3 (revisão crítica) avalia esse código gerado.

---

## Sumário

Executei o ciclo SDD `plan → tasks → implement` para o **query endpoint**: decompus o `plan.md` (fornecido no enunciado) em um `tasks.md` de tasks atômicas, implementei a primeira task (skeleton do endpoint + validação de input) seguindo os padrões do plan, **provei que compila e passa nos testes**, e fiz a revisão crítica do código gerado.

## Entregáveis

| # | Entregável | Arquivo |
|---|-----------|---------|
| T1 | `tasks.md` com tasks atômicas (ID, aceite, dependências, P/M/G) | [`novatech-assistant/specs/query-endpoint/tasks.md`](../../novatech-assistant/specs/query-endpoint/tasks.md) |
| T2 | Código da primeira task implementado | `novatech-assistant/src/...` (ver abaixo) |
| T3 | Revisão crítica (≥2 pontos reais + correção) | [`02-revisao-critica-codigo.md`](02-revisao-critica-codigo.md) |
| — | Evidência de execução (tsc + vitest) | [`evidencia/`](evidencia/) |

## Decomposição plan → tasks (Tarefa 1)

O `plan.md` descreve um fluxo de 5 passos (receber → embedding → buscar top-5 → montar prompt → completar e retornar com `source_document`). Decompus em **10 tasks atômicas** (T1–T10), cada uma uma fatia vertical testável de forma independente, com dependências explícitas. Princípios aplicados:
- **Atomicidade:** cada serviço do pipeline (embedding, busca, prompt, completion, response builder, validador) é uma task isolada, testável com mocks — não um monólito "implementar o endpoint".
- **Critérios de aceite verificáveis:** escritos como asserções concretas (ex.: *"`history` com mais de 3 turnos → 400 com issue `field='history'`"*), nunca "funcionar corretamente".
- **Rastreabilidade às ADRs:** context budget (ADR-0002) na T5; vigência de documentos (ADR-0003) na T4/T7.

## Primeira task implementada (Tarefa 2)

**T1 — Skeleton do endpoint (Azure Functions v4) + validação de input (Zod).** Arquivos:

| Arquivo | Papel |
|---------|-------|
| `src/functions/query/validator.ts` | Schema Zod + `parseQueryRequest` (lança `ValidationError` com issues formatadas) |
| `src/functions/query/handler.ts` | `queryHandler` — parse defensivo do body, validação, log estruturado, 400/200. Sem side-effect de registro (testável direto) |
| `src/functions/query/index.ts` | Registro `app.http("query", …)` isolado do handler |
| `src/shared/logger.ts` | Logger pino (nível via `LOG_LEVEL`); proíbe `console.log` |
| `src/shared/errors.ts` | `AppError` base + `ValidationError` (status + code estáveis) |
| `src/shared/types.ts` | Contrato `QueryResponse`, `SourceDocument`, `Tier` |
| `package.json` | + `@azure/functions`, `pino`, `@types/node` |

Padrões do plan seguidos: **TypeScript strict, Azure Functions v4 (`app.http`), Zod para validação, pino para log estruturado, sem `console.log`**. Toques de domínio embutidos na validação: `tier` restrito a Gold/Silver/Standard (rejeita "Platinum"); `history` limitado a 3 turnos (context budget, ADR-0002); só metadados são logados (nunca a pergunta crua).

**Decisão de design:** o registro `app.http` foi separado em `index.ts` para que importar o `handler` (nos testes) não dispare side-effect de registro no host. Os imports de `@azure/functions` no handler são type-only (apagados em runtime), então o handler não tem dependência de runtime do host e é testável isoladamente.

## Verificação (evidência real)

A partir de `cenario-2/novatech-assistant/`:

```
npm install           → added 63 packages
npx tsc -p . --noEmit → exit 0  (zero erros sob strict mode)
npx vitest run        → Test Files 2 passed (2) · Tests 11 passed (11) · exit 0
```

- [`evidencia/tsc-output.txt`](evidencia/tsc-output.txt) — type-check limpo.
- [`evidencia/vitest-output.txt`](evidencia/vitest-output.txt) — 11 testes (6 do validator + 5 do handler). Os logs pino na saída comprovam o log estruturado e que **só metadados** (`queryLength`, não a pergunta) são registrados.

Cobertura de casos: JSON inválido → 400 `INVALID_JSON`; `query` ausente/curta → 400 com `field`; tier inventado → 400 `field=tier`; histórico >3 → 400 `field=history`; input válido → 200 `pending`.

## Revisão crítica (Tarefa 3)

5 pontos reais documentados em [`02-revisao-critica-codigo.md`](02-revisao-critica-codigo.md), com severidade e correção. Os mais relevantes: (1) 🔴 o stub 200 não pode vazar para produção; (2) 🟡 a resposta de erro não honra o guardrail de `source_document`; (4) 🟡 pino não correlaciona no Application Insights. Nenhum problema inventado — todos decorrem do código de fato gerado.

## Aderência aos critérios de avaliação

| Critério | Como foi atendido |
|----------|-------------------|
| Tasks realmente atômicas | 10 fatias verticais independentes, cada uma testável com mocks; dependências explícitas |
| Critérios de aceite verificáveis | Asserções concretas (status/campo), não "funcionar corretamente" |
| Código funcional e segue o plan | TS strict + Zod + Functions v4 + pino; **provado** por `tsc` (exit 0) e `vitest` (11/11) |
| Revisão crítica identifica problemas reais | 5 pontos extraídos do código gerado, com correção; sem inventar |

## Notas

- `npm install` criou `node_modules/` e `package-lock.json` no repo de trabalho. `node_modules/` já está no `.gitignore`; o lockfile pode ser versionado (boa prática) ou descartado conforme preferência.
- Tasks T2–T10 ficam para as próximas iterações do ciclo SDD (fora do escopo desta tarefa, que pede só a primeira task).
