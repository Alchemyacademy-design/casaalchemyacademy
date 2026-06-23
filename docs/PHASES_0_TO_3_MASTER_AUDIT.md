# PHASES 0 → 3 — MASTER AUDIT (read-only)

Commit auditado: `d9d63f9bcb8b69c8c4fc95d6b8768dd3298ba1fa`
Branch: `main` (HEAD == origin/main)
Stripe: **ADIADO** — `STRIPE_LIVE_ENABLED=false`, secrets armazenados não verificáveis,
domínio público pendente, validação operacional pendente. **Não alterado** nesta execução.

## 1. Resumo executivo

| Fase | Status |
|------|--------|
| Fase 0 | PARCIAL (lint reprovado, sem code-splitting, sem CI, suspeitas de drift schema) |
| Fase 1 | PARCIAL (paginação, lazy/Suspense, arquivamento, `any` e lint pendentes) |
| Fase 2 | BLOQUEADA_PELOS_DADOS (0 cursos visíveis + drift `is_published` / `video_url`) |
| Fase 3 | PARCIAL (estrutura ok e testada; 6 interações ainda `IMPLEMENTADO, NÃO VALIDADO`) |
| Fase 4 | NÃO INICIADA (conforme proibição) |
| Stripe | ADIADO (LIVE_DESATIVADO, DOMÍNIO_PENDENTE, VALIDAÇÃO_OPERACIONAL_PENDENTE) |

## 2. Comandos e exit codes

| Comando | Exit |
|---------|------|
| `bun run typecheck` | 0 |
| `bun run test` | 0 (78/78) |
| `bun run build` | 0 (bundle 1.419,77 kB — aviso de chunk > 500 kB) |
| `bun run lint` | **1** (25 errors / 12 warnings — todos `no-explicit-any`) |

CI no GitHub: **AUSENTE** (`.github/workflows/` não existe) → `CI_INDEPENDENTE = AUSENTE`.

## 3. Estado do banco (visível ao anon via REST)

- `courses` / `course_modules` / `lessons` → 0 linhas visíveis.
- `community_spaces` → 1 (`alchemy-tribe`).
- `community_channels` → 5 (`general, questions, projects, inspiration, resources`).
- `stripe_prices` → `42501 permission denied` para anon (esperado).
- Drifts: `courses.is_published` e `lessons.video_url` retornam `42703` — código
  referencia colunas que **não existem** no schema atual.

## 4. Matriz consolidada

