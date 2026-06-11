# Avaliação do Exercício 1.1 — Análise de Viabilidade Técnica

> **Programa:** Trilha de Certificação AI First — DGS / DB1 Global Software
> **Papel:** Desenvolvedor
> **Cenário:** 1 — Entendimento e Contexto
> **Exercício:** 1.1 — Análise de viabilidade técnica com fundamentos de LLM e engenharia de contexto

---

## Resumo

Entregável de alta qualidade que demonstra domínio conceitual sólido e específico ao domínio NovaTech. O participante não apenas cobriu todos os itens da tarefa, como produziu uma iteração v1→v2 genuína em que o Claude foi usado como revisor cético e o feedback gerou mudanças substantivas e verificáveis. Destaca-se por conectar conceitos técnicos (lost in the middle, orçamento de contexto) a decisões de arquitetura e a regras de negócio do cenário (disposição transitória, FAQ não validado).

## Scores por Dimensão

| Dimensão | Score | Justificativa |
|----------|-------|---------------|
| D1 — Domínio Conceitual | 3 | Conceitos corretos, específicos e com nuance. Identifica que retrieval por similaridade pura retorna PROC-042 v1 e v2 simultaneamente, misturando multiplicadores — exatamente o exemplo de nível 3 da rubrica. Distingue "caber" de "ser eficaz", trata orçamento de atenção e context rot corretamente, e entende RAG como necessidade matemática (não conveniência). |
| D2 — Uso de Ferramentas | 3 | Ciclo gerar→avaliar→iterar visível e documentado no apêndice com 3 prompts reais. O prompt de revisão ("critique como tech lead cético") é específico e produziu 6 pontos de feedback concretos. Refinamento não é cosmético. |
| D3 — Qualidade do Entregável | 3 | Completo, correto, específico e acionável. Tabela de riscos consolidada com causa-raiz e mitigação concreta. Outro membro do time usaria sem pedir esclarecimentos. Estimativa de tokens com cálculo explícito e faixa (~5–8M, ponto médio ~6,3M) — dentro/abaixo da ordem esperada e justificada. |
| D4 — Pensamento Crítico | 3 | A v2 incorpora insights não-óbvios que o próprio participante reconhece como gaps: disposição transitória como lógica *fora* do RAG, governança de fonte do FAQ, ingestão como processo contínuo por causa da atualização mensal por 3 áreas. Refuta ativamente a ilusão de "quanto mais contexto melhor". |
| D5 — Aplicabilidade ao Projeto | 3 | Profundamente conectado: referencia PROC-042 vs v2, multiplicadores por região, prazo de carga perigosa, FAQ não validado, meta de 12→<2 min, atualização mensal descoordenada, integração Teams/SharePoint/Azure. Não funcionaria para "qualquer projeto". |

**Score do exercício: 3.0**

## Verificação de Armadilhas

A skill do papel não lista armadilha intencional obrigatória para o Exercício 1.1 (a armadilha de "carga perigosa" pertence ao 1.2). **Nenhuma armadilha de corte automático neste exercício.** Observação positiva: o participante antecipou voluntariamente o risco do FAQ não validado para perguntas críticas como carga perigosa (§1 v2), o que reforça o domínio do cenário.

Verificação do padrão de iteração (regra de corte D2): há diferença concreta e verificável entre v1 e v2 — estimativa única vira faixa com consequência de re-indexação; "252 chunks" passa a ser apresentado apenas para refutação com top-k 3–8 justificado por latência/custo; versão deixa de ser só metadado e vira lógica de negócio; dois riscos novos (ingestão recorrente, governança de fonte). **v1 ≠ v2** — regra de corte não disparada.

## Pontos Fortes

- **Conexão número→decisão:** a estimativa de tokens não fica solta; vira justificativa para indexação incremental e confirmação matemática de RAG.
- **Tratamento diferenciado por tipo de fonte:** cada fonte tem desafio + impacto na resposta + estratégia específica, com o risco silencioso do OCR (dígitos corrompidos em documentos normativos) bem identificado.
- **Disposição transitória como lógica fora do RAG:** insight de engenharia avançado e específico, raramente capturado por quem trata o problema apenas como chunking/metadado.

## Pontos de Melhoria

- **Densidade de tokens das tabelas/escaneados:** a faixa 300–600 palavras/página é uma boa correção, mas tabelas de 15+ colunas e overhead de formatação (Markdown/HTML no chunk) podem inflar a contagem de tokens de retrieval além do texto puro — valeria uma nota sobre como isso pressiona o tamanho de chunk de 500 tokens.
- **Top-k e reranking:** a recomendação de top-k 3–8 está correta, mas poderia mencionar reranking (cross-encoder) como mecanismo para garantir que os poucos chunks escolhidos sejam de fato os certos.
- **Posicionamento no prompt:** menciona "posicionar o mais relevante no topo" para mitigar lost in the middle, mas poderia ser mais explícito sobre ordenar relevância no início *e* fim do contexto, já que o efeito favorece ambas as extremidades.

## Classificação

**Aprovado com distinção (2.5–3.0).**

## Tópicos da Trilha para Reforço

Score ≥ 2.5 — não há tópicos obrigatórios de reforço. Como aprofundamento opcional (não corretivo): técnicas de reranking/retrieval avançado e estimativa de overhead de tokens em conteúdo tabular estruturado.
