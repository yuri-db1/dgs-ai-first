# Exercício 1.1 — Análise de Viabilidade Técnica com Fundamentos de LLM e Engenharia de Contexto

**Papel:** Desenvolvedor
**Projeto:** Assistente de IA para atendimento — NovaTech (cliente DB1)
**Ferramenta utilizada:** Claude (chat)

> Este documento contém duas partes, conforme as Tarefas 1 e 2 do exercício:
> - **Parte 1 — Análise técnica v1:** primeira versão produzida com apoio do Claude.
> - **Parte 2 — Revisão crítica e análise v2 (final):** o Claude revisou a v1 apontando estimativas otimistas, pontos fracos e riscos não considerados; a v2 incorpora esse feedback.
>
> O histórico de iteração com o Claude está no Apêndice ao final.

---

# PARTE 1 — Análise Técnica (v1)

## 1. Contexto e objetivo da análise

A NovaTech quer um assistente que responda perguntas de atendentes em linguagem natural, fundamentado na documentação oficial (SharePoint + Confluence + planilhas de rede) e com citação de fonte. A arquitetura assumida é **RAG sobre Azure AI Search + um LLM (GPT-4o, janela de 128K tokens)**, integrado a Teams/SharePoint.

O objetivo desta análise é avaliar a **viabilidade técnica** sob duas óticas:
1. A natureza heterogênea das fontes e o que isso exige do pipeline de ingestão/RAG.
2. O **gerenciamento de contexto** — por que "jogar tudo no modelo" não funciona e como o orçamento de atenção molda a arquitetura.

## 2. Desafios por tipo de fonte

Cada tipo de conteúdo quebra de uma forma diferente no pipeline. A tabela abaixo resume; o detalhamento vem em seguida.

| Tipo de fonte | Desafio para o RAG | Impacto na resposta | Estratégia de tratamento |
|---|---|---|---|
| PDF com tabelas complexas (15+ colunas) | Extração linear destrói a estrutura linha×coluna | Cruza valores errados (ex.: multiplicador de uma região atribuído a outra) | Extração estrutural (layout-aware), preservar tabela como Markdown/HTML no chunk; manter cabeçalho junto da linha |
| PDF escaneado (precisa OCR) | Texto não é nativo; OCR erra dígitos e acentos | Valores numéricos corrompidos viram fonte de erro silencioso | OCR com verificação de confiança; sinalizar baixa confiança; revisão humana para docs normativos |
| Wiki Confluence (links internos, macros) | Macros não renderizam em texto; links quebram o contexto da página | Resposta perde informação que estava "atrás" de um link/macro | Renderizar macros antes de extrair; resolver/expandir links críticos; chunk por seção com título |
| Planilhas com fórmulas interdependentes | O valor está na fórmula, não no texto; perde-se a relação entre células | "Lê" rótulos sem entender o cálculo; ignora dependências | Materializar valores calculados; converter para tabela textual com contexto da aba; tratar como dado estruturado, não texto livre |

**PDFs com tabelas complexas.** As tabelas de frete (PROC-042) têm a informação na *interseção* linha×coluna. Uma extração ingênua (texto corrido) transforma "Sudeste 1.1" e "Norte 1.8" numa sopa de números onde o modelo pode associar o multiplicador à região errada. Estratégia: extração que preserva a estrutura tabular (Azure Document Intelligence / layout-aware parsing) e armazenar a tabela no chunk em formato que mantém a relação (Markdown/HTML), com o cabeçalho replicado junto da linha.

**PDFs escaneados.** OCR é a etapa mais perigosa para documentos normativos, porque o erro é numérico e silencioso: "1.5" vira "15", "R$ 100.000" vira "R$ 10.000". O atendente não tem como perceber. Estratégia: OCR com score de confiança, flag de baixa confiança no metadado do chunk, e — para documentos que definem valores/prazos — exigir validação humana antes de indexar.

