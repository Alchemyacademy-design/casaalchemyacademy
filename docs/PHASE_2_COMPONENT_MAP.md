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
