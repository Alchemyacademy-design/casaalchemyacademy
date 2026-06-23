# PHASE 2 — CURRENT AUDIT (read-only, corrigida)

Confronta `docs/PHASE_2_REPORT.md` com `main` (código em `d9d63f9`).

## Dados reais (admin)

| Métrica | Valor |
|---------|-------|
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

> O banco **não está vazio**. O bloqueio é a ausência de uma cadeia publicada
> ponta a ponta: o único curso publicado **não tem** módulo nem aulas
> publicadas. Sem isso a jornada não pode ser exercitada por uma aluna.

## Schema ↔ código (correção)

| Item | Estado |
|------|--------|
| `courses.is_published` | **NÃO existe no código.** Consulta pública usa `eq("status", "published")`; schema tem `status`, `published_at`, `archived_at`. O `42703` da auditoria anterior foi erro da sonda. |
| `lessons.video_url` | **NÃO existe no código.** Coluna real é `lessons.external_video_url`; `src/manus/lib/trpc.ts` faz `videoUrl: l.external_video_url`; `ModuleDetail.tsx` consome `activeLesson.videoUrl`. Schema **alinhado**. |
| Experiência do player | **PARCIAL** — `ModuleDetail.tsx` renderiza apenas um link "Watch Video"; sem player embutido e sem fallback. |

## Componentes-chave

| Requisito | Arquivo | Estado |
|-----------|---------|--------|
| Dashboard | `src/manus/pages/Dashboard.tsx` | IMPLEMENTADO, depende de cadeia publicada |
| My Courses | `src/manus/pages/Modules.tsx` | IMPLEMENTADO, idem |
| Course Detail | `src/manus/pages/CourseDetail.tsx` | IMPLEMENTADO, idem |
| Module Detail (hash `#lesson-id`, prev/next, mark/unmark) | `src/manus/pages/ModuleDetail.tsx` + `ModuleDetail.test.tsx` | ✅ EM COMPONENTE / TESTADO |
| Progresso (mark/unmark + invalidação) | `ModuleDetail.tsx` | ✅ EM COMPONENTE |
| Persistência 2ª aba | — | ❌ PENDENTE (`lesson_progress` fora da publication `supabase_realtime`) |
| Player embutido + fallback | `ModuleDetail.tsx` | ❌ PARCIAL (apenas link externo) |
| Materiais / duração total / Learning Path | `ModuleDetail.tsx` | ❌ PENDENTE NO CÓDIGO + dados (0 materiais, 0 durações) |
| Membership / Entitlement gating | `GlobalAccessController.tsx`, `useAuth.access.test.ts` | ✅ EM COMPONENTE (parcial) |
| Certificate | `CertificateSection.tsx` | IMPLEMENTADO, NÃO VALIDADO |
| Busca / filtros | `Modules.tsx`, `Guides.tsx` | NÃO VALIDADO |
| Loading / error / empty / Retry | parcial | ⚠ PARCIAL |
| Responsividade / acessibilidade | — | NÃO AUDITADO nesta passada |

## Testes que cobrem a Fase 2

- `src/manus/services/learning.test.ts`
- `src/manus/pages/ModuleDetail.test.tsx`
- `src/manus/services/billing-runtime.test.ts`
- `src/manus/hooks/useAuth.access.test.ts`

Nenhum E2E ou teste de integração com banco real.

## FASE_2_STATUS

`FASE_2_STATUS = PARCIAL_E_BLOQUEADA_PELA_PUBLICACAO_DOS_DADOS`

A estrutura está implementada e parcialmente testada em componente. O bloqueio
é a **ausência de uma cadeia publicada** (1 curso publicado, 0 módulos
publicados, 0 aulas publicadas). Schema de vídeo está alinhado; o que é
parcial é a experiência do player.