**Wiki Confluence.** Macros customizadas e links internos significam que parte da informação não está no texto plano. Estratégia: renderizar a página (HTML final) antes de extrair, expandir macros, e tratar links internos como sinal de relação entre chunks (metadado), não descartá-los.

**Planilhas com fórmulas.** O valor relevante muitas vezes é o *resultado* de uma fórmula que depende de outras células. Extrair a planilha como texto perde isso. Estratégia: materializar os valores calculados, converter cada aba relevante em uma tabela textual com contexto (nome da aba, cabeçalhos), e tratar como dado estruturado.

## 3. Estimativa do tamanho da base (em tokens)

Regra prática: ~0,75 palavra por token ⇒ `tokens ≈ palavras / 0,75`.

| Fonte | Volume | Palavras estimadas | Tokens estimados |
|---|---|---|---|
| PDFs | 800 docs × 10 págs × ~500 palavras/pág | 4.000.000 | ~5,33 M |
| Wiki | 400 págs × 1.500 palavras | 600.000 | ~0,80 M |
| Planilhas | 50 × ~2.000 palavras-equivalente | 100.000 | ~0,13 M |
| **Total** | — | **~4,7 M** | **~6,3 M tokens** |

**Leitura:** a base inteira tem ordem de **milhões de tokens** — ~49× a janela de 128K do GPT-4o. Isso confirma que **não existe a opção de "colocar toda a documentação no contexto"**. O RAG não é uma escolha de conveniência; é uma necessidade matemática. O trabalho de qualidade está em *selecionar* os poucos chunks certos, não em ampliar o contexto.

## 4. Análise de orçamento de contexto

Janela do GPT-4o: 128K tokens. System prompt + instruções: ~2K. Chunks de ~500 tokens.

Cálculo simples (só descontando o system prompt): `(128.000 − 2.000) / 500 = 252 chunks`.

Mas esse número é enganoso. O contexto real não é só system prompt + chunks — também há histórico de conversa (Teams é multi-turn) e a própria resposta precisa de espaço. Descontando uma reserva razoável (system ~2K, saída ~4K, histórico ~4K), sobram ~118K ⇒ **~236 chunks** caberiam fisicamente.

**O ponto central:** "caber" não é o objetivo. Encher o contexto com 236 chunks é contraproducente por dois motivos:
- **Lost in the middle:** informação no meio de um contexto longo é processada com menos atenção que no início/fim. Chunks relevantes enterrados no meio do prompt podem ser efetivamente ignorados.
- **Orçamento de atenção / context rot:** mais texto irrelevante dilui a atenção do modelo e degrada a precisão. A resposta correta tende a vir de **3 a 8 chunks bem escolhidos**, não de 200.

Conclusão de design: o gargalo de qualidade é a **relevância do retrieval (top-k pequeno e preciso)**, não a capacidade da janela.

## 5. Recomendação de estratégia de chunking

Justificada pelo tipo de pergunta e pelo *lost in the middle*:

- **Chunk por seção semântica**, não por contagem fixa de caracteres. As perguntas dos atendentes são pontuais ("qual o prazo de devolução?", "multiplicador do Sudeste?") e mapeiam para *uma seção específica* de um documento. Cortar no meio de uma seção separa a regra do seu contexto.
- **Tamanho-alvo ~500 tokens com leve sobreposição** entre chunks adjacentes, para não cortar uma regra no limite.
- **Cabeçalho/contexto replicado em cada chunk** (documento de origem, versão, seção). Isso é o que sustenta a citação de fonte e o desempate entre versões.
- **Metadados ricos:** documento, versão, data de vigência, área responsável. Essenciais para o problema das versões (PROC-042 vs v2) e para mitigar *lost in the middle* — em vez de empurrar muitos chunks, o sistema usa metadado para escolher o chunk *certo* (versão vigente) e mantê-lo no topo do contexto.

## 6. Conclusão de viabilidade (v1)

