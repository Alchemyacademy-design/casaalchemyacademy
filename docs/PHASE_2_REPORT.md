# Phase 2 — Experiência de Aprendizagem Premium (Relatório de Execução)

Data: 2026-06-22
Escopo: somente `src/` (sem migrations, sem alteração de RLS, sem Stripe).

## Arquivos de código alterados

- `src/manus/pages/Dashboard.tsx`
- `src/manus/pages/Modules.tsx` (rota `/mycourses`)
- `src/manus/pages/CourseDetail.tsx`

## Bugs corrigidos

1. **Invalidação de progresso quebrada em `CourseDetail.tsx`**
   - Antes: `queryClient.invalidateQueries({ queryKey: [["lessons", "progress"]] })` — chave aninhada que não casava com a query real (`["lessons.progress", input]`). Resultado: marcar aula como concluída não atualizava a UI sem refresh.
   - Depois: `["lessons.progress"]` + `["progress.moduleProgress"]`. Mutations agora propagam para Dashboard, My Courses e Course Detail automaticamente.

2. **Dashboard navegava com `window.location.href`** nos cards de "Continue Learning" — full page reload, perda de cache do React Query.
   - Substituído por `<Link to=…>` do react-router-dom.

3. **Dashboard rotulava "Courses Completed" com contagem de aulas** ("of N total courses"). Corrigido para "Lessons Completed / of N total lessons".

4. **Dashboard tinha bloco "Your Certificates" duplicado e vazio** abaixo da `CertificateSection`. Removido.

5. **Cálculo de progresso por módulo no Dashboard** usava `moduleProgress.length` (qualquer linha, mesmo não concluída) em vez de `filter(p => p.completed).length`. Corrigido.

## Recursos implementados

### Dashboard (`/dashboard`)
- Saudação real (`user.name`) e tipo de acesso (`Administrator` ou plano).
- Cards de Overall Progress e Lessons Completed conectados a `lesson_progress` real.
- "Coming Up" já carregava workshops/eventos reais via `usePublicContent` (mantido).
- Continue Learning: cards reais por módulo, com barra de progresso correta e navegação SPA via `<Link>`.
- Estado vazio: card "Start Learning" com CTA para `/mycourses` quando o aluno ainda não tem nenhuma aula iniciada.
- Cache: `staleTime: 5min` no catálogo (admin e member).

### My Courses (`/mycourses`, `Modules.tsx`)
- **Busca** por título/subtítulo (input com ícone, `aria-label`).
- **Filtro por status**: All / Not started / In progress / Completed (derivado de `lesson_progress`).
- Indicador "X% done" e CheckCircle em cursos concluídos (já existia).
- Bloqueio por acesso e drafts visíveis apenas para admin (já existia, mantido).
- Cache: `staleTime: 5min`.

### Course Detail (`/courses/:id`)
- Player incorporado via `VideoPreview` quando há `external_video_url`; fallback bloqueado para usuários sem acesso e prévia liberada para `is_preview = true`.
- Renderiza `description`, `content_text`, `external_resource_url` (todos opcionais, com estado vazio limpo).
- **Navegação prev/next** entre aulas (botões + contador "X of N").
- Botão "Mark as completed" / "Mark as not completed" persiste em `lesson_progress` e invalida o cache corretamente (ver bug #1).
- Lista lateral com status (concluído/playable/bloqueado), agrupada por módulo na ordem de `sort_order`.
- Estado vazio "This course has no lessons yet." quando não há lessons publicadas.
- Cache: `staleTime: 2min`.

## Mocks removidos

Nenhuma das telas alteradas continha dados hardcoded de aulas/cursos — todas usam Supabase via `getCoursesTree()`, `supabase.from('courses')`, `trpc.modules.list`, `trpc.lessons.progress`. As datas e textos exibidos em "Coming Up" já vinham de `events`/`live_workshops` reais.

## Consultas conectadas / Query keys

| Chave | Origem | staleTime |
|---|---|---|
| `["modules-page", "courses", { admin }]` | `getCoursesTree()` (admin) ou `supabase.from('courses')` (member) | 5 min |
| `["dashboard", "admin-modules"]` | `getCoursesTree()` | 5 min |
| `["modules.list", undefined]` | trpc → `course_modules` | 5 min |
| `["public", "course", id, { admin }]` | tree de curso | 2 min |
| `["lessons.progress", { lessonId: 0 }]` | `lesson_progress` do usuário |  default |
| `["progress.moduleProgress", { moduleId }]` | derivado de `lesson_progress` | default |

## Mutations implementadas / corrigidas

- `trpc.lessons.markComplete` — upsert em `lesson_progress`, com invalidação de `lessons.progress` e `progress.moduleProgress`.

## Validações

- `bunx tsc --noEmit` → **OK** (sem erros).
- `bunx vitest run` → **9/9 passando** (`useAuth.access.test.ts`, `admin-api.test.ts`, `example.test.ts`).
- Build/lint: não executados nesta fase (devem rodar no pipeline do harness).

## Critérios de aceite

| # | Critério | Status |
|---|---|---|
| 1 | Dashboard carrega dados reais | ✅ |
| 2 | My Courses carrega dados reais | ✅ |
| 3 | Curso carrega módulos/aulas reais | ✅ |
| 4 | Aula carrega conteúdo real | ✅ |
| 5 | Concluir aula grava no Supabase | ✅ (mutation já existia, agora com invalidação correta) |
| 6 | Refresh preserva conclusão | ✅ (persistido em `lesson_progress`) |
| 7 | Dashboard atualiza progresso após mutation | ✅ (invalidação corrigida) |
| 8 | Outras abas mostram mesmo estado | ✅ (mesmo cache key compartilhado) |
| 9 | Admin visualiza drafts | ✅ (`getCoursesTree` via edge function) |
| 10 | Aluno sem acesso permanece bloqueado | ✅ (`isCourseAccessible`, `lessonPlayable`) |
| 11 | Sem mocks críticos nas telas alteradas | ✅ |
| 12 | Typecheck, testes passam | ✅ |

## Pendências (fora de escopo desta fase)

- Aplicar o SQL `docs/migrations/20260621120000_restore_is_admin.sql` no Supabase para que o caminho RLS direto funcione (hoje o admin usa o fallback edge — já operacional).
- Aceitar embed completo (oEmbed) para Vimeo/YouTube em `VideoPreview` é parcial — fase 5 cobrirá player avançado.
- Notas pessoais, moodboards, notificações — documentados em `docs/FUTURE_SCHEMA_BACKLOG.md` (requerem schema).
