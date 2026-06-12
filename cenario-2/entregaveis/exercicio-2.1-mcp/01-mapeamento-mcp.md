# Tarefa 1 — Mapeamento das necessidades do projeto para MCP servers

**Exercício:** Desenvolvedor 2.1 — Configuração e uso real de MCP servers
**Projeto:** NovaTech Assistant
**Regra:** apenas *reference servers* locais e gratuitos (rodam via `npx`/`uvx`), sem nenhum serviço pago ou externo.

> Verificação de fonte (parte do exercício): os nomes de pacote/comandos foram confirmados rodando os servers de fato e inspecionando `tools/list` (ver evidência na Tarefa 3). O server oficial de **GitHub foi arquivado** no upstream e exigiria conta/token externos — por isso o repositório é tratado **localmente** via `filesystem` + `git`.

---

## 1. Tabela necessidade → server → escopo

| # | Necessidade do projeto | Server (reference, local) | O que expõe | Quem consome | Escopo recebido | Acesso |
|---|------------------------|---------------------------|-------------|--------------|-----------------|--------|
| 1 | Ler **e escrever** código, specs e skills | `fs-workspace` (`server-filesystem`) | **Tools**: `read_text_file`, `read_multiple_files`, `list_directory`, `directory_tree`, `search_files`, `get_file_info`, `write_file`, `edit_file`, `create_directory`, `move_file`, `list_allowed_directories` | Claude Code, Copilot (devs, Tech Lead) | `./src ./specs ./skills` | **Leitura + escrita** |
| 2 | Ler documentação de negócio da NovaTech (era Confluence) | `fs-knowledge` (`server-filesystem`) | Mesmas tools do filesystem | Todos os agentes (geração com fundamentação no domínio) | `./docs/novatech` | **Leitura** (escrita bloqueada no SO) |
| 3 | "Recuperar" chunks do corpus de RAG (era Azure AI Search) | `fs-knowledge` (mesma instância de #2) | Mesmas tools do filesystem | Agentes que simulam retrieval / geram dados de teste | `./data/retrieval-corpus` | **Leitura** (escrita bloqueada no SO) |
| 4 | Histórico, diff e branches do repo (era GitHub) | `git` (`mcp-server-git`) | **Tools**: `git_status`, `git_log`, `git_show`, `git_diff`, `git_diff_unstaged`, `git_diff_staged`, `git_branch` (leitura) + `git_add`, `git_commit`, `git_reset`, `git_checkout`, `git_create_branch` (mutação) | Tech Lead, devs (contexto de histórico) | repositório local (`.`) | **Leitura** (mutação possível — ver risco R3) |
| 5 | Memória persistente de decisões e linguagem ubíqua | `memory` (`server-memory`) | **Tools**: `create_entities`, `create_relations`, `add_observations`, `read_graph`, `search_nodes`, `open_nodes`, `delete_*` | Todos os agentes (continuidade entre sessões) | grafo local (arquivo JSON gerenciado pelo server) | Leitura + escrita |
| 6 | Aprender/explorar as primitivas do MCP | `everything` (`server-everything`) | Tools/Resources/Prompts de demonstração | Devs (aprendizado) | — (não aponta para dados do projeto) | Demonstração |

> **Observação importante (achado real):** a instância `server-filesystem` (v0.2.0, "secure-filesystem-server") **expõe ferramentas de escrita para todos os diretórios permitidos** — não existe flag de read-only por pasta. Por isso a separação em **duas instâncias** (`fs-workspace` com escrita legítima e `fs-knowledge` para fontes que não devem ser escritas) e o read-only **enforced no nível do SO**. Detalhe na Tarefa 2 e prova na Tarefa 3 (Evidência D).

---

## 2. Primitivas do MCP por server (Tools / Resources / Prompts)

- **`fs-workspace` e `fs-knowledge`** — expõem **Tools** (ações de leitura/escrita sobre o filesystem). Não expõem Resources nem Prompts. A diferença entre as duas é puramente de **escopo** (quais diretórios) e de **acesso** (knowledge é read-only no SO).
- **`git`** — expõe **Tools** de leitura (`git_log`, `git_status`, `git_diff*`, `git_show`, `git_branch`) e de mutação (`git_commit`, `git_add`, `git_reset`, `git_checkout`, `git_create_branch`). Consumimos apenas as de leitura no fluxo de desenvolvimento.
- **`memory`** — expõe **Tools** sobre um grafo de conhecimento (entidades, relações, observações). É onde persistimos a linguagem ubíqua e as decisões para que sobrevivam entre sessões.
- **`everything`** — expõe **Tools, Resources e Prompts** de exemplo; serve só para o time entender as três primitivas do protocolo na prática.

## 3. Quem consome o quê (resumo por papel)

| Papel | Agente | Servers que usa |
|-------|--------|-----------------|
| Desenvolvedor (pleno/sênior) | Claude Code, GitHub Copilot | `fs-workspace` (escreve código/specs/skills), `fs-knowledge` (lê domínio), `git` (histórico), `memory` |
| Tech Lead | Claude Code, GitHub Copilot | todos acima + `git` para revisão de histórico/branches |
| Product Specialist / QA / DM | Claude / Claude Cowork | `fs-knowledge` (domínio), `fs-workspace` (specs/test-plan), `memory` (glossário) |

## 4. Por que cada escopo é o mínimo suficiente

- **`fs-workspace` → `./src ./specs ./skills`**: são exatamente os artefatos que o time **produz e edita**. Não inclui `./docs`, `./data`, `./infra` nem `.mcp` — um agente gerando código não precisa (nem deve) reescrever a documentação de negócio, o corpus de referência ou a própria config de MCP.
- **`fs-knowledge` → `./docs/novatech ./data/retrieval-corpus`**: são as **fontes de verdade** que fundamentam respostas e dados de teste. O agente precisa **ler**, nunca escrever — por isso instância separada e read-only no SO.
- **`git` → `.`**: o histórico do próprio repositório, nada além. Consumido para contexto.
- **`memory`/`everything`**: não recebem caminho do projeto; o risco de exposição de arquivos é nulo.

Mapeamento → configuração concreta: **`02-mcp-config-justificativa.md`** e o arquivo **`novatech-assistant/.mcp/mcp.json`**.
