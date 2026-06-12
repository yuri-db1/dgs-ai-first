# Cenário-Âncora 2 — Fase de Estruturação · Papel: Desenvolvedor

Práticas de IA First (DB1) sobre o projeto **NovaTech Assistant**. Enunciado completo: [`../docs/exercicio-2-fase-estruturacao.md`](../docs/exercicio-2-fase-estruturacao.md).

## Organização

```
cenario-2/
├── novatech-assistant/        # cópia de trabalho do repo do projeto (starter Anexo D, sem .git aninhado)
│                              # é onde vivem os artefatos reais: .mcp/mcp.json, specs, skills, código
└── entregaveis/               # documentos de entrega + evidências, por exercício
    ├── exercicio-2.1-mcp/
    │   ├── RELATORIO-exercicio-2.1.md      # comece por aqui
    │   ├── 01-mapeamento-mcp.md            # T1: necessidade → server
    │   ├── 02-mcp-config-justificativa.md  # T2: least privilege
    │   ├── 03-evidencia-execucao.md        # T3: evidência real
    │   ├── 04-analise-riscos.md            # T4: riscos + mitigações
    │   └── evidencia/                      # saídas JSON-RPC brutas + driver mcp_probe.py
    ├── exercicio-2.2-sdd/
    │   ├── RELATORIO-exercicio-2.2.md      # comece por aqui
    │   ├── 02-revisao-critica-codigo.md    # Tarefa 3: revisão crítica
    │   └── evidencia/                      # saídas reais de tsc + vitest
    └── exercicio-2.3-skills/
        ├── RELATORIO-exercicio-2.3.md      # comece por aqui
        └── 01-arvore-skills.md             # árvore + mapeamento cria/consome
```

> Artefatos no repo de trabalho: 2.2 → `novatech-assistant/specs/query-endpoint/tasks.md` + código da T1 em
> `novatech-assistant/src/{functions/query,shared}/`. 2.3 → `novatech-assistant/skills/foundation/typescript-conventions.md`.

## Exercícios do papel Desenvolvedor

| Exercício | Tema | Status |
|-----------|------|--------|
| 2.1 | Configuração e uso real de MCP servers | ✅ concluído — [relatório](entregaveis/exercicio-2.1-mcp/RELATORIO-exercicio-2.1.md) |
| 2.2 | Implementação de spec com SDD | ✅ concluído — [relatório](entregaveis/exercicio-2.2-sdd/RELATORIO-exercicio-2.2.md) |
| 2.3 | Estratégia de skills do projeto | ✅ concluído — [relatório](entregaveis/exercicio-2.3-skills/RELATORIO-exercicio-2.3.md) |

## Notas de ambiente

- Servers MCP rodam localmente: Node v22 (`npx`) + `uv`/`uvx` (instalado em `~/.local/bin`).
- O server `git` da evidência foi apontado para a raiz `dgs-ai-first` (a cópia foi achatada, sem `.git` próprio); o `mcp.json` do projeto usa a forma canônica `--repository .`.
