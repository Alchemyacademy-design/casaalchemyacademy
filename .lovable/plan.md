
# Plano — Auditoria Final e Encerramento do Stripe Live

Objetivo: executar Fases A–K de forma segura, deixar tudo pronto para o teste live controlado (Fase L) e parar para sua autorização. `STRIPE_LIVE_ENABLED` permanece `false` durante toda a execução. Nenhum segredo será exibido, pedido pelo chat ou gravado em arquivo.

## Regras inegociáveis aplicadas
- Nenhum produto/preço novo no Stripe. Nenhuma alteração de valor/recorrência. Nenhum delete de histórico.
- Migrations apenas idempotentes, com transação e validação final que aborta em falha.
- Webhook continua sendo o único escritor financeiro.
- Diagnóstico não usa `webhookFunctionActive: true` / `checkoutFunctionActive: true` como constantes.
- Fases 2, 3, 4 não serão iniciadas.

## Fase A — Inventário real
Levantar e registrar (sem segredos): secrets esperados vs detectados (yes/no), edge functions e versões implantadas, tabelas/RPCs/migrations financeiras, rotas e hooks que chamam checkout, estado real de `stripe_products`, `stripe_prices`, `stripe_customers`, `stripe_checkout_sessions`, `stripe_payments`, `stripe_subscriptions`, `stripe_webhook_events`, `memberships`, `course_entitlements`, RLS e policies relevantes, índices e unique constraints. Confrontar repo × Supabase deploy × DB real.

## Fase B — Secrets
Auditar nomes (não valores) dos 7 obrigatórios + 5 opcionais já suportados. Para cada um: `configured`, `prefixValid`, `environmentCompatible`, `urlValid`. Se algum dos 7 obrigatórios estiver ausente, abrir o formulário seguro do Secret Manager (sem pedir valor no chat) e parar até preenchimento.

## Fase C+D — Preços canônicos + migration oficial
Criar migration nova, versionada e idempotente em `supabase/migrations/` que:
1. abre transação;
2. inspeciona constraints;
3. `INSERT … ON CONFLICT DO UPDATE` em `stripe_products` para `prod_UYpfuiZ9vyi86D`, `prod_UYpYjAVuppRhis`, `prod_UiwxdgrcqKGV5q`;
4. `INSERT … ON CONFLICT DO UPDATE` em `stripe_prices` para os 3 price IDs canônicos com `livemode=true`, `active=true`, `is_checkout_default=true`, `course_id=null`, currency/amount/interval exatos do brief, metadata `{"source":"stripe_live_csv_2026_06","validated":true}`;
5. `UPDATE … SET is_checkout_default=false` apenas em outros registros `livemode=true` do mesmo `plan_key`;
6. preserva integralmente registros `livemode=false` e históricos;
7. valida no fim: 1 default monthly + 1 annual + 1 individual = 3 totais; `RAISE EXCEPTION` se diferente, abortando a transação.

Após aplicar, conferir histórico de migrations no Supabase.

## Fase E — Auditoria do checkout
Conferir em `create-checkout-session/index.ts` os 15 critérios (auth + email confirmado + gate live + price do DB + valor/recorrência/livemode validados + idempotency + rate limit + customer↔user_id + metadata completa + URLs vindas de secrets + nenhum segredo retornado), e regras por plano (monthly subscription, annual payment, individual subscription 3 meses com `course_id` validado e curso `published`). Corrigir desvios encontrados sem mudar contratos.

## Fase F — Auditoria do webhook
Conferir `stripe-webhook/index.ts` e `_shared/billing-core.ts`: POST-only, raw body, signature + livemode, claim idempotente, sem price IDs hardcoded, sem leak em erro, suporte aos 11 eventos com semântica correta (subscription.created não libera sozinho, invoice.paid libera mensal/curso, anual libera 12 meses uma única vez, refund/dispute revogam, dispute closed só restaura idempotente).

## Fase G — RPCs / single writer
Conferir as 6 RPCs `internal_*` + wrappers: `SECURITY DEFINER` mínimo, `search_path` seguro, permissões mínimas, frontend sem acesso, validação user_id/course_id, proteção contra evento velho/duplicado, anual não duplica para 24 meses, invoice duplicada não duplica pagamento.

## Fase H — Páginas de retorno
`/payment/success`: nunca grava acesso, refaz `auth-me`, refaz consulta de entitlements com retry+timeout, só mostra "ativo" quando o DB confirmar, CTA para Dashboard/My Courses. `/payment/cancel`: não toca DB, volta a planos.

## Fase I — Diagnóstico honesto
Refatorar `billing-config-status` e `AdminDiagnostics.tsx` para devolver:
- `functionConfigured`, `functionDeploymentKnown`, `functionOperationallyTested`, `deploymentStatus`
- separar `configurationReady`, `checkoutGateEnabled`, `operationallyValidated`
- `operationallyValidated` só `true` quando houver webhook processado + checkout controlado + pagamento + membership/entitlement + auth-me OK no DB.

Remover qualquer `true` constante para deployment de função.

## Fase J — Webhook no Stripe (orientação)
Confirmar endpoint `https://omzwtfnqffseemrlylwu.supabase.co/functions/v1/stripe-webhook` com os 11 eventos. Quando `STRIPE_WEBHOOK_SECRET` precisar entrar/rotacionar, abrir formulário seguro. Diagnóstico só marca webhook como validado após evento real recebido (linha em `stripe_webhook_events`).

## Fase K — Testes
Cobrir/atualizar os 27 cenários listados no brief em `src/manus/services/billing-runtime.test.ts` (e companion onde aplicável). Rodar e registrar exit codes reais:
- `bun run typecheck`
- `bun run test`
- `bun run build`
- `bun run lint` (sem esconder exit 1 pré-existente)

## Fase M — Relatório
Atualizar `docs/STRIPE_LIVE_CLOSURE_REPORT.md` com: commit, migration aplicada, tabelas/RPCs/funções auditadas, prices/products, nomes de secrets (sem valores), endpoint+eventos, testes+exit codes, snapshot do banco antes/depois, rollback, pendências, evidências. Status final desta execução: `SECRETS_CONFIGURED_LIVE_DISABLED` ou `READY_FOR_CONTROLLED_LIVE_TEST` (nunca `LIVE_VALIDATED` agora).

## Parada obrigatória
Ao terminar Fase K + relatório, **parar**. Listar ações manuais restantes (criar/conferir webhook no Stripe, autorizar Fase L). Não flipar `STRIPE_LIVE_ENABLED`. Não tocar comunidade/aprendizagem.

## Detalhes técnicos
- Migration: `supabase/migrations/<timestamp>_stripe_live_canonical_defaults.sql`, transação única, `pg_advisory_xact_lock` por `plan_key|livemode|currency` (reaproveitar padrão de `internal_activate_validated_stripe_price`), validação final via `SELECT count(*)` por plan_key e total=3.
- Diagnóstico: novo shape JSON publicado por `billing-config-status`, com camada `configurationReady`/`checkoutGateEnabled`/`operationallyValidated`; `AdminDiagnostics` consome os novos campos.
- Operational validation: queries leves em `stripe_webhook_events`, `stripe_checkout_sessions`, `stripe_payments`, `memberships` filtradas por `livemode=true`.
- Nenhum arquivo `.env*` será gravado com segredos; segredos ficam apenas no Supabase Functions Secrets via `secrets--add_secret`/`update_secret`.

Confirma que posso seguir nessa ordem (A→K + relatório) e parar antes da Fase L?
