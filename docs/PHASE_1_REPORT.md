# Fase 1 — Fundação técnica

**Data:** 2026-06-21
**Branch:** `edit/edt-8ede4bfa-a9ef-480e-9360-be6f83bc6576`
**Commit base:** `8be9822`
**Escopo:** correções mínimas. Sem migrations, sem Stripe, sem refatoração de UX.

## 1. Causa dos erros corrigidos

- **Forms admin desalinhados com schema:** `AdminEvents`/`AdminWorkshops` enviavam `subtitle` (coluna inexistente em `events` e `live_workshops`); `AdminWorkshops` usava `join_url` e `external_url` (na verdade `meeting_url` e `replay_url`); `AdminMagazine` usava `published_at` (`published_on`); `AdminDeals` enviava `cover_image_path` inexistente em `exclusive_deals`; `AdminSuppliers` enviava `cover_image_path` (na verdade `logo_image_path`). Cada INSERT/UPDATE falharia silenciosamente ou produziria um toast de erro Postgres confuso.
- **Audit log ausente:** `admin_access_audit_log` é consultada por `AdminOverview` e `AdminUserDetail` mas não existe no schema atual. O erro era convertido em `[]` (`?? []`), confundindo "sem dados" com "tabela inexistente"/"sem permissão".
- **Sem trava contra Wouter:** embora `wouter` já não exista em `src/`, não havia guarda contra reintrodução.

## 2. Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/manus/pages/admin/AdminEvents.tsx` | Remoção do campo `subtitle`. |
| `src/manus/pages/admin/AdminWorkshops.tsx` | Remoção de `subtitle`; `join_url` → `meeting_url`; `external_url` → `replay_url`. |
| `src/manus/pages/admin/AdminMagazine.tsx` | `published_at` → `published_on`. |
| `src/manus/pages/admin/AdminDeals.tsx` | Remoção de `cover_image_path`. |
| `src/manus/pages/admin/AdminSuppliers.tsx` | `cover_image_path` → `logo_image_path`. |
| `src/manus/lib/admin-audit-safe.ts` *(novo)* | Helper `fetchAuditSafe` que detecta `42P01`/`PGRST205` (tabela ausente) e `42501` (permissão) e devolve `{ available, reason, message, rows }` — sem lançar e sem mascarar erro em lista vazia. |
| `src/manus/pages/admin/AdminOverview.tsx` | Usa `fetchAuditSafe`; UI distingue *loading / unavailable / empty / data*. |
| `src/manus/pages/AdminUserDetail.tsx` | Usa `fetchAuditSafe`; UI da aba "Audit" idem. |
| `eslint.config.js` | Regra `no-restricted-imports` bloqueando `wouter`. |

## 3. Campos incompatíveis encontrados e corrigidos

Ver tabela completa na Fase 0 §5. Total: 7 correções em 5 páginas admin.

## 4. Imports de Wouter removidos

Nenhum import precisou ser removido — `rg wouter src/ package.json` já retornava 0 antes da Fase 1. A regra ESLint adicionada bloqueia reintrodução.

## 5. Rotas corrigidas

Nenhuma — `AdminUserDetail` já usava `react-router-dom` (`useNavigate`/`useParams`). Sem alteração de roteamento.

## 6. Tratamento de erro × vazio × loading × sucesso

Implementado nos painéis de auditoria do Overview e UserDetail. Restante do CRUD admin continua através do `AdminTablePage`, cujos toasts amigáveis foram introduzidos em refator anterior. Padronização ampla das outras telas fica para Fase 2 (mesma camada de serviços).

## 7. AuthProvider, AdminGuard, Supabase

Validados — nenhuma alteração necessária.

## 8. Resultado do administrador master

`/admin/diagnostics` (esperado após esta fase, conforme `auth-me` 200 já capturado):

| Check | Valor |
|---|---|
| session | yes |
| email | contact@casaalchemystudio.com |
| roles | `admin` |
| isAdmin | true |

## 9. Resultado do catálogo

Edge Function `admin-content-catalog` continua respondendo com `{ courses: 10, modules: 10, lessons: 30 }` (fonte: dashboard de Diagnostics; não há mudança de leitura nesta fase).

## 10. Status final de checagens

| Comando | Resultado |
|---|---|
| `bunx tsc --noEmit` | ✅ 0 erros |
| `bunx vitest run` | ✅ 3 arquivos / 9 testes |
| `vite build` (harness) | ✅ |
| `bunx eslint .` | ⚠️ 25 erros pré-existentes (`no-explicit-any` em arquivos não tocados nesta fase); 0 erros novos. **Pendência para Fase 2.** |

## 11. Correção do diagnóstico (RLS 42501)

O diagnóstico inicial da Fase 0/1 atribuía o erro `HTTP 403 / 42501 permission denied for function is_admin` à ausência de `public.is_admin()`. **Isso está incorreto.** A função administrativa de fato em uso vive no schema `private`:

- `private.is_admin()`
- `private.has_course_access(bigint)`
- `private.has_active_plan_permission(public.plan_permission_key)`
- `private.can_access_channel(bigint)`

