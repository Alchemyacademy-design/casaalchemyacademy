# PHASE 1 — CURRENT AUDIT (read-only, corrigida)

Confronta `docs/PHASE_1_REPORT.md` com `main` (código em `d9d63f9`).

## Requisitos auditados

| # | Requisito | Estado | Evidência |
|---|-----------|--------|-----------|
| 1 | AuthProvider único | ✅ | `src/App.tsx` único `<AuthProvider>` |
| 2 | Sem listeners duplicados | ✅ | `onAuthStateChange` só em `AuthContext.tsx` |
| 3-4 | AdminGuard com 5 estados | ✅ | `src/components/AdminGuard.tsx` |
| 5-6 | React Router único / sem Wouter | ✅ | `package.json` |
| 7 | Queries tipadas | ⚠ PARCIAL | tRPC tipado; ainda há `any` em telas (vide lint) |
| 8 | Query keys padronizadas | NÃO VALIDADO | sem auditoria sistemática |
| 9 | Invalidação correta | ✅ EM COMPONENTE (parcial) | `ModuleDetail.tsx` invalida 2 keys após mutation |
| 10 | Sem consultas duplicadas | NÃO VALIDADO | exige profiling em runtime |
| 11 | loading/error/empty/success/retry | ⚠ PARCIAL | `AdminGuard` cobre auth; várias telas admin sem Retry |
| 12-13 | Paginação server-side admin / PAGE_SIZE=20 | ❌ PENDENTE | nenhum `range()` em `pages/admin/*` |
| 14-15 | Seleção mínima de colunas | ⚠ PARCIAL | algumas telas usam selects amplos |
| 16 | React.lazy / Suspense | ❌ PENDENTE | sem `lazy(` em `App.tsx` |
| 17 | Redução de bundle | ❌ PENDENTE | 1.419,77 kB |
| 18 | Tipagem AdminTablePage | NÃO VALIDADO | — |
| 19 | Ausência de `any` evitável | ❌ | 25 lint errors |
| 20 | Soft-delete | ❌ PENDENTE NO CÓDIGO | **schema suporta**: `courses.archived_at`, `course_modules.archived_at`, `lessons.archived_at`, `community_posts.archived_at`, `community_replies.archived_at` já existem; demais tabelas a auditar |
| 21 | Doc das tabelas que exigem hard-delete | PENDENTE | — |
| 22 | Atualização após mutation | ✅ (parcial) | `ModuleDetail` |
| 23 | Persistência após refresh | NÃO VALIDADO | exige runtime |
| 24 | Atualização em segunda aba | ❌ PENDENTE | `lesson_progress` **não** está na publication `supabase_realtime` |
| 25 | Grants schema `private` | ⚠ **FUNCIONAL NO BANCO / NÃO VERSIONADO NO PIPELINE** — `anon` e `authenticated` têm `USAGE` em `private` e `EXECUTE` em `private.is_admin()`; `public.is_admin()` não existe. Scripts em `docs/migrations/20260622120000_grant_private_schema_execute.sql` ainda não promovidos a `supabase/migrations/`. |
| 26 | Sem `public.is_admin` duplicado | ✅ | `public.is_admin()` não existe; canônico é `private.is_admin` |
| 27 | Proteção admin master | ✅ | trigger real `protect_designated_admin_trg` + `on_auth_user_sync_casa_alchemy_admin_role` |
| 28 | CRUD real (10 entidades) | NÃO VALIDADO EM RUNTIME | rotas existem |
| 29 | Erros de banco não mascarados | NÃO VALIDADO | — |
| 30 | Lint global | ❌ | exit 1 |

## FASE_1_STATUS

`FASE_1_STATUS = PARCIAL`

Reprovações que impedem `CONCLUÍDA`:

- Lint global (exit 1) e `any` evitável.
- `React.lazy` ausente / bundle pesado.
- Paginação server-side `PAGE_SIZE=20` ausente.
- Soft-delete não implementado **no código** (schema suporta).
- Segunda aba para `lesson_progress` (Realtime não habilitado nessa tabela).
- Grants e policies vivem em `docs/migrations/`, não em `supabase/migrations/`.
- CI independente ausente.
