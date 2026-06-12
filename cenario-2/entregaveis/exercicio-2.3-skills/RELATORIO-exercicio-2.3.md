# Relatório — Exercício 2.3 (Desenvolvedor): Estratégia de skills do projeto

**Cenário-Âncora 2 — Fase de Estruturação** · Papel: **Desenvolvedor** · Projeto: **NovaTech Assistant**
**Ferramentas:** Claude (chat/Claude Code) como agente de codificação.

> **Substituição de ferramenta:** o enunciado pede GitHub Copilot para gerar o SKILL.md. Copilot não está disponível neste ambiente; o Claude Code atuou como agente de codificação (mesma abordagem do 2.1/2.2).

---

## Sumário

Defini a **estratégia de skills** do projeto na hierarquia Foundation → Domain → Artifact, mapeei criação/consumo por papel (visão de time), e autorei o **SKILL.md da Foundation base** (`typescript-conventions`) com regras prescritivas e exemplos extraídos do código real do exercício 2.2.

## Entregáveis

| # | Entregável | Arquivo |
|---|-----------|---------|
| T1 | Árvore de skills + mapeamento (cria/consome/frequência) | [`01-arvore-skills.md`](01-arvore-skills.md) |
| T2 | Mapeamento por papel (visão de time) | idem, seção 3–4 |
| T3 | SKILL.md Foundation (`typescript-conventions`) | [`novatech-assistant/skills/foundation/typescript-conventions.md`](../../novatech-assistant/skills/foundation/typescript-conventions.md) |

## Destaques

- **Hierarquia em cascata:** Artifact lê Domain, que herda Foundation. A receita `create-rag-endpoint` não repete regras de TS — referencia `typescript-conventions`.
- **Cobertura dos 5 artefatos repetidos:** cada um recebeu par Domain (padrão) + Artifact (receita). Para "documentação técnica (ADRs)" e "specs SDD", que o scaffold não cobria, propus **2 skills novas** (`create-adr`, `create-spec`).
- **Coerência com o repo:** logging e env config foram encapsulados em `error-handling` e `project-structure` (não viram arquivos soltos), mantendo a Foundation alinhada à árvore canônica do scaffold.
- **Visão de time:** QA é dono das skills de teste; Product Specialist de `create-spec`; Tech Lead da Foundation e arquitetura; Design co-autor das skills React; Delivery Manager **consome** ADR/spec para governança. Skills são artefatos de time, não só de dev.
- **SKILL.md concreto:** regras DEVE/NÃO DEVE + 6 pares DO/DON'T com código **verbatim** do 2.2 + 8 anti-padrões reais de LLM em TS/ESM.

## Verificação (grounding)

Não há execução nova (skill é documento). A garantia de qualidade é o **grounding no código verificado**: todos os blocos **DO** do SKILL.md são trechos verbatim de `src/shared/{logger,errors,types}.ts` e `src/functions/query/{validator,handler}.ts` — código que já passou `tsc --noEmit` (exit 0) e `vitest` (11/11) no exercício 2.2. Logo, os exemplos compilam por construção. Conferi também que cada artefato repetido tem cobertura e que nenhuma skill proposta ficou órfã (todas têm criador e consumidor).

## Aderência aos critérios de avaliação

| Critério | Como foi atendido |
|----------|-------------------|
| Árvore coerente (sem skill que ninguém usaria) | Cada skill mapeada a um artefato repetido real; criador e consumidor nomeados; 5/5 artefatos cobertos |
| Atribuição cria/consome com visão de time | QA (testes), PS (spec), TL (foundation/arquitetura/ADR), Design (React), DM (consome ADR/spec) |
| Foundation SKILL.md concreto e prescritivo | Exemplos verbatim do 2.2, regras DEVE/NÃO DEVE, não abstrações |
| Anti-padrões úteis | Erros reais de LLM em TS ESM: extensão em import, `export default`, `any`, CommonJS, `console.log`, engolir erro, logar PII, redefinir tipos |

## Encerramento do papel Desenvolvedor

Com 2.1 (MCP), 2.2 (SDD) e 2.3 (skills), os três exercícios do Desenvolvedor no Cenário 2 estão concluídos.
