# Sistema Administrativo Definitivo — Alchemy Academy

Escopo restrito ao projeto atual (Supabase `omzwtfnqffseemrlylwu`, branch `migration/manus-official-to-lovable`). Sem novo Supabase, sem alterar Products/Prices Stripe, sem pagamento real, sem deploy remoto sem confirmação.

---

## Fase 1 — Auditoria (sem mudanças)

Arquivo novo: `docs/ADMIN_SYSTEM_AUDIT.md` com:
- Confirmação das tabelas: `profiles`, `user_roles`, `memberships`, `course_entitlements`, `membership_plans`, `plan_permissions`, `stripe_customers`, `stripe_subscriptions`, `stripe_payments`, `stripe_checkout_sessions`, `stripe_webhook_events`.
- Confirmação do enum `app_role` (admin/student).
- Status atual do usuário `contact@casaalchemystudio.com` em `auth.users` + `user_roles`.
- Listagem de policies por tabela.
- Componentes/funções administrativas existentes (`AdminPanel.tsx`, `AdminAnalytics.tsx`, `AdminGuard.tsx`, `GlobalAccessController.tsx`, `useAuth.ts`, `trpc.admin.*`).
- Operações Stripe atuais (`create-checkout-session`, `stripe-webhook`, `recover-stripe-events`).
- Lista de arquivos que serão alterados nas fases seguintes.

---

## Fase 2 — Migration: admin permanente

`supabase/migrations/20260621_protect_designated_platform_admin.sql`

```sql
create or replace function public.ensure_designated_platform_admin()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if lower(trim(new.email)) = 'contact@casaalchemystudio.com' then
    insert into public.user_roles (user_id, role)
    values (new.id, 'admin'::public.app_role)
    on conflict (user_id, role) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_designated_platform_admin_ins on auth.users;
create trigger ensure_designated_platform_admin_ins
after insert on auth.users
for each row execute function public.ensure_designated_platform_admin();

drop trigger if exists ensure_designated_platform_admin_upd on auth.users;
create trigger ensure_designated_platform_admin_upd
after update of email on auth.users
for each row execute function public.ensure_designated_platform_admin();

-- backfill
insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role
from auth.users u
where lower(trim(u.email)) = 'contact@casaalchemystudio.com'
on conflict (user_id, role) do nothing;
```

Não cria membership/entitlement falso.

---

## Fase 3 — Proteção contra rebaixamento

Na mesma migration:

```sql
create or replace function public.protect_designated_admin_role()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_protected_id uuid;
begin
  select id into v_protected_id
  from auth.users
  where lower(trim(email)) = 'contact@casaalchemystudio.com'
  limit 1;

  if tg_op = 'DELETE' and old.user_id = v_protected_id and old.role = 'admin' then
    raise exception 'Cannot remove admin role from designated platform administrator';
  end if;
  if tg_op = 'UPDATE' and old.user_id = v_protected_id and old.role = 'admin' and new.role <> 'admin' then
    raise exception 'Cannot change admin role of designated platform administrator';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists protect_designated_admin_role_trg on public.user_roles;
create trigger protect_designated_admin_role_trg
before update or delete on public.user_roles
for each row execute function public.protect_designated_admin_role();
```

---

## Fase 4 — Regra única de acesso (frontend)

Revisar:
- `src/manus/hooks/useAuth.ts` → garantir `isAdmin` derivado de `roles.includes("admin")` e `hasPaidAccess = isAdmin || isMember || hasCourseAccess` ✅ já está; apenas garantir `defaultPath = isAdmin ? '/admin' : ...`.
- `src/manus/components/GlobalAccessController.tsx` → nunca redirecionar admin para `/plans`.
- `src/components/AdminGuard.tsx` → ok.
- Páginas de curso/módulo/aula → liberar quando `isAdmin`.

Sem usar e-mail como fonte de autorização.

---

## Fase 5 — Redirecionamento de admin

- Pós-login: admin → `/admin` (ou `/dashboard` se preferir manter dashboard). Definir `/admin`.
- `/plans` para admin: banner "Administrator access is active. No subscription is required." + botões de compra desabilitados.

---

## Fase 6 — Painel `Users & Access`

Nova seção em `src/manus/pages/AdminPanel.tsx` (ou subpágina `/admin/users/:id`):
- Lista pesquisável por nome, e-mail, UUID.
- Detalhe do usuário com avatar, nome, e-mail, user_id, role, created_at, membership (plano/status/source/início/vencimento), Stripe customer/subscription IDs **mascarados** (`cus_***1234`), entitlements ativos, último pagamento. Sem secrets.

---

## Fase 7 — Gestão de roles

Botões Promote/Demote chamando Edge Function (Fase 16). Bloqueio explícito para `contact@casaalchemystudio.com`. Confirmação especial para auto-demote. Sem localStorage.

---

## Fase 8 — Liberação manual de acesso

Via Edge Function `admin-manage-user-access`:
- `grant_membership(plan_key in ['monthly_member','annual_member'], starts_at, ends_at, reason)` → `memberships` com `source='manual'`.
- `grant_course_entitlement(course_id, starts_at, ends_at, reason)` → `course_entitlements` com `source='manual', active=true`.
- Nunca cria cobrança Stripe.

UI com seleção de curso, datas e motivo opcional.

---

## Fase 9 — Revogação segura

