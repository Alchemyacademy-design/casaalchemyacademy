# Fase 3 — Comunidade Integrada à Aprendizagem (revisão final)

Data: 2026-06-22 (correção pós-auditoria)
Status: implementação corrigida em cima dos slugs/canais reais do Supabase. Nenhuma migration, tabela, coluna, enum, função SQL, policy, RLS ou Stripe foi alterado nesta fase.

## Implementado

### Slugs reais (PROBLEMA 1)
`src/manus/pages/ModuleDetail.tsx` agora aponta para os canais que existem hoje no Supabase:

| Botão | Slug usado (antes) | Slug usado (agora — real) |
|---|---|---|
| Share your progress | `project-sharing` ❌ | `projects` ✅ |
| Ask the community | `ask-lorena` ❌ | `questions` ✅ |
| Discuss this lesson | `general-discussion` ❌ | `general` ✅ |

Os slugs disponíveis (`general`, `questions`, `projects`, `inspiration`, `resources`) não foram alterados — nenhum canal novo é criado pelo front.

### Deep-link real (PROBLEMA 2)
- Novo hook `useChannelBySlug(slug)` em `useCommunityData.ts`: uma única consulta `community_channels.select("id,slug,space_id").eq("slug", slug).maybeSingle()`. Respeita RLS, sem service role.
- Em `CommunityCenter.tsx`:
  1. resolve o slug via `useChannelBySlug`;
  2. obtém `space_id` do canal;
  3. troca para esse space (sem inspecionar cada space, sem fan-out de queries);
  4. aguarda `useChannels(spaceId)` carregar o canal;
  5. seleciona o `channel_id` correto;
  6. só então marca `deepLinkApplied`.
- Se o slug não existir / não estiver acessível: `toast.message(...)` não bloqueante, o draft (`title` + `body`) é preservado e o usuário fica no primeiro canal acessível.

### Paginação real de 20 (PROBLEMA 3)
- Novo `usePostsInfinite(channelId)` usando `useInfiniteQuery` + `.range(from, to)`.
- `PAGE_SIZE = 20`. Primeira página `range(0, 19)`, depois `range(20, 39)`, etc. — nada é refeito.
- `getNextPageParam` só devolve a próxima página quando a última retornou exatamente `PAGE_SIZE`. O botão "Carregar mais" some na última página.
- `dedupePostPages` concatena páginas sem duplicar `id`.
- Botão "Carregar mais" tem estado próprio de `isFetchingNextPage` e fica desabilitado durante o fetch (evita duplo clique).
- Realtime invalida o prefixo `["community","posts",channelId]` → `useInfiniteQuery` refetcha todas as páginas em ordem.
- Resetar: troca de canal → nova `queryKey` (channelId muda) → `useInfiniteQuery` recomeça do zero. `search`/`filter` voltam ao default por `useEffect`.

### Curso × módulo (PROBLEMA 4)
- `ModuleDetail.tsx` consulta `courses.select("id,title").eq("id", module.course_id)` (relação já existente, sem migration).
- O corpo pré-preenchido agora vem do novo helper `buildLessonShareBody`, com linhas distintas:
  ```
  Course: <título real do curso>
  Module: <título do módulo>
  Lesson: <título da aula>
  Lesson link: /modules/<id>#lesson-<id>
  ```

### Link com hash (PROBLEMA 5)
- `useLocation()` lê `location.hash`.
- `parseLessonHash(hash, lessons)` valida o formato `#lesson-<id>` e exige que o `id` exista na lista de lessons **do módulo atual** — IDs de outros módulos são rejeitados.
- Se válido, `setActiveLessonId` ativa a aula correta. Caso contrário, fallback para a primeira aula.

## Testado (PROBLEMA 6)

Comandos executados nesta correção:

