<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Pelada IPA — guia do projeto

App mobile-first para registrar campeonatos de pelada (Next.js 16 App Router +
React 19 + Prisma 6/SQLite + Tailwind v4). UI e textos em **pt-BR**.

## Ambiente

- Node fica em `/opt/homebrew/bin` e **não** está no `PATH` de shells
  não-interativos. Prefixe `export PATH="/opt/homebrew/bin:$PATH"` nos comandos.
- O npm 11 **bloqueia install scripts** por padrão. Após instalar dependências,
  rode `npm approve-scripts --all` e depois `npm rebuild` se necessário (Prisma,
  esbuild, sharp precisam dos postinstall).
- Banco: `prisma/dev.db`. Recriar do zero: `npm run db:reset`.

## Modelo de dados (prisma/schema.prisma)

`Player` · `Championship` · `Team` (A/B/C/D) · `TeamPlayer` (elenco) ·
`Match` (stage: GROUP|SF1|SF2|THIRD|FINAL) · `GoalEvent`.

- **O placar é derivado dos `GoalEvent`**, não armazenado. `GoalEvent.teamId`
  aponta para o time **beneficiado** (no gol contra, o adversário do autor);
  `scorerId` guarda o autor. Pênaltis de desempate ficam em `Match.homePens/awayPens`.
- A agregação de estatísticas é **pura** em `src/lib/aggregate.ts` e está
  **validada** contra a planilha original em `prisma/validate.ts`
  (`npx tsx prisma/validate.ts`) — rode após mexer na agregação/seed.

## Convenções

- Leitura em `src/lib/queries.ts`; mutações em `src/lib/actions.ts` (server
  actions, sempre com `revalidatePath`). Componentes cliente chamam a action e
  depois `router.refresh()`.
- Regras de negócio isoladas e testáveis: `standings.ts`, `knockout.ts`,
  `rating.ts`, `aggregate.ts` (sem import de Prisma).
- Pesos da nota em `rating.ts`. Datas são guardadas em UTC (meia-noite) e
  formatadas em UTC (`src/lib/format.ts`) para não escorregar de dia.