| Fase | Requisito | Estado | Evidência | Arquivo | Tabela | Teste | Bloqueio | Correção (futura) |
|------|-----------|--------|-----------|---------|--------|-------|----------|-------------------|
| 0 | typecheck | ✅ VALIDADO | exit 0 | tsconfig | — | — | — | — |
| 0 | tests | ✅ VALIDADO | 78/78 | vitest.config.ts | — | 8 arquivos | — | — |
| 0 | build | ✅ VALIDADO (com aviso) | 1.42 MB | vite.config.ts | — | — | bundle gigante | code-splitting |
| 0 | lint | ❌ REPROVADO | exit 1, 25 errors | eslint.config.js | — | — | `any` | substituir `any` |
| 0 | CI | ❌ AUSENTE | sem `.github/workflows` | — | — | — | — | criar workflow |
| 0 | drift `courses.is_published` | ⚠️ REGRESSÃO | REST `42703` | `usePublicContent.ts` etc. | `courses` | — | schema | alinhar para `status` |
| 0 | drift `lessons.video_url` | ⚠️ REGRESSÃO | REST `42703` | componentes que usam `video_url` | `lessons` | — | schema | localizar coluna real |
| 1 | AuthProvider único | ✅ | App.tsx:55 | `AuthContext.tsx` | — | `useAuth.access.test.ts` | — | — |
| 1 | AdminGuard 5-estados | ✅ | guard completo | `AdminGuard.tsx` | — | — | — | — |
| 1 | React Router único | ✅ | sem Wouter | `package.json` | — | — | — | — |
| 1 | React.lazy / Suspense | ❌ PENDENTE | App.tsx só usa import estático | `App.tsx` | — | — | — | refatorar rotas admin |
| 1 | Bundle reduzido | ❌ PENDENTE | 1.42 MB | vite output | — | — | — | code-split + manualChunks |
| 1 | Paginação server-side admin | ❌ PENDENTE | nenhum `range()` em `pages/admin/*` | — | tabelas admin | — | — | aplicar PAGE_SIZE=20 |
| 1 | Soft-delete | ❌ PENDENTE | sem coluna `archived_at` referenciada | — | conteúdo | — | schema | doc + migration |
| 1 | Grants `private` | ⚠️ PARCIAL | script em `docs/migrations/*` não promovido a `supabase/migrations/*` | `20260622120000_grant_private_schema_execute.sql` | — | — | aplicação manual | mover para pipeline |
| 1 | Proteção admin master | ✅ | `protect_designated_admin` no DB | — | `user_roles` | — | — | — |
| 1 | `any` evitável | ❌ REPROVADO | 25 lint errors | múltiplos | — | — | — | tipar |
| 2 | Conteúdo publicado | ❌ BLOQUEADO PELOS DADOS | 0 cursos visíveis | — | `courses` | — | dados | publicar/seed |
| 2 | Mark/unmark + invalidação | ✅ | mutation invalida 2 queryKeys | `ModuleDetail.tsx` | `lesson_progress` | `ModuleDetail.test.tsx` | — | — |
| 2 | Hash `#lesson-id` | ✅ TESTADO | `appliedKeyRef` por `(moduleId, hash)` | `ModuleDetail.tsx` | — | `ModuleDetail.test.tsx` | — | — |
| 2 | Player de vídeo embutido + fallback | ❌ PARCIAL | apenas `<a>` "Watch Video" | `ModuleDetail.tsx` | `lessons` | — | — | adicionar player + fallback |
| 2 | Materiais / duração total | ❌ PENDENTE | nada renderizado | `ModuleDetail.tsx` | `lessons` | — | — | exibir |
| 2 | Persistência 2ª aba (Realtime) | ❌ PENDENTE | sem `ALTER PUBLICATION` | — | `lesson_progress` | — | — | habilitar Realtime |
| 2 | Certificate | ⚠️ IMPLEMENTADO, NÃO VALIDADO | componente existe | `CertificateSection.tsx` | `certificates` | — | dados | smoke E2E |
| 2 | Learning Path visual | ❌ PENDENTE | não encontrado | — | — | — | — | UX |
| 3 | Spaces/Channels publicados | ✅ | 1 + 5 visíveis | — | `community_spaces`/`_channels` | — | — | — |
| 3 | CommunityCenter deep-link | ✅ TESTADO | 3 testes | `CommunityCenter.tsx` | — | `CommunityCenter.test.tsx` | — | — |
| 3 | CTAs aula → community | ✅ VALIDADO EM COMPONENTE | helpers cobertos | `ModuleDetail.tsx` + `community-deeplink.ts` | — | `community-deeplink.test.ts` (21) | — | — |
| 3 | Load more / paginação | ❌ NÃO VALIDADO | sem teste | `CommunityCenter.tsx` | `community_posts` | — | — | teste + UX |
| 3 | Filtros `Meus` / `Fixados` | ❌ NÃO VALIDADO | sem teste | `CommunityCenter.tsx` | `community_posts` | — | — | teste |
| 3 | Slug inexistente | ❌ NÃO VALIDADO | sem teste | — | — | — | — | adicionar teste |
| 3 | Preservação de draft | ❌ NÃO VALIDADO | sem teste | `CommunityDialogs.tsx` | — | — | — | teste |
| 3 | Toast único | ❌ NÃO VALIDADO | sem teste | — | — | — | — | teste |
| 3 | Realtime na comunidade | ❌ PENDENTE | sem `ALTER PUBLICATION` | — | `community_posts/replies/reactions` | — | — | habilitar |
| Stripe | tudo | ⏸ ADIADO | LIVE=false | `_shared/billing-core.ts` | `stripe_*` | `billing-runtime.test.ts` | DOMÍNIO_PENDENTE | fechar pós-domínio |

## 5. Bloqueadores principais

1. **Conteúdo zerado para alunas** (Fase 2) — 0 cursos visíveis.
2. **Drift de schema** (`courses.is_published`, `lessons.video_url`) — possível regressão silenciosa.
3. **Lint reprovado** + 25 `any` — Fase 1 não pode ser declarada concluída.
4. **Sem code-splitting**: bundle 1,42 MB.
5. **Sem CI no GitHub**: nenhuma validação externa independente.
6. **Realtime não habilitado** para `lesson_progress` nem `community_*`.
7. **Scripts em `docs/migrations/`** (grants, admin policies, admin master) não estão no pipeline `supabase/migrations/` — aplicação real só pode ser confirmada manualmente.

