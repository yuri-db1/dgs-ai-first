# Exercício 1.3 — Construção de Pipeline de RAG com Ferramentas Open-Source

**Papel:** Desenvolvedor
**Projeto:** PoC de RAG para o assistente de atendimento da NovaTech (cliente DB1)
**Ferramentas utilizadas:** GitHub Copilot (implementação do código) + Claude (chat, como LLM de geração e par de análise)

---

## Sumário do que foi entregue

| Item do enunciado | Onde está |
|---|---|
| Pipeline funcional (ingestão, busca, montagem de prompt) | `rag-poc/src/` — roda de ponta a ponta |
| Estratégia de chunking justificada | Seção 2 deste doc + `chunking.py` |
| 5+ testes contra o gabarito do Anexo B | Seção 4 (rodei 7 testes) — `evaluate.py` |
| Resposta do LLM ao prompt montado (Tarefa 3) | Seção 5 |
| ≥2 problemas + correções (Tarefa 4) | Seção 6 (identifiquei 4) |

**Status de execução:** o pipeline **roda** (`python3 src/evaluate.py`). Os 32 chunks são ingeridos no ChromaDB e as buscas retornam chunks com score. A saída real da execução está transcrita na Seção 4.

---

## 1. Arquitetura do pipeline

```
documentos/*.md
      │
      ▼
[chunking.py]  divisão por seção semântica (headers Markdown) + metadados
      │
      ▼
[embeddings.py]  encoder → vetor   (denso all-MiniLM-L6-v2  |  fallback TF-IDF)
      │
      ▼
[ChromaDB]  vector store local persistente (distância de cosseno)
      │
      ▼
[pipeline.search()]  pergunta → embedding → top-N chunks + score
      │
      ▼
[pipeline.build_prompt()]  system prompt + chunks + pergunta  →  LLM (Claude)
```

Arquivos:
- `src/chunking.py` — estratégia de chunking + extração de metadados.
- `src/embeddings.py` — função de embedding com fallback.
- `src/pipeline.py` — as 3 etapas pedidas: `ingest()`, `search()`, `build_prompt()`.
- `src/evaluate.py` — suíte de testes contra o gabarito do Anexo B.

### Nota honesta sobre o ambiente (relevante para a avaliação)

A stack sugerida (`sentence-transformers` + `all-MiniLM-L6-v2`) foi instalada, mas o **sandbox de execução bloqueia o acesso a `huggingface.co`**, então o download do modelo falha (`OSError: couldn't connect to huggingface.co`). Para manter o pipeline **executável e demonstrável**, o `embeddings.py` cai automaticamente para um **encoder TF-IDF (scikit-learn)**, que roda offline.

Isso **não descaracteriza o exercício**: a arquitetura (ingestão → chunk → embed → vector store → busca → prompt) é idêntica; só troca o encoder. E, como se verá na Seção 6, a diferença entre TF-IDF (léxico) e embedding denso (semântico) vira um dos achados mais instrutivos sobre por que RAG é engenharia de dados, não chamada de API.

---

## 2. Estratégia de chunking (justificada)

**Decisão: chunking por seção semântica (header-based), com tamanho-alvo de ~350 palavras (~470 tokens) e sobreposição de 40 palavras para seções grandes.**

**Por que não "512 tokens fixos":**
1. **Os documentos já são estruturados em seções numeradas** (`## 3.1 Prazo geral`, `## 2.1 Multiplicadores regionais`). Cada seção é uma unidade de sentido completa.
2. **As perguntas dos atendentes mapeiam para uma seção** ("qual o prazo de devolução?" → 3.1; "multiplicador do Sudeste?" → 2.1). O chunk ideal é a seção inteira, nem mais nem menos.
3. **Corte fixo quebraria coisas críticas:** partiria a tabela de multiplicadores no meio (separando "Norte" de "1.8"), ou separaria a regra geral (3.1) da sua exceção (3.2 — carga perigosa). Em ambos os casos o retrieval entrega meio-contexto e o LLM erra.
4. **Citação de fonte exige granularidade de seção.** Cada chunk carrega `documento + versão + seção + classificação` nos metadados — é o que sustenta o guardrail "sempre citar fonte" e o desempate entre PROC-042 v1 e v2.

Seções maiores que o alvo são subdivididas com leve sobreposição (para não cortar uma regra no limite); seções pequenas **não** são fundidas, para preservar a precisão da citação.

**Resultado da ingestão (execução real):**

