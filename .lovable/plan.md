# Plano — Padronizar idioma do admin (EN) e liberar acesso total ao admin

A plataforma e a home estão em **inglês**. O admin foi escrito em português, criando inconsistência. Além disso, alguns pontos da área de membros ainda gating por `entitlement`/`membership` sem checar `isAdmin`, então um admin logado pode esbarrar em telas de "comprar". Os cursos importados já estão no banco (10 cursos / 30 aulas, `status=draft`, sem vídeo) — você preencherá os links manualmente em `/admin/courses/:id` e `/admin/lessons`.

## 1. Padronização de idioma (PT → EN) na Central ADM

Sem mudar layout nem design tokens. Apenas strings.

- `src/manus/components/admin/AdminShell.tsx`
  - "Central ADM" → "Admin Center"
  - "Gestão" → "Manage"
  - "Visão geral" → "Overview"
  - "Cursos" → "Courses"
  - "Aulas (lote)" → "Lessons (bulk)"
  - "Alunos" → "Students"
  - "Importar conteúdo" → "Import content"
  - "Métricas" → "Analytics"
  - "Voltar à plataforma" → "Back to platform"
  - "Sair" → "Sign out"
- `AdminOverview.tsx` — títulos KPI, alertas, descrições para EN.
- `AdminCoursesList.tsx` — "Cursos", "Crie, edite…", "Novo curso", "Aulas em lote", "Importar catálogo", colunas (Ordem/Título/Slug/Status/Planos/Gerenciar), empty state.
- `AdminCourseDetail.tsx` — abas Detalhes / Módulos & aulas / Pré-visualização, botões Salvar/Publicar/Testar link, mensagens da checklist.
- `AdminLessonsBulk.tsx` — filtros ("Sem vídeo", "Sem thumb"), colunas, ações em lote.
- `AdminContentImport.tsx` — "Importar catálogo de cursos", badges (duplicado, sem thumb, sem vídeo), resumo created/updated/ignored/errors.
- `AdminStudents.tsx` — colunas e ações.
- `AdminPanel.tsx` — qualquer texto restante.
- `StatusBadge.tsx`, `PublishChecklist.tsx`, `ThumbnailField.tsx`, `VideoPreview.tsx` — labels e mensagens.

Mantemos os enums internos (`draft`, `published`) intactos — só os rótulos exibidos mudam.

## 2. Liberar acesso total ao admin na área de membros

Garantir que todo gating de plano respeite `isAdmin`.

- `src/manus/pages/Modules.tsx` — já cobre admin via `user?.role === "admin"`. Confirmar e estender para `roles?.includes("admin")` (usar diretamente `isAdmin` do `useAuth`).
- `src/manus/pages/ModuleDetail.tsx` — auditar e abrir todos os módulos/aulas quando `isAdmin` (sem checar entitlement).
- `src/manus/pages/CourseDetail.tsx` — admin sempre vê conteúdo do curso (mesmo `draft`/sem vídeo, com aviso "Coming soon").
- `src/manus/pages/Guides.tsx`, `Magazine.tsx`, `Community.tsx`, `Suppliers.tsx`, `Events.tsx`, `LiveWorkshops.tsx`, `Dashboard.tsx` — qualquer paywall/CTA "Subscribe" oculto quando `isAdmin`.
- `GlobalAccessController.tsx` já libera admin no nível de rota — manter.
- `MemberLayout.tsx` — quando `isAdmin`, adicionar link "Admin Center" no topo da sidebar.

Critério: logado como admin, eu clico em qualquer item do menu (Dashboard, Courses, Magazine, Events, Community, Suppliers, Live Workshops, My courses, qualquer curso) e o conteúdo abre sem redirect para `/plans` e sem overlay de "locked".

## 3. Cursos importados visíveis na plataforma

Já implementado anteriormente (`Guides` consome `courses` published; My courses consome entitlements). Para admin, listar **todos** os cursos (inclusive `draft`), com tag "Draft" — assim você abre, edita pelo `/admin/courses/:id` e vê o resultado em tempo real. Sem mexer no schema.

## Fora de escopo

- Importação de novos links de vídeo (você preencherá manualmente).
- Stripe / planos / billing.
- Mudanças de schema, RLS ou edge functions.
- Redesign visual — apenas strings.

## Entrega

- Arquivos editados (lista acima).
- Build verde e navegação validada como admin nas rotas `/dashboard`, `/mycourses`, `/courses`, `/courses/:id`, `/magazine`, `/community`, `/events`, `/suppliers`, `/live-workshops`, `/admin/*`.