Todas existem e são as funções referenciadas pelas policies atuais. O 42501 ocorre porque os papéis `anon` e `authenticated` **não possuem `USAGE` no schema `private` nem `EXECUTE` nessas funções**, então a avaliação das policies aborta.

**Correção aplicada (manual, via Supabase SQL Editor):** `docs/migrations/20260622120000_grant_private_schema_execute.sql` — concede `USAGE` em `private` e `EXECUTE` nos quatro helpers para `anon` e `authenticated`. **Nenhuma função `public.is_admin()` foi criada ou restaurada** — fazer isso duplicaria o helper canônico e abriria caminho para inconsistência.

A migration anterior (`20260621120000_restore_is_admin.sql`) foi removida por estar baseada no diagnóstico incorreto.

A Fase 1 só é considerada tecnicamente concluída após validar, no Supabase SQL Editor + UI:

1. consulta direta a `courses` sem 42501;
2. leitura de `course_modules`;
3. leitura de `lessons`;
4. leitura e mutation de `lesson_progress`;
5. admin (`contact@casaalchemystudio.com`) continua reconhecido;
6. aluno autorizado permanece limitado pelas policies (sem escalada);
7. visitante (`anon`) vê somente o conteúdo permitido pelas policies;
8. nenhuma função duplicada `public.is_admin()` foi criada.

## 12. Pendências para a Fase 2

1. Criar/aprovar migration para `admin_access_audit_log` (estrutura, RLS, GRANTs) — hoje a UI mostra "unavailable" amigavelmente, mas a tabela continua ausente.
2. Substituir `delete()` físico de `AdminTablePage` por arquivamento (`status='archived'`, `archived_at = now()`) onde a tabela tiver essas colunas.
3. Limpar 25 `no-explicit-any` herdados em `usePublicContent.ts`, `Suppliers.tsx`, `AdminLessonsBulk.tsx`, `admin-content-catalog/index.ts`, `manus-import/index.ts`.
4. Audit completo do CRUD de cursos/módulos/aulas (drag-and-drop ordering, checklist de publicação, validação de URL externa, thumbnails) — escopo formal da Fase 2.
5. Padronizar tratamento "loading/error/empty/success" nas demais telas (Eventos, Workshops, Magazine, Suppliers, Deals) usando o mesmo padrão aplicado ao painel de auditoria.

**Pare aqui. Aguardando aplicação manual da migration de GRANT + validação dos 8 critérios acima antes de iniciar a Fase 2.**

---

## Execução de 22/06/2026 — auditoria dos requisitos pendentes

### Comandos rodados nesta execução

| Comando            | Exit code | Notas                                  |
| ------------------ | --------- | -------------------------------------- |
| `bun run typecheck`| 0         | limpo                                  |
| `bun run test`     | 0         | 41 testes, 5 arquivos, 0 falhas        |
| `bun run build`    | 0         | warning de chunk >500 kB (informativo) |
| `bun run lint`     | **1**     | 37 problemas (25 errors, 12 warnings) pré-existentes |

### Status dos requisitos da cobrança

| # | Requisito | Estado |
| - | --------- | ------ |
| 1 | Paginação server-side de 20 registros no `AdminTablePage` | **PENDENTE** — `AdminTablePage` ainda carrega `.select(...)` sem range/limit. |
| 2 | Seleção apenas das colunas declaradas | **PENDENTE** — `select` padrão continua `"*"`. |
| 3 | Botão Retry em `AdminTablePage`, `Modules`, `CourseDetail` | **PENDENTE** — erros são exibidos mas sem botão de retry explícito (refetch do React Query existe via invalidação, mas não como UX). |
| 4 | `React.lazy` + `Suspense` nas rotas grandes | **PENDENTE** — `src/App.tsx` segue com imports síncronos; bundle único de 1,4 MB confirmado pelo build. |
| 5 | Remover `any` do `AdminTablePage` com tipos genéricos seguros | **PARCIAL** — `AdminTablePage` ainda contém `(supabase as any)` para tabelas dinâmicas; outros 25 `any` no projeto também permanecem (ver lint). |
| 6 | Substituir hard delete por arquivamento onde houver `status`/`archived_at` | **PENDENTE** — `deleteMutation` continua chamando `.delete()` físico. |
| 7 | Documentar onde delete físico permanece | **PARCIAL** — esta nota registra que **todas** as tabelas continuam com delete físico. |
| 8 | Reduzir lint global sem alterar comportamento | **PENDENTE** — 25 errors / 12 warnings preservados (nenhum erro novo introduzido pelas fases 2-3). |
| 9 | Atualização da segunda aba | **LIMITADO PELO SCHEMA** — comunidade usa Realtime via `postgres_changes`; learning progress (`lesson_progress`) **não** está publicado em `supabase_realtime`. Hoje a segunda aba só recebe atualização ao re-focar/refetchar via React Query. Adicionar a tabela à publicação exige migration, **fora de escopo desta execução**. |

**Fase 1 NÃO está concluída** enquanto os itens 1, 2, 3, 4, 6, 8 estiverem como PENDENTE.