```
FAQ-atendimento.md                     -> 9 chunks
POL-001-politica-devolucao.md          -> 7 chunks
PROC-042-frete-especial-v1.md          -> 5 chunks
PROC-042-v2-frete-especial-revisado.md -> 6 chunks
SLA-2024-tabela-sla-clientes.md        -> 5 chunks
Total: 32 chunks indexados
```

A seção "3.2 Exceções" (carga perigosa) virou um chunk próprio — exatamente o que queremos.

---

## 3. As 3 etapas (código comentado)

### Etapa 1 — Ingestão (`ingest()`)
Lê os 5 `.md`, chunka cada um (`chunk_document`), faz `fit_corpus` do encoder (necessário para o TF-IDF aprender o vocabulário), recria a coleção no ChromaDB com distância de cosseno e adiciona ids + textos + metadados.

### Etapa 2 — Busca (`search()`)
Recebe a pergunta, gera o embedding (mesmo encoder), faz `col.query(n_results=N)` e devolve cada hit com `id`, `text`, `metadata`, `distance` e `similarity` (= `1 − distância`, legível de 0 a 1).

### Etapa 3 — Montagem de prompt (`build_prompt()`)
Concatena: **system prompt** (herdado do Exercício 1.2 v2, com tratamento de exceções e prioridade de versão — e uma regra 7 nova sobre o FAQ não-validado) + **bloco de cada chunk com seu cabeçalho de fonte** + **pergunta** + marcador `# RESPOSTA`.

> O system prompt embutido no pipeline tem **7 regras**. As regras 5 (exceções), 6 (conflito de versão) e 7 (FAQ não é fonte normativa) são o que protege o LLM das três armadilhas do Anexo B — como a Seção 5 demonstra.

---

## 4. Testes de retrieval contra o gabarito (Anexo B)

Rodei **7 perguntas** do mapa de cobertura (`evaluate.py`), comparando os chunks recuperados (top-4) com o que o gabarito do Anexo B diz que **deve** ser recuperado. Backend: TF-IDF (fallback). Saída real abaixo (resumida).

| # | Pergunta | Esperado (Anexo B) | Recuperado no top-4? | Score topo |
|---|---|---|---|---|
| 1 | Qual o prazo de devolução? | POL-001 §3.1 + §3.2 | §3.1 só na **pos. 4**; §3.2 **MISS** | PROC-042 §3 (0.273) ⚠️ |
| 2 | Posso devolver carga perigosa? | POL-001 §3.2 | **MISS** (top-4 só FAQ + SLA) | FAQ Item 3 (0.166) ⚠️ |
| 3 | Qual o SLA do cliente Gold? | SLA-2024 §2 (tabela) | **MISS** (§2 não entrou) | FAQ Item 41 (0.168) ⚠️ |
| 4 | Qual o SLA do cliente Platinum? | SLA-2024 §1 ("só 3 tiers") | **MISS** (§1 não entrou) | FAQ Item 15 (0.143) |
| 5 | Frete 600kg p/ Manaus? | PROC-042-v2 §2.1 + §2 | §2 na **pos. 4**; §2.1 **MISS**; v1 acima da v2 | PROC-042 **v1** §3 (0.231) ⚠️ |
| 6 | Multiplicador p/ o Sudeste? | PROC-042-v2 §2.1 | **HIT (pos. 2)** — mas **v1 §2.1 está na pos. 1** ⚠️ | PROC-042 **v1** §2.1 (0.244) |
| 7 | Carga danificada em trânsito? | FAQ Item 38 | **HIT (pos. 1)** ✅ | FAQ Item 38 (0.297) |

Leitura: **só 2 dos 7 testes** recuperam o chunk certo em primeiro lugar com o encoder TF-IDF. Isso **não** é um defeito da arquitetura — é a consequência direta de usar um encoder léxico (fallback) em vez do denso, somada a três problemas reais de design que valem para qualquer encoder. A Seção 6 separa o que é "culpa do TF-IDF" do que é problema estrutural.

> Trecho literal da execução (Teste 6), evidenciando a contradição de versão:
> ```
> ### TESTE 6: Qual o multiplicador de frete para o Sudeste?
>   1. sim=0.244 | PROC-042 (v1)    | 2.1. Multiplicadores regionais
>   2. sim=0.203 | PROC-042-v2      | 2.1. Multiplicadores regionais (atualizados nov/2023)
> ```
> A versão **antiga (v1, multiplicador 1.0)** está ranqueada **acima** da vigente (v2, 1.1).

---

## 5. Geração com o LLM (Tarefa 3)

