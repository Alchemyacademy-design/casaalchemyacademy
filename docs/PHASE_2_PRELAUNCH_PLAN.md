# PHASE 2 — PRE-LAUNCH IMPLEMENTATION PLAN (read-only)

Contexto: pré-lançamento. Sem usuários reais. Stripe ADIADO
(`STRIPE_LIVE_ENABLED=false`). Nada é implementado nesta execução.

## 1. Inventário dos cursos (a coletar antes da implementação)

A consulta administrativa anterior reportou:

- `courses_total = 10`, `published = 1`, `draft = 9`
- `course_modules_total = 10`, `published = 0`, `draft = 10`
- `lessons_total = 30`, `published = 0`, `draft = 30`,
  `with_external_video_url = 1`, `with_resource = 0`, `with_duration = 0`
- `lesson_progress = 0`

A query pública via `anon` retorna `[]` (esperado, RLS oculta drafts e
acesso restrito). Antes de iniciar a implementação a equipe deve rodar
**como admin** a query abaixo (read-only) e anexar o resultado a este doc:

```sql
select c.id, c.slug, c.title, c.subtitle, c.status, c.cover_image_path,
       c.access_plan_keys, c.published_at, c.archived_at,
       (select count(*) from course_modules m
          where m.course_id = c.id and m.archived_at is null) as modules,
       (select count(*) from lessons l
          join course_modules m on m.id = l.module_id
          where m.course_id = c.id and l.archived_at is null) as lessons,
       (select count(*) from lessons l
          join course_modules m on m.id = l.module_id
          where m.course_id = c.id and l.external_video_url is not null) as with_video,
       (select count(*) from lessons l
          join course_modules m on m.id = l.module_id
          where m.course_id = c.id and l.external_resource_url is not null) as with_material,
       (select coalesce(sum(l.duration_seconds),0) from lessons l
          join course_modules m on m.id = l.module_id
          where m.course_id = c.id) as duration_total
from courses c
order by c.id;
```

## 2. Recomendação do curso piloto

**Pendente de aprovação humana.** Critério recomendado para escolha:

1. Maior `lessons` + `modules` com `external_video_url` preenchido.
2. Possuir `cover_image_path`, `subtitle`, `description`.
3. Já estar `status = 'published'` ou ser o mais próximo de publicar.

O único curso atualmente publicado é candidato natural; se o título for
"The Path to a Colourful Life" (como sugere o PDF), confirmar pela query.
**Não publicar nenhum outro curso nesta execução.**

## 3. Plano de implementação (etapas sequenciais)

Cada etapa abre PR isolado, com testes, sem tocar Stripe/schema.

### E1 — Componentização base (sem regressão)

Extrair, sem mudar comportamento:

- `CourseCard` (usado em `Home`, `Modules`)
- `CourseProgress`, `LearningPath`
- `ModuleCard`
- `LessonSidebar`, `LessonNavigation`
- `LessonMaterial`
- `CompletionButton`
- `LessonPlayer` (esqueleto)
- `AccessState` (wrapper já parcialmente em `services/learning.ts`)

### E2 — `/mycourses` alinhado ao PDF

- Header eyebrow "The Curriculum" + título "Courses Available".
- Grid responsivo 1/2/3 (mobile/sm/lg). XL=4 apenas na landing.
- Busca debounced + filtro por status (admin) e por acesso (membro).
- Estados via `QueryStateView` com Retry.
- CTAs financeiros → "Coming Soon" enquanto Stripe ADIADO; **não chamar
  `create-checkout-session`** nem `SubscribeModal` para checkout real.

### E3 — `/courses/:id` como overview puro

- Remover `VideoPreview` da overview; mover para `/modules/:id`.
- Adicionar duração total (soma `duration_seconds`), progresso geral,
  contagem de módulos/aulas, Learning Path, Start/Continue (deep-link
  para `#lesson-id`), materiais agregados.
- Preview admin (drafts) com badge "DRAFT".

### E4 — `LessonPlayer` seguro em `/modules/:id`

Estratégia em ordem:

1. **URL embed**: detectar YouTube/Vimeo a partir de regex restrita e
   montar URL `embed/` canônica (`youtube.com/embed/<id>` ou
   `player.vimeo.com/video/<id>`) servida em `<iframe>` com
   `sandbox="allow-scripts allow-same-origin allow-presentation"`,
   `referrerpolicy="strict-origin-when-cross-origin"`, sem autoplay,
   `title` acessível, `loading="lazy"`.
