# RAG PoC — Assistente de Atendimento NovaTech

Prova de conceito de pipeline de RAG (Retrieval-Augmented Generation) construída
com ferramentas open-source/gratuitas, para o Exercício 1.3 (papel Desenvolvedor)
da Trilha de Formação AI First — DGS.

## Objetivo

Ingerir a documentação da NovaTech, indexá-la num vector store, e recuperar os
trechos certos para responder perguntas de atendentes — com citação de fonte e
sem inventar informação.

## Stack

- **Python 3.12**
- **ChromaDB** — vector store local persistente
- **sentence-transformers** (`all-MiniLM-L6-v2`) — embeddings densos
  - *Fallback:* **TF-IDF** (scikit-learn) quando o HuggingFace está inacessível
- **Claude** (chat) — LLM de geração (o prompt é montado pelo pipeline e colado no chat)

## Estrutura

```
rag-poc/
├── documentos/                 # 5 documentos .md da NovaTech (entrada da ingestão)
├── src/
│   ├── chunking.py             # chunking por seção semântica + metadados
│   ├── embeddings.py           # encoder com fallback (denso -> TF-IDF)
│   ├── pipeline.py             # ingest() / search() / build_prompt()
│   └── evaluate.py             # testes de retrieval vs gabarito do Anexo B
├── exemplo_prompt_carga_perigosa.txt   # prompt montado (exemplo p/ a Tarefa 3)
├── requirements.txt
├── RELATORIO-exercicio-1.3.md  # relatório completo (testes, análise, correções)
└── README.md
```

## Como rodar

```bash
pip install -r requirements.txt
python3 src/pipeline.py     # ingestão + busca de exemplo + preview do prompt
python3 src/evaluate.py     # 7 testes contra o gabarito do Anexo B
```

> Nota: no sandbox de execução o download do modelo `all-MiniLM-L6-v2`
> (huggingface.co) é bloqueado, então o pipeline usa o fallback TF-IDF
> automaticamente. Em ambiente com internet, o encoder denso é usado sem
> qualquer alteração de código.

## Pipeline em uma frase

`documentos → chunking por seção → embeddings → ChromaDB → busca por similaridade
→ montagem de prompt (system + chunks + pergunta) → Claude`

Veja `RELATORIO-exercicio-1.3.md` para os resultados dos testes, a resposta do
LLM e os 4 problemas de retrieval identificados com suas correções.