## 6. Riscos / Premortem

| Risco | Impacto | Probabilidade | Primeiro sinal | Prevenção | Rollback |
|-------|---------|---------------|----------------|-----------|----------|
| RLS bloqueando conteúdo (todas tabelas com 0 linhas para anon) | aluna vê app vazio | alta | `useQuery` retorna `[]` em produção | seed + checagem de `status=published` | reverter publicação |
| Admin com delete físico | perda de dados irreversível | média | usuária reclama de aula sumida | introduzir `archived_at` | restaurar backup |
| `lesson_progress` não sincroniza entre abas | conclusões "somem" ao recarregar | média | conclusão volta para Circle | habilitar Realtime + invalidação | refetch manual |
| Conteúdo `draft` invisível porque RLS exige `status='published'` | catálogo vazio em prod | alta | mesmo cenário atual | publicar deliberadamente | tornar `draft` visível ao admin |
| Entitlement liberando curso errado | acesso indevido | baixa | aluna acessa curso fora do plano | testes de `useEntitlements` | revogar entitlement |
| Deep-link abrindo canal errado por slug repetido | UX confusa | baixa | post no canal errado | unicidade `(space_id, slug)` | corrigir slug |
| Paginação omitindo posts | conteúdo perdido na rolagem | média | "Load more" sem incremento | teste integrado | reset cursor |
| Componente passando teste puro mas falhando na UI | falso verde | alta | bug reportado por usuária | adicionar teste de componente/E2E | hotfix |
| Ausência de Retry | usuária sem ação após erro | alta | tela em branco com toast | botão Retry padrão | reload manual |
| Bundle pesado | LCP alto em 3G | alta | métricas web vitals | `React.lazy` | tolerar até split |
| Regressão `main` ↔ deployment | função antiga em produção | média | logs mostram comportamento divergente | CI + deploy reproduzível | redeploy |
| Stripe ativado antes do domínio definitivo | webhooks órfãos / cobrança real indevida | alta | eventos em modo errado | manter `STRIPE_LIVE_ENABLED=false` | desativar gate |

## 7. Ordem corretiva recomendada (proposta, NÃO executada)

**P0 — segurança / dados**
1. Resolver drift `courses.is_published` e `lessons.video_url` (decidir coluna canônica) antes de qualquer publicação.
2. Confirmar/aplicar via `supabase/migrations/` os scripts hoje em `docs/migrations/` (admin_full_access, grant `private`, protect_designated_admin).
3. Soft-delete (`archived_at`) nas tabelas de conteúdo do admin.

**P1 — funcionalidades quebradas**
4. Publicar/seed cursos, módulos, aulas reais (Fase 2 desbloqueia).
5. Habilitar Realtime em `lesson_progress` e `community_*`.
6. Player de vídeo embutido + fallback em `ModuleDetail`.

**P2 — UX / validação**
7. Fechar lint (eliminar `any` e qualquer regra restante).
8. `React.lazy` nas rotas admin + `manualChunks` no Vite → reduzir bundle.
9. Paginação server-side (`PAGE_SIZE = 20`) nas listas admin.
10. Testes de componente para os 6 itens pendentes da Fase 3 (Load more, Meus, Fixados, slug inexistente, draft, toast).
11. Botão Retry padrão nas telas com `error`.

**P3 — melhorias**
12. CI no GitHub Actions (typecheck + test + lint + build).
13. Learning Path visual.
14. Documentar tabelas que exigem hard-delete.

## 8. Stripe (registro)

- `STRIPE_LIVE_ENABLED = false` (mantido).
- Secrets armazenados: `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` presentes no workspace; validade não verificável em modo read-only.
- Domínio público autoritativo: **pendente** (`published_url = null`, sem custom domain).
- Validação operacional ponta-a-ponta: **pendente**.
- Nenhuma alteração realizada nesta auditoria.

## 9. Próximo passo

Aguardar auditoria externa antes de iniciar qualquer correção. Nenhuma das
ações listadas em §7 foi executada.
