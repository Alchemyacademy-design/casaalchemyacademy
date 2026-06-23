# PHASE 3 — CURRENT AUDIT (read-only)

Confronta `docs/PHASE_3_REPORT.md` com o código em `main` (commit `d9d63f9`).

## Estrutura

| Item | Estado | Evidência |
|------|--------|-----------|
| Tabelas `community_spaces / channels / posts / replies / reactions / moderation_actions` | IMPLEMENTADO | `<supabase-tables>` lista todas com policies |
| RLS habilitada | IMPLEMENTADO E VALIDADO EM COMPONENTE | gatilho `rls_auto_enable` força RLS em todo `CREATE TABLE` no `public` |
| Realtime | PENDENTE | nenhuma migration aplicada faz `ALTER PUBLICATION supabase_realtime ADD TABLE community_*` |
| Spaces / Channels acessíveis | IMPLEMENTADO E VALIDADO EM COMPONENTE | REST devolveu 1 space + 5 channels publicados |

## Componentes / hooks

| Requisito | Estado | Evidência |
|-----------|--------|-----------|
| CommunityCenter (`src/manus/components/community/CommunityCenter.tsx`) | IMPLEMENTADO E UNITARIAMENTE TESTADO | `CommunityCenter.test.tsx` cobre 3 cenários incluindo `?channel=general` |
| Busca / filtros (Todos / Fixados / Meus) | PARCIAL | filtros existem no componente; cobertura E2E ausente |
| `Load more` / paginação | IMPLEMENTADO, NÃO VALIDADO | sem teste exercendo a interação |
| Ordenação determinística | NÃO VALIDADO | depende de query — não auditado nesta passada |
| Empty / error / retry | PARCIAL | empty existe; retry não detectado |
| Slug inexistente / slug repetido entre spaces | PENDENTE | nenhum teste cobre esses ramos |
| Draft preservado | PENDENTE | sem teste |
| Toast único | PENDENTE | sem teste |
| Troca de query params sem desmontagem | IMPLEMENTADO E UNITARIAMENTE TESTADO (parcial) | `CommunityCenter.test.tsx` exercita `?channel=` |

## Deep-link aula → comunidade

| Requisito | Estado | Evidência |
|-----------|--------|-----------|
| `buildLessonShareBody` / `parseLessonHash` | IMPLEMENTADO E UNITARIAMENTE TESTADO | `community-deeplink.test.ts` (21 testes) |
| CTAs Share / Ask / Discuss em `ModuleDetail` | IMPLEMENTADO E VALIDADO EM COMPONENTE | trecho `(() => { ... })()` no `ModuleDetail.tsx` monta `/community?space=...&channel=...&title=...&body=...` |
| Hash `#lesson-<id>` aplicado na ida e na volta | IMPLEMENTADO E UNITARIAMENTE TESTADO | `ModuleDetail.test.tsx` valida `appliedKeyRef` por `(moduleId, hash)` |
| Comportamento Prev/Next após hash | IMPLEMENTADO E UNITARIAMENTE TESTADO | mesmo arquivo |
| Troca de módulo redefine seleção | IMPLEMENTADO E UNITARIAMENTE TESTADO | `appliedKeyRef` reseta por `moduleId` |
| Channel slug resolvido por query RLS | IMPLEMENTADO E VALIDADO EM COMPONENTE | `useQuery(['community-cta-channels'])` retorna `{spaceSlug}` por slug |

## Testes que cobrem a Fase 3

- `src/manus/services/community-deeplink.test.ts` — helper puro
- `src/manus/components/community/CommunityCenter.test.tsx` — componente
- `src/manus/pages/ModuleDetail.test.tsx` — componente (deep-link inverso)

Nenhum teste exercita Realtime, paginação real, moderação, slug inexistente,
filtros `Meus` / `Fixados`, preservação de draft ou toast único.

## FASE_3_STATUS

`FASE_3_STATUS = PARCIAL`

Itens pendentes obrigatórios para fechar:
- Load more / paginação validada em runtime
- Filtros `Meus` e `Fixados` validados
- Slug inexistente
- Preservação de draft
- Toast único
- Realtime habilitado (se requisito)
