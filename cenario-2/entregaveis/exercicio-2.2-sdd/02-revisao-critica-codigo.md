# Tarefa 3 — Revisão crítica do código gerado (T1)

O código da T1 **compila** (`tsc --noEmit` exit 0) e **passa nos testes** (11/11). Mesmo assim, vários pontos precisariam de ajuste antes de um code review de produção. Cada item é real, extraído do código de fato gerado — não inventado para cumprir a tarefa — com a correção proposta.

> Convenção de severidade: 🔴 bloqueante para produção · 🟡 ajustar antes do merge · 🔵 decisão a confirmar.

---

## 1. 🔴 O stub de 200 não pode chegar à produção

**Onde:** `handler.ts` — caminho de input válido retorna `{ answer: "", source_document: [], pending: true }`.

**Problema:** é o comportamento correto para a T1 (pipeline ainda não conectado), mas um consumidor real — o bot do Teams — receberia **HTTP 200 com `answer` vazio** e renderizaria uma mensagem em branco para o atendente. Um 200 "de mentira" é pior que um erro explícito: parece sucesso.

**Correção:** proteger o caminho válido até a T9 estar pronta — retornar **501 Not Implemented** enquanto o pipeline não existe, ou colocar atrás de uma *feature flag* (`PIPELINE_ENABLED`) que, desligada, responde 503 com aviso. O `pending: true` vira sinal interno, não resposta entregue ao usuário final.

## 2. 🟡 Resposta de erro não honra o guardrail "citar fonte em toda resposta"

**Onde:** `handler.ts` — caminhos 400/500 retornam `{ error: { code, message, issues? } }`, um contrato **diferente** do `QueryResponse`.

**Problema:** o guardrail de produto diz "incluir `source_document` no JSON de retorno, mesmo com confiança baixa". As respostas de erro fogem desse contrato, então um cliente que sempre lê `source_document` quebra em caso de erro. Há uma inconsistência de contrato (objeto de sucesso vs. objeto de erro) que precisa ser decidida, não deixada implícita.

**Correção:** alinhar com o Product Specialist um **contrato de erro único** — ou os erros também seguem `QueryResponse` (com `source_document: []` + `answer` de aviso), ou define-se formalmente um `ErrorResponse` separado e o guardrail é reescrito para valer só no caminho de sucesso. Registrar a decisão (ADR/seção do AGENTS.md).

## 3. 🔵 `authLevel: "function"` foi decidido dentro do código, sem ADR

**Onde:** `index.ts` — `app.http("query", { authLevel: "function", ... })`.

**Problema:** o nível de autenticação foi *hardcoded* como function key. A integração real (bot do Teams + painel web) pode exigir Azure AD / APIM / managed identity. Essa é uma decisão de arquitetura/segurança que não deveria ser um default silencioso de quem implementa a T1.

**Correção:** confirmar a estratégia de auth com o Tech Lead e registrar em ADR; provavelmente `anonymous` atrás de APIM/AAD em vez de function key. Até lá, marcar com `// TODO(ADR): confirmar authLevel` para não passar despercebido no review.

## 4. 🟡 Logging via pino não se integra ao contexto do Azure Functions

**Onde:** `logger.ts` — instância pino de nível de módulo escrevendo em stdout.

**Problema:** funciona (os testes mostram o JSON estruturado), mas em produção no Azure Functions o pino em stdout **não correlaciona** automaticamente com a invocação no Application Insights, e duplica o canal de log do runtime (`context.log`). Perde-se a rastreabilidade por invocação no APM.

**Correção:** decidir a estratégia de observabilidade — ou um transport do pino para o Application Insights, ou uma ponte que injete o `invocationId`/operation id em cada log. Tarefa natural da T2 (config) + uma ADR de observabilidade.

## 5. 🔵 Falta `requestId` na resposta ao cliente

**Onde:** `handler.ts` — o `invocationId` aparece nos logs, mas **não** no corpo retornado (nem no sucesso, nem no erro).

**Problema:** quando o atendente reportar "o assistente errou", não há um id que ele consiga citar para o suporte cruzar com os logs. Triagem fica cara.

**Correção:** incluir `requestId` (o próprio `invocationId` ou um gerado) em todo corpo de resposta — especialmente nos erros — e propagá-lo no header de resposta.

---

## Resumo

| # | Severidade | Ponto | Correção |
|---|-----------|-------|----------|
| 1 | 🔴 | Stub 200 vaza para produção | 501/feature-flag até T9 |
| 2 | 🟡 | Erro não segue contrato com `source_document` | contrato de erro único (alinhar c/ PS) |
| 3 | 🔵 | `authLevel` decidido no código | confirmar via ADR (provável APIM/AAD) |
| 4 | 🟡 | pino não correlaciona no App Insights | transport/ponte de observabilidade (T2) |
| 5 | 🔵 | Sem `requestId` no retorno | propagar id em corpo+header |

**Leitura geral:** o agente acertou a estrutura, os padrões do plan (Functions v4, Zod, pino, strict, sem `console.log`) e a fronteira da task. As lacunas são de **decisões que extrapolam a T1** (auth, contrato de erro, observabilidade) e de **higiene de produção** (não vazar stub, rastreabilidade) — exatamente o tipo de coisa que um code review humano precisa pegar antes do merge (Gate 3).