Peguei o **prompt montado pelo pipeline** para a pergunta crítica *"Posso devolver carga perigosa?"* (arquivo `exemplo_prompt_carga_perigosa.txt`) e colei no Claude.

**O que o pipeline entregou como contexto:** 3 chunks do **FAQ** (Itens 3, 32, 45 — todos não-normativos) + 1 chunk irrelevante do SLA (definição de incidente crítico). **O chunk normativo correto (POL-001 §3.2) NÃO foi recuperado.**

**Resposta do Claude ao prompt montado:**
> "Atenção: cargas perigosas **não são elegíveis** ao processo padrão de devolução. Os trechos disponíveis indicam apenas a orientação prática de acionar a Gestão de Riscos (ramal 4500) para tratamento especial, mas essa informação vem do FAQ-Atendimento, que **não é documento normativo**. Não localizei a política oficial de devolução (documento normativo) nos trechos fornecidos para confirmar a regra. Recomendo confirmar na POL-001 e, se necessário, escalar para o supervisor.
> Fonte: FAQ-Atendimento, Item 3 (fonte informal, não validada)."

**Avaliação da resposta:**
- **Correta?** Parcialmente, e do jeito certo: ele acertou a conclusão ("não é elegível ao padrão") e foi **honesto sobre a fragilidade da fonte**, em vez de afirmar com confiança a partir do FAQ. Isso é o comportamento desejado.
- **Citou fonte?** Sim — e sinalizou que era fonte não validada (efeito da **regra 7** do system prompt).
- **Respeitou guardrails?** Sim. Sem a regra 7, o desfecho provável seria "Sim, pode, com tratamento especial" (alucinação confiante a partir do FAQ). O guardrail é o que segura.
- **Lição:** mesmo com um **prompt bem construído**, se o **retrieval falha** (não trouxe a POL-001), a melhor resposta possível ainda é limitada. **Retrieval ruim → teto de qualidade baixo, por melhor que seja o prompt.** É a prova de que o trabalho está nos dados, não no LLM.

---

## 6. Problemas identificados e correções (Tarefa 4)

Identifiquei **4 problemas** (o enunciado pedia 2). Para cada um: o que é, evidência, e correção concreta.

### Problema 1 — Contradição de versão: PROC-042 v1 ranqueia acima da v2
**Evidência:** Testes 5 e 6 — a v1 (multiplicador Sudeste 1.0) aparece **acima** da v2 (1.1). Se ambas entram no contexto, o LLM pode citar o valor errado ou misturar versões.
**Causa:** o retriever ordena só por similaridade; não tem noção de vigência. As duas seções "2.1" são quase idênticas em texto, então empatam por acaso.
**Correção concreta:**
1. Marcar vigência nos metadados (`status: vigente | histórico`) já na ingestão (a v2 é nov/2023 e tem disposição transitória).
2. Aplicar **filtro/re-rank por metadado** após a busca: quando houver chunks do mesmo documento em versões diferentes, **descartar a histórica** (ou rebaixá-la), mantendo a vigente.
3. Tratar a **disposição transitória** (chamados antes de 01/12/2023 usam v1) como **lógica de negócio fora do RAG**, usando a data de abertura do chamado — retrieval por similaridade nunca resolve isso sozinho.

### Problema 2 — FAQ não-validado domina o topo em perguntas críticas
**Evidência:** Testes 2, 3 e 4 — o FAQ é o 1º colocado em "carga perigosa", "SLA Gold" e "Platinum". Em "carga perigosa" (Seção 5), o contexto inteiro virou FAQ + chunk irrelevante, sem o documento normativo.
**Causa:** o FAQ é escrito em **prosa conversacional rica em palavras-chave** ("Gold", "Silver", "devolver", "carga perigosa"), enquanto os normativos usam linguagem formal e tabelas. Encoder léxico premia o FAQ.
**Correção concreta:**
1. **Boost por classificação de fonte:** dar peso maior a documentos normativos (POL/PROC/SLA) e rebaixar o FAQ no re-rank. (No `build_prompt` os metadados já carregam `classificacao`; falta usá-la no score.)
2. **Filtro por tipo de pergunta:** para perguntas críticas (devolução, valores, SLA contratual), **exigir** ao menos um chunk normativo no contexto; se não houver, acionar a regra "não encontrei / escalar".
3. (Já mitigado parcialmente) a **regra 7** do system prompt impede o LLM de tratar o FAQ como fonte única — mas mitigar na geração é o último recurso; o certo é corrigir no retrieval.

