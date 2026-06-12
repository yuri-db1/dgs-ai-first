# Tasks — Query Endpoint

> Derivado do `plan.md` do query endpoint (cenário 1 → fase de estruturação).
> Fluxo SDD: `requirements.md` → `plan.md` → **`tasks.md`** → implementação.
> Cada task é uma fatia vertical implementável e testável de forma independente.
> Estimativa: **P** (pequena, ~½ dia) · **M** (média, ~1–2 dias) · **G** (grande, >2 dias).
> Padrões herdados do plan: TypeScript strict, Azure Functions v4, Zod, pino, retry com
> backoff exponencial. Context budget: ADR-0002 (~4K system + ~8K chunks, histórico ≤3 turnos).
> Contradições de documento: ADR-0003 (metadado de vigência, priorizar mais recente).

| ID | Estimativa | Depende de |
|----|-----------|------------|
| T1 | M | — |
| T2 | P | — |
| T3 | M | T2 |
| T4 | M | T2 |
| T5 | M | — |
| T6 | M | T2 |
| T7 | P | T4 |
| T8 | M | T7 |
| T9 | M | T1, T3, T4, T5, T6, T7, T8 |
| T10 | M | T9 |

---

## T1 — Skeleton do endpoint (Functions v4) + validação de input ✅ implementada

**Descrição:** Criar o HTTP trigger `POST /api/query` no modelo de programação v4 e validar o input com Zod, sem ainda acionar o pipeline de RAG. Inclui as fundações mínimas sem as quais o endpoint não recebe/valida/loga: `logger` (pino), taxonomia de erros e tipos do contrato de resposta. **Fronteira explícita:** busca, prompt, completion e validação de resposta NÃO entram aqui (são T3–T8).

**Critérios de aceite (verificáveis):**
- `POST /api/query` registrado via `app.http` com `methods:["POST"]`.
- Body que não é JSON válido → **HTTP 400** com `error.code = "INVALID_JSON"` (nunca 500).
- Body sem `query` → **400** com `error.code = "VALIDATION_ERROR"` e um issue com `field = "query"`.
- `query` com menos de 3 caracteres → **400**.
- `tier` fora de `{Gold, Silver, Standard}` (ex.: "Platinum") → **400** com issue `field = "tier"`.
- `history` com mais de 3 turnos → **400** com issue `field = "history"` (ADR-0002).
- Input válido → **HTTP 200** com corpo `{ answer, source_document: [], pending: true }`.
- Nenhuma ocorrência de `console.log`; logs emitidos via `logger` (pino), sem registrar a pergunta crua.
- `npx tsc -p . --noEmit` sem erros; testes da T1 passam no Vitest.

**Arquivos:** `src/functions/query/{handler,validator,index}.ts`, `src/shared/{logger,errors,types}.ts`, `tests/{unit/validator,integration/query-handler}.test.ts`, `package.json`.

## T2 — Config de ambiente validada com Zod

**Descrição:** `src/shared/config.ts` lê variáveis de ambiente (endpoints/keys do Azure OpenAI e AI Search, `LOG_LEVEL`) e as valida com Zod no startup, expondo um objeto `config` tipado e congelado.

**Critérios de aceite:**
- Variável obrigatória ausente → erro no startup com a lista de variáveis faltantes (não falha silenciosa).
- `config` é `readonly`/`Object.freeze`; nenhum acesso direto a `process.env` fora de `config.ts`.
- Teste cobre: env completo → ok; env incompleto → lança com mensagem listando o que falta.

## T3 — Serviço de embedding (Azure OpenAI) com retry/backoff

**Descrição:** `src/services/embeddings.ts` expõe `embedQuery(text): Promise<number[]>` chamando o Azure OpenAI, com retry e backoff exponencial.

**Critérios de aceite:**
- Retorna vetor de dimensão esperada para um texto válido (mockado via msw).
- Falha transitória (HTTP 429/503) → reintenta com backoff exponencial até N tentativas; falha definitiva → lança erro tipado.
- Número de tentativas e atrasos são configuráveis e testados (sem `sleep` real nos testes).

