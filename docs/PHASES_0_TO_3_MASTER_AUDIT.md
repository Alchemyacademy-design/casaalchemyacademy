# PHASES 0 → 3 — MASTER AUDIT (read-only, corrigida)

- Commit de **código** auditado: `d9d63f9bcb8b69c8c4fc95d6b8768dd3298ba1fa`
- Commit **final** da `main` ao publicar esta revisão: HEAD posterior, contendo
  apenas os cinco relatórios desta auditoria (sem alteração funcional).
- Stripe: **ADIADO** — `STRIPE_LIVE_ENABLED=false`, domínio público pendente,
  validação operacional pendente. **Não alterado** nesta execução.

> Esta versão substitui a auditoria anterior, que continha quatro afirmações
> incorretas (banco vazio, drift `is_published`, drift `video_url`, Realtime da
> comunidade ausente). Ver §10 para o histórico das correções.

## 1. Resumo executivo

| Fase | Status |
|------|--------|
| Fase 0 | PARCIAL (lint reprovado, sem code-splitting, sem CI) |
| Fase 1 | PARCIAL (paginação, lazy/Suspense, `any`, soft-delete e migrations versionadas pendentes) |
| Fase 2 | **PARCIAL_E_BLOQUEADA_PELA_PUBLICACAO_DOS_DADOS** (existe conteúdo, mas a cadeia `curso publicado → módulo publicado → aulas publicadas` ainda não foi montada) |
| Fase 3 | **PARCIAL_E_BLOQUEADA_POR_DADOS_DE_QA** (infra e Realtime no banco prontos; faltam posts/replies/reactions para validar UX) |
| Fase 4 | NÃO INICIADA |
| Stripe | ADIADO |

## 2. Comandos e exit codes

| Comando | Exit |
|---------|------|
| `bun run typecheck` | 0 |
| `bun run test` | 0 (78/78) |
| `bun run build` | 0 (bundle 1.419,77 kB — aviso de chunk > 500 kB) |
| `bun run lint` | **1** (25 errors / 12 warnings — todos `no-explicit-any`) |

CI no GitHub: **AUSENTE** (`.github/workflows/` não existe).

## 3. Estado real do banco (admin)

Consulta administrativa direta:

| Métrica | Valor |
|--------|------|
| `courses_total` | 10 |
| `courses_published` | 1 |
| `courses_draft` | 9 |
| `course_modules_total` | 10 |
| `course_modules_published` | 0 |
| `course_modules_draft` | 10 |
| `lessons_total` | 30 |
| `lessons_published` | 0 |
| `lessons_draft` | 30 |
| `lessons_with_external_video_url` | 1 |
| `lessons_with_resource` | 0 |
| `lessons_with_duration` | 0 |
| `lesson_progress` rows | 0 |
| `community_spaces` | 1 (`alchemy-tribe`) |
| `community_channels` | 5 (`general, questions, projects, inspiration, resources`) |
| `community_posts` / `_replies` / `_reactions` | 0 / 0 / 0 |

> O banco **não está vazio**. Cursos existem; o que falta é uma cadeia
> publicada ponta a ponta (curso publicado → módulo publicado → aulas
> publicadas) que permita exercitar a jornada da aluna.

### Schema vs. código (verificado nesta revisão)

| Suposto drift | Estado real |
|---------------|------------|
| `courses.is_published` | **NÃO confirmado**. Nenhuma ocorrência de `is_published` em `src/` ou `supabase/functions/`. Código usa `eq("status", "published")` e schema tem `status`, `published_at`, `archived_at`. O `42703` da auditoria anterior veio da sonda, não do app. |
| `lessons.video_url` | **NÃO confirmado**. Schema usa `lessons.external_video_url`; `src/manus/lib/trpc.ts` mapeia `videoUrl = l.external_video_url`; `ModuleDetail` consome `activeLesson.videoUrl`. Coluna alinhada. Pendência real: o player apenas abre link externo (sem embed nem fallback). |

## 4. Matriz consolidada

| Fase | Requisito | Estado | Evidência / observação |
|------|-----------|--------|------------------------|
| 0 | typecheck / tests / build | ✅ | exit 0; 78/78; 1.42 MB |
| 0 | lint | ❌ | exit 1, 25 `no-explicit-any` |
| 0 | CI | ❌ AUSENTE | sem `.github/workflows` |
| 0 | code-splitting | ❌ PENDENTE | bundle único 1,42 MB |
| 1 | AuthProvider único / AdminGuard 5-estados / React Router único | ✅ | `App.tsx`, `AdminGuard.tsx` |
| 1 | React.lazy / Suspense | ❌ PENDENTE | sem `lazy(` em `App.tsx` |
| 1 | Paginação server-side admin (PAGE_SIZE=20) | ❌ PENDENTE | nenhum `range()` em `pages/admin/*` |
| 1 | Soft-delete usando `archived_at` | ❌ PENDENTE NO CÓDIGO (suportado pelo schema em `courses`, `course_modules`, `lessons`, `community_posts`, `community_replies`; demais tabelas a auditar) |
| 1 | Grants schema `private` | ⚠ FUNCIONAL NO BANCO / NÃO VERSIONADO NO PIPELINE OFICIAL — `anon` e `authenticated` têm `USAGE` em `private` e `EXECUTE` em `private.is_admin()`; `public.is_admin()` não existe. Scripts vivem em `docs/migrations/`, fora de `supabase/migrations/`. |
| 1 | Proteção admin master | ✅ | trigger real `protect_designated_admin_trg` + `on_auth_user_sync_casa_alchemy_admin_role` |
| 1 | `any` evitável / lint | ❌ | 25 lint errors |
| 2 | Dashboard / My Courses / Course Detail / Module Detail | ✅ EM COMPONENTE | dependem de cadeia publicada |
| 2 | Mark / unmark / hash `#lesson-id` / prev/next | ✅ TESTADO | `ModuleDetail.test.tsx` |
| 2 | Player de vídeo + fallback | ❌ PARCIAL | apenas `<a>` "Watch Video" (schema alinhado em `external_video_url`) |
| 2 | Materiais / duração total / Learning Path | ❌ PENDENTE NO CÓDIGO + DADOS (0 aulas com material/duração) |
| 2 | Persistência 2ª aba | ❌ PENDENTE | `lesson_progress` **não** está na publication `supabase_realtime` |
| 2 | Cadeia publicada para QA | ❌ AUSENTE | 1 curso publicado, 0 módulos publicados, 0 aulas publicadas |
| 3 | Spaces / Channels | ✅ | 1 + 5 |
| 3 | CommunityCenter deep-link | ✅ TESTADO | `CommunityCenter.test.tsx` |
| 3 | CTAs aula → community | ✅ TESTADO | `community-deeplink.test.ts` (21) |
| 3 | Realtime habilitado no banco | ✅ NO BANCO | `community_posts`, `community_replies`, `community_reactions` estão na publication `supabase_realtime` |
| 3 | Realtime assinado no frontend + invalidação | ⚠ NÃO VALIDADO EM RUNTIME |
| 3 | Load more, filtros `Meus` / `Fixados`, slug inexistente, draft, toast único | ❌ NÃO VALIDADO + BLOQUEADO POR DADOS (0 posts/replies/reactions) |
| Stripe | tudo | ⏸ ADIADO |

