
# Central de Comunidade — Réplica adaptada do Discord

Objetivo: transformar `src/manus/pages/Community.tsx` (hoje um shell com 238 linhas e sem leitura/escrita real nas tabelas) em uma central 100% funcional, usando exclusivamente as tabelas `community_*` e `moderation_actions` que já existem no Supabase `omzwtfnqffseemrlylwu`. Sem criar tabelas novas, sem mocks, sem Stripe.

## 1. Modelo mental (Discord → nossa plataforma)

| Discord            | Nossa tabela            | Papel                                                                  |
|--------------------|-------------------------|------------------------------------------------------------------------|
| Server / Guild     | `community_spaces`      | Agrupa canais por tema (ex.: "Mentorias", "Networking", "Anúncios").   |
| Channel            | `community_channels`    | Canal dentro de um Space (`type`: text / announcement / etc.).         |
| Message            | `community_posts`       | Mensagem raiz num canal (com autor, conteúdo, anexos).                 |
| Thread reply       | `community_replies`     | Resposta dentro de um post (thread leve, sem nesting infinito).        |
| Reaction (emoji)   | `community_reactions`   | Reações por post/reply, agregadas no client.                           |
| Mod log            | `moderation_actions`    | Histórico de ações de moderação (delete, pin, mute, ban no espaço).    |

Permissões: leitura/escrita gated por `useAuth().isAdmin` + `plan_permissions` (já existente) para acesso a Spaces premium. Admin sempre tem acesso total.

## 2. Layout (estilo Discord, adaptado)

```text
┌─────────────┬───────────────────────┬────────────────────────────────┐
│ Spaces rail │  Channel list (Space) │  Channel feed                  │
│ (ícones)    │  + cabeçalho do Space │  posts ⇢ thread drawer à dir.  │
│  64 px      │  240 px               │  flex-1                        │
└─────────────┴───────────────────────┴────────────────────────────────┘
```

- **Spaces rail** (esquerda, 64 px): avatares circulares dos spaces que o usuário tem acesso. Indicador de não-lidos.
- **Channel list** (240 px): nome do space, lista de canais agrupados por categoria (`category` text livre ou `position`), botão "+ canal" para admin.
- **Feed do canal**: lista virtualizada de `community_posts` (ordem desc por `created_at`), composer no rodapé (textarea + anexos via bucket `public-assets`), header com nome do canal + descrição + botão de buscar.
- **Thread drawer**: ao clicar num post abre painel lateral com `community_replies` + composer de reply.
- **Reações**: barra de emojis abaixo do post; clique adiciona/remove em `community_reactions` (unique por user+target+emoji).

Mobile: rail e channel list viram drawers (sheet shadcn), feed full-width.

## 3. Funcionalidades obrigatórias

### Aluno / membro
- Listar Spaces que ele pode ver (`plan_permissions` + admin override).
- Listar canais de um Space, lembrar o último canal aberto por Space (localStorage).
- Ler feed do canal (paginação por cursor `created_at`).
- Criar post (`community_posts.insert` com `author_id = auth.uid()`).
- Editar/excluir os próprios posts e replies.
- Responder em thread (`community_replies.insert`).
- Reagir / desreagir (toggle em `community_reactions`).
- Indicador de "novo" baseado em `last_read_at` do usuário (armazenar em localStorage por canal — sem nova tabela; aceitar trade-off de não persistir entre devices).

### Admin (`isAdmin` via `has_role`)
- CRUD de Spaces, Channels (ordenar via `position`).
- Pin/unpin de posts (campo `is_pinned` se já existir; senão usar moderation action).
- Delete/soft-delete de qualquer post ou reply, registrado em `moderation_actions`.
- Mute/ban de usuário no Space (registrar em `moderation_actions`; checar no client antes de permitir post).

### Realtime
- Inscrever em `postgres_changes` para `community_posts` e `community_replies` filtrando por `channel_id` aberto (dentro de `useEffect`, com `supabase.removeChannel` no cleanup — conforme regra do projeto).
- Atualizar React Query cache via `setQueryData` para inserir/remover sem refetch.
- Habilitar Realtime nas tabelas via migration (`ALTER PUBLICATION supabase_realtime ADD TABLE ...`) se ainda não estiver.

