# Skill: typescript-conventions (Foundation)

> **Frase-ativação:** "escrever, gerar ou editar qualquer arquivo `.ts` do backend NovaTech".
> **Nível:** Foundation — esta é a **base que todas as outras skills herdam**. `azure-functions-endpoint`,
> `testing-patterns`, `create-rag-endpoint` etc. assumem estas regras e não as repetem.
> **Cria:** Tech Lead · **Consome:** Devs + Copilot/Claude Code · **Frequência:** muito alta.

---

## Contexto

O backend é **TypeScript ESM** rodando em Azure Functions v4. `tsconfig.json`: `strict: true`,
`module: ESNext`, `moduleResolution: Bundler`, `target: ES2022`. `package.json`: `"type": "module"`.
Estas três configs ditam quase todas as regras abaixo — gerar código que as ignore quebra o build
ou o runtime ESM.

Os exemplos **DO** desta skill são trechos reais do código já em produção no repo
(`src/shared/*`, `src/functions/query/*`), que passa `tsc --noEmit` (0 erros) e `vitest` (11/11).

## Regras prescritivas

### DEVE
- **Usar `strict` sempre.** Nada de desligar checagens por arquivo (`// @ts-nocheck`) ou casts para silenciar o compilador.
- **Imports relativos SEM extensão.** `moduleResolution: Bundler` resolve `"../../shared/logger"` — não escreva `.ts` nem `.js`.
- **Named exports** para módulos da aplicação. `export function`, `export const`, `export class`. Default export só para libs que exigem (não temos nenhuma).
- **`import type` inline** para o que é só tipo: `import { ValidationError, type FieldIssue } from "../../shared/errors"`. Tipos são apagados no runtime.
- **Tipos de domínio centralizados** em `src/shared/types.ts` (`Tier`, `SourceDocument`, `QueryResponse`, ...). Importe de lá; não redefina inline.
- **Entrada não confiável tipada como `unknown`** e estreitada por validação (Zod). Nunca `any`.
- **Comentários e identificadores em inglês**; strings voltadas ao usuário em português formal.
- **Logar via `logger`** (pino) de `src/shared/logger.ts`. **Erros via taxonomia** `AppError`/`ValidationError` de `src/shared/errors.ts`.

### NÃO DEVE
- `console.log`/`console.error` em qualquer lugar.
- `any` (nem `as any`) para contornar o `strict`.
- `require()` ou `module.exports` (projeto é ESM puro).
- `export default` em módulos da aplicação.
- Engolir erro (`catch (e) {}`) ou converter falha em sucesso (retornar 200 no catch).
- Logar input cru do usuário (a pergunta do atendente) — só metadados.

---

## Exemplos DO / DON'T (código real)

### Imports relativos
✅ **DO** — sem extensão, named import, `import type` para tipos:
```ts
import { logger } from "../../shared/logger";
import { AppError, ValidationError } from "../../shared/errors";
import { parseQueryRequest } from "./validator";
import type { QueryResponse } from "../../shared/types";
```
❌ **DON'T** — extensão, default import, tipo importado como runtime:
```ts
import logger from "../../shared/logger.ts";   // extensão + default (errado)
import { QueryResponse } from "../../shared/types"; // tipo sem `type` (import desnecessário no bundle)
```

### Exports
✅ **DO** — named exports:
```ts
export const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });
export function parseQueryRequest(raw: unknown): QueryRequest { /* ... */ }
export class ValidationError extends AppError { /* ... */ }
```
❌ **DON'T** — default export em módulo de app:
```ts
export default function handler(req) { /* ... */ }  // quebra a consistência de import nomeado
```

### Segurança de tipo na borda
✅ **DO** — `unknown` + validação (Zod `safeParse`), issues achatadas sem vazar stack:
```ts
export function parseQueryRequest(raw: unknown): QueryRequest {
  const result = QueryRequestSchema.safeParse(raw);
  if (!result.success) {
    const issues: FieldIssue[] = result.error.issues.map((issue) => ({
      field: issue.path.join(".") || "(root)",
      message: issue.message,
    }));
    throw new ValidationError("Invalid query request", issues);
  }
  return result.data;
}
```
❌ **DON'T** — `any` e acesso direto sem validar:
```ts
export function parseQueryRequest(raw: any): any {
  return { query: raw.query };  // sem validação; `any` desliga o strict
}
```

### Erros
✅ **DO** — erro tipado da taxonomia, com status + code estáveis:
```ts
throw new ValidationError("Invalid query request", issues);
```
❌ **DON'T** — `Error` cru (handler não consegue mapear para HTTP sem checar string):
```ts
throw new Error("query inválida");
```

### Logging
✅ **DO** — pino estruturado, só metadados:
```ts
logger.info(
  { invocationId: context.invocationId, tier: input.tier, queryLength: input.query.length },
  "query_received",
);
```
❌ **DON'T** — `console.log` e/ou pergunta crua (PII, ruído, sem estrutura):
```ts
console.log("recebi a pergunta:", input.query);
```

---

## Anti-padrões (o que um agente gera de errado sem esta skill)

1. **Extensão em import relativo** — o LLM adiciona `.js`/`.ts` (hábito de NodeNext). Aqui é `Bundler`: sem extensão.
2. **CommonJS num projeto ESM** — `const x = require(...)` / `module.exports`. Falha em runtime (`"type":"module"`).
3. **`export default`** em handler/serviço — gera imports inconsistentes e atrapalha refactor/rename.
4. **`as any` para "fazer compilar"** — mascara o erro real que o `strict` apontou.
5. **`console.log` de debug esquecido** — viola o padrão de observabilidade; use `logger`.
6. **`catch` que engole ou mascara** — `catch (e) {}`, ou retornar 200 mesmo com falha. Erros devem virar `AppError` e status HTTP correto.
7. **Logar a pergunta do usuário** — risco de PII e volume de log; logue `queryLength`/`tier`, nunca o texto.
8. **Redefinir tipos de domínio inline** — recriar `Tier`/`QueryResponse` em vez de importar de `shared/types.ts` gera divergência.

## Dependências

Nenhuma (é a raiz da hierarquia). Toda skill Domain/Artifact **referencia esta** como pré-leitura obrigatória.
