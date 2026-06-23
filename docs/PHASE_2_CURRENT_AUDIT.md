# PHASE 2 — CURRENT AUDIT (read-only)

Confronta `docs/PHASE_2_REPORT.md` com o código em `main` (commit `d9d63f9`).

## Dados reais (REST anon)

| Métrica | Valor observado | Comentário |
|---------|-----------------|------------|
| `courses` visíveis | **0** | nada publicado, ou todos `draft` |
| `course_modules` visíveis | **0** | idem |
| `lessons` visíveis | **0** | idem |
| `lesson_progress` | não auditável via anon | depende de sessão |
| `certificates` / `memberships` / `course_entitlements` | não auditáveis via anon | RLS scope = `auth.uid()` |
| `community_spaces` | 1 | `alchemy-tribe` |
| `community_channels` | 5 | `general, questions, projects, inspiration, resources` |

Conclusão imediata: **todos os fluxos de aluna que dependem de cursos
publicados estão `BLOQUEADO PELOS DADOS`** — nenhuma curso/módulo/aula chega ao
front via RLS pública.

## Inconsistências schema ↔ código

| Referência no código | Coluna esperada | Resposta REST | Estado |
|----------------------|-----------------|---------------|--------|
| `courses.is_published` (várias telas, p.ex. `usePublicContent`) | `is_published` | `42703 column does not exist` | REGRESSÃO potencial — o schema usa `status` |
| `lessons.video_url` | `video_url` | `42703` | REGRESSÃO potencial — vídeo pode estar em outra coluna (`video_id`, `video_path`) |

(Não corrigir nesta execução — registrar.)

## Componentes-chave

| Requisito | Arquivo | Estado | Evidência |
|-----------|---------|--------|-----------|
| Dashboard | `src/manus/pages/Dashboard.tsx` | IMPLEMENTADO, NÃO VALIDADO | renderiza mas depende de cursos publicados |
| My Courses | `src/manus/pages/Modules.tsx` | IMPLEMENTADO, NÃO VALIDADO | idem |
| Course Detail | `src/manus/pages/CourseDetail.tsx` | IMPLEMENTADO, NÃO VALIDADO | |
| Module Detail | `src/manus/pages/ModuleDetail.tsx` | IMPLEMENTADO E UNITARIAMENTE TESTADO | `ModuleDetail.test.tsx` cobre seleção via hash e fallback |
| Progresso (mark/unmark, persistência, refresh) | `ModuleDetail.tsx` (mutation `progress.markLesson`) | IMPLEMENTADO E VALIDADO EM COMPONENTE | invalida `lessons.progress` e `progress.moduleProgress` |
| Persistência segunda aba | — | PENDENTE | Realtime não habilitado |
| Previous / Next | `ModuleDetail.tsx` linhas finais | IMPLEMENTADO E VALIDADO EM COMPONENTE | |
| Mark / Unmark | `ModuleDetail.tsx` (handleToggleLesson) | IMPLEMENTADO E VALIDADO EM COMPONENTE | |
| Video player | `activeLesson.videoUrl` link externo | PARCIAL | é apenas link “Watch Video”, não player embutido; sem fallback explícito |
| Materiais / duração total | não encontrados em `ModuleDetail.tsx` | PENDENTE | nenhuma exibição de `materials` / `duration_seconds` somada |
| Last lesson / Continue / Start | hash `#lesson-<id>` em `ModuleDetail` | IMPLEMENTADO E UNITARIAMENTE TESTADO | `ModuleDetail.test.tsx` |
| Membership/Entitlement gating | `src/manus/components/GlobalAccessController.tsx` | IMPLEMENTADO E UNITARIAMENTE TESTADO (parcial) | `useAuth.access.test.ts` cobre `isAdmin/isMember/hasCourseAccess`; runtime não exercido |
| Certificate / estado sem certificado | `src/manus/components/CertificateSection.tsx` | IMPLEMENTADO, NÃO VALIDADO | depende de dados de `certificates` |
| Learning Path visual | não encontrado | PENDENTE | |
| Busca / filtros | `Modules.tsx` / `Guides.tsx` | NÃO VALIDADO | exige runtime |
| Loading / error / empty / retry | parcial | PARCIAL | `ModuleDetail` exibe "No lessons available" sem botão Retry |
| Responsividade / acessibilidade / tipografia | não auditadas nesta passada | NÃO VALIDADO | |

## Testes que cobrem a Fase 2

- `src/manus/services/learning.test.ts` — helper puro
- `src/manus/pages/ModuleDetail.test.tsx` — componente (hash, fallback, navegação)
- `src/manus/services/billing-runtime.test.ts` — helper puro (gating)
- `src/manus/hooks/useAuth.access.test.ts` — unitário (entitlements)

Nenhum teste de integração com banco real ou E2E.

## FASE_2_STATUS

`FASE_2_STATUS = BLOQUEADA_PELOS_DADOS`

Mesmo que a estrutura esteja `IMPLEMENTADO E VALIDADO EM COMPONENTE`, **0
cursos / módulos / aulas chegam ao front via RLS pública**, e há suspeita de
REGRESSÃO em colunas (`courses.is_published`, `lessons.video_url`). Não declarar
concluída.