Apenas para `source='manual'`:
- membership → `status='cancelled'`, mantém histórico.
- entitlement → `active=false`.

Nunca apagar registros financeiros nem `stripe_*`.

---

## Fase 10 — Edge Function `admin-manage-stripe-subscription`

`supabase/functions/admin-manage-stripe-subscription/index.ts` com `verify_jwt = true`:
1. Validar JWT via `getClaims`.
2. Confirmar role admin no servidor (`user_roles` consultado com service role).
3. Usar `STRIPE_SECRET_KEY` apenas dentro da function.
4. Ações: `cancel_at_period_end`, `cancel_immediately`, `resync_subscription`.
5. Deixar o `stripe-webhook` sincronizar o banco.
6. Auditoria registrada (Fase 15).

---

## Fase 11 — `cancel_at_period_end`

Chama `stripe.subscriptions.update(id, { cancel_at_period_end: true })`. Mensagem: "The subscription will remain active until the end of the current billing period." Audit log.

## Fase 12 — `cancel_immediately`

Exige confirmação digitando o e-mail do alvo. Chama `stripe.subscriptions.cancel(id)`. Sem refund. Sem apagar histórico. Audit log.

## Fase 13 — `resync_subscription`

`stripe.subscriptions.retrieve(id)` → atualiza `stripe_subscriptions` (status, current_period_end, cancel_at_period_end, last_synced_at). Sem criar cobrança.

---

## Fase 14 — "Desvincular" decomposto

Sem botão genérico. UI separa em: Revogar acesso manual / Cancel at period end / Cancel immediately / Resync / Remove entitlement / Change role. Bloquear remoção de `stripe_customer_id` / `stripe_subscription_id` enquanto a assinatura Stripe estiver ativa.

---

## Fase 15 — Audit log

Migration adicional ou na mesma: `public.admin_access_audit_log`:
```sql
create table public.admin_access_audit_log (
  id bigserial primary key,
  actor_user_id uuid not null,
  target_user_id uuid,
  action text not null,
  entity_type text,
  entity_id text,
  reason text,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);
grant select on public.admin_access_audit_log to authenticated;
grant all on public.admin_access_audit_log to service_role;
alter table public.admin_access_audit_log enable row level security;
create policy "admin read audit" on public.admin_access_audit_log
  for select to authenticated using (public.has_role(auth.uid(), 'admin'));
-- writes restritos a service_role via edge functions
```

---

## Fase 16 — Edge Function `admin-manage-user-access`

`supabase/functions/admin-manage-user-access/index.ts`, `verify_jwt = true`. Ações:
- `grant_membership`
- `revoke_membership`
- `grant_course_entitlement`
- `revoke_course_entitlement`
- `promote_admin`
- `demote_admin`

Regras:
- Executor derivado do JWT (`getClaims`).
- Validar admin via `user_roles` server-side.
- Validar IDs, `course_id`, datas.
- Bloquear demote/revoke do admin principal.
- Service role apenas dentro da função.
- Audit log em todas as ações.

---

## Fase 17 — UI de usuário admin

`/admin/users/:id` com abas: Overview / Access / Courses / Billing / Audit. Ações com diálogos: explicação, impacto, confirmação, loading, resultado, erro. Sem update otimista. Recarrega dados após cada ação.

---

## Fase 18 — Auditoria RLS

Revisar e documentar policies em `docs/ADMIN_SYSTEM_AUDIT.md`:
- `profiles`, `user_roles`, `memberships`, `course_entitlements`, `stripe_*` → student lê apenas o próprio, admin lê tudo via `has_role`, escrita administrativa só via Edge Function/service role, anon sem acesso.
- Nenhum `using (true)` para write.
- Nenhum service role no frontend.

Corrigir policies divergentes em migration anexa, se encontradas.

---

## Fase 19 — Testes

`src/test/` (vitest) e `supabase/functions/*/index.test.ts` (Deno) cobrindo os 19 casos listados. Rodar typecheck/test/build/lint e corrigir.

---

## Fase 20 — Sem deploy remoto

Nesta execução vou:
- Criar migrations, Edge Functions, UI, testes.
- Rodar typecheck/testes locais.
- Apresentar diff e relatório.

Não vou: `db push`, deploy de Edge Functions, cancelamento Stripe real, alteração real de usuário. Paro e peço confirmação antes de aplicar no Supabase.

---

## Relatório final (após implementação)

Vou entregar:
- Lista de arquivos alterados/criados.
- Migrations criadas (Fase 2/3/15 e ajustes RLS).
- Triggers (`ensure_designated_platform_admin_*`, `protect_designated_admin_role_trg`).
- Edge Functions (`admin-manage-stripe-subscription`, `admin-manage-user-access`).
- Páginas administrativas (`/admin/users`, `/admin/users/:id` com 5 abas).
- Ações disponíveis e fluxo de confirmação.
- Resultado de testes/build/lint.
- Riscos e operações remotas pendentes.
- Confirmação: nenhum novo Supabase, nenhum novo banco, nenhum Product/Price Stripe alterado, nenhum pagamento real, nenhum cancelamento real, nenhum secret exposto, `main` não tocada.

---

## Confirmação para prosseguir

Aprovando este plano eu começo pela **Fase 1 (auditoria)** + **Fase 2/3/15 (migrations)** + **Fase 16/10 (Edge Functions)** em um primeiro lote, depois UI e testes. Tudo local, sem deploy.
