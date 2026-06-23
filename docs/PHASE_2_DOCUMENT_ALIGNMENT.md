# PHASE 2 — DOCUMENT × CODE ALIGNMENT (read-only)

Reference: `Alchemy_Academy_—_Documentação_Completa_da_Seção_Courses.pdf`
(v1.0, 23 Jun 2026). Code snapshot: current `main`.

## 0. Identidade visual — regra

O PDF usa a identidade **histórica** (Cormorant Garamond, DM Sans, olive,
gold, cream — `--aa-*`). O projeto canônico atual usa **Instrument Serif,
Manrope, Chocolate, Terracotta, Sandstone** (tokens semânticos em
`src/index.css` + `tailwind.config.ts`).

**Regra de tradução (aplicada em todas as etapas abaixo):**

| Histórico (PDF) | Atual (projeto) |
|---|---|
| Cormorant Garamond | Instrument Serif |
| DM Sans | Manrope |
| `--aa-olive-dark` `#3D3A2A` | `primary` (Chocolate) |
| `--aa-gold` `#C4A05A` | `accent` (Terracotta) |
| `--aa-cream` `#F5F0E8` | `background` / Sandstone |
| `--aa-olive-light` | `muted-foreground` |

Não inserir hex antigo nem `--aa-*` em componente.

## 1. Modelo de domínio

| PDF | Código | Decisão |
|---|---|---|
| Os "9 módulos" da landing | linhas em `courses` | Tratar como **cursos**. Renomear na UI: "Courses". |
| Módulos internos do curso | `course_modules` | Permanecem como módulos. |
| Aulas | `lessons` | Sem mudança. |

## 2. Matriz de superfícies

| Superfície | Requisito do PDF | Estado atual | Diferença | Ação |
|---|---|---|---|---|
| `Home` — seção "Our Courses" | Eyebrow "The Curriculum", título "Our Courses", grid 1/2/3/4, cards com capa+overlay+nº+status+lock+CTA | `src/manus/pages/Home.tsx` renderiza grid de cursos | Eyebrow / hierarquia / `CourseCard` reutilizável não destacados; CTAs financeiros não verificados (Stripe ADIADO) | **PARCIAL** — extrair `CourseCard`, ajustar tokens, neutralizar "Buy Now"/"Join" para "Coming Soon" enquanto Stripe adiado |
| `/mycourses` (`Modules.tsx`) | Header "The Curriculum / Courses Available", grid 1/2/3, badges Draft/Coming Soon/Available, busca, filtros, loading/error/empty/Retry | `Modules.tsx` lista cursos com `access_plan_keys` e usa `canAccessCourse`. Admin vê drafts via path admin separado | Header/eyebrow ausentes; busca/filtros não confirmados; `QueryStateView`/Retry parcial | **PARCIAL** — adicionar header semântico, busca, filtros, estados padronizados, badges |
| `/courses/:id` (`CourseDetail.tsx`) | Overview do curso: capa, descrição, duração total, progresso, módulos, aulas, Learning Path, Start/Continue | Mostra capa + lista módulos/aulas, mas embute `VideoPreview` da aula ativa | **DESALINHADO**: detalhe de aula vaza para overview; falta Learning Path, duração total, Start/Continue explícitos | **PARCIAL** — separar overview puro; mover player para `/modules/:id` |
| `/modules/:id` (`ModuleDetail.tsx`) | Sticky header, progress bar, sidebar de aulas com hash, player 16:9, Mark Complete, Previous/Next, materiais | Existe layout e mark/unmark, hash `#lesson-id`, Previous/Next testados; player atual = link externo "Watch Video" + `btn-gold` | **PENDENTE**: player real; uso de utilitário legado `btn-gold` | **PENDENTE** — implementar `LessonPlayer` com URL embed/HTML5/iframe seguro/fallback; substituir `btn-gold` por variante de design system |
| `MemberLayout.tsx` | Sidebar desktop, mobile drawer, itens fixos, Admin link condicional | Implementado, inclui Admin Center | A11y/active state/foco a auditar | **JÁ_IMPLEMENTADO** (auditar a11y) |
| Materiais (PDF §5) | `external_resource_url` exibido com nome/tipo/domínio/abrir | Botão "Open" simples em `CourseDetail` e `ModuleDetail` | Falta metadados visíveis | **PARCIAL** — `LessonMaterial` component |
| Progresso (PDF §5/§4) | mark/unmark, %, retomada, sync entre abas | `lesson_progress` + invalidação cross-tab via `cross-tab-query-sync` (Fase 1) | Realtime DB ausente — sync por BroadcastChannel | **PARCIAL** — aceitável; realtime fica como NÃO_APLICA_PRÉ_LANÇAMENTO |
| Quiz (PDF não detalha) | Schema `quizzes/quiz_questions/quiz_options/quiz_attempts/quiz_answers` existe | Sem UI | **PENDENTE** — planejar UI sem migration |
| Certificate | `CertificateSection.tsx` | Implementado, não validado | **PARCIAL** |
| Rating (PDF §4) | Card "Rate this module" | Sem schema atual | **DESATUALIZADO_NO_PDF** — não implementar nesta fase |
| Subscribe / Buy Now / Join | CTAs vão para checkout | Stripe ADIADO | **NÃO_APLICA_PRÉ_LANÇAMENTO** — manter desabilitado/Coming Soon |
| Asset paths `/manus-storage/*` | Capas e logo do PDF | Projeto usa tokens e assets próprios | **DESATUALIZADO_NO_PDF** — ignorar paths literais |
| Identidade `--aa-*`, Cormorant, DM Sans | aplicado em snippets do PDF | Não aplicado no projeto | **DESATUALIZADO_NO_PDF** — usar mapeamento da seção 0 |

## 3. Schema vs PDF

| Campo PDF | Campo banco | Estado |
|---|---|---|
| `course.cover` | `courses.cover_image_path` | OK |
| `course.subtitle` | `courses.subtitle` | OK |
| `course.access_plan_keys` | OK | OK |
| `lesson.video_url` | `lessons.external_video_url` | OK (alinhado) |
| `lesson.materials` | `lessons.external_resource_url` (1 URL) | LIMITADO — PDF sugere múltiplos; aceitar 1 nesta fase |
| `lesson.duration` | `lessons.duration_seconds` | OK no schema; **0 linhas preenchidas** |
| `lesson.is_preview` | OK | OK |

## 4. Classificação consolidada

- **JÁ_IMPLEMENTADO**: rotas, `MemberLayout`, mark/unmark, hash, Previous/Next, cross-tab sync, `canAccessCourse`, `VideoPreview` parcial.
- **PARCIAL**: `Home`/`Modules` headers e busca/filtros, `CourseDetail` overview puro, materiais com metadados, certificado.
- **PENDENTE**: `LessonPlayer` seguro em `ModuleDetail`, Quiz UI, durações/learning path.
- **DESATUALIZADO_NO_PDF**: paleta `--aa-*`, fontes Cormorant/DM Sans, paths `/manus-storage`, "9 módulos", Rating.
- **NÃO_APLICA_PRÉ_LANÇAMENTO**: CTAs Stripe, realtime DB de progresso, certificados/quiz reais.

## 5. Confirmação

Nenhum arquivo de código, schema, RLS, migration, secret ou dado foi
alterado nesta execução.
