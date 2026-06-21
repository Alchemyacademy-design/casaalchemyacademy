## Goal

Remover o fluxo de "Importar catálogo" da Central de Administração e entregar a estrutura real dos 10 cursos / 30 aulas já pronta dentro do banco, para que o administrador apenas edite título, descrição e link de cada aula em `/admin/courses/:id`.

## 1. Remover o importador da UI

- `src/manus/pages/admin/AdminOverview.tsx` — remover o card "Import catalogue" / "Open importer".
- `src/manus/pages/admin/AdminCoursesList.tsx` — remover o botão "Import catalogue" do header de ações.
- `src/manus/components/admin/AdminShell.tsx` — remover o item "Import content" da navegação lateral.
- `src/App.tsx` — remover a rota `/admin/import` e o import de `AdminContentImport`.
- Apagar `src/manus/pages/admin/AdminContentImport.tsx` (não é mais usado).

A edge function `manus-import` e o JSON `src/manus/data/manus-import.json` ficam no repositório (a migração abaixo os consome uma única vez como seed), mas sem nenhum ponto de entrada na UI.

## 2. Popular o catálogo real no banco

Os dados reais (10 cursos, ordem, slugs, módulos e aulas com numeração `N.x`) que você colou são exatamente os que já estão em `src/manus/data/manus-import.json`. Vou usar esse arquivo como fonte e aplicar via migração SQL idempotente para garantir que:

- Os 10 cursos existem com `slug`, `title`, `subtitle`, `description`, `sort_order` corretos e `status='draft'`.
- O curso **Kids (legacy database only)** fica com `status='draft'` e `is_hidden=true` (oculto na área de membros, visível só para admin).
- Cada curso tem 1 módulo "Main" e 3 lessons com `lesson_number` (`1.1`…`10.3`), `title`, `description` herdada do JSON, `status='draft'`, `external_video_url=null`.
- `sort_order` das aulas segue a numeração (1.1 → 1, 1.2 → 2, 1.3 → 3).
- A operação é `INSERT ... ON CONFLICT (slug) DO UPDATE` para cursos e `ON CONFLICT (course_id, sort_order)` para aulas — rodar de novo não duplica.

Nenhum link de vídeo é definido aqui. Nenhuma thumbnail é alterada. Nada é publicado.

## 3. Edição inline em `/admin/courses/:id`

A página `AdminCourseDetail.tsx` já existe e já permite editar título, descrição, link de vídeo e ordem por módulo/aula. Após a seed, basta:

- Confirmar que `AdminCoursesList` lista todos os 10 cursos (incluindo `draft` e o Kids oculto, com badge "Hidden").
- Confirmar que `AdminLessonsBulk` mostra as 30 aulas com filtros "No video" / "No cover".
- Pequeno ajuste em `AdminCoursesList` para mostrar um badge "Hidden" quando `is_hidden=true`, para o curso Kids.

## 4. Texto do AdminOverview

No espaço onde estava o card "Import catalogue", colocar um aviso curto:

> "Catalogue seeded with 10 courses · 30 lessons (draft). Add video URLs and publish from **Courses** or **Bulk lessons**."

## Out of scope

- Vídeos / thumbnails (você preenche manualmente).
- Schema novo, RLS, Stripe, planos.
- Redesign visual.

## Entrega

- Arquivos editados/removidos listados acima.
- Migração SQL idempotente aplicada para os 10 cursos / 30 aulas em `draft`.
- Build verde; `/admin/courses` mostra os 10 cursos prontos para edição; nenhuma rota `/admin/import` permanece.
