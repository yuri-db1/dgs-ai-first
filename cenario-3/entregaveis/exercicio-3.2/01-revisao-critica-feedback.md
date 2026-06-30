# Revisão Crítica de Código Gerado por IA — Módulo de Feedback (Exercício 3.2)

**Cenário 3** · Papel: **Desenvolvedor** · Tópico: Revisão Crítica de Outputs de IA
**Ferramentas:** revisão própria → Claude (chat) como 2º revisor → reescrita.

> **Regra do exercício:** a análise própria vem ANTES do Claude. Esta seção 1 foi escrita lendo o código gerado, sem assistente. A seção 2 é o que o Claude acrescentou. A seção 3 compara honestamente.

---

## 1. Minha revisão (antes do Claude)

Código revisado: o `feedback-handler.ts` gerado pelo Copilot (no enunciado). Comparei linha a linha com o AGENTS.md (*TS strict; Zod para input; pino, nunca console.log; nunca logar dado pessoal; imports estáticos no topo*).

| # | Problema | Tipo | Linha(s) | Por que importa |
|---|----------|------|----------|-----------------|
| 1 | `body = await request.json() as any` — sem validação | **Violação AGENTS.md** (Zod obrigatório) + bug | 11 | `rating: "abc"`, `queryId` ausente, ou payload gigante entram direto no banco. Nenhuma garantia de tipo nem de formato. |
| 2 | `console.log('Feedback recebido:', ...)` | **Violação AGENTS.md** (pino obrigatório) | 18 | Log não estruturado, não filtrável, e fora do pipeline de observabilidade. |
| 3 | `console.log` loga o objeto `feedback` inteiro, **incluindo `attendantEmail`** | **Segurança / privacidade** (PII) | 18 | E-mail do atendente é dado pessoal. Logar PII viola o AGENTS.md e potencialmente LGPD. O `comment` também pode conter PII. |
| 4 | `const { CosmosClient } = require('@azure/cosmos')` dentro da função | **Violação AGENTS.md** (import estático no topo) | 20 | `require` dinâmico em ESM é anti-padrão, reinstancia o client a cada request, e quebra tree-shaking/tipagem. |
| 5 | `new CosmosClient(process.env.COSMOS_CONNECTION_STRING)` sem checar a env | Bug potencial | 21 | Se a env não está setada, o erro estoura em runtime no meio do request, com mensagem obscura. Deveria falhar no startup. |
| 6 | Nenhum `try/catch` em torno do `container.items.create` | Bug potencial | 25 | Se o Cosmos falha, a função estoura 500 não tratado — e o stack pode vazar o payload (PII de novo). |
| 7 | `return { status: 200, body: 'OK' }` | Qualidade | 27 | Criação deveria ser **201**, e devolver o `id` criado para o cliente correlacionar. `body: 'OK'` (texto) em vez de JSON. |
| 8 | `app.http` registrado no mesmo arquivo do handler | Qualidade / testabilidade | 31-34 | Importar o handler num teste dispara o side-effect de registro no host. (No repo, query separa isso em `index.ts`.) |
| 9 | Sem `authLevel` no `app.http` | Segurança | 31 | Endpoint de escrita sem nível de auth declarado → default pode expor a rota. |

**As 4 armadilhas que o exercício exige estão em #1 (`as any`), #2 (`console.log`), #4 (`require` dinâmico) e #3 (`attendantEmail` logado).** As demais (#5–#9) são reais e saem da mesma leitura.

---

## 2. Revisão do Claude (2º revisor)

Pedi ao Claude uma revisão independente do mesmo trecho, contra o mesmo AGENTS.md. O Claude confirmou os 4 itens obrigatórios e #5–#7. Acrescentou pontos que eu **não** tinha listado explicitamente:

- **A.** `rating` não tem faixa: mesmo com Zod, é preciso `z.number().int().min(1).max(5)` — senão `rating: 999` ou `rating: 4.5` passam. (Eu tinha dito "validar com Zod", mas não especifiquei a regra de domínio.)
- **B.** Schema deveria ser **`.strict()`**: sem isso, um cliente injeta campos extras (`isAdmin`, `internalNote`) que vão parar no documento do Cosmos.
- **C.** O `comment` também é potencial PII e não deveria ser logado — eu citei o e-mail, mas o Claude estendeu o cuidado ao comentário e ao stack de erro.
- **D.** Diferenciar o código de falha: validação → 400, persistência → 5xx (502/503), não tudo 500.

