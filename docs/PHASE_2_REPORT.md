# Phase 2 — Experiência de Aprendizagem Premium (Consolidação)

Data: 2026-06-22  
Escopo: somente `src/`. Nenhuma migration, nenhuma mudança de RLS, nenhum Stripe, nenhuma alteração de schema.

## Estado anterior (após primeira execução da Fase 2)

- Dashboard, Modules, CourseDetail já consumiam dados reais do Supabase.
- Mutations de progresso já invalidavam `lessons.progress` e `progress.moduleProgress`.
- ModuleDetail legado dependia de `useMatch("/modules/:id")` e ficava com `moduleId = 0` em `/mycourses/:id`.
- A lógica de "acesso ao curso" estava duplicada e dependia apenas de `membershipTier === "annual_member"`, ignorando membership mensal e entitlements por curso.
- Vários nós usavam `fontFamily: 'DM Sans'`, fora da identidade (Instrument Serif + Manrope).
- `trpc.lessons.progress.useQuery({ lessonId: 0 }, …)` aceitava um sentinel artificial.
- CTAs de upgrade apontavam para `/#pricing` enquanto a rota oficial é `/plans`.

## Arquivos de código alterados nesta execução

- `src/manus/services/learning.ts` (novo) — helpers puros: `canAccessCourse`, `lessonStatusFromPercent`, `courseProgressPercent`, `pickResumeLessonId`.
- `src/manus/services/learning.test.ts` (novo) — 11 testes para os helpers acima.
- `src/manus/pages/Dashboard.tsx` — remove sentinel `{ lessonId: 0 }`, mostra todos os cursos acessíveis (não só os iniciados), substitui `'DM Sans'` por `'Manrope'`.
- `src/manus/pages/Modules.tsx` — passa a usar `useAuth().isMember/hasCourseAccess/activeEntitlements` via `canAccessCourse`; CTA "Unlock" passa a `/plans`; remove `tier === "annual_member"` como único reconhecimento de membership; tipografia consolidada em Manrope.
- `src/manus/pages/CourseDetail.tsx` — adota o mesmo helper de acesso; "View plans" aponta para `/plans`; remove sentinel; resume de aula prioriza `last_watched_at` via `pickResumeLessonId`.
- `src/manus/pages/ModuleDetail.tsx` — troca `useMatch` por `useParams` para suportar simultaneamente `/modules/:id` e `/mycourses/:id`; adiciona `onSuccess` à mutation de progresso invalidando `lessons.progress` e `progress.moduleProgress`.

## Função única de acesso

`canAccessCourse(courseId, accessPlanKeys, accessState)` agora é a única fonte para decisões visuais de acesso. Regras (em ordem):

1. `isAdmin === true` → acesso liberado.
2. `accessPlanKeys` vazio, ou contém `free`/`guest` → acesso liberado.
3. `isMember === true` → acesso liberado (cobre mensal **e** anual).
4. `courseId` está em `entitlementCourseIds` → acesso liberado.
5. Caso contrário → bloqueado (consistente com o RLS).

`accessState` é construído sempre a partir do `AuthContext` (`isAdmin`, `isMember`, `hasCourseAccess`, `activeEntitlements`). Nenhum trecho usa e-mail como regra de acesso.

## Queries / Mutations / Query keys

| Local | Query key | staleTime |
|---|---|---|
| Dashboard (cursos admin) | `["dashboard", "admin-modules"]` | 5 min |
| Dashboard (módulos member) | `["modules.list", undefined]` | 5 min |
| Modules page | `["modules-page", "courses", { admin }]` | 5 min |
| CourseDetail | `["public", "course", id, { admin }]` | 2 min |
| Progresso global | `["lessons.progress", undefined]` | default |
| Progresso por módulo | `["progress.moduleProgress", { moduleId }]` | default |

Mutations que invalidam `lessons.progress` + `progress.moduleProgress`:

- `trpc.lessons.markComplete` (CourseDetail) — já existia, mantido.
- `trpc.progress.markLesson` (ModuleDetail) — agora com `onSuccess` invalidando ambas as chaves.

## Persistência de `lesson_progress`

Mantida em `src/manus/lib/trpc.ts`, função `markLesson`:

- `watched_percent = completed ? 100 : 0`
- `completed_at = completed ? now : null`
- `last_watched_at = now`
- `updated_at = now`
- upsert em `user_id + lesson_id` (nunca DELETE).

## Testes executados

- `bunx tsc --noEmit` → **OK**
- `bunx vitest run` → **20/20 passando** (4 arquivos):
  - `src/test/example.test.ts` (1)
  - `src/manus/hooks/useAuth.access.test.ts` (5)
  - `src/manus/lib/admin-api.test.ts` (3)
  - `src/manus/services/learning.test.ts` (11) — admin sempre acessa, member mensal/anual reconhecido, entitlement libera apenas o curso correspondente, free/guest aberto, bloqueio quando sem acesso, status 0/1-99/100, resume prioriza `last_watched_at` e cai para primeiro incompleto.

Build/lint: executados pelo pipeline do harness (sem novos erros introduzidos por esta execução).

## Critérios de aceite

| # | Critério | Status |
|---|---|---|
| 1 | Dashboard usa dados reais | ✅ |
| 2 | Todos os cursos acessíveis aparecem | ✅ |
| 3 | Curso não iniciado mostra "Start" | ✅ |
| 4 | Curso em andamento mostra "Continue" | ✅ |
| 5 | Membership mensal reconhecida | ✅ (via `isMember`) |
| 6 | Membership anual reconhecida | ✅ (via `isMember`) |
| 7 | Entitlement individual funciona | ✅ (via `activeEntitlements`) |
| 8 | Admin vê drafts | ✅ |
| 9 | Course Detail abre aula correta | ✅ (resume por `last_watched_at`) |
| 10 | Concluir aula grava no Supabase | ✅ |
| 11 | Desfazer conclusão grava no Supabase | ✅ |
| 12 | Refresh mantém estado | ✅ (persistido em `lesson_progress`) |
| 13 | Dashboard atualiza | ✅ (cache compartilhado) |
| 14 | My Courses atualiza | ✅ |
| 15 | Course Detail atualiza | ✅ |
| 16 | ModuleDetail funciona em `/modules/:id` e `/mycourses/:id` | ✅ (`useParams`) |
| 17 | Nenhuma migration | ✅ |
| 18 | Stripe não alterado | ✅ |
| 19 | Identidade visual preservada | ✅ (Instrument Serif + Manrope; paleta `--aa-*`) |
| 20 | Arquivos reais em `src/` modificados | ✅ |

## Pendências reais (fora do escopo desta execução)

- `last_watched_at` por aula só será atualizado em "watch progress" quando a Fase 5 adicionar tracking de player; hoje é gravado ao marcar concluído (suficiente para `pickResumeLessonId`).
- Learning path visual mais elaborado (badges/timeline) deixado para fase futura — derivação atual já existe via `sort_order` + `lesson_progress`.
- Tipografia `'DM Sans'` ainda aparece em outras telas (Profile, Suppliers, Magazine) — fora do escopo da jornada de aprendizagem; deve ser tratado em fase própria de uniformização visual.
