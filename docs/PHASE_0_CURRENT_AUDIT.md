# PHASE 0 — CURRENT AUDIT (read-only)

> Esta auditoria não substitui `docs/PHASE_0_REPORT.md`. É um diagnóstico atual,
> verificável, gerado sem aplicar correções.

## Identidade

| Item | Valor |
|------|-------|
| Lovable project | `aa3b388c-6623-43ee-8740-326108415543` |
| Supabase ref | `omzwtfnqffseemrlylwu` |
| Branch auditada | `main` |
| Commit HEAD | `d9d63f9bcb8b69c8c4fc95d6b8768dd3298ba1fa` ("Executar Fase A→J em paralelo") |
| Diff vs `origin/main` | vazio (HEAD == origin/main) |
| CI no GitHub | **AUSENTE** — não existe diretório `.github/workflows/` |

## Comandos executados

| Comando | Exit | Observação |
|---------|------|------------|
| `bun run typecheck` (`tsc --noEmit`) | **0** | sem erros de tipo |
| `bun run test` (`vitest run`) | **0** | 8 arquivos / 78 testes, todos passam |
| `bun run build` (`vite build`) | **0** | bundle único `dist/assets/index-*.js` = **1.419,77 kB** (gzip 390,62 kB). Vite emite aviso oficial de chunk > 500 kB |
| `bun run lint` (`eslint .`) | **1** | **25 errors + 12 warnings** (todos `@typescript-eslint/no-explicit-any`) → script termina com código 1 |

Arquivos com `any` proibido (errors de lint):

```
src/manus/hooks/usePublicContent.ts
src/manus/pages/Guides.tsx
src/manus/pages/Home.tsx
src/manus/pages/Suppliers.tsx
src/manus/pages/admin/AdminLessonsBulk.tsx
supabase/functions/admin-content-catalog/index.ts
supabase/functions/manus-import/index.ts
```

## Roteamento e provedores

- React Router v6 (`react-router-dom ^6.30.1`). **Nenhum Wouter** no `package.json`.
- `src/App.tsx`: **único `AuthProvider`** (linhas 7 / 55) e **único `GlobalAccessController`** (linha 58).
- Rotas administrativas todas atrás de `<AdminGuard>`.
- **Nenhuma rota usa `React.lazy` / `Suspense`** — todos os módulos administrativos (`AdminLessonsBulk`, `AdminMagazine`, `AdminSuppliers`, etc.) são `import` estático no topo de `App.tsx`. Isso explica o bundle único > 1,4 MB.

## Cliente Supabase / Query

- `src/integrations/supabase/client.ts` é o único cliente. `src/lib/supabase.ts` apenas re-exporta.
- `@tanstack/react-query ^5.83.0` e `QueryClientProvider` em `src/manus/lib/query-client.ts`.

## Edge Functions (deploy listado pelo workspace)

```
_shared, admin-audit, admin-bootstrap, admin-content-catalog,
admin-manage-stripe-subscription, admin-manage-user-access, auth-me,
billing-config-status, create-checkout-session, lesson-video-url,
manus-import, recover-stripe-events, stripe-webhook
```

Estado real (ACTIVE/inativo, latência, logs) **não verificável** nesta execução
read-only — exige acesso ao painel.

## Migrations aplicadas (pasta `supabase/migrations`)

```
20260618235641_mvp_stripe_single_writer_schema.sql
20260618235837_mvp_stripe_webhook_claim_functions.sql
20260619000001_mvp_stripe_financial_rpc_functions.sql
20260619000244_mvp_stripe_financial_rpc_wrappers.sql
20260619005628_activate_validated_stripe_price.sql
20260619170000_provision_auth_users.sql
20260620120000_enforce_invoice_paid_single_activation.sql
20260620130000_map_existing_stripe_offers.sql
20260620131000_enable_existing_annual_one_time_access.sql
```

> `docs/migrations/*.sql` contêm scripts que precisam ser aplicados manualmente
> (admin_full_access_policies, grant_private_schema_execute,
> protect_designated_platform_admin). Não há garantia, nesta auditoria, de que
> foram efetivamente executados no banco — **NÃO VALIDADO em runtime**.

## Tabelas conhecidas

37 tabelas no schema `public` (lista completa em `<supabase-tables>`); incluem
todas as tabelas exigidas pelas Fases 1–3 (`courses`, `course_modules`,
`lessons`, `lesson_progress`, `memberships`, `course_entitlements`,
`community_*`, `stripe_*`, `user_roles`, etc.).

## Dados reais (consulta via REST anon)

| Tabela | Linhas visíveis ao anon | Observação |
|--------|-------------------------|------------|
| `courses` | **0** | RLS pública só mostra publicados → ou tabela vazia ou tudo `draft` |
| `course_modules` | **0** | idem |
| `lessons` | **0** | idem |
| `community_spaces` | **1** (`alchemy-tribe`) | publicado |
| `community_channels` | **5** (`general, questions, projects, inspiration, resources`) | todos no space 1 |
| `membership_plans` / `events` / `live_workshops` / `magazine_issues` / `suppliers` / `exclusive_deals` / `community_posts` | resposta sem header `content-range` confiável | não verificável sem service role |
| `stripe_prices` | `42501 permission denied` para anon | esperado (RLS) |

**Inconsistências detectadas entre código e schema real:**

- `courses` não possui coluna `is_published` (REST devolveu `42703`). O campo de
  publicação parece ser `status`. Conferir todos os usos de `is_published` nos
  componentes (potencial REGRESSÃO).
- `lessons` não possui coluna `video_url` snake_case via REST (`42703`). Acesso
  ao vídeo se dá via tRPC com mapeamento camelCase (`videoUrl`). Confirmar a
  coluna real (`video_path` / `video_id`?) antes de qualquer correção.

## Erros de runtime

Snapshot do console / network não consultado nesta auditoria estática. **Não
validado em runtime**.

## Conclusão da Fase 0

| Item | Estado |
|------|--------|
| Branch / commit / build / typecheck / test | ✅ IMPLEMENTADO E VALIDADO |
| Lint global | ❌ REPROVADO (exit 1) |
| Code-splitting / bundle saudável | ❌ PENDENTE (sem `React.lazy`, bundle 1,42 MB) |
| CI independente | ❌ AUSENTE |
| Conteúdo publicado para alunas | ⚠️ BLOQUEADO PELOS DADOS (0 cursos visíveis) |
| Coerência types ↔ banco | ⚠️ PARCIAL (`is_published`, `video_url` divergentes) |
