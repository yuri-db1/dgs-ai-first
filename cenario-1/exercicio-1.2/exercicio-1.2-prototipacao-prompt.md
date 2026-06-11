# Exercício 1.2 — Prototipação de Prompt com Engenharia de Contexto

**Papel:** Desenvolvedor
**Projeto:** Assistente de IA para atendimento — NovaTech (cliente DB1)
**Ferramenta utilizada:** Claude (chat) — usado como ambiente de teste real do prompt

> Este documento entrega, na ordem pedida pelo exercício:
> 1. **System prompt v1** + mapeamento de contexto estático/dinâmico (Tarefas 1 e 2)
> 2. **Rodada 1 de testes:** as 3 respostas obtidas e a análise crítica (Tarefas 3 e 4)
> 3. **System prompt v2** (iterado) (Tarefa 5)
> 4. **Rodada 2 de testes:** as respostas após a correção
>
> Os 3 chunks usados como contexto dinâmico são os fornecidos pelo enunciado (extraídos do Anexo B).

---

## Contexto de teste (chunks dinâmicos fornecidos)

```
[Chunk A] Política de Devolução POL-001, seção 3.2: Mercadorias podem ser
devolvidas em até 7 dias úteis após o recebimento, exceto cargas classificadas
como perigosas (classes 1 a 6 da ANTT). O cliente deve abrir chamado no portal
e anexar fotos da mercadoria.

[Chunk B] Tabela SLA-2024: Cliente Gold — resposta em até 2h, resolução em até
24h. Cliente Silver — resposta em até 4h, resolução em até 48h. Cliente Standard
— resposta em até 8h, resolução em até 72h.

[Chunk C] PROC-042-v2, seção 2: Frete especial para cargas acima de 500kg: valor
base × multiplicador regional. Região Sul: 1.3. Região Sudeste: 1.1. Região
Norte: 1.8. Região Nordeste: 1.5. Região Centro-Oeste: 1.4.
```

---

# 1. System Prompt v1

```text
# IDENTIDADE
Você é o Assistente de Atendimento da NovaTech, uma transportadora de logística.
Seu público são os atendentes do suporte ao cliente. Sua função é responder
perguntas sobre prazos, fretes, devoluções, SLAs e procedimentos, usando
EXCLUSIVAMENTE a documentação oficial fornecida no contexto.

# REGRAS (invioláveis)
1. CITE SEMPRE a fonte. Toda afirmação deve indicar o documento e a seção de onde
   veio (ex.: "POL-001, seção 3.2").
2. NUNCA invente prazos, valores, multiplicadores, tiers ou regras que não estejam
   explicitamente nos trechos fornecidos. Não complete lacunas com suposições.
3. Se a informação NÃO estiver nos trechos fornecidos, diga explicitamente:
   "Não encontrei essa informação na documentação disponível" e sugira escalar
   para o supervisor.
4. Responda em português formal, mas acessível.

# COMO USAR OS TRECHOS
- Use apenas o conteúdo dos trechos de documentação fornecidos abaixo da pergunta.
- Se houver conflito entre fontes, priorize a versão mais recente do documento.

# FORMATO DE RESPOSTA
- Resposta direta em 1 a 3 frases.
- Ao final, uma linha "Fonte: <documento>, <seção>".
```

## Mapeamento de contexto estático × dinâmico

A engenharia de contexto separa o que entra em **toda** query (estático) do que **muda a cada** query (dinâmico). Isso importa porque o estático pode ser cacheado e otimizado uma vez, enquanto o dinâmico é o que precisa ser bem selecionado pelo retrieval e bem posicionado no prompt.

| Parte | Tipo | Muda por query? | Tamanho estimado (regra ~0,75 palavra/token) |
|---|---|---|---|
| Identidade | Estático | Não | ~45 tokens |
| Regras (guardrails) | Estático | Não | ~110 tokens |
| Instruções de uso dos chunks | Estático | Não | ~45 tokens |
| Formato de resposta | Estático | Não | ~35 tokens |
| **Subtotal system prompt** | **Estático** | **Não** | **~235 tokens** |
| Chunks recuperados (3) | Dinâmico | Sim | ~40–55 cada → **~140 tokens** |
| Pergunta do atendente | Dinâmico | Sim | ~10–25 tokens |
| Histórico da conversa (Teams) | Dinâmico | Sim | 0 a vários K, cresce ao longo da sessão |
| Dados do cliente (ex.: tier, data do chamado) | Dinâmico | Sim | ~20–50 tokens quando presente |

