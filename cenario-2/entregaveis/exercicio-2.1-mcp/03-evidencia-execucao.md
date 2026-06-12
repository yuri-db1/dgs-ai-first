# Tarefa 3 — Evidência de execução real dos MCP servers

Os servers foram **efetivamente executados localmente** (não apenas configurados). A comunicação foi feita por **JSON-RPC sobre stdio** — o mesmo transporte que Claude Code / Copilot usam — através de um driver mínimo, [`evidencia/mcp_probe.py`](evidencia/mcp_probe.py), que faz o handshake (`initialize` + `notifications/initialized`) e dispara chamadas de tool.

**Ambiente:** Node v22.14.0 (`npx`) + `uv` 0.11.21 (`uvx`, instalado em `~/.local/bin`). Servers: `@modelcontextprotocol/server-filesystem` v0.2.0, `mcp-server-git`, `@modelcontextprotocol/server-memory`.

Saídas brutas (JSON-RPC) em [`evidencia/`](evidencia/).

---

## Pré-passo — descoberta das tools (ler a doc do server antes de ligar)

Rodei `tools/list` em cada server. Resultado que orientou o desenho:

- **filesystem** → `read_text_file`, `read_multiple_files`, `list_directory`, `directory_tree`, `search_files`, `get_file_info`, `list_allowed_directories` **+ `write_file`, `edit_file`, `create_directory`, `move_file`** (escrita para todos os dirs permitidos — sem read-only por pasta).
- **git** → `git_status`, `git_log`, `git_show`, `git_diff*`, `git_branch` (leitura) **+ `git_commit`, `git_add`, `git_reset`, `git_checkout`, `git_create_branch`** (mutação).
- **memory** → `create_entities`, `create_relations`, `add_observations`, `read_graph`, `search_nodes`, `open_nodes`, `delete_*`.

Esse achado motivou as duas instâncias de filesystem e o read-only no SO (Tarefa 2).

---

## (a) Listar e ler um documento de `docs/novatech/` — `evidencia/01-filesystem-list-read.txt`

Server `fs-knowledge` com escopo `docs/novatech` + `data/retrieval-corpus`.

1. `list_allowed_directories` confirmou que o server **só enxerga as duas pastas read-only** (least privilege na prática):
   ```
   Allowed directories:
   .../novatech-assistant/docs/novatech
   .../novatech-assistant/data/retrieval-corpus
   ```
2. `list_directory docs/novatech` retornou os 6 arquivos (POL-001, PROC-042 v1/v2, SLA-2024, FAQ, README).
3. `read_text_file docs/novatech/POL-001-politica-devolucao.md` retornou o conteúdo real (cabeçalho "POL-001 — Política de Devolução de Mercadorias", versão 3.1, seção 3.1 prazo de 7 dias úteis).

✅ Agente lê documentação de negócio via MCP.

## (b) Recuperar um chunk relevante de `data/retrieval-corpus/` — `evidencia/02-retrieval-chunk.txt`

Pergunta do domínio: **"Posso devolver carga perigosa?"**
Gabarito do **mapa de cobertura do Anexo B**: chunk que **DEVE** ser recuperado = **POL-001-B**.

Via MCP (`read_text_file` em `data/retrieval-corpus/chunks-novatech.md`) o agente recuperou o corpus e o chunk relevante isolado bate exatamente com o gabarito:

> **Chunk POL-001-B** — Seção 3.2: Exceções
> As seguintes categorias de carga NÃO são elegíveis para devolução pelo processo padrão: Cargas perigosas classificadas nas classes 1 a 6 da ANTT... o cliente deve entrar em contato com o setor de Gestão de Riscos (ramal 4500)...

✅ Agente recupera o chunk correto via MCP, conferido contra o gabarito do Anexo B.

## (c) Ler o histórico do repositório via `git` — `evidencia/03-git-history.txt`

Server `git` (`mcp-server-git`) apontado para o repositório local.

- `git_log` (max_count 5) retornou o histórico real, incluindo `68f2a6f add cenario-1 files`, `cc38888 organiza exercicios em pastas`, `b5ada90 adiciona exercicio 1.3`...
- `git_branch` (local) listou `cenario-1`, `cenario-2` (atual), `main`.

✅ Agente lê histórico e branches via MCP.

## (d) BÔNUS — read-only enforced (prova de least privilege) — `evidencia/04-readonly-enforcement.txt`

Para provar que as fontes de negócio estão protegidas mesmo com o server expondo `write_file`:

1. `chmod -R a-w docs/novatech data/retrieval-corpus` → perms `-r--r--r--`.
2. Chamada MCP `write_file docs/novatech/_tentativa_injection.md` →
   ```json
   { "content": [{ "type": "text", "text": "EACCES: permission denied, open '.../docs/novatech/_tentativa_injection.md'" }], "isError": true }
   ```
3. `ls` confirmou: **o arquivo não foi criado**.
4. Perms revertidas (mantém o working tree limpo; o `chmod` é a mitigação a aplicar no ambiente de dev real).

✅ A escrita nas fontes read-only é **negada de forma determinística** pelo SO.

---

## Como reproduzir

```bash
# pré-requisitos
curl -LsSf https://astral.sh/uv/install.sh | sh   # instala uv/uvx
export PATH="$HOME/.local/bin:$PATH"

NT=.../cenario-2/novatech-assistant
PROBE=.../entregaveis/exercicio-2.1-mcp/evidencia/mcp_probe.py

# tools/list de qualquer server
echo '[{"method":"tools/list"}]' > /tmp/req.json
python3 $PROBE npx -y @modelcontextprotocol/server-filesystem $NT/docs/novatech -- /tmp/req.json

# ler doc + recuperar chunk: ver comandos em 01/02; git: uvx mcp-server-git --repository <repo>
```
