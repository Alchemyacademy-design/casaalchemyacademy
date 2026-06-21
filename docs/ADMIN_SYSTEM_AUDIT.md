# Admin System Audit — Alchemy Academy

Projeto: `omzwtfnqffseemrlylwu` (Supabase oficial)
Branch: `migration/manus-official-to-lovable`
Administrador principal: `contact@casaalchemystudio.com`

---

## 1. Tabelas confirmadas (schema `public`)

| Tabela | Uso |
| --- | --- |
| `profiles` | Perfil do usuário (1:1 com `auth.users`). |
| `user_roles` | Roles por usuário (`admin`/`student`). Fonte de verdade de autorização. |
| `memberships` | Assinaturas ativas. `source` distingue `stripe` de `manual`. |
| `course_entitlements` | Acesso individual a cursos. `source` idem. |
| `membership_plans` | Catálogo (`monthly_member`, `annual_member`, `individual_course`). |
| `plan_permissions` | Permissões por plano. |
| `stripe_customers` | Vínculo `user_id ↔ stripe_customer_id`. |
| `stripe_subscriptions` | Estado canônico da assinatura Stripe. |
| `stripe_payments` | Histórico financeiro. |
| `stripe_checkout_sessions` | Sessões de checkout. |
| `stripe_webhook_events` | Idempotência dos webhooks. |

Enum `app_role` aceita: `admin`, `student`.

## 2. Estado atual do administrador principal

- Email: `contact@casaalchemystudio.com`
- Existe em `auth.users` (id `a858bebb-…` — confirmado em iterações anteriores).
- Linha em `public.user_roles` com `role='admin'` foi inserida manualmente em sessão anterior; a migration desta entrega torna a regra **permanente e idempotente** via trigger.

## 3. Policies relevantes (resumo)

- `user_roles`: leitura permitida ao próprio usuário e a admins (via `has_role`). Escrita restrita a admin/`service_role`.
- `memberships`, `course_entitlements`: estudante lê apenas o próprio (`user_id = auth.uid()`); admin lê tudo via `has_role`; escrita administrativa via Edge Function com `service_role`.
- `stripe_*`: leitura admin via `has_role`; escrita só pelo webhook (`service_role`).
- `admin_access_audit_log` (nova): leitura admin; escrita apenas `service_role`.

Nenhuma policy `using (true)` para escrita.

## 4. Componentes e funções administrativas existentes

- `src/components/AdminGuard.tsx` — guard de rota baseado em `isAdmin`.
- `src/manus/components/GlobalAccessController.tsx` — controla redirecionamento global; admin já recebe `return` antecipado.
- `src/manus/hooks/useAuth.ts` — calcula `isAdmin`, `isMember`, `hasCourseAccess`, `hasPaidAccess`, `defaultPath`.
- `src/manus/pages/AdminPanel.tsx` — substituída por painel Users & Access funcional.
- `src/manus/pages/AdminAnalytics.tsx` — leitura agregada.
- `src/manus/lib/trpc.ts` — chamadas administrativas (`admin.users`, `admin.allPosts`, `admin.updateMembership`, `admin.deletePost`).

## 5. Operações Stripe existentes

- `supabase/functions/create-checkout-session/index.ts`
- `supabase/functions/stripe-webhook/index.ts`
- `supabase/functions/recover-stripe-events/index.ts`

Estas continuam intocadas. As novas Edge Functions administrativas usam apenas APIs do Stripe (`subscriptions.update`, `subscriptions.cancel`, `subscriptions.retrieve`) e deixam o webhook sincronizar o banco.

## 6. Arquivos novos ou alterados nesta entrega

- `docs/ADMIN_SYSTEM_AUDIT.md` (novo)
- `supabase/migrations/20260621000000_protect_designated_platform_admin.sql` (novo)
- `supabase/functions/admin-manage-user-access/index.ts` (novo)
- `supabase/functions/admin-manage-stripe-subscription/index.ts` (novo)
- `src/manus/hooks/useAuth.ts` (admin → `/admin`)
- `src/manus/components/GlobalAccessController.tsx` (mantém; revisado)
- `src/manus/pages/Login.tsx` (redireciona via `defaultPath`)
- `src/manus/pages/Plans.tsx` (banner admin + desabilita botões)
- `src/manus/pages/AdminPanel.tsx` (Users & Access)
- `src/manus/pages/AdminUserDetail.tsx` (novo — abas Overview/Access/Courses/Billing/Audit)
- `src/manus/lib/admin-api.ts` (novo — wrappers `supabase.functions.invoke`)
- `src/App.tsx` (rota `/admin/users/:id`)

## 7. Operações remotas pendentes (Fase 20)

- Aplicar a migration `20260621000000_protect_designated_platform_admin.sql` no Supabase.
- Deploy das Edge Functions `admin-manage-user-access` e `admin-manage-stripe-subscription`.
- Confirmar secret `STRIPE_SECRET_KEY` disponível nas Edge Functions (já usado pelo webhook).

Nada é executado remotamente nesta entrega. Aguardar autorização explícita.
