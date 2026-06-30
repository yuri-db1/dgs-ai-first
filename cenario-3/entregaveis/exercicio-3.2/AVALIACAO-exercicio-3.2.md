# Avaliação do Exercício 3.2 — Revisão Crítica de Código Gerado por IA

> Avaliação feita com as skills `avaliacao-foundation.md` + `avaliacao-desenvolvedor.md` (cenário 3) e o prompt padrão `prompt-avaliacao.md`.
> Papel: **Desenvolvedor** · Cenário: 3 — Governança e Validação · Exercício: **3.2 — Revisão Crítica**

### Resumo

Entregável exemplar de revisão crítica. A análise própria (anterior ao Claude) é substantiva e identifica as **4 armadilhas obrigatórias** mais 5 problemas reais, todos classificados por tipo. A comparação humano vs Claude é genuinamente honesta — mostra divergência nos dois sentidos. A reescrita segue o AGENTS.md integralmente e é provada por 34 testes, incluindo um teste anti-PII robusto.

### Scores por Dimensão

| Dimensão | Score | Justificativa |
|----------|-------|---------------|
| D1 — Domínio Conceitual | 3 | Distingue violação de norma (AGENTS.md), risco de segurança (PII/LGPD) e bug; entende por que `require` dinâmico é anti-padrão em ESM e por que validação ≠ tipagem (`as any`). |
| D2 — Uso de Ferramentas | 3 | Claude usado como 2º revisor com resultado distinto da análise própria; evidência de geração + revisão; reescrita verificada com tsc/vitest. |
| D3 — Qualidade do Entregável | 3 | Código reescrito completo (validator/store/handler/index + testes), segue o AGENTS.md, type-check limpo, 34 testes verdes. Status HTTP corretos (201/400/502). |
| D4 — Pensamento Crítico | 3 | Análise própria ANTES do Claude, substantiva (9 itens). Pegou 2 pontos (registro acoplado, `authLevel`) que o Claude não citou — competência independente da IA demonstrada. |
| D5 — Aplicabilidade ao Projeto | 3 | Reescrita espelha o padrão real do `query/` do repo; ancora no AGENTS.md do cenário 2; coloca o código no caminho correto (`/src/functions/feedback/handler.ts`). |

**Score do exercício: 3.0**

### Verificação de Armadilhas

| Armadilha obrigatória | Tipo | Identificada? |
|-----------------------|------|---------------|
| `as any` sem validação Zod | Violação AGENTS.md | ✅ §1 #1 |
| `console.log` em vez de pino | Violação AGENTS.md | ✅ §1 #2 |
| `require` dinâmico | Violação AGENTS.md | ✅ §1 #4 |
| `attendantEmail` (PII) logado | Segurança | ✅ §1 #3 |

Para score 3 em D4 a skill exige os 4 na análise própria (antes do Claude) — **atendido**.

### Pontos Fortes

- **Teste anti-PII robusto:** espiona o `logger` (não `process.stdout`, que o pino contorna) e afirma `captured.length > 0` antes de checar — não passa vazio. Raro e correto.
- **Comparação honesta de verdade:** a tabela §3 mostra o humano superando o Claude em 2 itens e o Claude superando o humano em 4 — não há autoelogio nem deferência cega.
- **Injeção de dependência no store:** resolve testabilidade sem mockar ESM nem tocar Cosmos.

### Pontos de Melhoria

- O e-mail é persistido em claro no Cosmos. A revisão menciona PII no log mas não propõe criptografia/pseudonimização at-rest. Ação: nota de follow-up sobre dado pessoal armazenado.
- Faltou um teste para o caminho de env ausente em `createCosmosFeedbackStore` (citado, não coberto).

### Classificação

**Aprovado com distinção (3.0)**

### Tópicos da Trilha para Reforço

Nenhum — score ≥ 2.5 em todas as dimensões.
