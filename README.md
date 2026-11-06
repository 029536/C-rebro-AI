# Cérebro IA

App de uso próprio da Saber Crescer. Leia [CLAUDE.md](./CLAUDE.md) e [PROMPT_INICIAL.md](./PROMPT_INICIAL.md) antes de qualquer alteração: são a fonte de verdade do produto, da stack e do plano de fases.

## Desenvolvimento

```bash
npm run dev        # servidor de desenvolvimento em http://localhost:3000
npm run lint        # ESLint
npm run typecheck   # verificação de tipos
npm run test        # testes (Vitest)
npm run build        # build de produção
```

Copie `.env.example` para `.env.local` e preencha as chaves antes de usar recursos de IA. Com `MOCK_AI=1`, o app roda sem chaves (respostas simuladas).
