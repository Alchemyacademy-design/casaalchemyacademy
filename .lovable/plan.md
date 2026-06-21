## Objetivo

Reestruturar a área administrativa para ficar simples e direta, garantir que o admin tenha acesso total à plataforma (membros, comunidade, cursos), e renderizar imediatamente o conteúdo do pacote Manus com thumbnails e player de vídeo funcionando.

## 1. Acesso total do administrador

Hoje o `GlobalAccessController` já libera tudo para `isAdmin`, mas há páginas (CourseDetail, Modules, Community, etc.) que ainda checam `isMember`/`hasCourseAccess` localmente. Vou auditar e adicionar bypass `isAdmin` em todos os guards de página/conteúdo (mycourses, courses/:id, community, suppliers, events, magazine, live-workshops, dashboard) para que o admin veja **tudo publicado ou em draft**, sem precisar de assinatura.

Também: no `GlobalAccessController`, permitir que admin acesse rotas `/admin/*` sem qualquer checagem de plano.

## 2. Importação automática do Manus (sem clicar em botão)

- Substituir `src/manus/data/manus-import.json` pelo conteúdo do novo `alchemy_content_import_template.json` enviado (10 cursos, 30 aulas).
- Disparar a edge function `manus-import` automaticamente uma vez, persistindo cursos/módulos/aulas como `draft`.
- Subir as 9 thumbnails reais (`/manus-storage/course-*.png`) extraídas do ZIP para o bucket `public-assets/courses/` e gravar a URL pública em `courses.cover_image_path`.
- Gerar `import-report.json` em `/mnt/documents/` com: cursos/módulos/aulas criados, links faltantes (todas as 30 aulas com `external_video_url` nulo), thumbnails OK vs. faltantes.

## 3. Admin de conteúdo simplificado — uma tela só por curso

Substituir o fluxo atual de 3 níveis (curso → módulo → aula em páginas separadas) por **uma página única** `/admin/courses/:id` no estilo planilha/acordeão:

```text
┌─ Curso: The path to a COLOURFUL life ──────────────────────┐
│  [thumb] título  | slug | status [Draft▾] | [Publicar]    │
│  subtítulo / descrição (inline edit)                        │
│  ▼ Módulo 1: Course lessons                    [+ Aula]    │
│     ├─ 1.1  Reading the Color Wheel                         │
│     │      Título:        [____________]                    │
│     │      Link do vídeo: [____________] [▶ preview]        │
│     │      Thumbnail:     [upload] [preview]                │
│     │      Status: ●Draft  ○Published   [↑][↓][🗑]          │
│     ├─ 1.2  Warm vs Cool Colors  ...                        │
└─────────────────────────────────────────────────────────────┘
```

Características:
- Edição **inline com auto-save** (debounce 600 ms) — sem botão "Salvar" em cada campo.
- Preview de vídeo embutido ao lado do input: aceita YouTube, Vimeo, MP4 direto, com detecção automática.
- Upload de thumbnail por drag-and-drop direto no card da aula (vai para `public-assets/lessons/`).
- Botões `↑ ↓` para reordenar aulas (usa `swapSortOrder`).
- Toggle Draft/Published por aula, módulo e curso.
- `/admin/courses` continua sendo a lista geral; `/admin/courses/new` cria curso e redireciona para a tela única.

Remover as páginas separadas `AdminModuleDetail.tsx` e `AdminLessonDetail.tsx` (consolidadas na tela única).

## 4. Importador como página leve

`/admin/content-import` vira só um relatório: mostra o `import-report.json`, lista os 30 links faltantes e 9 thumbnails (já resolvidas), com botão "Re-sincronizar Manus" caso o usuário queira rodar de novo. Sem fluxo de wizard.

## 5. Renderização para alunos/admin

`CourseDetail` e `ModuleDetail` já existem — vou ajustar para:
- Mostrar player do `external_video_url` (YouTube/Vimeo iframe ou `<video>` nativo).
- Usar `cover_image_path` real.
- Admin vê aulas em qualquer status; alunos só `published`.

## Arquivos afetados

**Criar/reescrever:**
- `src/manus/pages/admin/AdminCourseDetail.tsx` — nova tela única com módulos+aulas inline.
- `src/manus/components/admin/LessonRow.tsx` — linha editável com auto-save, preview de vídeo, upload de thumb.
- `src/manus/components/admin/VideoPreview.tsx` — detector YouTube/Vimeo/MP4.
- `src/manus/lib/admin-content.ts` — adicionar `updateLessonPartial`, `uploadLessonThumbnail`, helpers de auto-save.
- `src/manus/data/manus-import.json` — substituir pelo template novo.
- `supabase/functions/manus-import/index.ts` — adicionar upload das 9 thumbnails reais do ZIP (passadas como base64 no payload ou pré-uploadadas pelo sandbox para o bucket).

**Editar:**
- `src/App.tsx` — remover rotas de módulo/aula separadas.
- `src/manus/components/GlobalAccessController.tsx` — admin pula todas as checagens (já parcial).
- Páginas membro (`Modules`, `ModuleDetail`, `Community`, `Suppliers`, `Events`, `Magazine`, `LiveWorkshops`, `Dashboard`) — bypass `isAdmin` em qualquer guard local de plano.
- `src/manus/pages/CourseDetail.tsx` / `ModuleDetail.tsx` — player real + admin vê drafts.
- `src/manus/pages/admin/AdminContentImport.tsx` — virar página de relatório.

**Remover:**
- `src/manus/pages/admin/AdminModuleDetail.tsx`
- `src/manus/pages/admin/AdminLessonDetail.tsx`

## Fora de escopo

- Stripe (explicitamente adiado).
- Mudanças no schema do Supabase (uso só as colunas existentes).
- Preencher os 30 links faltantes — isso depende do usuário colar as URLs reais; o admin já facilita esse trabalho.
