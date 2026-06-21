
# Central ADM — Plano de reestruturação

## Objetivo
Transformar `/admin` em uma **Central Administrativa** coesa, com identidade visual própria, sidebar, e CRUDs realmente funcionais de cursos / módulos / aulas. Importar o catálogo dos arquivos enviados como **draft** (sem links de vídeo, sem placeholder, sem Stripe). Já estruturar a **área de membros (aluno)** para exibir esses cursos. Nenhuma menção à palavra "Manus" em UI, copy ou rotas visíveis.

## Premortem — riscos e mitigações
1. **"Refazer o front" pode quebrar auth/billing/comunidade** → escopo limitado a `/admin/*` e às páginas que consomem `courses/course_modules/lessons` (`/courses`, `/courses/:id`, `/mycourses`). Auth, Stripe, comunidade, suppliers, magazine, events: intocados.
2. **Renomear rotas quebra links** → manter `/admin`, `/admin/courses`, `/admin/courses/:id`, `/admin/users/:id`, `/admin/analytics`, `/admin/lessons`. Adicionar `/admin/import` com redirect de `/admin/content-import`.
3. **Importação duplicar registros** → upsert idempotente por `slug` (curso) e `(module_id, sort_order)` (módulo/aula).
4. **Publicar curso sem vídeo** → checklist "Ready to publish" bloqueia publish sem capa + ≥1 módulo + ≥1 aula com `external_video_url` válido.
5. **Admin sendo bloqueado por falta de assinatura** → manter `GlobalAccessController` confiando em `isAdmin` (role no Supabase), nunca em e-mail no client.
6. **Aluno vendo cursos vazios** → student-facing lista só `published`; aulas sem vídeo aparecem como "Em breve" sem quebrar layout.
7. **Design genérico de dashboard** → direção visual única (ver §Design) com tokens semânticos em `index.css`; zero cores hardcoded; sem roxo/indigo padrão de IA.

## Design da Central ADM
Direção: **editorial sóbrio + acentos quentes** (Casa Alchemy): terracota / off-white / preto carvão, display serifado para títulos e sans neutra para UI. Tokens novos em `index.css`: `--admin-bg`, `--admin-surface`, `--admin-accent`, `--admin-accent-foreground`, `--admin-border`, `--admin-muted`, mais gradients e shadows nomeados.

Estrutura:
```text
┌────────────────────────────────────────────────────────────┐
│  CASA ALCHEMY · Central Administrativa        [user menu]  │
├──────────┬─────────────────────────────────────────────────┤
│ Sidebar  │  Topbar (breadcrumb + ações primárias)          │
│ (shadcn) │ ┌─────────────────────────────────────────────┐ │
│ Visão    │ │  KPIs (cursos, aulas, alunos, pendências)   │ │
│ Cursos   │ ├─────────────────────────────────────────────┤ │
│ Aulas    │ │  Conteúdo da rota                           │ │
│ Alunos   │ │                                             │ │
│ Importar │ │                                             │ │
│ Métricas │ │                                             │ │
│ Ajustes  │ └─────────────────────────────────────────────┘ │
└──────────┴─────────────────────────────────────────────────┘
```
Sidebar shadcn com `collapsible="icon"`, `SidebarTrigger` na topbar (sempre visível), `NavLink` para rota ativa, divisores sutis, bordas finas, ações primárias em accent terracota. Estados vazios ilustrados.

## Mudanças por área

### 1. Shell e navegação
- Reescrever `AdminShell` usando `SidebarProvider` + `Sidebar` shadcn (`collapsible="icon"`) + topbar com breadcrumb e slot de ações.
- Itens: **Visão geral**, **Cursos**, **Aulas (lote)**, **Alunos**, **Importar conteúdo**, **Métricas**, **Configurações**.
- `AdminPanel` (`/admin`) vira **Visão geral**: KPIs (cursos publicados/draft, aulas sem vídeo, thumbs faltantes, alunos ativos) + atalhos.

### 2. Cursos (CRUD completo)
- `/admin/courses`: tabela com busca, filtros (status, sem vídeo, sem thumb), ações por linha, "Novo curso", reordenar via `swapSortOrder`.
- `/admin/courses/new` e `/admin/courses/:id`: editor unificado em abas:
  - **Detalhes**: título, slug, subtítulo, descrição, capa (upload).
  - **Módulos & aulas**: acordeão por módulo, criar/editar/excluir/reordenar; aula tem título, descrição, URL vídeo, material complementar, duração, thumbnail, preview toggle, status, ordem, botão "Testar link" (abre `VideoPreview`).
  - **Pré-visualização do aluno**: renderiza `CourseDetail` em modo preview.
  - Header com checklist "Ready to publish" + botão Publish (desabilitado se checklist falhar).