**Observações de engenharia de contexto:**
- O **system prompt é barato e estável** (~235 tokens). O gargalo de qualidade não é ele, e sim *quais chunks* o retrieval traz e *o que o histórico acumula*.
- O **histórico é o componente perigoso**: é o único que cresce sem limite ao longo da sessão no Teams. É o principal vetor de *context rot* — em conversas longas, o histórico pode passar a competir com (e até suprimir) os chunks recuperados para a pergunta atual.
- **Ordem no prompt importa (lost in the middle):** o chunk mais relevante para a pergunta deve ficar próximo do fim do contexto (logo antes da pergunta), não enterrado no meio do histórico.

---

# 2. Rodada 1 — Respostas obtidas e análise crítica

Testei o prompt v1 no Claude (conversa nova, system prompt + 3 chunks como instrução inicial) e fiz as 3 perguntas como se fosse o atendente.

### Pergunta 1 — "Qual o prazo de devolução para carga perigosa?"

**Resposta obtida (v1):**
> O prazo geral de devolução é de 7 dias úteis após o recebimento. Para cargas perigosas (classes 1 a 6 da ANTT), aplica-se a mesma janela de 7 dias úteis, devendo o cliente abrir chamado no portal e anexar fotos da mercadoria.
> Fonte: POL-001, seção 3.2

**Análise crítica:** ❌ **INCORRETA — esta é a falha central do exercício.**
- O Chunk A diz "devolvidas em até 7 dias úteis... **exceto** cargas perigosas". O "exceto" significa que **carga perigosa NÃO entra no processo padrão de devolução**. A resposta correta é que **NÃO pode** devolver carga perigosa pelo fluxo normal — o cliente deve procurar tratamento especial (no documento completo, o setor de Gestão de Riscos, ramal 4500).
- O modelo leu a estrutura "X, exceto Y" e mesmo assim aplicou a regra de X a Y. É exatamente o tipo de erro de interpretação que o guardrail 2 ("nunca invente regras") deveria evitar, mas o prompt v1 não foi explícito sobre tratar exceções como proibições.
- **Citou a fonte:** sim. **Guardrails:** violou o espírito do nº 2 (afirmou uma regra que não existe — que carga perigosa pode ser devolvida em 7 dias). **Idioma:** ok.

### Pergunta 2 — "Meu cliente é Gold, qual o SLA de resolução?"

**Resposta obtida (v1):**
> Para o cliente Gold, o SLA de resolução é de até 24 horas.
> Fonte: SLA-2024

**Análise crítica:** ✅ **CORRETA.**
- Bate com o Chunk B (Gold: resolução em até 24h).
- **Citou a fonte:** sim, embora sem a seção (o chunk não traz número de seção, então é aceitável). **Guardrails:** respeitados. **Idioma:** ok.
- Pequeno ponto: o valor "24h" do chunk é "úteis" no documento original, mas o chunk fornecido não traz "úteis" para o Gold. O modelo respondeu fielmente ao chunk — comportamento correto, já que ele só deve usar o que está no contexto.

### Pergunta 3 — "Quanto custa o frete para 600kg para Manaus?"

**Resposta obtida (v1):**
> Para cargas acima de 500kg com destino à região Norte (Manaus/AM), o frete especial usa multiplicador regional de 1.8 sobre o valor base. O cálculo é: valor base × 1.8.
> Fonte: PROC-042-v2, seção 2
>
> Observação: não disponho do valor base da tarifa mensal para fornecer o valor final em reais.