O projeto é **tecnicamente viável**, mas o esforço está concentrado na **engenharia de ingestão e na qualidade do retrieval**, não no LLM. Os principais riscos técnicos são extração de tabelas/escaneados, contradição entre versões de documento, e a tentação de "encher o contexto" em vez de selecionar bem.

---

# PARTE 2 — Revisão Crítica e Análise v2 (Final)

Pedi ao Claude que revisasse a v1 procurando estimativas otimistas, pontos fracos e riscos não considerados. O resumo do feedback e as correções incorporadas estão abaixo. As mudanças relevantes estão marcadas com **[v2]**.

## Resumo do feedback do Claude sobre a v1

1. **Estimativa de palavras/página otimista e sem faixa.** 500 palavras/página é razoável para texto corrido, mas a base tem tabelas e escaneados — densidade muito variável. Apresentar um único número passa falsa precisão.
2. **A estimativa de tokens não vira decisão.** A v1 calcula 6,3 M tokens mas não diz o que isso muda na arquitetura além de "precisa de RAG". Faltou conectar o número a custo de embeddings e a decisão de *re-indexação*.
3. **"252 chunks cabem" reforça o erro que a própria análise critica.** Mesmo explicando depois, dar o número de 252 sem reserva alimenta a ilusão de "quanto mais, melhor". Faltou também o custo (latência e $) de top-k grande.
4. **Risco de versão tratado só como chunking.** A contradição PROC-042 vs v2 não se resolve com metadado de versão sozinho — há a regra de **disposição transitória** (chamados antes de 01/12/2023 usam v1). Isso é lógica de negócio que o retrieval puro não captura.
5. **OCR e custo de manutenção subestimados.** A v1 cita OCR, mas não trata o custo recorrente: a base é atualizada *mensalmente por 3 áreas sem processo unificado*. Re-ingestão e detecção de mudança são parte do escopo, não um detalhe.
6. **Faltou o risco do FAQ não-validado.** O FAQ é fonte não oficial; se entrar no índice com o mesmo peso dos normativos, contamina respostas críticas.

## Correções incorporadas na v2

**[v2] §3 — Estimativa de tokens com faixa e consequência.** Em vez de número único, uso faixa: assumindo 300–600 palavras/página úteis nos PDFs, a base fica entre **~5 M e ~8 M tokens** (ponto médio ~6,3 M). O que isso decide:
- **Custo de embeddings é proporcional a esse total** e ocorre a cada (re)indexação — não só uma vez, porque a base muda mensalmente. Logo, o pipeline precisa de **indexação incremental** (só re-embeddar o que mudou), não reprocessamento total mensal.
- Confirma que RAG é obrigatório (a base é ~40–60× a janela).

**[v2] §4 — Orçamento de contexto sem alimentar a ilusão.** O número fisicamente possível (~236 chunks após reservas) é apresentado apenas para *refutá-lo*. A recomendação operacional é **top-k entre 3 e 8**, porque:
- top-k grande aumenta **latência e custo por query** (mais tokens de entrada);
- agrava *lost in the middle*;
- a meta de negócio (< 2 min por chamado) é melhor servida por respostas rápidas e precisas de poucos chunks do que por contextos inchados.

**[v2] §5 — Versão como regra de negócio, não só metadado.** Manter metadado de versão/vigência é necessário mas insuficiente. Para PROC-042 vs v2, é preciso:
- marcar a v1 como histórica e a v2 como vigente no metadado;
- **e** codificar a disposição transitória (data de abertura do chamado decide a versão) como **lógica fora do RAG** — ou seja, o sistema precisa do dado "data de abertura do chamado" para escolher a tabela certa. Retrieval puro por similaridade não resolve isso e pode retornar as duas versões ao mesmo tempo, gerando resposta que mistura multiplicadores.

**[v2] §2 — Custo recorrente de ingestão (risco novo).** A atualização mensal por 3 áreas sem processo unificado significa que **a ingestão é um processo contínuo, não um evento de setup**. O pipeline precisa de: detecção de mudança (hash/versão de documento), re-indexação incremental, e um passo de validação para documentos normativos (especialmente os que passam por OCR). Sem isso, a base "envelhece" e volta o problema atual (informação contraditória).

