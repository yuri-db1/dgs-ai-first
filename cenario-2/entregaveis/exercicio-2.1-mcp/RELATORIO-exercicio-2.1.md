# Relatório — Exercício 2.1 (Desenvolvedor): Configuração e uso real de MCP servers

**Cenário-Âncora 2 — Fase de Estruturação** · Papel: **Desenvolvedor** · Projeto: **NovaTech Assistant**
**Ferramentas:** Claude (chat/Claude Code) + execução real dos servers via CLI.

---

## Sumário

Configurei e **rodei de fato** os MCP servers locais que dão aos agentes de IA acesso ao repositório, à documentação da NovaTech e ao corpus de RAG — tudo local e gratuito (`npx`/`uvx`), sem nenhum serviço pago. As 4 tarefas do enunciado estão entregues com **evidência de execução real** (JSON-RPC sobre stdio), não apenas arquivos de config.

## Entregáveis

| # | Entregável | Arquivo |
|---|-----------|---------|
| T1 | Mapeamento necessidade → server (tools/resources/prompts, consumidor, escopo) | [`01-mapeamento-mcp.md`](01-mapeamento-mcp.md) |
| T2 | `.mcp/mcp.json` final + justificativa de least privilege | [`novatech-assistant/.mcp/mcp.json`](../../novatech-assistant/.mcp/mcp.json) · [`02-mcp-config-justificativa.md`](02-mcp-config-justificativa.md) |
| T3 | Evidência de execução (ler doc, recuperar chunk, ler git) + read-only enforced | [`03-evidencia-execucao.md`](03-evidencia-execucao.md) · [`evidencia/`](evidencia/) |
| T4 | Análise de riscos do setup local + mitigações | [`04-analise-riscos.md`](04-analise-riscos.md) |

## Servers configurados (todos locais e gratuitos)

| Server | Comando | Escopo | Acesso |
|--------|---------|--------|--------|
| `fs-workspace` | `npx @modelcontextprotocol/server-filesystem ./src ./specs ./skills` | código/specs/skills | RW |
| `fs-knowledge` | `npx @modelcontextprotocol/server-filesystem ./docs/novatech ./data/retrieval-corpus` | fontes de negócio | RO (SO) |
| `git` | `uvx mcp-server-git --repository .` | repo local | leitura |
| `memory` | `npx @modelcontextprotocol/server-memory` | grafo local | RW |
| `everything` | `npx @modelcontextprotocol/server-everything` | — | aprendizado |

## Decisões de engenharia (o que difere do scaffold de exemplo)

1. **Duas instâncias de filesystem** em vez de uma. Motivo: ao rodar o server e ler `tools/list`, confirmei que ele expõe `write_file`/`edit_file` para **todos** os dirs permitidos. Juntar fontes de negócio e workspace numa só instância daria ao agente poder de sobrescrever o domínio.
2. **Read-only no nível do SO** (`chmod -R a-w`) para as fontes, já que o server não tem flag de read-only. Comprovei que a escrita é negada (`EACCES`).
3. **`git` consumido só para leitura** por política, porque o server também expõe `git_commit`/`git_reset`/`git_checkout`.

## Evidência de execução real (resumo)

- (a) `list_allowed_directories` + `list_directory` + `read_text_file` em `docs/novatech/POL-001...` → conteúdo real retornado.
- (b) `read_text_file` em `data/retrieval-corpus/chunks-novatech.md` p/ a pergunta *"Posso devolver carga perigosa?"* → recuperou o chunk **POL-001-B**, exatamente o gabarito do mapa de cobertura do Anexo B.
- (c) `git_log` + `git_branch` → histórico real (`68f2a6f`, `cc38888`, ...) e branches (`cenario-1`, `cenario-2`, `main`).
- (d) `write_file` em fonte read-only → `EACCES ... isError: true`, arquivo não criado.

Saídas brutas em [`evidencia/`](evidencia/) (`01`–`04`), geradas pelo driver [`evidencia/mcp_probe.py`](evidencia/mcp_probe.py).

## Aderência aos critérios de avaliação

| Critério do enunciado | Como foi atendido |
|-----------------------|-------------------|
| Apenas servers locais e gratuitos | `npx`/`uvx`; sem Azure/Confluence/GitHub remoto. `uv` instalado localmente |
| Least privilege concreto (escopos mínimos, fontes em read-only, justificativa por server) | Escopos disjuntos `workspace`/`knowledge`; read-only enforced no SO e comprovado; justificativa por server em T1/T2 |
| **Evidência real de uso** (não só config) | JSON-RPC real: leu doc, recuperou chunk (conferido com gabarito do Anexo B), leu git; bônus: write negado |
| Riscos específicos do setup local + mitigação acionável | R1 segredos por escopo amplo, R2 escrita sem gate, R3 mutação via git, R4 prompt injection — cada um com mitigação, 2 já comprovadas |

## Reprodutibilidade

`uv` 0.11.21 + Node v22.14.0. Passos completos em [`03-evidencia-execucao.md`](03-evidencia-execucao.md#como-reproduzir).

## Próximos exercícios do papel Desenvolvedor

- **2.2** — Implementação de spec com SDD (plan → tasks → primeira task do query endpoint).
- **2.3** — Estratégia de skills (árvore Foundation → Domain → Artifact + SKILL.md Foundation).