## 4. Backend / Supabase

Nada de tabelas novas. Apenas:

1. **Verificar RLS + GRANTS** em todas as 6 tabelas (`community_*` + `moderation_actions`). Se faltar, aplicar via edge function temporária `community-bootstrap-policies` (mesmo padrão usado em `admin-bootstrap-policies` — criar, executar, deletar). Políticas-alvo:
   - SELECT: autenticado se `has_role(uid,'admin')` OR (space é público) OR (user tem plan permission para o space).
   - INSERT (posts/replies/reactions): autenticado, `author_id = auth.uid()`, sem mute ativo.
   - UPDATE/DELETE: autor OR admin.
   - `moderation_actions`: apenas admin.
2. **Realtime publication** para `community_posts`, `community_replies`, `community_reactions`.
3. **Storage**: reusar bucket `public-assets` para anexos (`community/{channelId}/{postId}/{file}`).
4. **Função `community_post_with_counts`** (opcional, SECURITY DEFINER) para somar reações + replies numa única query. Se complicado, agregar no client.

## 5. Estrutura de arquivos

```text
src/manus/pages/Community.tsx                 # shell com layout 3 colunas
src/manus/components/community/
  SpacesRail.tsx
  ChannelList.tsx
  ChannelHeader.tsx
  PostFeed.tsx
  PostItem.tsx
  PostComposer.tsx
  ThreadDrawer.tsx
  ReactionBar.tsx
  AdminSpaceDialog.tsx
  AdminChannelDialog.tsx
src/manus/hooks/community/
  useSpaces.ts
  useChannels.ts
  usePosts.ts          # infinite query + realtime subscription
  useReplies.ts
  useReactions.ts
  useModeration.ts
src/manus/pages/admin/AdminCommunity.tsx      # já existe? senão criar para CRUD raiz
```

Rotas:
- `/community` → redirect para último space/canal.
- `/community/:spaceSlug/:channelSlug` → feed.
- `/admin/community` → tabelas de Spaces/Channels (reusa `AdminTablePage`).

## 6. Estados vazios / erros
- Space sem canais → CTA "Peça ao admin para criar um canal" (admin vê botão criar).
- Canal sem posts → ilustração + sugestão de primeiro post.
- Sem permissão → mensagem "Esse espaço faz parte de um plano superior" + link `/plans`.
- Erro de RLS → toast com mensagem amigável + log no console.

## 7. QA obrigatório antes de declarar pronto
- Criar Space → aparece no rail em tempo real.
- Criar Channel → aparece na lista.
- Postar mensagem em 2 abas → segunda aba recebe via realtime.
- Reagir/desreagir → contador atualiza.
- Responder em thread → drawer atualiza, contador no post sobe.
- Admin deleta post de outro usuário → some na outra aba, `moderation_actions` registra linha.
- Usuário sem permissão tenta acessar Space premium → bloqueado pela RLS.
- Typecheck, build e lint limpos.
- Atualizar `docs/ADMIN_CENTER_FINAL_REPORT.md` com seção "Comunidade".

## 8. Entregas em fases

1. **Fase A — Fundação (1 PR)**: políticas RLS + grants + realtime publication via edge function bootstrap; tipos atualizados.
2. **Fase B — Leitura**: layout 3 colunas, SpacesRail, ChannelList, PostFeed (somente leitura) com realtime.
3. **Fase C — Escrita aluno**: composer, replies, reações, edição/exclusão própria.
4. **Fase D — Admin & moderação**: CRUD de Spaces/Channels, pin, delete moderado, mute/ban, log em `moderation_actions`.
5. **Fase E — Polish**: notificações de não-lidos, busca dentro do canal, anexos, atalhos de teclado estilo Discord (Esc fecha thread, Shift+Enter quebra linha).

## Fora de escopo (premortem — o que NÃO faremos agora)
- Voice/video channels (Discord-like) — exige WebRTC, fora do scope desta fase.
- DMs 1:1 — exigiria nova tabela; pedir confirmação antes.
- Stripe / cobrança de Spaces premium — bloqueado por regra do projeto.
- Push notifications nativas — só badge no menu.
- Bots / webhooks externos.

Confirma que sigo nessa direção? Posso começar pela **Fase A** (políticas + realtime) imediatamente após o OK.