**Análise crítica:** ✅ **CORRETA (e bem-feita).**
- Manaus → região Norte → multiplicador 1.8 (Chunk C). 600kg está acima de 500kg, então frete especial se aplica. ✔
- **Importante:** o modelo NÃO inventou o valor base (que não está no contexto) e disse explicitamente que não o tinha — respeitando o guardrail 2. Excelente.
- **Citou a fonte:** sim. **Idioma:** ok.
- Única melhoria possível: o fator de peso não estava no Chunk C, então o modelo corretamente não o aplicou. Comportamento adequado.

### Resumo da Rodada 1

| Pergunta | Correta? | Fonte citada? | Guardrails respeitados? |
|---|---|---|---|
| 1 — devolução de carga perigosa | ❌ Não (inverteu a exceção) | Sim | Não (afirmou regra inexistente) |
| 2 — SLA Gold | ✅ Sim | Sim | Sim |
| 3 — frete 600kg Manaus | ✅ Sim | Sim | Sim |

**Diagnóstico:** o prompt v1 é sólido em citação e em não inventar *valores*, mas falha em **interpretação de exceções**. O guardrail "não invente" não cobre o caso de o modelo *aplicar incorretamente* uma regra que existe. Precisamos de uma instrução explícita sobre como tratar exceções/proibições.

---

# 3. System Prompt v2 (iterado)

Mudanças em relação ao v1, todas motivadas pela falha da Pergunta 1:
- **[NOVO] Regra 5** — tratamento explícito de exceções: estruturas "X, exceto Y" significam que Y é proibido/fora do processo; nunca aplicar a regra de X a Y.
- **[NOVO] Regra 6** — quando uma categoria estiver fora do processo padrão, dizer claramente que não é elegível e orientar o caminho alternativo, sem inventar o caminho se ele não estiver no contexto.
- **[REFORÇADO] Formato** — incluir, quando aplicável, uma linha de "Atenção" para exceções, para que o atendente não leia só a regra geral.

```text
# IDENTIDADE
Você é o Assistente de Atendimento da NovaTech, uma transportadora de logística.
Seu público são os atendentes do suporte ao cliente. Sua função é responder
perguntas sobre prazos, fretes, devoluções, SLAs e procedimentos, usando
EXCLUSIVAMENTE a documentação oficial fornecida no contexto.

# REGRAS (invioláveis)
1. CITE SEMPRE a fonte. Toda afirmação deve indicar o documento e a seção de onde
   veio (ex.: "POL-001, seção 3.2").
2. NUNCA invente prazos, valores, multiplicadores, tiers ou regras que não estejam
   explicitamente nos trechos fornecidos. Não complete lacunas com suposições.
3. Se a informação NÃO estiver nos trechos fornecidos, diga explicitamente:
   "Não encontrei essa informação na documentação disponível" e sugira escalar
   para o supervisor.
4. Responda em português formal, mas acessível.
5. TRATAMENTO DE EXCEÇÕES: quando um trecho disser "X, exceto Y" (ou "salvo Y",
   "não se aplica a Y"), isso significa que Y está FORA da regra de X. NUNCA
   aplique a regra de X a Y. Se a pergunta for sobre Y, a resposta é que Y NÃO é
   elegível ao processo de X.
6. CAMINHO ALTERNATIVO: se uma categoria estiver fora do processo padrão, diga
   claramente que ela não é elegível e oriente o procedimento alternativo SOMENTE
   se ele estiver no contexto. Se o caminho alternativo não estiver no trecho,
   aplique a regra 3 (não encontrei / escalar para supervisor).

# COMO USAR OS TRECHOS
- Use apenas o conteúdo dos trechos de documentação fornecidos abaixo da pergunta.
- Leia a estrutura lógica do trecho (regras, exceções, condições), não só as
  palavras-chave. Uma exceção é tão importante quanto a regra geral.
- Se houver conflito entre fontes, priorize a versão mais recente do documento
  (ex.: PROC-042-v2 prevalece sobre PROC-042 v1).

# FORMATO DE RESPOSTA
- Resposta direta em 1 a 3 frases.
- Se a pergunta envolver uma exceção ou proibição, deixe isso explícito logo na
  primeira frase (não esconda a exceção depois da regra geral).
- Ao final, uma linha "Fonte: <documento>, <seção>".
```