## 5. Bloqueadores principais

1. **Cadeia publicada ausente** (Fase 2): 1 curso publicado, mas nenhum módulo
   nem aula publicados — impede QA real da jornada da aluna.
2. **Lint reprovado** + 25 `any` (Fase 0/1).
3. **Sem code-splitting**: bundle 1,42 MB.
4. **Sem CI** no GitHub.
5. **Realtime de `lesson_progress` não habilitado** (comunidade já está).
6. **Massa de QA da comunidade ausente**: 0 posts/replies/reactions impedem
   validar load more, filtros, ordenação e Realtime em runtime.
7. **Pipeline de migrations não reflete o banco** (grants `private`, admin
   policies, trigger admin master vivem em `docs/migrations/`).

## 6. Riscos / Premortem (inalterado em relação à versão anterior — apenas referência)

Ver `docs/PHASE_2_CURRENT_AUDIT.md` e `docs/PHASE_3_CURRENT_AUDIT.md`.

## 7. Ordem corretiva recomendada (proposta, NÃO executada)

**Bloco 1 — corrigir relatórios** *(esta execução)*
- Atualizar os cinco documentos da auditoria.

**Bloco 2 — concluir Fase 1**
- paginação server-side / `PAGE_SIZE=20`; selects mínimos; Retry padrão;
  `React.lazy` + `manualChunks`; eliminar `any` e fechar lint; soft-delete
  usando `archived_at` onde já existe; segunda aba para `lesson_progress`
  (Realtime ou `BroadcastChannel`); promover scripts de `docs/migrations/` ao
  pipeline oficial; CI no GitHub.

**Bloco 3 — desbloquear Fase 2**
- Publicar cadeia controlada: 1 curso publicado → 1 módulo publicado → 3 aulas
  publicadas com 1 vídeo, 1 material, durações preenchidas; criar 1 member,
  1 entitlement, 1 usuário sem acesso. Player embutido + fallback. QA real.

**Bloco 4 — desbloquear Fase 3**
- Criar > 20 posts (alguns fixados, autores diversos), replies, reactions,
  slug inválido, draft de composer. Testar componente + runtime + Realtime.

**Bloco 5 — reauditar** Fases 1, 2 e 3.

**Bloco 6 — Fase 4** (somente após aprovação).

## 8. Stripe (registro)

- `STRIPE_LIVE_ENABLED = false` (mantido).
- Domínio público autoritativo: pendente.
- Validação operacional ponta-a-ponta: pendente.
- Nenhuma alteração nesta auditoria.

## 9. Próximo passo

Aguardar auditoria externa. Nenhuma ação dos blocos 2–6 foi executada.

## 10. Correções aplicadas a esta auditoria

Em relação à revisão anterior dos mesmos relatórios:

1. Removida a afirmação “0 cursos / 0 módulos / 0 aulas” — substituída pelos
   contadores administrativos reais (10/10/30) e pela observação de que falta
   uma **cadeia publicada**.
2. Removido o suposto drift `courses.is_published` — não há ocorrência no
   código; o erro `42703` foi gerado pela sonda da auditoria.
3. Removido o suposto drift `lessons.video_url` — coluna real é
   `external_video_url`, adaptada para `videoUrl` no front; o que é parcial é
   a **experiência do player**, não o schema.
4. Corrigido o estado do Realtime: `community_posts`, `community_replies`,
   `community_reactions` **já estão** na publication; pendente apenas
   `lesson_progress` e a validação de assinatura no frontend.
5. Grants do schema `private` registrados como **funcionais no banco**, mas
   **não reproduzíveis** pelo pipeline oficial.
6. Nome real do trigger do admin master: `protect_designated_admin_trg`
   (a busca anterior por nome exato dava falso negativo).
7. Soft-delete: tabelas centrais (`courses`, `course_modules`, `lessons`,
   `community_posts`, `community_replies`) **já possuem `archived_at`**;
   pendência é exclusivamente no código.
8. Commit auditado (`d9d63f9`) distinguido do HEAD atual da `main`, que
   contém apenas estes relatórios — sem alteração funcional.
