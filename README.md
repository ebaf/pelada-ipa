# ⚽ Pelada IPA

Aplicativo web (mobile-first) para registrar campeonatos de pelada de futebol.

Cada **pelada** acontece em um único dia, com **4 times (A, B, C, D)**, uma
**fase de grupos** (pontos corridos, todos contra todos) e **eliminatórias**
(semifinais, disputa de 3º lugar e final). As estatísticas (gols, assistências,
gols contra e gols de pênalti) são creditadas aos jogadores e alimentam um
**ranking geral** com a nota de cada um.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **Prisma 6** + **SQLite** (banco em arquivo, `prisma/dev.db`)
- Mutações via **Server Actions**

## Como rodar

> Requer Node 18+. Neste Mac o Node está em `/opt/homebrew/bin` (via Homebrew) e
> pode não estar no `PATH` de shells não-interativos — rode
> `export PATH="/opt/homebrew/bin:$PATH"` se `node` não for encontrado.

```bash
npm install           # se necessário: npm approve-scripts --all
npm run db:push       # cria o banco SQLite a partir do schema
npm run db:seed       # importa os dados da planilha (prisma/seed-data.json)
npm run dev           # http://localhost:3000
```

Scripts úteis:

| Script            | O que faz                                              |
| ----------------- | ------------------------------------------------------ |
| `npm run dev`     | Servidor de desenvolvimento                            |
| `npm run build`   | Build de produção                                      |
| `npm run db:seed` | Importa jogadores + 7 peladas históricas da planilha   |
| `npm run db:reset`| Recria o banco do zero e re-importa                    |
| `npm run db:studio`| Abre o Prisma Studio para inspecionar o banco         |

## Telas

- **Início** — ranking geral dos jogadores (por nota), com a **variação de
  posição** causada pela última pelada (▲/▼), e lista de peladas. O ícone ⓘ
  ao lado do ranking explica o cálculo da nota.
- **Jogadores** — cadastro, busca e estatísticas de carreira de cada jogador.
- **Nova pelada** — cria a pelada (data + nome opcional).
- **Gerenciar pelada** — monta os 4 times, registra gols partida a partida,
  gera as eliminatórias a partir da classificação e define a final.
- **Painel da pelada** — visão consolidada: pódio, classificação, jogos,
  chaveamento e destaques do dia.
- **Compartilhar jogo** — cada partida encerrada tem um botão 📤 que gera o
  resultado formatado (gols, assistências, gol contra 🤦, pênaltis) e abre
  direto no WhatsApp (via `wa.me`) ou copia o texto. Formatador em
  [`src/lib/share.ts`](src/lib/share.ts).

## Regras

**Fase de grupos** — vitória 3 pts, empate 1, derrota 0. Desempate, nesta ordem:
pontos → confronto direto → saldo de gols → ordem alfabética do time.

**Eliminatórias** — SF1: 1º × 4º, SF2: 2º × 3º. Final entre os vencedores e
disputa de 3º entre os perdedores. Empate no tempo normal é decidido nos
**pênaltis**.

**Nota do jogador** (derivada da planilha original):

```
Nota = 5 + V·0,1 + E·0,025 − D·0,1 + Gols·0,15 + Assist·0,05 − GolContra·0,3
```

Gols de pênalti são contabilizados **separadamente** dos gols de linha
(peso 0,10 na nota). Pesos ficam em [`src/lib/rating.ts`](src/lib/rating.ts).

## Estrutura

```
prisma/
  schema.prisma     # modelo de dados
  seed.ts           # importador da planilha
  seed-data.json    # dados extraídos da planilha "Pelada IPA.xlsx"
  validate.ts       # confere as estatísticas contra os números da planilha
src/
  lib/
    aggregate.ts    # agregação pura de estatísticas (validada)
    standings.ts    # classificação + desempates
    knockout.ts     # vencedor/perdedor das eliminatórias
    rating.ts       # fórmula da nota
    queries.ts      # leitura (read models das telas)
    actions.ts      # mutações (server actions)
  components/        # UI (cliente + apresentação)
  app/               # rotas (App Router)
```

## Sobre os dados importados

Os 34 jogadores e as 7 peladas (04/05 a 15/06 de 2026) vêm da planilha
`Pelada IPA.xlsx`. Os placares e as estatísticas de carreira batem exatamente
com a planilha (conferido em `prisma/validate.ts`).

Algumas peladas antigas tiveram finais empatadas **sem o resultado dos pênaltis
registrado** na planilha — elas aparecem como **"Pênaltis pendentes"** na lista.
Basta abrir _Gerenciar → Eliminatórias_ e informar os pênaltis para definir o
campeão.
