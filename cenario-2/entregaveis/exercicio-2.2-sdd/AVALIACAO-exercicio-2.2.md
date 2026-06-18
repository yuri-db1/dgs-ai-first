# Avaliação do Exercício 2.2 — Implementação com SDD (plan → tasks → código)

> **Programa:** Trilha de Certificação AI First — DGS / DB1 Global Software
> **Papel:** Desenvolvedor · **Cenário:** 2 — Estruturação do Trabalho
> **Avaliado:** `cenario-2/entregaveis/exercicio-2.2-sdd/` + `novatech-assistant/specs/query-endpoint/tasks.md` + código `src/functions/query/` e `src/shared/`
> **Framework:** `docs/avaliacao/avaliacao-foundation.md` + `avaliacao-desenvolvedor.md`

### Resumo

Decomposição SDD madura: 10 tasks atômicas com critérios de aceite verificáveis, dependências e estimativas; a primeira task foi implementada seguindo os padrões do plan (TS strict, Zod, Functions v4, pino) e **verificada de verdade** (`tsc --noEmit` exit 0, `vitest` 11/11). A revisão crítica traz 5 problemas reais do código. A principal ressalva é de ferramenta: o enunciado pede GitHub Copilot e a entrega substituiu por Claude Code (documentado), sem transcrição de geração/iteração com o Copilot.

### Scores por Dimensão

| Dimensão | Score | Justificativa |
|----------|-------|---------------|
| D1 — Domínio Conceitual | 3 | SDD bem aplicado: tasks atômicas como fatias verticais testáveis, dependências explícitas; critérios de aceite como asserções concretas. Context budget (ADR-0002) e vigência (ADR-0003) incorporados nas tasks. |
| D2 — Uso de Ferramentas | 2 | Há código gerado por IA **com verificação real** (tsc + vitest, saídas salvas) e revisão crítica — evidência sólida de output funcional. Porém o **Copilot não foi usado** (substituído por Claude Code) e não há transcrição de geração→avaliação→reescrita com a ferramenta prescrita. Pela escala, "ferramenta usada com evidência, alguma iteração" = 2; falta a iteração de prompt documentada para 3. |
| D3 — Qualidade do Entregável | 3 | `tasks.md` completo e acionável; código compila sob strict, passa nos testes, segue paths do Anexo C (`src/functions/query/`), sem `console.log`. Outro dev implementaria as próximas tasks sem pedir esclarecimento. |
| D4 — Pensamento Crítico | 3 | Revisão crítica com 5 pontos reais (stub 200 vazando p/ produção, resposta de erro não honra o guardrail de `source_document`, `authLevel` decidido no código, pino sem correlação no App Insights, falta `requestId`) — todos derivados do código gerado, nenhum inventado. |
| D5 — Aplicabilidade ao Projeto | 3 | Referencia ADR-0002/0003, usa linguagem ubíqua (tiers Gold/Silver/Standard, carga perigosa, gabarito do Anexo B na T4) e respeita a estrutura do Anexo C. Não ignora decisões do cenário 1. |

**Score do exercício: 2.8**

### Verificação de Artefatos Machine-Readable

`tasks.md` é estruturado e parseável (tabela de dependências + seções por task com critérios de aceite verificáveis). Os critérios são checáveis por máquina/teste (ex.: *"history >3 turnos → 400 com issue `field='history'`"*), o que é exatamente o esperado para tasks consumíveis por agentes.

### Pontos Fortes

- **Verificação real do código** (tsc exit 0, vitest 11/11) — prova de que o output é funcional, não só plausível.
- **Tasks genuinamente atômicas** com critérios de aceite verificáveis, não vagos.
- **Revisão crítica honesta**: aponta inclusive que o próprio stub 200 não pode ir a produção.

### Pontos de Melhoria

- **Substituição de ferramenta (impacto em D2):** sem Copilot e sem transcrição de iteração de prompt. Para pontuar 3 em D2, anexar evidência da ferramenta gerando o código (prints/export) e ao menos um ciclo de refinamento de prompt.
- **Conexão explícita com o cenário 1:** o critério do papel pede reconhecer que o protótipo open-source (Dev 1.3) validou a abordagem e agora é produção. As ADRs são citadas, mas esse vínculo ao protótipo poderia ser explícito no `tasks.md`/relatório.
- O caminho 200 stub e o contrato de erro divergente são corretamente apontados na revisão — fechar pelo menos a decisão de contrato de erro antes da T9.

### Classificação

**Aprovado com distinção (2.8)**

### Tópicos da Trilha para Reforço

Não aplicável (score ≥ 2.5). Observação pontual: registrar evidência da ferramenta de IA prescrita quando o exercício a exige.
