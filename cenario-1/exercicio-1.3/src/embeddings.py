"""
embeddings.py — Função de embedding do pipeline.

STACK SUGERIDA: sentence-transformers (all-MiniLM-L6-v2) — embeddings semânticos
densos, é o ideal para produção.

FALLBACK (usado neste ambiente): o sandbox de execução BLOQUEIA o acesso a
huggingface.co, então o download do modelo all-MiniLM-L6-v2 falha. Para manter o
pipeline 100% funcional e executável, caímos para um embedding TF-IDF
(scikit-learn), que é determinístico, roda offline e não exige download.

IMPLICAÇÃO (documentada como achado do exercício — Tarefa 4):
- TF-IDF é LÉXICO (casa palavras), não SEMÂNTICO. Ele recupera bem quando a
  pergunta compartilha termos com o chunk (ex.: "multiplicador Sudeste"), mas
  perde sinônimos/paráfrases ("quanto custa mandar p/ Manaus" vs "frete região
  Norte"). Em produção, o modelo denso resolve isso.
- A arquitetura do pipeline (ingestão -> chunk -> embed -> vector store -> busca
  -> montagem de prompt) é IDÊNTICA nos dois casos; só troca o "encoder".
"""

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from chromadb.api.types import EmbeddingFunction as ChromaEmbeddingFunction, Documents, Embeddings

# Tenta carregar o modelo denso; se a rede bloquear o HuggingFace, usa TF-IDF.
_BACKEND = None
_st_model = None


def _try_load_sentence_transformer():
    global _st_model
    try:
        from sentence_transformers import SentenceTransformer
        _st_model = SentenceTransformer("all-MiniLM-L6-v2")
        return True
    except Exception as e:  # rede bloqueada, etc.
        print(f"[embeddings] sentence-transformers indisponível ({type(e).__name__}). "
              f"Usando fallback TF-IDF.")
        return False


class EmbeddingFunction(ChromaEmbeddingFunction):
    """
    Interface compatível com ChromaDB: chamável que recebe list[str] e
    devolve list[list[float]]. Herda de ChromaEmbeddingFunction para ganhar
    embed_query/embed_documents automaticamente. Mantém estado do vectorizer
    TF-IDF (precisa ser 'fitado' no corpus de chunks antes de embeddar queries).
    """

    def __init__(self):
        global _BACKEND
        if _try_load_sentence_transformer():
            _BACKEND = "sentence-transformers/all-MiniLM-L6-v2"
            self.mode = "dense"
        else:
            _BACKEND = "tfidf (fallback offline)"
            self.mode = "tfidf"
            self._vec = TfidfVectorizer(
                lowercase=True,
                ngram_range=(1, 2),     # uni+bigramas ajudam termos compostos
                min_df=1,
                strip_accents="unicode",
            )
            self._fitted = False
            self._dim = None

    @property
    def backend(self):
        return _BACKEND

    def fit_corpus(self, texts: list[str]):
        """Só para TF-IDF: aprende o vocabulário do corpus de chunks."""
        if self.mode == "tfidf":
            mat = self._vec.fit_transform(texts)
            self._fitted = True
            self._dim = mat.shape[1]

    def __call__(self, input: list[str]) -> list[list[float]]:
        if self.mode == "dense":
            embs = _st_model.encode(input, normalize_embeddings=True)
            return [e.tolist() for e in embs]
        # TF-IDF
        if not self._fitted:
            # fit defensivo se chamado antes de fit_corpus
            self._vec.fit(input)
            self._fitted = True
            self._dim = len(self._vec.vocabulary_)
        mat = self._vec.transform(input).toarray().astype("float32")
        # normaliza L2 para que produto interno ~ similaridade de cosseno
        norms = np.linalg.norm(mat, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        mat = mat / norms
        return mat.tolist()

    # ChromaDB >=0.4 exige estes métodos na embedding function custom
    def name(self) -> str:
        return f"novatech-{self.mode}"

    @staticmethod
    def build_from_config(config):
        return EmbeddingFunction()

    def get_config(self):
        return {}