2. **Arquivo direto** (`.mp4`/`.webm`): `<video controls preload="metadata">`.
3. **Provider permitido extra**: lista branca configurável.
4. **Fallback**: card com link externo (`rel="noopener noreferrer"
   target="_blank"`) — comportamento atual.
5. **Sem vídeo**: estado "Coming soon" com Mark Complete ainda disponível
   se permitido.
6. **Erro de carregamento**: capturar via `onError`, mostrar fallback link.

Proibido: HTML arbitrário, `srcdoc`, iframe de domínio não validado,
autoplay, `dangerouslySetInnerHTML` em conteúdo de vídeo.

### E5 — Materiais

`LessonMaterial`: nome (fallback = hostname), tipo (inferir extensão),
domínio visível, botão Abrir/Baixar conforme MIME, `rel="noopener
noreferrer"`, estado vazio.

### E6 — Progresso (sem dados reais)

- Validar com mocks: marcar, desmarcar, %, retomada, Previous/Next,
  cursos sem aulas, aulas/módulos arquivados invisíveis.
- Sync entre abas continua via `cross-tab-query-sync` (Fase 1). Realtime
  DB **não** será ligado nesta fase.

### E7 — Quiz (planejamento)

Schema já existe (`quizzes/quiz_questions/quiz_options/quiz_attempts/
quiz_answers`). Auditar PKs/FKs antes de UI. UI: questão atual,
Previous/Next, seleção, submissão, resultado, tentativa, persistência,
regra de aprovação. **Sem migration nesta análise**. Sem rating.

### E8 — Certificado

Auditar `CertificateSection.tsx` e tabela `certificates`. Regra:
100% concluído + quiz aprovado (quando houver). Emissão única. Preview
admin sem emissão real. **Não emitir certificados** nesta fase.

### E9 — MemberLayout (a11y polish)

Active state via `NavLink`/`useLocation`, `aria-label` no toggle mobile,
foco visível, fechamento do drawer ao navegar, sticky + scroll.

### E10 — Responsividade final

- Mobile 1 col, padding reduzido, sidebar de aulas como `<details>` ou
  drawer.
- `sm` 2 cols catálogo, `lg` 3 cols + grid 3/1 em Module Detail, `xl`
  até 4 cols **apenas** na landing.
- Sem scroll horizontal; player 16:9 com `aspect-video`.

## 4. Decisões pré-lançamento

| Item | Decisão |
|---|---|
| Stripe | ADIADO. Botões financeiros → "Coming Soon" não destrutivo. |
| Memberships/Entitlements/Progress/Cert reais | Mantidos em 0. Não criar. |
| Publicação de cursos | Apenas o piloto aprovado, em PR separado. |
| Schema | Não alterar. |
| RLS / migrations / secrets | Não alterar. |
| Fontes/cores `--aa-*` do PDF | Não inserir. Mapeamento atual. |

## 5. Arquivos que *seriam* alterados (escopo previsto)

- `src/manus/pages/Home.tsx` (E1, E2)
- `src/manus/pages/Modules.tsx` (E1, E2)
- `src/manus/pages/CourseDetail.tsx` (E1, E3)
- `src/manus/pages/ModuleDetail.tsx` (E1, E4, E5, E9)
- `src/manus/components/MemberLayout.tsx` (E9)
- novos: `src/manus/components/learning/CourseCard.tsx`,
  `CourseProgress.tsx`, `LearningPath.tsx`, `ModuleCard.tsx`,
  `LessonSidebar.tsx`, `LessonPlayer.tsx`, `LessonMaterial.tsx`,
  `CompletionButton.tsx`, `LessonNavigation.tsx`
- testes correspondentes em `*.test.tsx`
- `src/index.css` (apenas se faltar utilitário; sem cores hex)
- `docs/PHASE_2_*` (atualizações)

**Não alterar:** `supabase/migrations/**`, `supabase/functions/**`
financeiras, secrets, `src/integrations/supabase/types.ts`.

## 6. Confirmação

Esta execução é planejamento. Nenhum arquivo de código, schema, dado,
RLS, migration ou secret foi modificado.


---
## Update — Phase 2A implemented (2026-06-23)

See `docs/PHASE_2A_IMPLEMENTATION_REPORT.md` for the diff, gates, and test counts. Status: `PHASE_2A_STATUS = IMPLEMENTED_PENDING_EXTERNAL_AUDIT`. Stripe untouched (`STRIPE_STATUS=ADIADO`). 141/141 tests pass.