**[v2] §1 — Governança de fonte (risco novo).** O FAQ-Atendimento é **explicitamente não validado** por Compliance/Operações. Se for indexado com o mesmo peso dos documentos normativos (POL/PROC/SLA), o assistente pode responder perguntas críticas (ex.: carga perigosa) com base no FAQ e parecer confiante. Recomendação: classificar fontes por nível de confiança no metadado e instruir o modelo a **priorizar normativos** e a tratar o FAQ como apoio, nunca como fonte única para regras críticas.

## Tabela de riscos técnicos consolidada (v2)

| # | Risco técnico | Causa-raiz | Mitigação concreta |
|---|---|---|---|
| 1 | Tabela extraída com valores cruzados | Extração linear de PDF | Extração layout-aware; tabela como Markdown no chunk; cabeçalho junto da linha |
| 2 | Valores numéricos corrompidos | OCR de escaneados | OCR com score de confiança; flag de baixa confiança; validação humana p/ normativos |
| 3 | Resposta mistura versões (PROC-042 vs v2) | Retrieval traz as duas; disposição transitória ignorada | Metadado de vigência + lógica de negócio usando data de abertura do chamado |
| 4 | Resposta crítica baseada em fonte não validada | FAQ indexado com mesmo peso | Classificar fontes por confiança; instruir modelo a priorizar normativos |
| 5 | Base envelhece e volta a contradição | Atualização mensal por 3 áreas, sem processo | Ingestão incremental com detecção de mudança; validação de normativos |
| 6 | Degradação por contexto inchado | top-k grande / "quanto mais melhor" | top-k 3–8; metadado para escolher o chunk certo; posicionar o mais relevante no topo |

## Conclusão de viabilidade (v2 — final)

O projeto é **viável**, com a ressalva de que o trabalho de engenharia está **na ingestão e no retrieval, não no modelo**. Três pontos definem o sucesso técnico:

1. **Ingestão como processo contínuo e validado** (não setup único), por causa da atualização mensal descoordenada.
2. **Versão e vigência tratadas como regra de negócio**, não só similaridade semântica.
3. **Orçamento de contexto gerenciado por relevância** (top-k pequeno), não por capacidade de janela.

A meta da diretoria (12 → < 2 min) é alcançável *se* essas três frentes forem resolvidas; se forem subestimadas, o assistente vai parecer funcionar na demo e falhar exatamente nas perguntas que mais importam (valores, prazos, versões).

---

# Apêndice — Histórico de iteração com o Claude

**Prompt 1 (produção da v1):**
> "Você é meu par técnico. Sou desenvolvedor avaliando a viabilidade de um assistente RAG para a NovaTech [cenário + inputs técnicos colados]. Me ajude a produzir uma análise técnica cobrindo: desafio por tipo de fonte (PDF com tabela, PDF escaneado, wiki, planilha), estimativa da base em tokens (regra 0,75 palavra/token), orçamento de contexto no GPT-4o (128K, system ~2K, chunks ~500), e estratégia de chunking justificada por lost in the middle."

→ Gerou a estrutura da Parte 1.

**Prompt 2 (revisão crítica — Tarefa 2):**
> "Agora critique esta análise como um tech lead cético. Onde minhas estimativas estão otimistas demais? Que riscos eu não considerei? O que ficou genérico?"

→ Gerou os 6 pontos de feedback da Parte 2 (faixa de tokens em vez de número único; conectar tokens a custo de re-indexação; não alimentar a ilusão de top-k grande; versão como regra de negócio e não só metadado; custo recorrente de ingestão; risco do FAQ não validado).

**Prompt 3 (incorporação):**
> "Incorpore essas críticas na análise, marcando o que mudou como [v2], e consolide os riscos numa tabela com causa-raiz e mitigação acionável."

→ Gerou a Parte 2 final e a tabela de riscos consolidada.
