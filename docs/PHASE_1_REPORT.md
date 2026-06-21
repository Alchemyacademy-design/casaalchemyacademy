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

## 11. Pendências para a Fase 2

1. **Crítico:** policies RLS em `courses`, `course_modules`, `lessons`, `lesson_progress` (e possivelmente outras) referenciam função `public.is_admin` que **não existe**. Resultado: `HTTP 403 / 42501 permission denied for function is_admin` em chamadas REST diretas. **Migration necessária** substituindo `is_admin()` por `has_role(auth.uid(), 'admin')`. O SQL deve ser apresentado antes de aplicar.
2. Criar/aprovar migration para `admin_access_audit_log` (estrutura, RLS, GRANTs) — hoje a UI mostra "unavailable" amigavelmente, mas a tabela continua ausente.
3. Substituir `delete()` físico de `AdminTablePage` por arquivamento (`status='archived'`, `archived_at = now()`) onde a tabela tiver essas colunas.
4. Limpar 25 `no-explicit-any` herdados em `usePublicContent.ts`, `Suppliers.tsx`, `AdminLessonsBulk.tsx`, `admin-content-catalog/index.ts`, `manus-import/index.ts`.
5. Audit completo do CRUD de cursos/módulos/aulas (drag-and-drop ordering, checklist de publicação, validação de URL externa, thumbnails) — escopo formal da Fase 2.
6. Padronizar tratamento "loading/error/empty/success" nas demais telas (Eventos, Workshops, Magazine, Suppliers, Deals) usando o mesmo padrão aplicado ao painel de auditoria.

**Pare aqui. Aguardando revisão antes de iniciar a Fase 2.**