### 3. Aulas em lote (`/admin/lessons`)
- Tabela já existente, no novo shell: filtros "sem vídeo", "sem thumb", "preview", por curso/status; "Salvar tudo"; ações em lote (publish ignora aulas sem vídeo).

### 4. Importador (`/admin/import`, redirect de `/admin/content-import`)
- Sem strings "Manus" na UI. Label: **"Importar catálogo de cursos"**.
- Upload de JSON no formato `alchemy_content_import_template.json` (também aceita o JSON empacotado no projeto como default).
- **Preview** antes de importar: lista cursos/módulos/aulas, com badges para slug duplicado, ordem duplicada, thumb ausente, vídeo ausente, módulo Kids (oculto), cursos 9 e 10 (revisão obrigatória).
- Checkboxes para ignorar registros.
- Chamada única ao edge function `manus-import` (mantém o nome interno para não quebrar deploy; UI nunca expõe esse nome) com service-role; idempotente por `slug` e `(module_id, sort_order)`.
- Importa tudo como `draft`, `external_video_url=null` (nunca grava `/manus-storage/placeholder-video.mp4`). `cover_image_path` em `/manus-storage/...` é importado como `null` e adicionado ao relatório como "thumb faltante".
- Relatório final: criados / atualizados / ignorados / erros + lista de links faltantes + thumbs faltantes; botão **Download `import-report.json`**.

### 5. Alunos (`/admin/students`, novo)
- Lista de perfis (busca por e-mail/nome, filtro por role/plano), link para `/admin/users/:id` existente.

### 6. Área de membros (aluno)
- `/courses` (Guides) e `/courses/:id` (CourseDetail): consomem `courses` published, módulos/aulas published com `VideoPreview` já implementado. "Em breve" quando `external_video_url` for `null`.
- `/mycourses` (Modules / ModuleDetail): cursos do aluno conforme `course_entitlements`/memberships; admin vê todos.
- `lesson_progress` e `certificates` continuam funcionando.

### 7. Acesso do admin
- `GlobalAccessController` + `AdminGuard` mantêm `isAdmin` (role Supabase). Sem comparação por e-mail no client.

## Dados importados agora (do JSON enviado)
- 10 cursos (slugs, títulos, subtítulos, descrições, sort_order; capas `/manus-storage/...` → `null` + relatório).
- 10 módulos.
- 30 aulas com título, descrição, ordem, lesson_number, preview flag, **`external_video_url=null`**, `external_resource_url=null`.
- Tudo `status=draft`. Flags módulo Kids / cursos 9 e 10 sinalizadas no relatório.

## Fora de escopo
- Stripe / billing / planos / autenticação / comunidade / suppliers / magazine / events / live workshops.
- Mudanças de schema Supabase ou RLS.
- Conteúdo real das aulas (links virão depois manualmente).

## Arquivos previstos
**Criar**
- `src/manus/pages/admin/AdminOverview.tsx`
- `src/manus/pages/admin/AdminStudents.tsx`
- `src/manus/components/admin/AdminSidebar.tsx`, `AdminTopbar.tsx`, `KpiCard.tsx`, `EmptyState.tsx`

**Atualizar**
- `src/manus/components/admin/AdminShell.tsx` (sidebar shadcn + topbar)
- `src/manus/pages/AdminPanel.tsx` (vira overview)
- `src/manus/pages/admin/AdminCoursesList.tsx` (tabela + reorder)
- `src/manus/pages/admin/AdminCourseDetail.tsx` (abas + checklist + preview do aluno)
- `src/manus/pages/admin/AdminLessonsBulk.tsx` (novo visual)
- `src/manus/pages/admin/AdminContentImport.tsx` (renomeada para `/admin/import`, copy sem "Manus", preview + relatório + download)
- `src/App.tsx` (rotas novas + redirect `/admin/content-import` → `/admin/import`, rota `/admin/students`)
- `src/manus/pages/Guides.tsx`, `src/manus/pages/CourseDetail.tsx` (consumir publicados + estado "Em breve")
- `src/index.css` (tokens `--admin-*`)

**Sem alterações**: billing, auth, comunidade, suppliers, magazine, events, live workshops, edge functions de Stripe, schema do Supabase.

## Validação
- Build limpo.
- Importar JSON → 10 cursos / 10 módulos / 30 aulas em `draft`; relatório lista 30 vídeos faltantes + thumbs faltantes; nenhum `external_video_url` populado.
- `/admin` mostra KPIs corretos; sidebar navega entre seções; checklist bloqueia publish sem vídeo.
- Logado como admin: acessa `/community`, `/mycourses`, `/courses/:id` sem assinatura.
- `/courses/:id` mostra "Em breve" para aulas sem vídeo, sem quebrar layout.
