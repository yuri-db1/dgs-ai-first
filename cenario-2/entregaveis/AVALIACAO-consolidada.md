# Avaliação consolidada — Papel Desenvolvedor (Cenário 2)

> **Programa:** Trilha de Certificação AI First — DGS / DB1 Global Software
> **Framework aplicado:** `docs/avaliacao/{avaliacao-foundation.md, avaliacao-desenvolvedor.md, prompt-avaliacao.md}`
> Avaliações por exercício: [2.1](exercicio-2.1-mcp/AVALIACAO-exercicio-2.1.md) · [2.2](exercicio-2.2-sdd/AVALIACAO-exercicio-2.2.md) · [2.3](exercicio-2.3-skills/AVALIACAO-exercicio-2.3.md)

## Quadro geral

| Exercício | D1 | D2 | D3 | D4 | D5 | Score | Classificação |
|-----------|----|----|----|----|----|-------|---------------|
| 2.1 — MCP servers | 3 | 3 | 3 | 3 | 3 | **3.0** | Aprovado com distinção |
| 2.2 — SDD (plan→tasks→código) | 3 | 2 | 3 | 3 | 3 | **2.8** | Aprovado com distinção |
| 2.3 — Estratégia de skills | 3 | 2 | 3 | 3 | 3 | **2.8** | Aprovado com distinção |
| **Média do papel** | | | | | | **2.87** | **Aprovado com distinção** |

## Padrões observados

**Pontos fortes recorrentes**
- Evidência de execução real onde foi possível verificar (MCP via JSON-RPC; código via tsc/vitest) — vai além de afirmar que funciona.
- Artefatos prescritivos e machine-readable (`.mcp/mcp.json` válido, `tasks.md` com critérios verificáveis, SKILL.md em DEVE/NÃO DEVE com código real).
- Boa conexão com o projeto: ADR-0002/0003, linguagem ubíqua, Anexos B e C.

**Ressalva transversal (a principal)**
- **Substituição de ferramenta:** o GitHub Copilot, exigido nos exercícios 2.2 e 2.3, foi substituído pelo Claude Code (documentado honestamente). Isso limita o D2 a 2 nesses dois exercícios — há evidência de output e verificação, mas não de iteração de prompt com a ferramenta prescrita. No 2.1, a evidência veio de um cliente MCP via CLI em vez da UI do agente; a substância exigida (servers servindo leituras reais) está comprovada, então o D2 ficou em 3.
- Conforme a nota do `prompt-avaliacao.md`, **a autenticidade de prints/evidências cabe ao avaliador humano** — o LLM avaliou a substância presente nos artefatos do repositório.

## Como elevar (priorizado por impacto)

1. **Anexar evidência da ferramenta prescrita (Copilot)** nos 2.2/2.3: export de chat mostrando geração e ao menos um ciclo de refinamento → D2 de 2 para 3 (ganho direto de ~0.2 em dois exercícios).
2. Tornar o `mcp.json` autoconsistente com o layout entregue (caminho do `git`).
3. Explicitar no 2.2 o vínculo com o protótipo open-source do Dev 1.3 (cenário 1 → produção).

_Nota de transparência: esta avaliação foi gerada com o framework de `docs/avaliacao/` aplicado aos artefatos presentes no repositório; como os entregáveis foram produzidos nesta mesma sessão, recomenda-se uma conferência humana independente, especialmente das evidências de execução._