## T4 — Serviço de busca top-5 (Azure AI Search)

**Descrição:** `src/services/search.ts` expõe `searchChunks(embedding, topK=5): Promise<Chunk[]>`. No cenário local, lê de `data/retrieval-corpus/`; em produção, Azure AI Search. Carrega metadado de vigência por chunk (ADR-0003).

**Critérios de aceite:**
- Retorna no máximo `topK` chunks, cada um com `documentId`, `section`, `content` e `confidence`.
- Pergunta sem match relevante → retorna lista vazia (não inventa chunk).
- Para "Posso devolver carga perigosa?" o gabarito do Anexo B (POL-001-B) está entre os recuperados (fixture).

## T5 — Prompt builder respeitando context budget (ADR-0002)

**Descrição:** `src/services/prompt-builder.ts` monta system prompt (de `prompts/system-prompt.md`) + chunks + pergunta + histórico (≤3 turnos), respeitando ~4K tokens de system e ~8K de chunks.

**Critérios de aceite:**
- System prompt ≤ ~4K tokens; chunks truncados/limitados para ≤ ~8K tokens (5 × ~1.5K).
- Histórico acima de 3 turnos é cortado para os 3 mais recentes.
- Cada chunk incluído no prompt carrega seu identificador de fonte (para citação posterior).

## T6 — Serviço de completion (GPT-4o) com retry/backoff

**Descrição:** `src/services/completion.ts` expõe `complete(prompt): Promise<string>` chamando GPT-4o no Azure OpenAI, com retry/backoff (reusa a política da T3).

**Critérios de aceite:**
- Resposta de texto para prompt válido (mockado).
- Timeout e retry configuráveis e testados; falha definitiva → erro tipado, sem travar o handler.

## T7 — Response builder com `source_document` e vigência (ADR-0003)

**Descrição:** `src/functions/query/response-builder.ts` monta o `QueryResponse` a partir da resposta do modelo + chunks usados, preenchendo `source_document` (documentId + section + confidence).

**Critérios de aceite:**
- Toda resposta inclui `source_document` não vazio quando há chunks; vazio + aviso quando não há.
- Se duas versões do mesmo documento aparecem, prioriza a vigente e sinaliza a existência da anterior (ADR-0003).

## T8 — Response validator determinístico (harness de guardrails)

**Descrição:** `src/services/response-validator.ts` valida a resposta do modelo de forma determinística antes de retornar.

**Critérios de aceite:**
- Rejeita/sinaliza resposta que cita tier inexistente (só Gold/Silver/Standard).
- Rejeita resposta sem nenhuma citação de fonte quando havia chunks.
- Sinaliza valores numéricos (prazos/multiplicadores) não presentes nos chunks (anti-alucinação).

## T9 — Orquestração end-to-end no handler + mapeamento de erros

**Descrição:** Conectar T3–T8 no `queryHandler`: embed → search → prompt → complete → validate → build response. Substituir o stub `pending` da T1 pela resposta real. Mapear erros de cada etapa para HTTP apropriado.

**Critérios de aceite:**
- Pergunta válida com match → 200 com `answer` real + `source_document` preenchido.
- Falha de dependência (Azure indisponível) → degrada com aviso e status apropriado, sem alucinar.
- `pending` não aparece mais em respostas de produção.

## T10 — Testes de integração do fluxo completo (msw + fixtures)

**Descrição:** Testes de integração ponta a ponta com `msw` mockando Azure e fixtures de `tests/fixtures/` (chunks, queries, expected responses), derivados do Anexo B.

**Critérios de aceite:**
- Cobre os verification criteria do requirements (VC-01..VC-04): resposta cita fonte; carga perigosa + devolução → negativa explícita; pergunta sem match → mensagem padrão.
- Cobertura de linhas ≥ 80% (gate do `vitest.config.ts`).
- Nenhum teste acessa serviço real.