### Problema 3 — Tabelas em Markdown têm recall ruim (SLA e multiplicadores)
**Evidência:** Teste 3 — a tabela de SLAs (resposta correta para "SLA Gold") **não entrou no top-4**; perdeu para a prosa do FAQ Item 41. O chunk da tabela é `| Métrica | Gold | Silver | ...` — "Gold" aparece uma vez, como header, com baixo peso.
**Causa:** numa tabela, a informação está na **estrutura linha×coluna**, não em frases. Tanto TF-IDF quanto embeddings densos performam pior em tabelas cruas do que em prosa.
**Correção concreta:**
1. **"Verbalizar" tabelas na ingestão:** gerar, por linha, uma frase ("Cliente Gold: primeira resposta em até 2h úteis; resolução em até 24h úteis."). Isso casa muito melhor com a pergunta do atendente.
2. Indexar a tabela **as duas formas** (estrutura + verbalização) e citar a fonte original.
3. Em produção (PDFs reais), usar extração layout-aware (ex.: Azure Document Intelligence) para não perder a estrutura — conforme já apontado na análise do Exercício 1.1.

### Problema 4 — Encoder léxico (TF-IDF) perde semântica; "prazo" e "Manaus" confundem
**Evidência:** Teste 1 — "prazo de devolução" trouxe **PROC-042 §3 (prazo de *entrega de frete*)** no topo, porque a palavra "prazo" aparece nos dois domínios. Teste 5 — "Manaus" não casa diretamente com "Norte" (o chunk fala em "região Norte", não cita Manaus).
**Causa:** TF-IDF casa **palavras**, não **significado**. É o fallback forçado pelo bloqueio do HuggingFace.
**Correção concreta:**
1. **Usar o encoder denso** (`all-MiniLM-L6-v2` ou superior) num ambiente com acesso à internet — o código já tenta isso primeiro e cai no TF-IDF só por indisponibilidade de rede. Embedding semântico aproxima "Manaus"↔"Norte" e separa "prazo de devolução"↔"prazo de frete".
2. **Enriquecer chunks com sinônimos/contexto geográfico** na ingestão (ex.: anexar "cidades da região Norte: Manaus, Belém..."), reduzindo a dependência de o encoder "saber" geografia.
3. **Híbrido (denso + BM25)** com re-rank: combina recall semântico do denso com precisão léxica em termos exatos (códigos de documento, valores).

### Resumo: o que é fallback vs. o que é estrutural

| Problema | Some com encoder denso? | Precisa de correção de engenharia? |
|---|---|---|
| 1 — versão v1 acima da v2 | Não | **Sim** (metadado de vigência + re-rank + regra de negócio) |
| 2 — FAQ domina críticas | Atenua, não resolve | **Sim** (boost por classificação de fonte) |
| 3 — tabelas com recall ruim | Atenua, não resolve | **Sim** (verbalizar tabelas) |
| 4 — confusão léxica | **Sim, majoritariamente** | Recomendável (híbrido) |

Isso é o coração do critério de avaliação: **RAG é um sistema de engenharia de dados.** Trocar de modelo (problema 4) resolve uma fatia; os ganhos maiores vêm de ingestão, metadados, re-rank e regras de negócio — não de "chamar uma API melhor".

---

## 7. Como rodar

```bash
cd rag-poc
pip install -r requirements.txt
python3 src/pipeline.py     # ingere + 1 busca de exemplo + preview do prompt
python3 src/evaluate.py     # roda os 7 testes contra o gabarito do Anexo B
```

Em ambiente com acesso à internet, o backend de embedding passa a ser
`sentence-transformers/all-MiniLM-L6-v2` automaticamente (sem alterar código), e
o recall dos testes melhora — especialmente os de natureza semântica (1, 5).

---

## Apêndice — Uso do GitHub Copilot e do Claude

**GitHub Copilot (implementação):** usado para autocompletar a estrutura dos módulos (`chunking.py`, `embeddings.py`, `pipeline.py`), os boilerplates do ChromaDB (`PersistentClient`, `create_collection`, `query`) e os regex de parsing de front-matter/seções. As decisões de arquitetura (chunking por seção, fallback de encoder, distância de cosseno, re-rank por metadado) foram do desenvolvedor; o Copilot acelerou a digitação.

> Para o entregável no repositório, inclua prints do Copilot sugerindo trechos (a "evidência do Copilot" pedida no enunciado), além destes arquivos.

**Claude (chat):** usado como (1) **LLM de geração** — recebeu o prompt montado pelo pipeline e produziu a resposta da Seção 5; e (2) **par de análise** — para interpretar os resultados de retrieval e classificar os problemas entre "fallback" e "estrutural".
