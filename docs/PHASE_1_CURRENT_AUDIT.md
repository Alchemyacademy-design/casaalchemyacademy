# PHASE 1 — CURRENT AUDIT (read-only)

Confronta `docs/PHASE_1_REPORT.md` com o código em `main` (commit `d9d63f9`).

## Requisitos auditados

| # | Requisito | Estado | Evidência |
|---|-----------|--------|-----------|
| 1 | AuthProvider único | IMPLEMENTADO E VALIDADO EM COMPONENTE | `src/App.tsx:55` único `<AuthProvider>`; `useAuth` é apenas wrapper de contexto (`src/manus/hooks/useAuth.ts`) |
| 2 | Sem listeners duplicados | IMPLEMENTADO E VALIDADO EM COMPONENTE | `useAuth.ts` apenas lê contexto; nenhuma chamada `supabase.auth.onAuthStateChange` fora de `AuthContext.tsx` |
| 3 | AdminGuard confiável | IMPLEMENTADO E VALIDADO EM COMPONENTE | `src/components/AdminGuard.tsx` cobre `authReady`, `accessReady`, `error`, `!session`, `!isAdmin`, `isAdmin` |
| 4 | Separação dos 5 estados | IMPLEMENTADO E VALIDADO EM COMPONENTE | mesmo arquivo |
| 5 | React Router único | IMPLEMENTADO E VALIDADO EM COMPONENTE | `react-router-dom ^6.30.1` |
| 6 | Sem Wouter | IMPLEMENTADO E VALIDADO EM COMPONENTE | ausente de `package.json` |
| 7 | Queries tipadas | PARCIAL | tRPC tipado, mas `Suppliers`, `Home`, `Guides`, `AdminLessonsBulk` ainda contêm `any` (vide lint) |
| 8 | Query keys padronizadas | NÃO VALIDADO | sem auditoria sistemática de chaves |
| 9 | Invalidação correta | IMPLEMENTADO E VALIDADO EM COMPONENTE (parcial) | `ModuleDetail.tsx` invalida `lessons.progress` e `progress.moduleProgress` após mutation |
| 10 | Sem consultas duplicadas | NÃO VALIDADO | exigiria perfilamento em runtime |
| 11 | loading/error/empty/success/retry | PARCIAL | `AdminGuard` cobre auth; `ModuleDetail` cobre vazio (`No lessons available`) sem botão Retry; muitas telas admin sem `Retry` documentado |
| 12 | Paginação server-side admin | PENDENTE | nenhuma evidência de paginação server-side (`range()`/cursor) nos arquivos `src/manus/pages/admin/*` |
| 13 | PAGE_SIZE = 20 | PENDENTE | não encontrado |
| 14 | Seleção de colunas | PARCIAL | há `select("id,title")` específico (ex.: `ModuleDetail`), mas várias telas admin usam queries amplas |
| 15 | Ausência de `select("*")` admin | NÃO VALIDADO | requer varredura por arquivo |
| 16 | React.lazy/Suspense rotas grandes | **PENDENTE** | nenhum `lazy(` em `App.tsx` ou rotas |
| 17 | Redução de bundle | **PENDENTE** | bundle = 1.419,77 kB (Vite alerta) |
| 18 | Tipagem do AdminTablePage | NÃO VALIDADO | tabela existe (`src/manus/components/admin/AdminTablePage.tsx`); tipagem não auditada nesta passada |
| 19 | Ausência de `any` evitável | **REPROVADO** | 25 errors de lint `no-explicit-any` |
| 20 | Soft-delete (arquivamento) | PENDENTE | hard-delete continua sendo o padrão visível no admin |
| 21 | Doc das tabelas que exigem hard-delete | PENDENTE | sem documento dedicado |
| 22 | Atualização após mutation | IMPLEMENTADO E VALIDADO EM COMPONENTE (parcial) | `ModuleDetail` invalida queries |
| 23 | Persistência após refresh | NÃO VALIDADO | exige runtime |
| 24 | Atualização em segunda aba | PENDENTE | Realtime não habilitado em tabelas auditáveis (sem publication ADD detectada nas migrations) |
| 25 | Grants schema `private` | PARCIAL | `docs/migrations/20260622120000_grant_private_schema_execute.sql` existe **mas é manual** — não há migration aplicada no pipeline confirmando isso |
| 26 | Sem `public.is_admin` duplicado | IMPLEMENTADO E VALIDADO EM COMPONENTE | `public.has_role` único; o helper canônico é `private.is_admin` |
| 27 | Proteção do admin master | IMPLEMENTADO E UNITARIAMENTE TESTADO | trigger `public.protect_designated_admin` presente; arquivo `docs/migrations/20260621000000_protect_designated_platform_admin.sql` espelha o trigger |
| 28 | CRUD real (10 entidades) | NÃO VALIDADO EM RUNTIME | rotas administrativas existem para todas; comportamento E2E não exercido nesta auditoria |
| 29 | Erros de banco não mascarados | NÃO VALIDADO | exigiria forçar falhas |
| 30 | Lint global | **REPROVADO** | exit 1 |

## FASE_1_STATUS

`FASE_1_STATUS = PARCIAL`

Reprovações que impedem `CONCLUÍDA`:

- Lint global (exit 1) — requisito 30
- `any` evitável — requisito 19
- React.lazy / bundle pesado — requisitos 16 e 17
- Paginação server-side / `PAGE_SIZE = 20` — requisitos 12 e 13
- Soft-delete (arquivamento) — requisito 20
- Sem CI independente confirmando os anteriores
