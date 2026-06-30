# Avaliação do Exercício 3.1 — Structured Output e Verificações Determinísticas

> Avaliação feita com as skills `avaliacao-foundation.md` + `avaliacao-desenvolvedor.md` (cenário 3) e o prompt padrão `prompt-avaliacao.md`.
> Papel: **Desenvolvedor** · Cenário: 3 — Governança e Validação · Exercício: **3.1 — Harness Engineering**

### Resumo

Entregável forte e completo. O participante transformou os 2 guardrails de produto em código determinístico que **bloqueia de fato** (provado por 16 testes verdes), articulou com clareza a distinção entre o prompt (probabilístico) e o código (determinístico), e fez uma revisão crítica adversarial que pegou os 2 problemas exigidos mais 4 reais. Conexão profunda com POL-001 e com a revisão do PS (resposta 4).

### Scores por Dimensão

| Dimensão | Score | Justificativa |
|----------|-------|---------------|
| D1 — Domínio Conceitual | 3 | Explica por que structured output (`.strict()` + Zod) é mais confiável que pedir a fonte no prompt; seção dedicada "probabilístico vs determinístico" com a tese correta (prompt reduz probabilidade, código garante o piso). |
| D2 — Uso de Ferramentas | 3 | Evidência de geração (v1) **e** revisão crítica (v2 com correções rastreadas). A substituição Copilot→Claude Code está declarada e a revisão é genuinamente adversarial, não cosmética. |
| D3 — Qualidade do Entregável | 3 | Código funcional, type-check limpo, 16 testes cobrindo schema + ambos guardrails + fallback. Os guardrails retornam `SAFE_FALLBACK` (bloqueiam, não só logam) — supera a regra de corte D3≤2. |
| D4 — Pensamento Crítico | 3 | Revisão pega os 2 achados exigidos (campos extras, regex sem variações) + 4 reais. O caso de burla de `includes("não")` ("Sim, … não têm restrição e podem ser devolvidas") demonstra raciocínio adversarial real. |
| D5 — Aplicabilidade ao Projeto | 3 | Ancora G2 na POL-001 §3.2 (classes ANTT), conecta G1 à resposta 4 alucinada da revisão do PS, e referencia o contrato `QueryResponse`/`SourceDocument[]` do repo, atribuindo os guardrails ao PS do cenário 2. |

**Score do exercício: 3.0**

### Verificação de Armadilhas

Este exercício não tem armadilhas de "resposta errada"; tem requisitos de qualidade do harness. Verificação dos pontos críticos da skill do papel:

| Item | Atendido? |
|------|-----------|
| Schema Zod válido com campos obrigatórios e tipos | ✅ `.strict()`, `confidence_score` em `[0,1]` |
| Guardrail 1 bloqueia de fato (não só loga) | ✅ retorna fallback; testes provam |
| Guardrail 2 detecta combinação e bloqueia sem negativa | ✅ cobre plural/caixa; lookbehind evita falso-positivo de "não podem" |
| Code review com 2+ problemas reais + correção | ✅ 6 achados, 2 exigidos contemplados |
| Probabilístico vs determinístico não confundido | ✅ seção dedicada, correta |

### Pontos Fortes

- **Fail-safe no G2:** bloquear também o caso ambíguo (sem negativa explícita), não só o que afirma — decisão de segurança correta para tema sensível.
- **Testes como prova de bloqueio:** os critérios "bloqueia, não loga" são demonstrados, não afirmados.
- **Rastreabilidade da correção:** cada achado do review tem a linha correspondente da v2.

### Pontos de Melhoria

- O mapeamento `source_document: string` → `SourceDocument[]` do repo é mencionado mas não implementado. Ação: um adaptador pequeno fecharia o contrato com o `query/response-builder.ts`.
- G2 é específico para PT-BR; uma resposta em inglês sobre devolução de carga perigosa não seria detectada (cf. QA 3.1 resposta 8). Ação: documentar a premissa de idioma ou normalizar idioma antes.

### Classificação

**Aprovado com distinção (3.0)**

### Tópicos da Trilha para Reforço

Nenhum — score ≥ 2.5 em todas as dimensões.
