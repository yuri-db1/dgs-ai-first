# Tarefa 2 — `.mcp/mcp.json` com least privilege (justificativa)

**Arquivo final:** [`novatech-assistant/.mcp/mcp.json`](../../novatech-assistant/.mcp/mcp.json)

---

## 1. Decisão central: separar **workspace** de **knowledge**

O scaffold de exemplo (Anexo C) usava **uma única** instância de `filesystem` com cinco pastas em escrita:

```json
"filesystem": { "args": ["...server-filesystem", "./src","./specs","./skills","./docs","./data"] }
```

Ao rodar o server e inspecionar `tools/list` (Tarefa 3), confirmei um fato que muda o desenho: o `@modelcontextprotocol/server-filesystem` **expõe `write_file`, `edit_file`, `create_directory` e `move_file` para TODOS os diretórios permitidos** — não há flag de read-only por pasta. Ou seja, a config de exemplo daria ao agente poder de **sobrescrever a documentação de negócio e o corpus de RAG**.

Correção aplicada — **duas instâncias com escopos disjuntos**:

| Instância | Escopo | Acesso | Razão |
|-----------|--------|--------|-------|
| `fs-workspace` | `./src ./specs ./skills` | leitura **+ escrita** | único lugar onde o agente legitimamente cria/edita artefatos |
| `fs-knowledge` | `./docs/novatech ./data/retrieval-corpus` | leitura (escrita bloqueada no SO) | fontes de verdade; jamais devem ser alteradas por um agente |

A separação física garante que um prompt mal-intencionado dirigido ao `fs-workspace` **não alcança** as fontes de negócio, e vice-versa.

## 2. Read-only real (já que o server não tem a flag)

Como o server não impede escrita, o read-only é garantido **de forma determinística no nível do SO**:

```bash
# torna as fontes de negocio read-only (aplicar no ambiente de dev)
chmod -R a-w docs/novatech data/retrieval-corpus
```

Com isso, mesmo que o agente chame `write_file` em `docs/novatech`, o kernel responde `EACCES: permission denied`. Isso foi **comprovado** (Tarefa 3, Evidência D): a tentativa de escrita retornou `isError: true` e o arquivo não foi criado. Config sozinha é probabilística quanto à intenção do agente; o `chmod` torna o read-only **inquebrável**.

## 3. Justificativa de escopo por server (least privilege)

| Server | Escopo | Por que é o mínimo suficiente |
|--------|--------|-------------------------------|
| `fs-workspace` | `./src ./specs ./skills` | exatamente os artefatos produzidos pelo time. **Exclui** `./infra` (Bicep — não é alvo desta fase), `./.mcp` (o agente não deve reescrever a própria config), `./.github` (CI), `./prompts/eval` (golden data), `./docs` e `./data` |
| `fs-knowledge` | `./docs/novatech ./data/retrieval-corpus` | só as fontes de verdade lidas no fluxo; **exclui** `./docs/adr`, `./docs/runbooks`, `./docs/onboarding.md` |
| `git` | `--repository .` | apenas o repositório local. Sem remoto, sem token, sem acesso a outros repos |
| `memory` | grafo local (sem path do projeto) | não toca o filesystem do projeto → superfície de exposição nula |
| `everything` | — | server de aprendizado; não recebe nenhum caminho do projeto |

**Nada de `*` ou de apontar para `.` (raiz) no filesystem.** Apontar para a raiz exporia `.env`, `.git/`, `node_modules/` e a própria `.mcp/mcp.json` (ver riscos R1 e R2 na Tarefa 4).

## 4. Nota sobre o `git --repository .` nesta entrega consolidada

O `mcp.json` é escrito na forma **canônica do projeto**: o `novatech-assistant` é, por natureza, um repositório Git próprio (o starter do Anexo D vinha com `git init`), então `--repository .` é o correto.

Nesta entrega, por decisão de organização, a cópia de trabalho foi **achatada** dentro do repositório `dgs-ai-first` (sem `.git` aninhado). Portanto, na **execução real da evidência** (Tarefa 3), o server `git` foi apontado para a raiz do repositório que de fato versiona estes arquivos:

```bash
uvx mcp-server-git --repository /home/.../dgs-ai-first
```

Se o `novatech-assistant` fosse extraído para seu próprio repositório (forma natural), `--repository .` funciona sem ajuste. Padrão adotado: **config canônica + adaptação local documentada**.

## 5. Conformidade com a regra "local e gratuito"

Todos os servers rodam via `npx` (Node) ou `uvx` (Python/uv) localmente. Nenhum depende de Azure, Confluence, GitHub remoto ou qualquer serviço pago. O `uv` foi instalado localmente (`~/.local/bin`) para habilitar o `mcp-server-git`.
