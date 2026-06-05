"""
evaluate.py — Testes de retrieval contra o gabarito do Anexo B.

Para cada pergunta do mapa de cobertura:
- roda a busca,
- mostra os chunks recuperados (documento + seção + score),
- compara com os chunks que o gabarito do Anexo B diz que DEVEM ser recuperados,
- marca HIT/MISS por documento+seção esperada.

A comparação é feita por (documento, seção) porque os IDs dos nossos chunks são
gerados pelo nosso chunker, enquanto o gabarito do Anexo B usa rótulos próprios
(POL-001-A, PROC-042v2-B...). O mapeamento rótulo->seção está em EXPECTED abaixo.
"""

from pipeline import ingest, search, build_prompt

# Gabarito do Anexo B traduzido para (documento_contém, seção_contém).
# Cada item de "deve" é um par de substrings que identificam o chunk esperado.
TESTES = [
    {
        "pergunta": "Qual o prazo de devolução?",
        "deve": [("POL-001", "3.1"), ("POL-001", "3.2")],
        "nota_gabarito": "POL-001-A (prazo) + POL-001-B (exceções)",
    },
    {
        "pergunta": "Posso devolver carga perigosa?",
        "deve": [("POL-001", "3.2")],
        "nota_gabarito": "POL-001-B (exceções); resposta correta = NÃO pode",
    },
    {
        "pergunta": "Qual o SLA do cliente Gold?",
        "deve": [("SLA-2024", "2")],
        "nota_gabarito": "SLA-2024-B (tabela de SLAs)",
    },
    {
        "pergunta": "Qual o SLA do cliente Platinum?",
        "deve": [("SLA-2024", "1")],
        "nota_gabarito": "SLA-2024-A ('não existem outros tiers'); tier inexistente",
    },
    {
        "pergunta": "Frete para 600kg para Manaus?",
        "deve": [("PROC-042-v2", "2.1"), ("PROC-042-v2", "2.")],
        "nota_gabarito": "PROC-042v2-B + PROC-042v2-A; risco: trazer v1 (contradição)",
    },
    {
        "pergunta": "Qual o multiplicador de frete para o Sudeste?",
        "deve": [("PROC-042-v2", "2.1")],
        "nota_gabarito": "PROC-042v2-B; armadilha: v1 (1.0) vs v2 (1.1)",
    },
    {
        "pergunta": "O que acontece com carga danificada em trânsito?",
        "deve": [("FAQ", "38")],
        "nota_gabarito": "FAQ-38; nenhum documento formal cobre -> fonte fraca",
    },
]


def match(hit, doc_sub, sec_sub):
    m = hit["metadata"]
    return doc_sub.lower() in m.get("documento", "").lower() and \
           sec_sub.lower() in m.get("secao", "").lower()


def run():
    print("== INGESTÃO ==")
    col, embfn = ingest(verbose=True)
    print(f"\nBackend de embedding em uso: {embfn.backend}")
    print("=" * 78)

    for i, t in enumerate(TESTES, 1):
        print(f"\n### TESTE {i}: {t['pergunta']}")
        print(f"Gabarito (Anexo B): {t['nota_gabarito']}")
        hits = search(t["pergunta"], col, n_results=4)
        print("Chunks recuperados (top-4):")
        for rank, h in enumerate(hits, 1):
            print(f"  {rank}. sim={h['similarity']:.3f} | {h['metadata']['documento'][:45]:<45} | {h['metadata']['secao']}")

        # avalia recall do gabarito
        print("Avaliação vs gabarito:")
        for doc_sub, sec_sub in t["deve"]:
            found_rank = None
            for rank, h in enumerate(hits, 1):
                if match(h, doc_sub, sec_sub):
                    found_rank = rank
                    break
            status = f"HIT (posição {found_rank})" if found_rank else "MISS"
            print(f"    esperado [{doc_sub} / seção {sec_sub}] -> {status}")
        print("-" * 78)


if __name__ == "__main__":
    run()
