
# Painel Administrativo de Conteúdo — Cursos / Módulos / Aulas

Escopo desta execução: construir o CRUD admin + importador do `alchemy_content_import_template.json` como **draft**. Sem Stripe. Sem novo banco. Sem alterar schema (as tabelas já têm todos os campos necessários).

## Confirmação prévia de schema

Verifiquei `src/integrations/supabase/types.ts`. Tabelas e colunas existentes batem 100% com o que o comando exige:

- `public.courses` — slug, title, subtitle, description, cover_image_path, external_landing_url, access_plan_keys, status, sort_order, published_at, archived_at, created_by.
- `public.course_modules` — course_id, title, description, cover_image_path, access_plan_keys, status, sort_order, published_at, archived_at.
- `public.lessons` — module_id, title, description, content_text, external_video_url, external_resource_url, duration_seconds, is_preview, status, sort_order, published_at, archived_at.
- Enum `content_status` (draft/published/archived) já presente.

**Não vou criar migrations** — apenas se um campo extra (ex.: `legacy_lesson_id`) for indispensável. Como o pack guarda `legacy_*` apenas para auditoria, vou armazenar isso em memória local na tela de importação (e exportar um relatório JSON) em vez de poluir o schema.

## Rotas novas

- `/admin/courses` — lista de cursos (todos os status) com busca, filtro por status, botão "New course", botão "Import Manus".
- `/admin/courses/new` — formulário de criação.
- `/admin/courses/:courseId` — edição do curso + lista de módulos (drag-handle de ordem, criar/editar/arquivar inline).
- `/admin/courses/:courseId/modules/:moduleId` — edição do módulo + lista de aulas (reordenar, criar/editar/arquivar inline).
- `/admin/courses/:courseId/modules/:moduleId/lessons/:lessonId` — edição completa da aula (campos do comando + checklist de publicação).
- `/admin/content-import` — importador do JSON Manus.

Todas atrás de `<AdminGuard>` (já existente, usa role `admin` server-side via `auth-me`). Sem checagem por e-mail no frontend.

## Componentes/arquivos novos

```
src/manus/pages/admin/
  AdminCoursesList.tsx
  AdminCourseForm.tsx          // new + edit
  AdminCourseDetail.tsx        // edit course + módulos
  AdminModuleDetail.tsx        // edit module + aulas
  AdminLessonDetail.tsx        // edit lesson
  AdminContentImport.tsx       // importador JSON
src/manus/lib/admin-content.ts // helpers supabase: list/create/update/reorder/publish/archive
src/manus/components/admin/
  StatusBadge.tsx
  ReorderableList.tsx          // setas up/down (sem libs extras)
  PublishChecklist.tsx         // valida antes de "Publish"
  ThumbnailField.tsx           // upload p/ bucket public-assets + preview + URL manual
src/manus/data/manus-import.json   // cópia local do alchemy_content_import_template.json
```

Arquivos alterados:

- `src/App.tsx` — registrar as 6 rotas.
- `src/manus/pages/AdminPanel.tsx` — adicionar card "Manage Courses" e "Import Manus content".
- `src/components/AdminGuard.tsx` — sem mudança funcional (já valida via `useAuth.isAdmin`).

## CRUD — regras

- Todas as escritas via cliente Supabase nativo (`@/integrations/supabase/client`), confiando em RLS (`has_role(auth.uid(),'admin')`).
- `status` muda via ações dedicadas: **Save draft**, **Publish** (seta `published_at=now()`, `archived_at=null`), **Archive** (seta `archived_at=now()`, `status='archived'`), **Restore to draft**.
- Reordenação: setas ↑/↓ atualizam `sort_order` em transação cliente (update individual; lista pequena, ok).
- Slug do curso: input + botão "auto" a partir do title; valida unicidade no submit (catch error 23505).
- `access_plan_keys`: multi-select com enum `membership_plan_key`.

## Aulas

- Edição completa: title, description, content_text (textarea), external_video_url, external_resource_url, duration_seconds (minutos+segundos), is_preview (toggle), sort_order.
- **PublishChecklist** bloqueia "Publish" quando:
  - `external_video_url` vazio OU contém `/manus-storage/` OU `placeholder-video.mp4`.
  - title vazio.
- Mostra preview do vídeo (iframe genérico) se URL parece YouTube/Vimeo.

## Thumbnails

- `ThumbnailField` aceita:
  1. Upload p/ bucket `public-assets` (já existe, público) em `course-covers/`, `module-covers/`, `lesson-covers/` (lessons não têm coluna; só curso/módulo).
  2. URL manual (caminhos legacy `/manus-storage/...` aceitos mas marcados em vermelho como "missing asset").
- Renderiza preview e badge de aviso quando o path começa com `/manus-storage/`.

## Importador `/admin/content-import`

Fluxo:

1. JSON do pack já embarcado como `src/manus/data/manus-import.json` (também aceita upload `.json` manual para versões futuras).
2. Mostra **dry-run**: cards de cursos/módulos/aulas que serão criados, com avisos do pack.
3. Botão "Import as draft" → cria/atualiza por slug+lesson_number:
   - `courses` upsert por `slug` (status='draft').
   - `course_modules` insert (1 módulo "Course lessons" por curso, sort_order=1).
   - `lessons` upsert por `(module_id, sort_order)` com status='draft'.
4. Nenhuma URL placeholder vai para `external_video_url` — campo fica `null` e a aula entra como draft.
5. Relatório final no UI + download `import-report.json`: cursos importados, aulas importadas, links faltantes, thumbnails faltantes (paths `/manus-storage/...`), divergências.

## Segurança

- Admin only via `<AdminGuard>` (server-side role check).
- Nenhum uso de service role no frontend.
- Nenhuma checagem por e-mail.
- RLS já existente nas tabelas controla escrita.

## Fora de escopo (próximas fases)

- Preencher `links_a_preencher.csv` (Fase 4) — feito pelo admin via UI depois.
- Recuperar thumbnails reais (Fase 5).
- Comunidade/Eventos/Workshops/Revista/Fornecedores/Ofertas (Fase 7).
- Stripe (Fase 8).

## Entregáveis no final da execução

- Rotas criadas (lista acima).
- Arquivos criados/alterados (lista acima).
- Resultado do dry-run do importador: 4 cursos / 12 aulas detectadas no pack (com base no JSON anexado).
- Lista de links faltantes e thumbnails faltantes geradas pelo importador.
- Resultado de build/typecheck (rodado automaticamente).

Aprove para eu começar a implementar.
