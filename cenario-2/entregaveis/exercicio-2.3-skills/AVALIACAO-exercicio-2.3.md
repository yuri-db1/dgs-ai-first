# Avaliação do Exercício 2.3 — Estratégia de skills do projeto

> **Programa:** Trilha de Certificação AI First — DGS / DB1 Global Software
> **Papel:** Desenvolvedor · **Cenário:** 2 — Estruturação do Trabalho
> **Avaliado:** `cenario-2/entregaveis/exercicio-2.3-skills/` + `novatech-assistant/skills/foundation/typescript-conventions.md`
> **Framework:** `docs/avaliacao/avaliacao-foundation.md` + `avaliacao-desenvolvedor.md`

### Resumo

Árvore de skills coerente e cobrindo os 5 artefatos repetidos do projeto, com atribuição multi-papel real (QA dono dos testes, PS de spec, Design em React, DM consumindo ADR/spec). O SKILL.md Foundation é concreto e prescritivo, com exemplos DO/DON'T **extraídos verbatim do código verificado no 2.2** e anti-padrões que LLMs de fato geram. Como no 2.2, a ressalva é de ferramenta: o SKILL.md deveria ser gerado com Copilot e foi produzido pelo Claude Code (documentado), sem transcrição de iteração.

### Scores por Dimensão

| Dimensão | Score | Justificativa |
|----------|-------|---------------|
| D1 — Domínio Conceitual | 3 | Hierarquia Foundation→Domain→Artifact bem entendida (cascata: Artifact lê Domain que herda Foundation); conecta com como as skills se relacionam ao AGENTS.md/projeto. |
| D2 — Uso de Ferramentas | 2 | O SKILL.md é sólido e seus exemplos são grounded em código já verificado (tsc/vitest do 2.2). Mas o Copilot não foi usado e não há iteração de prompt documentada com a ferramenta prescrita. Pela escala: evidência presente, sem iteração documentada = 2. |
| D3 — Qualidade do Entregável | 3 | SKILL.md prescritivo (DEVE/NÃO DEVE), 6 pares DO/DON'T com código real e 8 anti-padrões acionáveis; árvore com tabela de criação/consumo/frequência. Acionável por outro membro do time. |
| D4 — Pensamento Crítico | 3 | Decisões de design justificadas: encapsular logging/env nas Foundation existentes em vez de criar arquivos soltos; propor `create-adr`/`create-spec` para cobrir lacunas; marcar stub vs proposta nova. |
| D5 — Aplicabilidade ao Projeto | 3 | Respeita a hierarquia `/skills/foundation|domain|artifact/` do Anexo C; exemplos do domínio NovaTech e do código real do projeto; vincula às ADRs e ao 2.2. |

**Score do exercício: 2.8**

### Verificação de Artefatos Machine-Readable

`typescript-conventions.md` é **prescritivo, não narrativo** (passa no teste da regra de corte D3≤1): regras em DEVE/NÃO DEVE, blocos de código rotulados ✅DO/❌DON'T, frase-ativação explícita e seção de dependências. Um agente consegue parsear e seguir. A árvore (`01-arvore-skills.md`) é tabular e mapeável (skill → criador/consumidor/frequência). Nada relevante caiu em "narrativo demais".

### Pontos Fortes

- **SKILL.md grounded em código verificado**: os exemplos DO são trechos reais que já passaram tsc/vitest — compilam por construção, não são abstrações.
- **Visão de time na atribuição**: QA, PS, Design e DM aparecem como criadores/consumidores — atende o critério "não é só para devs".
- **Anti-padrões reais de LLM** (extensão em import ESM, `export default`, `as any`, CommonJS, `console.log`, engolir erro, logar PII).

### Pontos de Melhoria

- **Substituição de ferramenta (impacto em D2):** anexar evidência do Copilot gerando o SKILL.md e um ciclo de refinamento elevaria D2 a 3.
- As 2 skills propostas (`create-adr`, `create-spec`) ficam só descritas na árvore; um esqueleto mínimo de cada (mesmo que stub) tornaria a estratégia ainda mais acionável.
- A árvore poderia indicar critérios de "skill madura" (quando está pronta para uso) — útil para a manutenção mencionada na seção 5.

### Classificação

**Aprovado com distinção (2.8)**

### Tópicos da Trilha para Reforço

Não aplicável (score ≥ 2.5). Observação pontual: registrar evidência da ferramenta de IA prescrita (Copilot) nos exercícios que a exigem.
