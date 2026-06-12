# Tarefa 1+2 — Árvore de skills do projeto NovaTech Assistant

**Exercício:** Desenvolvedor 2.3 — Estratégia de skills.
**Hierarquia:** Foundation (convenções globais) → Domain (padrões por camada) → Artifact (receitas de geração).

> Princípio de cascata: uma skill Artifact **lê** as skills Domain das quais depende, que por sua vez **herdam** as Foundation. Assim a receita "criar endpoint RAG" não repete regras de TypeScript — ela referencia `typescript-conventions`.

---

## 1. Árvore

```
skills/
├── foundation/                  # convenções globais — herdadas por TODAS as outras
│   ├── typescript-conventions   [stub no repo] ← SKILL.md autorado nesta entrega
│   ├── error-handling           [stub]  (inclui logging com pino / sem console.log)
│   └── project-structure        [stub]  (inclui env config e organização de módulos)
│
├── domain/                      # padrões por camada
│   ├── azure-functions-endpoint     [stub]
│   ├── azure-ai-search-integration  [stub]
│   ├── react-components             [stub]
│   └── testing-patterns             [stub]
│
└── artifact/                    # receitas de geração ponta a ponta
    ├── create-rag-endpoint      [stub]
    ├── create-integration-test  [stub]
    ├── create-react-card        [stub]
    ├── create-adr               [PROPOSTA NOVA]
    └── create-spec              [PROPOSTA NOVA]
```

As 10 primeiras já existem como arquivos vazios no scaffold (Anexo C). `create-adr` e `create-spec` são **propostas novas** — necessárias para cobrir os artefatos repetidos "documentação técnica (ADRs)" e "specs de produto (SDD)", que o scaffold não contemplava.

**Decisão de coerência:** "logging" e "env config" (citados no enunciado como exemplos Foundation) **não viram arquivos soltos** — logging vive em `error-handling` (regra do pino, proibição de `console.log`) e env config vive em `project-structure`. Isso mantém a Foundation enxuta e alinhada à árvore canônica do projeto (mesma do Tech Lead 2.3).

## 2. Cobertura dos 5 artefatos repetidos do enunciado

Cada artefato produzido com frequência tem um par **Domain (padrão) + Artifact (receita)**, ambos sobre a base Foundation:

| Artefato repetido | Foundation (base) | Domain (padrão) | Artifact (receita) |
|---|---|---|---|
| Endpoints Azure Functions com RAG | todas | `azure-functions-endpoint` + `azure-ai-search-integration` | `create-rag-endpoint` |
| Testes de integração para endpoints | `typescript-conventions`, `error-handling` | `testing-patterns` | `create-integration-test` |
| Componentes React (painel web) | `typescript-conventions` | `react-components` | `create-react-card` |
| Documentação técnica (ADRs, README de módulo) | — | — | `create-adr` *(nova)* |
| Specs de produto (template SDD) | — | — | `create-spec` *(nova)* |

Nenhuma skill fica órfã (todas têm criador e consumidor abaixo) e nenhum artefato repetido fica sem cobertura.

## 3. Mapeamento por skill (nome · frase-ativação · cria · consome · frequência)

### Foundation

| Skill | Frase-ativação (o agente reconhece) | Cria | Consome (papel + agente) | Frequência |
|---|---|---|---|---|
| `typescript-conventions` | "escrever/gerar qualquer arquivo `.ts` do backend" | Tech Lead | Devs (pleno/sênior) + Copilot/Claude Code | **Muito alta** (toda geração de código) |
| `error-handling` | "tratar erro, logar evento, adicionar retry" | Tech Lead | Devs + agentes | Alta |
| `project-structure` | "criar um novo módulo / onde colocar este arquivo / ler env" | Tech Lead | Devs + agentes | Média |

### Domain

| Skill | Frase-ativação | Cria | Consome | Frequência |
|---|---|---|---|---|
| `azure-functions-endpoint` | "criar um endpoint Azure Function (HTTP trigger v4)" | Tech Lead | Devs + Copilot | Alta |
| `azure-ai-search-integration` | "buscar/indexar chunks no Azure AI Search" | Dev Sênior | Devs + Copilot | Média |
| `react-components` | "criar um componente do painel web" | Dev (front) + **Design** (UX/tokens) | Devs front + Copilot | Média |
| `testing-patterns` | "escrever testes (Vitest, mocks, fixtures)" | **QA** | Devs + QA + agentes | Alta |

### Artifact

| Skill | Frase-ativação | Cria | Consome | Frequência |
|---|---|---|---|---|
| `create-rag-endpoint` | "criar um endpoint completo com RAG (busca + prompt + completion + fonte)" | Dev Sênior | Devs + Copilot | Alta |
| `create-integration-test` | "gerar teste de integração para um endpoint" | **QA** | Devs + QA + Copilot | Alta |
| `create-react-card` | "criar um card de resposta / formulário de feedback no painel" | Dev front + **Design** | Devs front + Copilot | Média |
| `create-adr` *(nova)* | "registrar uma decisão técnica como ADR" | Tech Lead | TL + Devs + **Delivery Manager** | Média |
| `create-spec` *(nova)* | "escrever requirements/plan/tasks de um módulo (SDD)" | **Product Specialist** | PS + TL + Devs + **DM** | Média (por módulo) |

## 4. Visão de time na atribuição (não só devs)

A propriedade das skills reflete a competência de cada papel — skills são artefatos de **time**, não só de desenvolvimento:

- **Tech Lead** — dono das Foundation e dos padrões de arquitetura (`azure-functions-endpoint`, `create-adr`). É quem garante que as regras duráveis viram skill.
- **QA** — dono das skills de teste (`testing-patterns`, `create-integration-test`). Quem define o que é um bom teste é quem revisa testes.
- **Product Specialist** — dono de `create-spec` (template SDD: requirements/plan/tasks).
- **Design** — co-autor de `react-components` e `create-react-card` (tokens, acessibilidade, padrões de UX do painel).
- **Delivery Manager** — **consome** `create-adr` e `create-spec` para rastrear decisões e escopo (governança), mesmo sem criar código.
- **Devs** — consumidores primários de quase tudo (via Copilot/Claude Code) e criadores das skills de implementação (`create-rag-endpoint`, `azure-ai-search-integration`).

## 5. Manutenção

Skills são **artefatos vivos**: versionadas no Git junto do código, evoluídas quando o padrão real muda, e validadas por teste com o agente (ver Tech Lead 2.3 — "skill madura"). Uma skill cujo exemplo não compila mais é um bug a corrigir, não documentação desatualizada tolerável.

---

➡️ O SKILL.md da Foundation base (`typescript-conventions`) está em
[`novatech-assistant/skills/foundation/typescript-conventions.md`](../../novatech-assistant/skills/foundation/typescript-conventions.md).
