
# Gestão de Cursos — plano de implementação faseado

O que você pediu é do tamanho de um produto Hotmart/Kiwify inteiro (14 seções, 20 critérios de aceite, ~15 tabelas novas, editor em blocos, versionamento, assistente de IA, aulas ao vivo, cohorts, gotejamento etc.). Fazer tudo num único turno inevitavelmente quebra o app em produção. Abaixo o plano que respeita as regras que você impôs (não recriar app, não apagar tabelas, reaproveitar o que já existe, migrations incrementais).

## Fase 1 — Análise (já feita agora)

O que **já existe e será reaproveitado** (nada será recriado):

```
courses (15 col) · course_modules · lessons · course_entitlements
lesson_progress · lesson_ratings · lesson_comments
quizzes · quiz_questions · quiz_options · quiz_attempts · quiz_answers
membership_plans · memberships · plan_permissions
user_roles (app_role: admin, …) · profiles
stripe_prices/products/subscriptions/webhook_events
community_* · magazine_issues · certificates · registrations
Storage bucket: public-assets (público)
Edge fns: admin-content-create/-catalog, submit-quiz-attempt,
         get-admin-quiz, lesson-video-url, stripe-webhook, …
Frontend: /admin/courses (list + editor com drag-and-drop, quiz editor,
          upload de vídeo/thumb, publish checklist, "view as member")
```

O que **falta** para bater a matriz que você descreveu:

1. Papéis extras: `content_manager`, `instructor` (hoje só `admin`).
2. Metadados de curso: `subtitle` já existe; faltam `short_description`, `banner_url`, `trailer_url`, `category_id`, `instructor_id`, `language`, `level`, `estimated_duration`, `has_certificate`, `is_featured`, `scheduled_publish_at`, `visibility`, `access_type`, `release_type`.
3. Módulos com liberação/gotejamento: `release_type`, `release_after_days`, `release_at`, `prerequisite_module_id`.
4. Aulas com liberação/gotejamento + flags: `is_mandatory`, `is_preview` (existe), `allow_comments`, `allow_download`, `release_*`, `prerequisite_lesson_id`, `lesson_type`.
5. **Editor em blocos**: `lesson_blocks` (id, lesson_id, block_type, content jsonb, settings jsonb, position, is_visible).
6. `lesson_attachments` (arquivos servidos por Storage privado + signed URLs).
7. `course_categories` + `course_tags` + `course_tag_map`.
8. `course_audit_logs` (quem/o quê/quando; antes/depois em jsonb).
9. Bucket de Storage **privado** `course-assets` (para PDFs/vídeos protegidos) + policies. `public-assets` continua para capas.
10. Extensão do enum `content_status` com `in_review` e `scheduled` (mantendo `draft/published/archived`).

## Fase 2 — Banco e segurança (única migration, aditiva, reversível)

- ALTER TYPE `app_role` ADD `content_manager`, `instructor`.
- ALTER TYPE `content_status` ADD `in_review`, `scheduled`.
- ALTER TABLE `courses` ADD colunas listadas acima (todas nullable/defaults).
- ALTER TABLE `course_modules` / `lessons` ADD colunas de liberação e flags.
- CREATE TABLE `lesson_blocks`, `lesson_attachments`, `course_categories`, `course_tags`, `course_tag_map`, `course_audit_logs` — todas com `GRANT` para authenticated/service_role e RLS.
- Bucket **privado** `course-assets` via `supabase--storage_create_bucket` + policies em `storage.objects` (admins full; instrutores só nos cursos deles; alunos com entitlement recebem signed URL via edge fn).
- Policies novas em cada tabela usando `has_role(uid,'admin')` + `has_role(uid,'content_manager')` + verificação de `instructor_id = auth.uid()`; nenhuma policy existente é apagada, só adicionada `admin_full_access` já cobre admin.
- Trigger `course_audit_logs` (AFTER UPDATE/DELETE em `courses/course_modules/lessons/lesson_blocks`).
- Índices em `lessons(course_id, module_id, position)`, `lesson_blocks(lesson_id, position)`, `course_enrollments(user_id, course_id)`, `lesson_progress(user_id, lesson_id)`.
- Constraint anti-matrícula-duplicada: hoje `course_entitlements` é o equivalente — vou reaproveitá-la em vez de criar `course_enrollments` (evita duplicar dado que Stripe/webhook já grava).

## Fase 3 — Admin (Gestão de Cursos)

- Rota `/admin/courses` renomeada visualmente para **"Gestão de Cursos"** (URL preservada para não quebrar links).
- Lista com: busca, filtros (status/instrutor/categoria/data), ordenação, cards+tabela, paginação server-side, contadores (aulas, matriculados via `course_entitlements`, progresso médio via `lesson_progress`), última atualização.
- Menu por curso: Editar, Visualizar como aluno (já existe), Duplicar, Publicar/Despublicar, Arquivar, Excluir (soft), Gerenciar alunos (nova rota `/admin/courses/:id/students`), Ver desempenho (`/admin/courses/:id/analytics`).
- Assistente **"Criar novo curso"** em 4 etapas (stepper) com salvar-como-rascunho a cada passo.
- Construtor 3 colunas: estrutura (dnd) · editor de blocos (novo, ver Fase 3b) · configurações da aula.

### Fase 3b — Editor em blocos

- Componente `LessonBlockEditor` com registry de blocos (text/heading/image/video/audio/file/pdf/link/button/callout/checklist/code/quiz/embed…). Cada bloco = row em `lesson_blocks`, `content` jsonb, autosave debounced (800 ms) com indicador "Salvando…/Salvo".
- Upload usa Storage privado (`course-assets/course-{id}/lesson-{id}/…`), retorna path + metadata (não bytes).
- Beforeunload guard quando há mudanças pendentes.

## Fase 4 — Área do aluno

- Página `/courses/:id` já existe: acrescentar respeito a `release_at/release_after_days/prerequisite_*`, mostrar aulas bloqueadas com motivo, retomada pelo `lesson_progress.last_position_seconds`.
- `lesson-video-url` (edge fn) passa a emitir signed URL de 15 min para arquivos em `course-assets`.

## Fase 5 — Avançado

Duplicação inteligente, versionamento (`course_versions`), assistente de IA (Lovable AI Gateway), analytics agregado, aulas ao vivo, cohorts, publicação agendada (worker/cron). Cada item vira PR próprio.

## Como quero executar

Ao invés de despejar 3 mil linhas de código de uma vez (e certamente quebrar o app), proponho executar **fase por fase, cada fase é 1 turno**:

- **Turno agora** (se você aprovar este plano): entrego **Fase 2 completa** — a migration incremental com todas as colunas/tabelas/policies/bucket privado. Nenhuma UI muda ainda, nenhum dado atual é perdido.
- Turno seguinte: **Fase 3** (Gestão de Cursos + assistente de criação).
- Turno seguinte: **Fase 3b** (editor em blocos).
- Turno seguinte: **Fase 4** (bloqueio/gotejamento no aluno).
- Turno seguinte: **Fase 5** (avançado, à la carte).

Se você preferir outra ordem (por exemplo pular direto para o editor de blocos, ou começar por categorias/tags), me diz antes que eu execute a Fase 2.

## Confirmação necessária

Responda **"pode aplicar Fase 2"** para eu abrir a migration única aditiva (papéis + colunas + tabelas novas + bucket privado + policies + índices + trigger de auditoria). Sem essa base as fases seguintes não têm onde gravar dado.
