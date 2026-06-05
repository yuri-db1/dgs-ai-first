"""
pipeline.py — Pipeline de RAG da PoC NovaTech.

Implementa as 3 etapas pedidas no exercício:
  1. INGESTÃO  -> ingest(): lê docs, chunka, embeda, grava no ChromaDB
  2. BUSCA     -> search(): pergunta -> embedding -> top-N chunks + score
  3. MONTAGEM  -> build_prompt(): chunks + pergunta -> prompt pronto p/ LLM

Vector store: ChromaDB (persistente em ./chroma_store).
Embeddings: ver embeddings.py (denso se HuggingFace acessível; senão TF-IDF).
"""

import os
import glob
import chromadb

from chunking import chunk_document
from embeddings import EmbeddingFunction

DOCS_DIR = os.path.join(os.path.dirname(__file__), "..", "documentos")
STORE_DIR = os.path.join(os.path.dirname(__file__), "..", "chroma_store")
COLLECTION = "novatech_docs"

# System prompt herdado do Exercício 1.2 (v2), com tratamento de exceções e
# prioridade de versão — peça central para o LLM não errar carga perigosa nem
# misturar PROC-042 v1/v2.
SYSTEM_PROMPT = """# IDENTIDADE
Você é o Assistente de Atendimento da NovaTech, uma transportadora de logística.
Seu público são os atendentes do suporte. Responda usando EXCLUSIVAMENTE os
trechos de documentação fornecidos no contexto.

# REGRAS (invioláveis)
1. CITE SEMPRE a fonte (documento e seção) de cada afirmação.
2. NUNCA invente prazos, valores, multiplicadores, tiers ou regras que não
   estejam nos trechos. Não complete lacunas com suposições.
3. Se a informação não estiver nos trechos, diga "Não encontrei essa informação
   na documentação disponível" e sugira escalar para o supervisor.
4. Responda em português formal, mas acessível.
5. EXCEÇÕES: "X, exceto Y" significa que Y está FORA da regra de X. Se a pergunta
   for sobre Y, a resposta é que Y NÃO é elegível ao processo de X.
6. CONFLITO DE VERSÃO: priorize a versão mais recente do documento
   (PROC-042-v2 prevalece sobre PROC-042 v1).
7. FONTE NÃO VALIDADA: o FAQ-Atendimento NÃO é documento normativo. Não o use
   como fonte única para regras críticas (devolução, carga perigosa, valores)."""


def get_client():
    return chromadb.PersistentClient(path=STORE_DIR)


def ingest(verbose=True):
    """Etapa 1 — Ingestão: lê os .md, chunka, embeda e grava no ChromaDB."""
    files = sorted(glob.glob(os.path.join(DOCS_DIR, "*.md")))
    all_chunks = []
    for path in files:
        with open(path, encoding="utf-8") as f:
            raw = f.read()
        cs = chunk_document(raw, os.path.basename(path))
        all_chunks.extend(cs)
        if verbose:
            print(f"  {os.path.basename(path):<45} -> {len(cs)} chunks")

    embfn = EmbeddingFunction()
    # TF-IDF precisa conhecer o corpus inteiro antes de gerar vetores.
    embfn.fit_corpus([c.text for c in all_chunks])

    client = get_client()
    # recria a coleção do zero (idempotente)
    try:
        client.delete_collection(COLLECTION)
    except Exception:
        pass
    col = client.create_collection(
        name=COLLECTION,
        embedding_function=embfn,
        metadata={"hnsw:space": "cosine"},  # vetores são L2-normalizados -> cosseno
    )

    col.add(
        ids=[c.id for c in all_chunks],
        documents=[c.text for c in all_chunks],
        metadatas=[c.metadata for c in all_chunks],
    )
    if verbose:
        print(f"\n  Backend de embedding: {embfn.backend}")
        print(f"  Total de chunks indexados: {len(all_chunks)}")
    return col, embfn


def get_collection(embfn=None):
    """Reabre a coleção já ingerida (reusa o mesmo embedding function)."""
    client = get_client()
    if embfn is None:
        embfn = EmbeddingFunction()
        # re-fit no corpus persistido (necessário para TF-IDF em processo novo)
        data = client.get_collection(COLLECTION).get()
        embfn.fit_corpus(data["documents"])
    return client.get_collection(COLLECTION, embedding_function=embfn), embfn


def search(question: str, col, n_results: int = 4):
    """Etapa 2 — Busca: pergunta -> top-N chunks + score de similaridade."""
    res = col.query(query_texts=[question], n_results=n_results)
    hits = []
    for i in range(len(res["ids"][0])):
        dist = res["distances"][0][i]
        hits.append({
            "id": res["ids"][0][i],
            "text": res["documents"][0][i],
            "metadata": res["metadatas"][0][i],
            "distance": dist,
            # ChromaDB devolve distância; convertemos p/ "similaridade" legível.
            "similarity": round(1.0 - dist, 4),
        })
    return hits


def build_prompt(question: str, hits: list[dict]) -> str:
    """Etapa 3 — Montagem do prompt: system + chunks + pergunta."""
    blocos = []
    for h in hits:
        m = h["metadata"]
        fonte = f"{m.get('documento')} (versão {m.get('versao')}) — {m.get('secao')}"
        blocos.append(f"[FONTE: {fonte} | classificação: {m.get('classificacao')}]\n{h['text']}")
    contexto = "\n\n---\n\n".join(blocos)
    prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        f"# TRECHOS DE DOCUMENTAÇÃO RECUPERADOS\n{contexto}\n\n"
        f"# PERGUNTA DO ATENDENTE\n{question}\n\n"
        f"# RESPOSTA\n"
    )
    return prompt


if __name__ == "__main__":
    print("== INGESTÃO ==")
    col, embfn = ingest()
    print("\n== BUSCA DE EXEMPLO ==")
    q = "Qual o multiplicador de frete para o Sudeste?"
    hits = search(q, col, n_results=3)
    for h in hits:
        print(f"  sim={h['similarity']:.3f} | {h['metadata']['documento']} | {h['metadata']['secao']}")
    print("\n== PROMPT MONTADO (preview) ==")
    print(build_prompt(q, hits)[:600], "...")
