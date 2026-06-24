# PHASE 2 — COMPONENT MAP (read-only)

Componentes-alvo (a criar/extrair na implementação). Tokens semânticos
do projeto, sem `--aa-*`, sem hex inline. Identidade Instrument Serif +
Manrope; primary=Chocolate, accent=Terracotta, background=Sandstone.

## Catálogo

| Componente | Localização proposta | Consumidores | Propósito |
|---|---|---|---|
| `CourseCard` | `src/manus/components/learning/CourseCard.tsx` | `Home`, `Modules` | Card capa+overlay+nº+status+lock+CTA. Variantes: `landing`, `member`. |
| `CourseProgress` | `…/learning/CourseProgress.tsx` | `CourseDetail`, `Modules` | Barra + % + "X of Y lessons". Aceita 0 aulas. |
| `LearningPath` | `…/learning/LearningPath.tsx` | `CourseDetail` | Lista vertical de módulos com estado (locked/active/done). |
| `ModuleCard` | `…/learning/ModuleCard.tsx` | `CourseDetail`, `LearningPath` | Resumo de módulo + aulas. |
| `LessonSidebar` | `…/learning/LessonSidebar.tsx` | `ModuleDetail` | Lista clicável (hash `#lesson-id`), estado completed/active. |
| `LessonPlayer` | `…/learning/LessonPlayer.tsx` | `ModuleDetail` | Estratégia embed/HTML5/iframe seguro/fallback. **Único ponto** de exibição de vídeo de aula. |
| `LessonMaterial` | `…/learning/LessonMaterial.tsx` | `ModuleDetail`, `CourseDetail` (agregado) | Render seguro de `external_resource_url`. |
| `CompletionButton` | `…/learning/CompletionButton.tsx` | `ModuleDetail` | Mark/Unmark com optimistic update + cross-tab. |
| `LessonNavigation` | `…/learning/LessonNavigation.tsx` | `ModuleDetail` | Previous/Next entre aulas (cross-módulo opcional). |
| `QuizCard` | `…/learning/QuizCard.tsx` | `ModuleDetail` (futuro) | Pergunta atual + alternativas + Previous/Next. Não nesta fase. |
| `AccessGate` | `…/learning/AccessGate.tsx` | `CourseDetail`, `ModuleDetail` | Encapsula `canAccessCourse` + estado bloqueado. |
| `QueryStateView` | já existe (`src/manus/components/QueryStateView.tsx`) | todas | Loading/error/empty/Retry padronizado. |
| `StatusBadge` | já existe (`…/admin/StatusBadge.tsx`) | reaproveitar em `CourseCard` admin | Badge Draft/Coming Soon/Available. |

## Regras

- Sem duplicação de markup entre `Home`, `Modules`, `CourseDetail`.
- Sem abstração genérica excessiva — cada componente tem 1 responsabilidade.
- Tokens via classes Tailwind (`bg-primary`, `text-foreground`, etc.).
  Proibido `bg-[#...]`, `text-white`, `bg-black`.
- `btn-gold` legado deve ser substituído por `Button` shadcn com variante
  semântica (`default`/`secondary`) — não inserir nova classe ad-hoc.

## Mapa de dados

| Componente | Lê | Escreve |
|---|---|---|
| `CourseCard` | `courses` (+ progresso agregado opcional) | — |
| `CourseProgress` | `lesson_progress` agregado | — |
| `LessonPlayer` | `lessons.external_video_url` | — |
| `CompletionButton` | `lesson_progress` | `lesson_progress` upsert + `publishCrossTabInvalidation` |
| `LessonMaterial` | `lessons.external_resource_url` | — |
| `AccessGate` | `useAuth`, `useEntitlements` | — |


---
## Update — Phase 2A implemented (2026-06-23)

See `docs/PHASE_2A_IMPLEMENTATION_REPORT.md` for the diff, gates, and test counts. Status: `PHASE_2A_STATUS = IMPLEMENTED_PENDING_EXTERNAL_AUDIT`. Stripe untouched (`STRIPE_STATUS=ADIADO`). 141/141 tests pass.

---

## Corrective closure 2026-06-24

- `Home.tsx` now consumes `CourseCard variant="landing"` for Our Courses;
  unavailable courses render Coming Soon and never expose a Stripe checkout
  CTA (asserted by `Home.test.tsx`).
- `ModuleDetail.tsx` uses `QueryStateView` for loading/error/empty for both
  module and lessons queries; progress error is isolated and displays a
  warning banner without hiding the lesson.
- `CourseDetail.tsx` shows the neutral copy "Course unavailable or you do
  not have access." instead of "not published yet". `ModuleDetail.tsx`
  shows the equivalent neutral copy for modules.
- `trpc.lessons.progress` selects `last_watched_at` and propagates it to
  `ProgressRow`; `pickResumeLessonId` uses it to drive Continue vs Start
  (covered by `learning.resume.test.ts`).
- `ModuleCard` integrated into `CourseDetail` as the "Modules overview"
  grid above the Learning Path. Not removed — actively used.
- New page tests: Home (no-Stripe), ModuleDetail lifecycle, MemberLayout
  (active state, aria-expanded, mobile menu close-after-nav).
- Gates: typecheck 0, tests 158/158, lint 0 errors, build success.
- Stripe untouched (`STRIPE_LIVE_ENABLED=false`, `STRIPE_STATUS=ADIADO`).
