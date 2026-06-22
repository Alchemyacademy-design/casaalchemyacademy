# Fase 3 — Comunidade Integrada à Aprendizagem

Data: 2026-06-22
Status: implementada com base no schema atual. Nenhuma migration, tabela, coluna, enum, RLS, Stripe ou variante visual foi alterada.

## Tabelas usadas (somente existentes)
- `community_spaces`, `community_channels`, `community_posts`, `community_replies`, `community_reactions`, `moderation_actions`.

## Mudanças de código

### `src/manus/hooks/community/useCommunityData.ts`
- `usePosts(channelId, limit = 20)` agora aceita `limit` paginado. Query key inclui o `limit` para que cada página tenha cache próprio sem invalidar erradamente. Realtime continua invalidando todas as variações da chave base (`["community","posts",channelId,...]`) porque `invalidateQueries` faz match por prefixo.

### `src/manus/pages/Community.tsx`
- Lê `?channel=`, `?title=` e `?body=` via `useSearchParams` e passa para `CommunityCenter` como props (`initialChannelSlug`, `initialDraftTitle`, `initialDraftBody`).

### `src/manus/components/community/CommunityCenter.tsx`
- Aceita novas props `initialChannelSlug | initialDraftTitle | initialDraftBody`.
- **Deep link de canal**: se `initialChannelSlug` corresponder a um canal carregado, ele é selecionado automaticamente.
- **Prefill do composer**: se vierem `title`/`body` na URL, preenchem o composer; permanecem editáveis e podem ser publicados normalmente.
- **Busca**: campo de busca client-side filtrando `title` + `body` dos posts já carregados.
- **Filtros**: chips `Todos | Fixados | Meus` (Mine = posts do usuário atual).
- **Paginação**: `Carregar mais` incrementa o limite em +20; aparece somente quando o número de posts retornados é ≥ limite atual (heurística simples e suficiente para o plano gratuito).
- Reseta busca/filtro/limit ao trocar de canal.
- Mantém: realtime de posts/replies, criação/exclusão de posts e respostas, fixar/desafixar (admin), reações por emoji em posts e replies, log de moderação para ação de admin em conteúdo de terceiros, criação de spaces/channels só para admin.

### `src/manus/pages/ModuleDetail.tsx`
- Card "Bring this lesson to the community" abaixo do conteúdo da aula com 3 ações:
  - **Share your progress** → `/community?channel=project-sharing&title=...&body=...`
  - **Ask the community** → `/community?channel=ask-lorena&...`
  - **Discuss this lesson** → `/community?channel=general-discussion&...`
- Cada link já vem com o nome do curso, título da aula e link interno pré-formatados no corpo. Nenhuma persistência nova entre aula e post (plano: "não criar relação persistente nova entre aula e post").
- Idioma preservado (a página de aula está em inglês).

## Canais sugeridos (slugs esperados)
O plano lista: Announcements, General Discussion, Room by Room, Colour & Materials, Project Sharing, Ask Lorena, Monthly Challenge. Os 3 botões da aula usam os slugs `project-sharing`, `ask-lorena`, `general-discussion`. Se um desses canais ainda não existir, a navegação cai no comportamento atual (canal último selecionado / primeiro do space) e o draft permanece preenchido, sem quebra. O admin pode criar o canal correto pelo botão "Novo canal" dentro da própria comunidade.

## Performance / plano gratuito
- Páginas de 20 posts, com botão explícito de "Carregar mais" — sem polling.
- Busca client-side sobre o que já está na memória (zero consultas adicionais durante digitação).
- Realtime mantido apenas na tela ativa (posts e replies do canal/post abertos).
- `usePosts` agora envia `.limit(limit)` em vez do antigo `.limit(200)`.

## Critérios de aceite

| # | Critério | Status |
|---|---|---|
| 1 | Canais reais carregando do schema atual | ✅ via `useSpaces` + `useChannels` |
| 2 | Busca | ✅ campo + filtro client-side |
| 3 | Filtros (Todos/Fixados/Meus) | ✅ |
| 4 | Criar post | ✅ (já existia) |
| 5 | Comentários/respostas | ✅ (já existia) |
| 6 | Reações em post e em reply | ✅ (já existia) |
| 7 | Posts fixados (admin) | ✅ (já existia) |
| 8 | Moderação (log em `moderation_actions`) | ✅ (já existia) |
| 9 | Estado vazio por canal e por filtro | ✅ |
| 10 | Carregamento paginado | ✅ (`Carregar mais`, +20) |
| 11 | Botão "Share your progress" na aula | ✅ |
| 12 | Botão "Ask the community" na aula | ✅ |
| 13 | Botão "Discuss this lesson" na aula | ✅ |
| 14 | Sem migrations / sem schema novo | ✅ |
| 15 | Stripe intocado | ✅ |
| 16 | Identidade visual (Sandstone/Cacao/Chocolate/Terracotta/Avocado/Moss, Manrope, Instrument Serif) | ✅ |
| 17 | Idioma de cada tela preservado (comunidade pt-BR, aula en) | ✅ |

## Pendências / dependentes de fases futuras

- **Relação persistente aula ↔ post**: explicitamente proibida nesta fase. Quando autorizado, criar tabela `lesson_community_links` (registrado em `docs/FUTURE_SCHEMA_BACKLOG.md` como item futuro).
- **Realtime de reações** e **contagem agregada server-side**: hoje as reações são recarregadas por invalidação do `useToggleReaction`; aceitável no plano gratuito.
- **Anti-spam/rate-limit por usuário**: ainda depende de uma `community_rate_limits` (futuro).
- **Notificações in-app** ao receber resposta ou citação: depende de tabela de notificações (Fase 11).

## Validação executada

- `bunx vitest run` → 4 arquivos, 20/20 testes ok.
- Typecheck e build são executados automaticamente pelo harness Lovable — sem erros pendentes após estas edições.

## Próximo passo (após aprovação)

Iniciar Execução 4 = Fase 4 (Gamificação elegante derivada de `lesson_progress` + `quiz_attempts` + `certificates` + `community_posts` + `registrations`, sem novas tabelas).
