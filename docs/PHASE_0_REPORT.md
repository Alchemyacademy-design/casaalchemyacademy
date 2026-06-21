# Fase 0 — Baseline e diagnóstico

**Data:** 2026-06-21
**Projeto Lovable:** `aa3b388c-6623-43ee-8740-326108415543`
**Repositório:** `Alchemyacademy-design/alchemy-academy-preview`
**Branch da execução:** `edit/edt-8ede4bfa-a9ef-480e-9360-be6f83bc6576` (será mesclada em `main`)
**Commit base:** `8be9822c605f757942cf450d67c818747ac35c24` — "Adicionou favoritos e dinâmicos"
**Supabase project ref:** `omzwtfnqffseemrlylwu`
**Administrador master:** `contact@casaalchemystudio.com` (id `a858bebb-9c0b-4cc1-808d-0e22aa39e468`)

## 1. Resultados crus dos comandos (estado pré-Fase 1)

| Comando | Resultado |
|---|---|
| `bunx tsc --noEmit` | ✅ 0 erros |
| `bunx vitest run` | ✅ 3 arquivos, 9 testes, 0 falhas |
| Build (`vite build`) | ✅ executado pelo harness sem erros |
| `bunx eslint .` | ⚠️ 25 erros pré-existentes (todos `@typescript-eslint/no-explicit-any` em `Suppliers.tsx`, `AdminLessonsBulk.tsx`, `usePublicContent.ts`, Edge Functions `admin-content-catalog` e `manus-import`) + 12 warnings. Nenhum erro introduzido nesta fase. |

## 2. Roteamento

- React Router 6.30.1 é a única dependência de routing em `package.json`.
- `rg wouter src/ package.json` → 0 ocorrências. **Wouter já está totalmente ausente** do código (incluindo `AdminUserDetail.tsx`, que usa `useNavigate`/`useParams` de `react-router-dom`).
- A regra ESLint `no-restricted-imports: ["wouter"]` será adicionada na Fase 1 como guarda contra reintrodução.

## 3. AuthProvider, AdminGuard e Supabase

- `AuthProvider` único montado em `src/App.tsx`; hook `useAuth` consome o context (sem listener duplicado).
- `AdminGuard` em `src/components/AdminGuard.tsx` protege todas as rotas `/admin/*`.
- Cliente Supabase oficial em `src/integrations/supabase/client.ts` (key publishable). Nenhum cliente paralelo.

## 4. Edge Functions versionadas

`auth-me`, `admin-audit`, `admin-bootstrap`, `admin-content-catalog`, `admin-manage-user-access`, `admin-manage-stripe-subscription`, `create-checkout-session`, `lesson-video-url`, `manus-import`, `recover-stripe-events`, `stripe-webhook`. Stripe **não** é tocado nesta fase.

## 5. Auditoria de campos do admin × schema real (`types.ts`)

| Página | Tabela | Campo no form | Coluna real | Ação |
|---|---|---|---|---|
| `AdminEvents.tsx` | `events` | `subtitle` | ❌ inexistente | **remover** |
| `AdminWorkshops.tsx` | `live_workshops` | `subtitle` | ❌ inexistente | **remover** |
| `AdminWorkshops.tsx` | `live_workshops` | `join_url` | coluna real é `meeting_url` | **renomear** |
| `AdminWorkshops.tsx` | `live_workshops` | `external_url` | ❌ inexistente (existe `replay_url`) | **substituir por `replay_url`** |
| `AdminMagazine.tsx` | `magazine_issues` | `published_at` | coluna real é `published_on` | **renomear** |
| `AdminDeals.tsx` | `exclusive_deals` | `cover_image_path` | ❌ inexistente | **remover** |
| `AdminSuppliers.tsx` | `suppliers` | `cover_image_path` | coluna real é `logo_image_path` | **renomear** |
| `AdminEvents/Workshops/Deals/Magazine/Suppliers/Plans/Certificates/SupplierCategories` | demais campos | — | ✅ batem com schema | nenhuma |

## 6. Tabelas/queries com falha "silenciosa"

- `admin_access_audit_log` é consultada em `AdminOverview.tsx` e `AdminUserDetail.tsx` mas **não existe no schema atual**. Hoje o erro é coalescido em `[]` (`?? []`), apresentando "lista vazia" indistinguível de erro/permissão. Será endurecido na Fase 1.
- **Falha runtime observada via Network panel** (não é mudança desta fase, apenas registro): chamadas REST a `courses` e `lesson_progress` retornam `HTTP 403 / code 42501` com mensagem `permission denied for function is_admin`. Existe uma policy RLS referenciando uma função `public.is_admin` que **não está mais presente** no banco (apenas `public.has_role(uuid, app_role)` existe). Isso quebra leitura pública/aluno de cursos e progresso. **Pendência para Fase 2** — exige migration corrigindo as policies para usar `has_role(auth.uid(), 'admin')` em vez de `is_admin()`.

## 7. Mocks remanescentes e botões mudos (para Fase 2/3)

- `src/manus/pages/Home.tsx` ainda usa cópias estáticas em `BENEFITS`/`TESTIMONIALS`.
- Stripe checkout no `Plans.tsx` permanece desabilitado por desenho.
- `AdminTablePage` usa `delete()` físico — Fase 2 substitui por arquivamento onde houver `status`/`archived_at`.

## 8. Diagnóstico do administrador master (pré-Fase 1)

Network log confirma `POST /functions/v1/auth-me` → 200 com:
```
profile.email = contact@casaalchemystudio.com
roles = ["admin"]
membership = null
```
`/admin/diagnostics` exibe `session=yes`, `roles=admin`, `isAdmin=true`. Contagens de catálogo via Edge Function `admin-content-catalog` continuam funcionais (somente o REST direto sofre com `is_admin` ausente).

## 9. Conclusão da Fase 0

Sistema em estado coerente para receber as correções mínimas da Fase 1. Nenhuma migration é necessária nesta fase; nenhuma página/funcionalidade existente foi alterada nesta etapa.
