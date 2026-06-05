"""
chunking.py — Estratégia de chunking do pipeline de RAG.

ESTRATÉGIA: chunking por SEÇÃO SEMÂNTICA (header-based), não por janela fixa.

Justificativa (ver README para detalhes):
- Os documentos da NovaTech são Markdown estruturado em seções numeradas
  (## 3.1 Prazo geral, ## 2.1 Multiplicadores regionais, etc).
- As perguntas dos atendentes são pontuais e mapeiam para UMA seção
  ("qual o prazo de devolução?" -> seção 3.1; "multiplicador do Sudeste?" -> 2.1).
- Cortar por nº fixo de tokens partiria uma tabela de fretes ou separaria a
  regra geral da sua exceção -> retrieval traz meio-contexto e o LLM erra.
- Cada chunk carrega metadados (documento, versão, seção, data) que sustentam
  a CITAÇÃO DE FONTE e o desempate entre versões (PROC-042 v1 vs v2).

Seções muito grandes são sub-divididas com sobreposição leve para não estourar
um tamanho-alvo; seções minúsculas adjacentes não são fundidas para preservar
a granularidade de citação.
"""

import re
from dataclasses import dataclass, field


# Tamanho-alvo de chunk em "palavras" (proxy de tokens: ~0.75 palavra/token).
# ~350 palavras ~= ~470 tokens, dentro do alvo de ~500 tokens da análise do 1.1.
TARGET_WORDS = 350
OVERLAP_WORDS = 40


@dataclass
class Chunk:
    id: str
    text: str
    metadata: dict = field(default_factory=dict)


def _parse_front_matter(raw: str) -> dict:
    """Extrai metadados do cabeçalho do documento (Versão, Última atualização...)."""
    meta = {}
    # Título (primeira linha "# ...")
    m = re.search(r"^#\s+(.+)$", raw, re.MULTILINE)
    if m:
        meta["titulo"] = m.group(1).strip()
    for label, key in [
        (r"\*\*Vers[aã]o:\*\*", "versao"),
        (r"\*\*[ÚU]ltima atualiza[çc][aã]o:\*\*", "atualizacao"),
        (r"\*\*Data de emiss[aã]o:\*\*", "atualizacao"),
        (r"\*\*Respons[aá]vel:\*\*", "responsavel"),
        (r"\*\*Classifica[çc][aã]o:\*\*", "classificacao"),
        (r"\*\*Status:\*\*", "status"),
    ]:
        mm = re.search(label + r"\s*(.+)", raw)
        if mm and key not in meta:
            meta[key] = mm.group(1).strip()
    return meta


def _split_by_sections(raw: str):
    """Divide o texto em (titulo_secao, corpo) usando headers ## e ###."""
    # Captura headers de nível 2 e 3 como pontos de corte.
    pattern = re.compile(r"^(#{2,3})\s+(.+)$", re.MULTILINE)
    matches = list(pattern.finditer(raw))
    sections = []
    if not matches:
        sections.append(("(documento)", raw.strip()))
        return sections
    # Preâmbulo antes do primeiro header (cabeçalho/objetivo) é descartado como
    # chunk próprio porque os metadados já o capturam; mantemos só o corpo seccionado.
    for i, m in enumerate(matches):
        sec_title = m.group(2).strip()
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(raw)
        body = raw[start:end].strip()
        if body:
            sections.append((sec_title, body))
    return sections


def _window(words, size, overlap):
    """Gera janelas de palavras com sobreposição para seções grandes."""
    if len(words) <= size:
        yield words
        return
    step = size - overlap
    for i in range(0, len(words), step):
        piece = words[i:i + size]
        if piece:
            yield piece
        if i + size >= len(words):
            break


def chunk_document(raw: str, source_filename: str) -> list[Chunk]:
    """Recebe o texto bruto de um documento e devolve a lista de chunks."""
    meta_base = _parse_front_matter(raw)
    doc_code = source_filename.split("-")[0:2]  # heurística p/ código do doc
    doc_id = re.sub(r"\.md$", "", source_filename)
    chunks = []
    for sec_idx, (sec_title, body) in enumerate(_split_by_sections(raw)):
        words = body.split()
        for w_idx, win in enumerate(_window(words, TARGET_WORDS, OVERLAP_WORDS)):
            cid = f"{doc_id}::sec{sec_idx}::w{w_idx}"
            meta = {
                "source": source_filename,
                "documento": meta_base.get("titulo", doc_id),
                "secao": sec_title,
                "versao": meta_base.get("versao", "n/d"),
                "atualizacao": meta_base.get("atualizacao", "n/d"),
                "classificacao": meta_base.get("classificacao", "n/d"),
            }
            text = f"[{meta['documento']} — Seção: {sec_title}]\n{' '.join(win)}"
            chunks.append(Chunk(id=cid, text=text, metadata=meta))
    return chunks


if __name__ == "__main__":
    import sys
    with open(sys.argv[1], encoding="utf-8") as f:
        raw = f.read()
    cs = chunk_document(raw, sys.argv[1].split("/")[-1])
    print(f"{len(cs)} chunks gerados:")
    for c in cs:
        print(f"  - {c.id} | seção: {c.metadata['secao']} | {len(c.text.split())} palavras")
