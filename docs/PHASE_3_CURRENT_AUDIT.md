# PHASE 3 — CURRENT AUDIT (read-only, corrigida)

Confronta `docs/PHASE_3_REPORT.md` com `main` (código em `d9d63f9`).

## Estrutura

| Item | Estado | Evidência |
|------|--------|-----------|
| Tabelas `community_spaces / channels / posts / replies / reactions / moderation_actions` | ✅ | catálogo Supabase |
| RLS habilitada | ✅ | gatilho `rls_auto_enable` força RLS em `public` |
| Realtime habilitado no banco | ✅ **CORRIGIDO** | `community_posts`, `community_replies`, `community_reactions` estão na publication `supabase_realtime` |
| Realtime assinado no frontend + invalidação | ⚠ NÃO VALIDADO EM RUNTIME | exige exercitar a UI com massa real |
| Spaces / Channels publicados | ✅ | 1 space (`alchemy-tribe`) + 5 channels |

## Massa de dados (admin)

| Métrica | Valor |
|---------|-------|
| `community_posts` | 0 |
| `community_replies` | 0 |
| `community_reactions` | 0 |

Sem massa não é possível validar `Load more`, `Meus`, `Fixados`, ordenação,
reply, reaction nem o Realtime em runtime.

## Componentes / hooks

| Requisito | Estado | Evidência |
|-----------|--------|-----------|
| CommunityCenter | ✅ TESTADO | `CommunityCenter.test.tsx` (3 cenários, inclui `?channel=general`) |
| Busca / filtros (Todos / Fixados / Meus) | ⚠ EM CÓDIGO, NÃO VALIDADO | bloqueado por massa |
| `Load more` / paginação | ⚠ EM CÓDIGO, NÃO VALIDADO | bloqueado por massa |
| Ordenação determinística | NÃO VALIDADO | bloqueado por massa |
| Empty / error / Retry | ⚠ PARCIAL | empty existe; Retry não detectado |
| Slug inexistente / repetido | ❌ NÃO TESTADO | adicionar teste |
| Draft preservado | ❌ NÃO TESTADO | — |
| Toast único | ❌ NÃO TESTADO | — |
| Troca de query params sem desmontagem | ✅ TESTADO (parcial) | `CommunityCenter.test.tsx` |

## Deep-link aula → comunidade

| Requisito | Estado | Evidência |
|-----------|--------|-----------|
| `buildLessonShareBody` / `parseLessonHash` | ✅ TESTADO | `community-deeplink.test.ts` (21) |
| CTAs Share / Ask / Discuss em `ModuleDetail` | ✅ EM COMPONENTE | `ModuleDetail.tsx` monta `/community?space=...&channel=...&title=...&body=...` |
| Hash `#lesson-<id>` na ida e na volta | ✅ TESTADO | `ModuleDetail.test.tsx` |
| Prev/Next após hash, troca de módulo redefine seleção | ✅ TESTADO | mesmo arquivo |
| Channel slug resolvido por query RLS | ✅ EM COMPONENTE | `useQuery(['community-cta-channels'])` |

## Testes que cobrem a Fase 3

- `src/manus/services/community-deeplink.test.ts`
- `src/manus/components/community/CommunityCenter.test.tsx`
- `src/manus/pages/ModuleDetail.test.tsx`

Não há teste de Realtime, moderação, paginação real com massa, filtros `Meus`
/ `Fixados`, slug inexistente, draft ou toast único.

## FASE_3_STATUS

`FASE_3_STATUS = PARCIAL_E_BLOQUEADA_POR_DADOS_DE_QA`

Infra (incluindo Realtime no banco para `community_posts`, `community_replies`,
`community_reactions`) está pronta. O fechamento depende de:

- criar massa controlada (> 20 posts, fixados, autores diversos, replies,
  reactions, slug inválido, draft);
- validar Realtime assinado pelo frontend em runtime;
- adicionar testes para `Load more`, `Meus`, `Fixados`, slug inexistente,
  draft e toast único.
