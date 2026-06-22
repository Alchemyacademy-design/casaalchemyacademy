# Phase 3 — Integrated Community

Status legend:
- IMPLEMENTADO E UNITARIAMENTE TESTADO — helper coverage only
- IMPLEMENTADO E VALIDADO EM COMPONENTE — React Testing Library renders the real flow
- IMPLEMENTADO, NÃO VALIDADO EM COMPONENTE
- PARCIAL — only part of the requirement is in place
- PENDENTE — not yet implemented
- BLOQUEADO PELO SCHEMA OU PELOS DADOS

No migration, table, column, enum, policy, function or Stripe code was added in
this phase. All work is presentation/integration code that respects the
existing schema and RLS.

## Implementação

### 1. Centralized community data hooks
- File: `src/manus/hooks/community/useCommunityData.ts`
- `usePostsInfinite(channelId)` — real `useInfiniteQuery` backed by
  `.range(from, to)` with `PAGE_SIZE = 20`, ordered
  `pinned desc, last_activity_at desc, id desc` so pages never omit or
  duplicate rows. Status: **IMPLEMENTADO E VALIDADO EM COMPONENTE** (covered
  by the helper ordering tests + the rendered Community tests that exercise
  the hook through the real component).
- `useChannelBySlug(slug, spaceSlug?)` — single-shot lookup that resolves
  the space first when `spaceSlug` is given (because `community_channels`
  is `UNIQUE(space_id, slug)`, the slug is NOT globally unique) and falls
  back to a deterministic `space_id asc, id asc, limit(1)` when no space
  is provided. RLS-honoured: rows the caller cannot read return null.
  Status: **IMPLEMENTADO E VALIDADO EM COMPONENTE** (used by the deep-link
  test in `CommunityCenter.test.tsx`).

The previous draft of this report claimed `useChannelBySlug(slug).maybeSingle()`
existed — it does not. Only the `(slug, spaceSlug?)` implementation above ships.

### 2. Community deep-link service
- File: `src/manus/services/community-deeplink.ts`
  - `parseLessonHash`, `resolveDeepLinkChannel`, `dedupePostPages`,
    `canLoadMorePosts`, `filterPosts`, `readCommunityUrlParams`,
    `buildLessonShareBody`, `comparePostsForFeed`, `paginateFeed`.
  - All helpers are pure and side-effect free.
  - Tests in `src/manus/services/community-deeplink.test.ts` (21).
  - Status: **IMPLEMENTADO E UNITARIAMENTE TESTADO**.

### 3. Lesson → Community CTAs
- File: `src/manus/pages/ModuleDetail.tsx`
- Three actions ("Share your progress", "Ask the community", "Discuss this
  lesson") link to the existing channel slugs `projects`, `questions`,
  `general` and include `?space=<space-slug>&channel=<slug>` so the deep-link
  resolves under the existing `UNIQUE(space_id, slug)` constraint.
- The space slug is fetched once via a single Supabase query against
  `community_channels` joined to `community_spaces!inner(slug)` for the
  three allow-listed slugs. No hardcoded space. If a slug cannot be
  resolved, the draft (title + body) is preserved and the link falls back
  to `?channel=` only.
- Course title is fetched from the existing `courses` table via the
  `module.course_id` relation; `buildLessonShareBody` distinguishes Course,
  Module and Lesson.
- Status: **IMPLEMENTADO E VALIDADO EM COMPONENTE** (rendered in
  `ModuleDetail.test.tsx`).

### 4. Lesson hash navigation (#lesson-<id>)
- File: `src/manus/pages/ModuleDetail.tsx`
- Composite ref key `${moduleId}:${hash}` ensures that:
  - Clicking another lesson, Previous or Next does NOT get re-trapped by
    a stale hash applied earlier;
  - Changing `moduleId` drops the previous selection, re-evaluates the hash
    for the new module, and falls back to `lessons[0]` when the hash is
    missing or invalid;
  - A hash whose lesson id belongs to another module is rejected.
- Status: **IMPLEMENTADO E VALIDADO EM COMPONENTE** — six rendered
  scenarios in `ModuleDetail.test.tsx` (initial select, hash apply, foreign
  hash rejection, click after hash, Previous/Next, module switch).

### 5. CommunityCenter pagination, search and filters
- File: `src/manus/components/community/CommunityCenter.tsx`
- Real infinite pagination through `usePostsInfinite`; "Carregar mais" is
  hidden when the last page is shorter than `POSTS_PAGE_SIZE`.
- Client-side search (title + body, case-insensitive) and filters
  (Todos / Fixados / Meus) reset when the channel changes.
- Deep-link via `?space=...&channel=...` resets and re-resolves when the
  URL changes without unmount; the "channel not found" toast is
  deduplicated by `(space, channel)` key so the user does not see it twice.
- Composer re-prefills `title` and `body` whenever the URL params change
  (no stuck "already prefilled" flag).
- Status: **IMPLEMENTADO E VALIDADO EM COMPONENTE** for slug-change
  navigation (3 tests). The "Load more" interaction, "Meus" and "Fixados"
  toggles and the unmatched-slug toast remain
  **IMPLEMENTADO, NÃO VALIDADO EM COMPONENTE**.

## Casos pendentes em validação de componente

Estes comportamentos têm helpers cobertos por testes puros, mas ainda não
há teste com React Testing Library renderizando a interação:

- "Carregar mais" desaparecendo após a última página.
- Filtro **Meus** filtrando posts do `userId` atual.
- Filtro **Fixados** filtrando apenas posts com `pinned = true`.
- Slug inexistente preservando o draft com toast único.

Status: **IMPLEMENTADO, NÃO VALIDADO EM COMPONENTE**.

## Comandos de validação (gravados nesta execução)

```
$ bun run typecheck   → exit 0
$ bun run test        → exit 0   (50 testes, 7 arquivos)
$ bun run build       → exit 0
$ bun run lint        → exit 1   (37 problems, 25 errors, 12 warnings — preexistentes)
```

Detalhe dos arquivos de teste:

- `src/test/example.test.ts` — 1
- `src/manus/lib/admin-api.test.ts` — 3
- `src/manus/hooks/useAuth.access.test.ts` — 5
- `src/manus/services/learning.test.ts` — 11
- `src/manus/services/community-deeplink.test.ts` — 21
- `src/manus/pages/ModuleDetail.test.tsx` — 6 (React Testing Library)
- `src/manus/components/community/CommunityCenter.test.tsx` — 3 (RTL)

Total: 50 testes. Lint continua reportado como falha (exit 1) enquanto os
warnings pré-existentes de `@typescript-eslint/no-explicit-any` não forem
endereçados — não foram tocados nesta execução.

## Conclusão da Fase 3

Fase 3 NÃO pode ser declarada completa enquanto os itens listados em
"Casos pendentes em validação de componente" continuarem como
**IMPLEMENTADO, NÃO VALIDADO EM COMPONENTE**. As regressões funcionais
(troca de módulo, troca de query params, hash) estão cobertas por testes
de componente reais.
