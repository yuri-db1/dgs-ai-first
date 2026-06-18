# Avaliação do Exercício 2.1 — Configuração e uso real de MCP servers

> **Programa:** Trilha de Certificação AI First — DGS / DB1 Global Software
> **Papel:** Desenvolvedor · **Cenário:** 2 — Estruturação do Trabalho
> **Avaliado:** entregáveis em `cenario-2/entregaveis/exercicio-2.1-mcp/` + `novatech-assistant/.mcp/mcp.json`
> **Framework:** `docs/avaliacao/avaliacao-foundation.md` + `avaliacao-desenvolvedor.md`

### Resumo

Entregável forte e completo: mapeia cada necessidade a um *reference server* local e gratuito, aplica least privilege concreto (duas instâncias de filesystem + read-only no nível do SO) e — diferencial — traz **evidência de execução real** dos servers via JSON-RPC, incluindo recuperação de chunk conferida contra o gabarito do Anexo B e prova de que a escrita em fonte read-only é negada. Não houve atalho: o achado de que o `server-filesystem` expõe escrita para todas as pastas foi descoberto rodando o server e ajustou o desenho.

### Scores por Dimensão

| Dimensão | Score | Justificativa |
|----------|-------|---------------|
| D1 — Domínio Conceitual | 3 | Distingue tools/resources/prompts por server; least privilege específico (fs-workspace RW vs fs-knowledge read-only); reconhece que o GitHub server foi arquivado e usa `filesystem`+`git` local. Específico ao NovaTech. |
| D2 — Uso de Ferramentas | 3 | Servers de fato no ar (transcrições JSON-RPC reais): leitura de `POL-001`, recuperação do chunk `POL-001-B` (coerente com o mapa do Anexo B), `git_log`/`git_branch`. Iteração genuína: descobriu as tools de escrita e adaptou o desenho; provou o read-only via `EACCES`. *Caveat para o avaliador humano: a evidência vem de um cliente MCP via CLI (probe JSON-RPC), não da UI do agente Copilot/Claude Code — a substância exigida (servers servindo leituras reais de doc/chunk/git) está comprovada.* |
| D3 — Qualidade do Entregável | 3 | `.mcp/mcp.json` válido e coerente com o mapeamento; justificativa por server; documentação acionável (outro dev sobe os servers seguindo o passo-a-passo). |
| D4 — Pensamento Crítico | 3 | Identifica e corrige o gap de read-only do server; aponta tools de mutação do `git` como risco (R3); 4 riscos específicos do setup local com mitigação, 2 comprovadas. |
| D5 — Aplicabilidade ao Projeto | 3 | Usa `docs/novatech/`, `data/retrieval-corpus/`, o gabarito do Anexo B e a estrutura do Anexo C; escopos derivados das pastas reais do projeto. |

**Score do exercício: 3.0**

### Verificação de Artefatos Machine-Readable

`.mcp/mcp.json` é JSON válido e coerente com o mapeamento (escopos disjuntos workspace/knowledge, comandos `npx`/`uvx`). Um agente/cliente MCP consegue consumir diretamente. Os comentários `_purpose`/`_comment` são metadados não-padrão tolerados pela maioria dos clientes, mas convém notar que campos `_`-prefixados não fazem parte do schema MCP.

### Pontos Fortes

- **Evidência de execução real** com transcrições JSON-RPC, indo além do arquivo de config — exatamente o que a regra de corte do Dev 2.1 exige.
- **Least privilege levado a sério**: duas instâncias + read-only enforced no SO, com prova (`EACCES`), não só afirmação.
- Análise de riscos específica ao setup local (segredos por escopo amplo, escrita sem gate, mutação via git, prompt injection), com mitigações.

### Pontos de Melhoria

- O `git` no `mcp.json` usa `--repository "."`, mas na entrega achatada o repo git real é o `dgs-ai-first` — está documentado, mas o artefato shipado não roda como está sem a adaptação. Considerar deixar o `mcp.json` autoconsistente com o layout entregue.
- O server `everything` aumenta a superfície para pouco valor de produção; embora previsto no enunciado para aprendizado, um config de produção idealmente o omitiria (ou marcaria como dev-only).
- O read-only via `chmod` foi revertido após a demo; o estado do repo entregue não está read-only. Coerente e documentado, mas o leitor deve aplicar o comando para obter a postura descrita.

### Classificação

**Aprovado com distinção (3.0)**

### Tópicos da Trilha para Reforço

Não aplicável (score ≥ 2.5).