---

## 3. Comparação honesta (humano vs Claude)

| Achado | Eu | Claude |
|--------|----|--------|
| `as any` sem Zod (#1) | ✅ | ✅ |
| `console.log` vs pino (#2) | ✅ | ✅ |
| `attendantEmail` logado (#3) | ✅ | ✅ |
| `require` dinâmico (#4) | ✅ | ✅ |
| Env não checada (#5) | ✅ | ✅ |
| Sem try/catch na persistência (#6) | ✅ | ✅ |
| Status 200 vs 201 + body texto (#7) | ✅ | ✅ |
| Registro acoplado ao handler (#8) | ✅ | ➖ (não citou) |
| `authLevel` ausente (#9) | ✅ | ➖ (não citou) |
| Faixa de `rating` (A) | ➖ (genérico) | ✅ (específico) |
| `.strict()` no schema (B) | ➖ | ✅ |
| `comment`/stack também são PII (C) | parcial | ✅ |
| 400 vs 5xx por tipo de falha (D) | ➖ | ✅ |

**Conclusão da comparação:** não concordamos em tudo. Peguei os 4 obrigatórios e dois pontos de arquitetura/segurança que o Claude deixou passar (registro acoplado, `authLevel`). O Claude foi mais preciso nas **regras de domínio do Zod** (faixa de rating, `.strict()`) e em estender o conceito de PII para além do e-mail. A reescrita incorpora a união dos dois.

---

## 4. Código reescrito (no repositório)

Aderente ao AGENTS.md. Arquivos:

| Arquivo | Papel |
|---------|-------|
| [`feedback/validator.ts`](../../novatech-assistant/src/functions/feedback/validator.ts) | Schema Zod `.strict()`; `rating` int 1–5; `attendantEmail` validado; `comment` bounded |
| [`feedback/store.ts`](../../novatech-assistant/src/functions/feedback/store.ts) | `CosmosClient` **import estático**; env checada no startup; `FeedbackStore` injetável |
| [`feedback/handler.ts`](../../novatech-assistant/src/functions/feedback/handler.ts) | pino (nunca console.log); loga **só** `queryId`/`rating`/`feedbackId`; 400 validação, 502 persistência, 201 sucesso com `id` |
| [`feedback/index.ts`](../../novatech-assistant/src/functions/feedback/index.ts) | `app.http` separado, com `authLevel: "function"` |
| [`tests/integration/feedback-handler.test.ts`](../../novatech-assistant/tests/integration/feedback-handler.test.ts) | 7 testes, incluindo um que prova que **PII nunca chega ao logger** |

### Como cada problema foi resolvido

| # | Antes | Depois |
|---|-------|--------|
| 1 | `as any` | `parseFeedbackRequest` (Zod `safeParse` → `ValidationError`) |
| 2 | `console.log` | `logger.info/warn/error` (pino) |
| 3 | loga e-mail | log carrega só `queryId`, `rating`, `feedbackId` — e-mail e comment **nunca** logados (teste prova) |
| 4 | `require` dinâmico | `import { CosmosClient } from "@azure/cosmos"` no topo de `store.ts` |
| 5 | env não checada | `createCosmosFeedbackStore` lança se `COSMOS_CONNECTION_STRING` ausente |
| 6 | sem try/catch | `try/catch` → 502 `PERSIST_FAILED`, log sem payload |
| 7 | 200 + `'OK'` | 201 + `{ id }` JSON |
| 8 | registro acoplado | `index.ts` separado (handler testável sem side-effect) |
| 9 | sem authLevel | `authLevel: "function"` |
| A/B | rating livre, sem strict | `z.number().int().min(1).max(5)` + `.strict()` |

### Prova (evidência real)

```
npx tsc -p . --noEmit  → exit 0
npx vitest run         → 34 testes, exit 0 (7 do feedback)
```

Ver [`evidencia/`](evidencia/). O teste *"never passes PII to the logger"* espiona o `logger` diretamente (não `process.stdout`, que o pino contorna) e afirma `captured.length > 0` antes de checar — então não passa vazio.
