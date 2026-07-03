
# Pre-mortem — Membership plans (Admin) + integração Stripe

## Estado atual (o que já existe)

- `/admin/people` → aba **Membership plans** usa `AdminTablePage` sobre `public.membership_plans` — CRUD raso de metadados: `key, name, description, duration, all_courses, community_access, events_access, active`.
- `/plans` (público/membro) renderiza os planos ativos com **preço/label hardcoded** (`PLAN_PRICE_LABEL`) — a fonte da verdade não é o Stripe.
- `public.stripe_prices` já existe, ligado a `plan_key` + `is_checkout_default`. Checkout via `create-checkout-session` já resolve preço por essa tabela.
- Stripe live gated por `STRIPE_LIVE_ENABLED` + `STRIPE_RUNTIME_MODE` (secrets já provisionados).
- **Gap crítico:** admin edita metadados mas não vê nem controla preço, moeda, intervalo, trial, cupom, quantidade de assinantes, MRR, churn, etc. Preço no `/plans` diverge de `stripe_prices` porque está hardcoded.

## Objetivo

Transformar **Membership plans** numa central real de planos: espelho fiel do Stripe (via API), com métricas de assinantes, ações operacionais (pausar, cancelar, reembolsar, aplicar cupom), e Sync bidirecional preço↔plano.

---

## Recursos propostos (por prioridade)

### F1 — Fonte da verdade unificada (base do resto)
1. Nova aba **Plans (Stripe)** dentro do People Hub.
2. Edge function `stripe-plans-sync` (GET): lista `products` + `prices` LIVE do Stripe, cruza com `membership_plans` + `stripe_prices` locais e retorna estado consolidado por `plan_key`:
   - preço atual (amount, currency, interval), price_id, product_id, active, livemode
   - contagem de assinantes ativos / trialing / past_due (via `stripe_subscriptions`)
   - MRR e receita 30d (via `stripe_payments`)
3. Substituir `PLAN_PRICE_LABEL` no `/plans` público pelo preço real vindo de `stripe_prices` (default checkout).

### F2 — Editor de planos rico (admin)
Substituir `AdminTablePage` por página dedicada `AdminMembershipPlans`:
- Cards por plano: nome, descrição, preço formatado, badge live/test, badge active/inactive.
- Modal de edição: metadados + toggles de acesso + **campo "Stripe price"** (dropdown com `stripe_prices` compatíveis).
- Botão "Trocar preço padrão" → chama RPC `internal_activate_validated_stripe_price` (já existe).
- Preview do card membro (como aparece em `/plans`) em tempo real.

### F3 — Recursos Stripe potencializados
Baseado em https://stripe.com/docs (Billing, Coupons, Trials, Portal):
1. **Trials**: campo `trial_days` no plano → passado ao checkout como `subscription_data.trial_period_days`.
2. **Coupons / Promotion codes**: aba "Discounts" que lista/cria `coupons` e `promotion_codes` via API; toggle `allow_promotion_codes` no checkout.
3. **Customer Portal**: botão "Manage billing" na área de membro que abre `billing_portal.sessions.create` — usuário atualiza cartão, cancela, troca de plano sozinho.
4. **Plan switching / upgrade / downgrade**: ação admin "Move subscriber to plan X" com proration automática (`subscriptions.update` + `proration_behavior`).
5. **Pause / resume**: `subscriptions.update({ pause_collection })`.
6. **Refunds**: botão de reembolso na linha de assinante → `refunds.create` + auditoria.
7. **Tax**: opção "Enable Stripe Tax" por preço (`automatic_tax: enabled`).
8. **Metered / usage-based** (futuro): estrutura pronta para `usage_records`, útil se surgir plano por consumo.
9. **Webhook enrichment**: já processamos 11 eventos; adicionar `customer.subscription.trial_will_end` e `invoice.upcoming` para email de aviso.

### F4 — Observabilidade & operação
- Painel "Plan health": subscribers ativos, churn 30d, MRR, ARPU, conversão trial→pago, cupons resgatados.
- Tabela de assinantes por plano com filtro (status, plano, criado em) — link para `stripe_subscriptions`.
- Log de auditoria por ação (`course_audit_logs` já existe; espelhar em `plan_audit_logs`).

### F5 — Segurança & governança
- Toda escrita no Stripe passa por edge function server-side (secret key nunca no cliente).
- Confirmação dupla para ações destrutivas (cancelar, reembolsar).
- RLS: só `admin` pode invocar as edge functions administrativas (`has_role`).
- Rate-limit por admin (5 ações/min) para evitar loops acidentais.

---

## Escopo de implementação (fases executáveis)

**Fase 1 — Verdade única (menor risco, entrega imediata)**
- Edge function `stripe-plans-sync` (read-only).
- Página `AdminMembershipPlans` com cards + métricas + preço real.
- `/plans` público consumindo `stripe_prices` (remove hardcoded label).

**Fase 2 — Operações no plano**
- Trocar preço padrão via UI.
- Trial days + `allow_promotion_codes` no checkout.
- Customer Portal para membros.

**Fase 3 — Assinantes & discounts**
- Aba "Subscribers" por plano (pause/resume/cancel/refund).
- Aba "Discounts" (coupons + promo codes).
- Webhook: `trial_will_end`, `invoice.upcoming`.

**Fase 4 — Analytics & auditoria**
- Painel MRR/churn/ARPU.
- `plan_audit_logs`.

---

## Riscos & mitigações
- **Divergência de preço Stripe↔DB** → sync forçado + banner "Out of sync" com botão reconcile.
- **Ação admin destrutiva acidental** → confirmação dupla + rate-limit + audit log.
- **Custos Stripe API** → cache 60s no `stripe-plans-sync`.
- **Live vs test** → toda tela mostra badge de modo; ações bloqueadas quando `STRIPE_LIVE_ENABLED=false` em live.

---

## Pergunta antes de executar
Começar pela **Fase 1** (verdade única + página nova + `/plans` real) e seguir para Fase 2 na sequência? Ou você quer priorizar Customer Portal / cupons antes das métricas?