| Comando | Exit | Resultado |
|---|---|---|
| `bunx vitest run` | 0 | 5 arquivos, **39/39 testes** (11 learning + 19 community-deeplink + 5 useAuth.access + 3 admin-api + 1 example) |
| `bunx tsc --noEmit` | 0 | sem erros |
| `bun run lint` (escopo dos arquivos alterados) | 0 erros novos | apenas 1 warning pré-existente em `CommunityCenter.tsx` (`react-refresh/only-export-components` por causa do `export { slugify }`, anterior a esta fase) |
| Build | executado pelo harness Lovable após cada save — sem erros TS |

Lint global continua com 25 erros pré-existentes em arquivos não tocados (`AdminLessonsBulk.tsx`, `Suppliers.tsx`, edge functions etc.). Nenhum deles foi introduzido por esta fase e a auditoria explicitamente proíbe alterar arquivos fora do escopo da Fase 3.

### Cobertura de testes adicionada — `src/manus/services/community-deeplink.test.ts`

| # critério | Coberto por |
|---|---|
| 1. leitura de channel/title/body da URL | `readCommunityUrlParams` × 2 |
| 2. seleção do canal real `projects` | `resolveDeepLinkChannel("projects", …)` |
| 3. seleção do canal real `questions` | `resolveDeepLinkChannel("questions", …)` |
| 4. seleção do canal real `general` | `resolveDeepLinkChannel("general", …)` |
| 5. deep-link para canal em outro space | `resolveDeepLinkChannel("resources", { space_id: 7 })` |
| 6. fallback quando slug não existe | `resolveDeepLinkChannel("project-sharing", null)` |
| 7. prefill preservado no fallback | `readCommunityUrlParams("?channel=nope&title=Kept&body=...")` |
| 8. busca em title e body | `filterPosts` "alpha" / "hello" |
| 9. filtro Meus | `filterPosts(posts, "", "mine", "u1")` |
| 10. filtro Fixados | `filterPosts(posts, "", "pinned", "u1")` |
| 11. paginação sem duplicação | `dedupePostPages([page1, page2])` (com id 20 sobreposto) |
| 12. "Carregar mais" sumindo na última página | `canLoadMorePosts(20|19|0|undefined)` |
| 13. hash selecionando a aula correta | `parseLessonHash("#lesson-6", lessons[5,6,7])` |
| 14. aula de outro módulo rejeitada | `parseLessonHash("#lesson-999", …)` |

## Limitado pelo schema

- Os slugs `inspiration` e `resources` existem no DB mas não têm CTA dedicado na aula — escopo desta fase é só os 3 acima.
- Sem tabela `lesson_community_links`: não há relação persistente aula↔post (proibido pelo plano da fase). Continua no `docs/FUTURE_SCHEMA_BACKLOG.md`.

## Pendente

- Realtime de reações (hoje invalidação manual; aceitável no plano gratuito).
- Rate-limit por usuário e notificações in-app (depende de tabelas futuras — Fases 11/12).
- Botões dedicados para canais `inspiration` e `resources` se a equipe quiser.

## Arquivos alterados nesta correção

- `src/manus/services/community-deeplink.ts` (novo) — helpers puros.
- `src/manus/services/community-deeplink.test.ts` (novo) — 19 testes.
- `src/manus/hooks/community/useCommunityData.ts` — adiciona `usePostsInfinite` e `useChannelBySlug`; mantém `usePosts` (backward-compat).
- `src/manus/components/community/CommunityCenter.tsx` — deep-link em 2 passos, paginação infinita real, helpers puros para search/filter, toast não bloqueante.
- `src/manus/pages/ModuleDetail.tsx` — slugs reais, busca `courses.title` via `module.course_id`, leitura de `#lesson-<id>` validada pelo módulo, body separado em Course/Module/Lesson/Lesson link.

A Fase 3 só passa a estar verdadeiramente concluída agora — antes os três botões apontavam para slugs inexistentes. **A Fase 4 não foi iniciada.**