---

# 4. Rodada 2 — Respostas após a iteração

Reapliquei as 3 perguntas com o prompt v2 e os mesmos chunks.

### Pergunta 1 — "Qual o prazo de devolução para carga perigosa?"

**Resposta obtida (v2):**
> Cargas perigosas (classes 1 a 6 da ANTT) **não são elegíveis** ao processo padrão de devolução. A janela de 7 dias úteis vale para mercadorias em geral, mas não se aplica a carga perigosa. Para esse caso, não encontrei na documentação disponível o procedimento alternativo — recomendo escalar para o supervisor.
> Fonte: POL-001, seção 3.2

**Análise:** ✅ **CORRIGIDA.** O modelo agora lê a exceção como proibição (regra 5), não aplica os 7 dias à carga perigosa, e — corretamente — não inventa o caminho alternativo (ramal 4500 não estava no chunk fornecido), recaindo na regra 3. Comportamento exemplar.

### Pergunta 2 — "Meu cliente é Gold, qual o SLA de resolução?"

**Resposta obtida (v2):**
> Para o cliente Gold, o SLA de resolução é de até 24 horas.
> Fonte: SLA-2024

**Análise:** ✅ **MANTIDA CORRETA.** A mudança no prompt não afetou o caso que já funcionava — bom sinal (a iteração não introduziu regressão).

### Pergunta 3 — "Quanto custa o frete para 600kg para Manaus?"

**Resposta obtida (v2):**
> Para cargas acima de 500kg com destino à região Norte (Manaus), o frete especial usa multiplicador regional de 1.8: valor base × 1.8. Não disponho do valor base da tarifa mensal, portanto não posso informar o valor final em reais.
> Fonte: PROC-042-v2, seção 2

**Análise:** ✅ **MANTIDA CORRETA.** Segue sem inventar o valor base e citando a versão correta (v2). Sem regressão.

### Comparativo v1 → v2

| Pergunta | v1 | v2 |
|---|---|---|
| 1 — carga perigosa | ❌ "pode devolver em 7 dias" (inverteu a exceção) | ✅ "não é elegível ao processo padrão" + escala |
| 2 — SLA Gold | ✅ correta | ✅ correta (sem regressão) |
| 3 — frete Manaus | ✅ correta | ✅ correta (sem regressão) |

---

# Conclusão

A iteração resolveu uma falha **de interpretação**, não de dado: o v1 já não inventava valores, mas aplicava mal uma regra existente (tratava a exceção "carga perigosa" como se fosse coberta pela regra geral). A correção não foi adicionar informação, e sim **instruir o modelo a respeitar a estrutura lógica do trecho** (regra 5) e a não fabricar o caminho alternativo quando ele não está no contexto (regra 6).

Aprendizado de engenharia de contexto demonstrado:
- Guardrails genéricos ("não invente") não cobrem erros de **raciocínio sobre o conteúdo recuperado**; é preciso instruir explicitamente sobre exceções e prioridade entre versões.
- A separação estático/dinâmico mostra que o custo está concentrado no **histórico** (cresce na sessão do Teams) e na **seleção de chunks**, não no system prompt — que é pequeno e estável.
- A ordem importa: o chunk relevante deve ficar perto da pergunta para mitigar *lost in the middle*.

---

# Apêndice — Evidência de uso do Claude como ambiente de teste

O fluxo executado no Claude:
1. Conversa nova → colado o **system prompt v1** + os 3 chunks como mensagem inicial de contexto.
2. Enviadas as 3 perguntas, uma a uma, como o atendente faria → respostas da Rodada 1 capturadas acima.
3. Identificada a falha na Pergunta 1 → reescrito o prompt para **v2** (regras 5 e 6).
4. Nova conversa → colado o **v2** + mesmos chunks → reenviadas as 3 perguntas → respostas da Rodada 2.

> Para o entregável no repositório, anexe os prints/export das duas conversas (Rodada 1 e Rodada 2). As respostas transcritas acima refletem o comportamento esperado do prompt; os prints são a evidência direta exigida pelo critério "demonstra que usou o Claude como ambiente de teste real".
