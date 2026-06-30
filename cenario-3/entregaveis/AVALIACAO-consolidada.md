# Avaliação Consolidada — Cenário 3 (Desenvolvedor)

**Trilha de Certificação AI First — DGS / DB1 Global Software**
**Papel:** Desenvolvedor · **Cenário-Âncora 3 — Fase de Governança e Validação**
Avaliação com as skills `avaliacao-foundation.md` + `avaliacao-desenvolvedor.md` + prompt padrão `prompt-avaliacao.md`.

---

## Visão geral

| Exercício | Tópico | Score | Classificação |
|-----------|--------|-------|---------------|
| 3.1 — Structured output e verificações determinísticas | Harness Engineering | **3.0** | Aprovado com distinção |
| 3.2 — Revisão crítica de código gerado por IA | Revisão Crítica de Outputs de IA | **3.0** | Aprovado com distinção |

**Score do cenário (média dos 2 exercícios): 3.0 — Aprovado com distinção.**

## Scores por dimensão

| Dimensão | 3.1 | 3.2 |
|----------|-----|-----|
| D1 — Domínio Conceitual | 3 | 3 |
| D2 — Uso de Ferramentas | 3 | 3 |
| D3 — Qualidade do Entregável | 3 | 3 |
| D4 — Pensamento Crítico | 3 | 3 |
| D5 — Aplicabilidade ao Projeto | 3 | 3 |

## Armadilhas (cenário com foco em revisão crítica)

- **3.1** (sem armadilha de "resposta errada"): os 2 problemas exigidos no code review foram identificados (schema aceita campos extras; match de carga perigosa não cobre variações), mais 4 reais.
- **3.2**: as **4 armadilhas obrigatórias** foram identificadas na análise própria, antes do Claude — `as any` sem Zod, `console.log` vs pino, `require` dinâmico, `attendantEmail` logado.

## Evidência verificável

Tudo foi provado, não apenas afirmado, a partir de `cenario-3/novatech-assistant/`:

```
npx tsc -p . --noEmit  → exit 0
npx vitest run         → 4 arquivos, 34 testes, exit 0
                         (16 do response-validator + 7 do feedback + 11 herdados)
```

## Síntese

Os dois exercícios demonstram a tese central do cenário 3: **um protótipo vira sistema de produção quando guardrails de produto viram código determinístico que bloqueia (não só loga) e quando código gerado por IA passa por revisão crítica antes do merge.** O 3.1 mostra o harness de código (structured output + 2 guardrails que bloqueiam de fato); o 3.2 mostra a revisão crítica que pega violações de norma e de segurança que a IA introduziu. Ambos conectam aos artefatos dos cenários 1 e 2 (POL-001, AGENTS.md, guardrails do PS, contrato `QueryResponse`).

## Notas para o avaliador humano

- O LLM avalia o texto e o raciocínio; a execução de `tsc`/`vitest` foi feita de verdade neste ambiente (saídas em `evidencia/`).
- Substituição de ferramenta declarada: GitHub Copilot indisponível → Claude Code atuou como agente de codificação; a revisão crítica (Claude chat) foi passo separado sobre o código gerado.
