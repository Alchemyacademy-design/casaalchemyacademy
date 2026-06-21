# Plano: Central Administrativa 100% funcional (bidirecional com Supabase)

Objetivo: tornar a Central Administrativa a fonte única de gestão da plataforma. **Toda leitura** vem do banco oficial (`omzwtfnqffseemrlylwu`) e **toda escrita feita no admin** reflete no banco e aparece imediatamente no lado público — sem dados estáticos / mockados.

Nada novo será inventado: o plano só cobre o que **já existe no código** (rotas, tabelas, edge functions) e ainda não está ligado de ponta a ponta.

---

## 1. Diagnóstico do que existe hoje

### 1.1 Tabelas no banco (já criadas)
`courses`, `course_modules`, `lessons`, `lesson_progress`, `quizzes`, `quiz_questions`, `quiz_options`, `quiz_answers`, `quiz_attempts`, `certificates`, `events`, `live_workshops`, `magazine_issues`, `suppliers`, `supplier_categories`, `supplier_favorites`, `exclusive_deals`, `membership_plans`, `plan_permissions`, `memberships`, `course_entitlements`, `community_spaces`, `community_channels`, `community_posts`, `community_replies`, `community_reactions`, `moderation_actions`, `profiles`, `user_roles`, `stripe_*`, `registrations`.

### 1.2 Telas admin que já existem
| Rota | Arquivo | Estado |
|---|---|---|
| `/admin` | `AdminOverview.tsx` | Lê KPIs reais do banco ✓ |
| `/admin/courses` | `AdminCoursesList.tsx` | OK (edge `admin-content-catalog`) ✓ |
| `/admin/courses/:id` | `AdminCourseDetail.tsx` | CRUD curso/módulo/aula ✓ |
| `/admin/lessons` | `AdminLessonsBulk.tsx` | Editor em massa ✓ |
| `/admin/students` | `AdminStudents.tsx` | Lista de profiles ✓ |
| `/admin/users/:id` | `AdminUserDetail.tsx` | **Quebrado** — importa `wouter`, usa `useAuth().loading` inexistente |
| `/admin/analytics` | `AdminAnalytics.tsx` | OK |
| `/admin/diagnostics` | `AdminDiagnostics.tsx` | OK |

### 1.3 Gaps principais (o que falta para "100% funcional")
1. **`AdminUserDetail`** ainda em `wouter` → 404 / erro ao gerenciar usuário.
2. **Sem CRUD admin** para conteúdos que aparecem no site público:
   `events`, `live_workshops`, `magazine_issues`, `suppliers`/`supplier_categories`, `exclusive_deals`, `membership_plans`/`plan_permissions`, moderação de `community_posts`/`community_replies`, `quizzes`/`quiz_questions`/`quiz_options`, `certificates`.
3. **Páginas públicas estáticas** (`Events`, `Magazine`, `LiveWorkshops`, `Suppliers`, `Plans`, `Community`, `Guides`) renderizam de `manus-import.json` em vez do banco — não refletem mudanças feitas no admin.
4. **RLS/GRANT de escrita admin** precisa existir para `events`, `live_workshops`, `magazine_issues`, `suppliers`, `supplier_categories`, `exclusive_deals`, `membership_plans`, `plan_permissions`, `quizzes`, `quiz_*`, `community_*` e `moderation_actions` (admin escreve via `public.has_role(auth.uid(), 'admin'::app_role)`).
5. **Sidebar admin** (`AdminShell` NAV) não tem entradas para Events / Workshops / Magazine / Suppliers / Deals / Plans / Community / Quizzes / Certificates — sem porta de entrada para essas telas.

---

## 2. Princípios não-negociáveis

- **Single source of truth = Supabase**. Nenhuma leitura nova do `manus-import.json` em página pública.
- **Toda mutação admin = `supabase.from(<tabela>).insert/update/delete`** com RLS validando `has_role(auth.uid(),'admin')`.
- **Invalidate React Query** depois de cada mutação para refletir no admin **e** no público.
- **Edge Functions** só onde precisa de `service_role` (papéis, Stripe). CRUD comum vai direto via RLS.
- Nenhuma alteração em Stripe, Lovable Cloud, repositório ou banco. Migrations são SQL adicionando policies/grants.

---

## 3. Execução em fases (pequeno → grande)

### Fase 0 — Correções bloqueantes (1 PR pequeno)
- `AdminUserDetail.tsx`: trocar `wouter` por `react-router-dom` (`useParams`, `useNavigate`); usar `useAuth()` com campos atuais (`authReady`, `accessReady`, `isAdmin`); remover `loading` inexistente.
- `MemberLayout.tsx`, `Activate.tsx`, `CourseDetail.tsx`, `Dashboard.tsx`, `Home.tsx`, `Guides.tsx`, `Magazine.tsx`: substituir `wouter` por `react-router-dom` (mantendo comportamento).
- Confirmar que `AdminGuard` libera contact@casaalchemystudio.com em todas as rotas `/admin/**`.

**Critério:** logar como admin → abrir `/admin/users/<id>` sem erro de runtime.

### Fase 1 — SQL: liberar escrita admin nas tabelas restantes
Migration única adicionando, para cada tabela listada em 1.3 (#4), uma policy:
```
CREATE POLICY admin_full_access ON public.<tabela>
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<tabela> TO authenticated;
```
Mantém policies existentes de leitura pública. Sem `DROP` de policies do site.

**Critério:** admin consegue `insert/update/delete` em todas as tabelas via SQL Editor logado como ele.

### Fase 2 — Sidebar + páginas admin que faltam (CRUD direto, sem novas features)
Adicionar entradas em `AdminShell.NAV` e criar páginas mínimas estilo `AdminLessonsBulk` (tabela editável + form lateral):

| Página admin | Tabela(s) base | Reflete em (página pública) |
|---|---|---|
| `AdminEvents` `/admin/events` | `events`, `registrations` | `Events.tsx` |
| `AdminWorkshops` `/admin/workshops` | `live_workshops`, `registrations` | `LiveWorkshops.tsx` |
| `AdminMagazine` `/admin/magazine` | `magazine_issues` | `Magazine.tsx` |
| `AdminSuppliers` `/admin/suppliers` | `suppliers`, `supplier_categories` | `Suppliers.tsx` |
| `AdminDeals` `/admin/deals` | `exclusive_deals` | dentro de `Suppliers/Plans` |
| `AdminPlans` `/admin/plans` | `membership_plans`, `plan_permissions` | `Plans.tsx` |
| `AdminCommunity` `/admin/community` | `community_spaces`, `community_channels`, `community_posts`, `community_replies`, `moderation_actions` | `Community.tsx` |
| `AdminQuizzes` (aba dentro do curso) | `quizzes`, `quiz_questions`, `quiz_options` | player de aula |
| `AdminCertificates` `/admin/certificates` | `certificates` | `Profile.tsx` |

Cada página: lista + criar + editar inline + excluir + status (`draft`/`published` quando existir). Usa **apenas** `supabase.from(...)` e `useMutation` + `queryClient.invalidateQueries`.

**Critério:** criar evento no admin → aparece em `/events` sem reload manual da página pública (depois de fase 3).

### Fase 3 — Páginas públicas: trocar `manus-import.json` por queries reais
Para cada página pública listada na coluna “Reflete em” da Fase 2, substituir o consumo do JSON por `useQuery(['public', '<tabela>'], () => supabase.from('<tabela>').select(...).eq('status','published'))`.

- Manter o layout, só trocar a fonte.
- Adicionar `staleTime` curto (15 s) para refletir mudanças do admin.
- `Modules.tsx` e `CourseDetail.tsx` já usam DB para cursos — só revisar.

**Critério:** apagar `manus-import.json` mentalmente não quebra nada visível.

### Fase 4 — Verificação bidirecional (checklist manual + script)
Para cada par admin↔público:
1. Criar registro no admin → aparece no público (sem reload manual além de F5).
2. Editar título/descrição no admin → reflete no público.
3. Mudar status para `archived`/`draft` → some do público.
4. Excluir → some do público e do admin.

Repetir para: course, module, lesson, event, workshop, magazine_issue, supplier, deal, plan, community_post.

### Fase 5 — Limpeza e telemetria
- Remover imports não usados de `manus-import.json` quando todas as páginas migrarem.
- Logar erros Supabase no `ErrorBoundary` (já existe; cobrir `code/policy`).
- Atualizar `docs/ADMIN_SYSTEM_AUDIT.md` com o estado final.

---

## 4. Detalhes técnicos chave

- **Validação de admin no front**: continua sendo `useAuth().isAdmin` (baseado em `user_roles` via `auth-me`).
- **Validação no back**: RLS com `public.has_role(auth.uid(),'admin'::app_role)`. Nada de checar e-mail no SQL.
- **React Query keys** padronizadas: `['admin','<tabela>']` no admin e `['public','<tabela>']` no site. Mutação no admin chama `queryClient.invalidateQueries({ queryKey: ['public','<tabela>'] })` também.
- **Sem novas Edge Functions** nesta entrega — `admin-content-catalog`, `auth-me`, `admin-manage-user-access`, `admin-manage-stripe-subscription` cobrem o que precisa de `service_role`.
- **Sem mexer em Stripe**: telas de `Plans` no admin só editam metadados (`name`, `description`, `features`, `is_active`), nunca preços.

---

## 5. Riscos e mitigação (premortem)

| Risco | Mitigação |
|---|---|
| Policies novas conflitarem com leitura pública | Criar policies admin **adicionais**, nunca dropar as existentes. |
| Recursão em RLS via `has_role` | Já é `SECURITY DEFINER` com `search_path = public` — manter padrão. |
| Página pública quebrar enquanto JSON sai | Migrar uma página por vez, atrás de feature query (`useQuery` cobre fallback de `[]`). |
| Admin escreve mas público não atualiza | Garantir `staleTime ≤ 30s` no público + invalidate cross-key no admin. |
| `wouter` ainda usado em outras páginas | Substituir todas as ocorrências na Fase 0 para evitar runtime errors. |
| Tabelas sem GRANT explícito após policy | Em cada migration de policy, incluir `GRANT` na mesma transação. |

---

## 6. Entregáveis por fase

- **F0**: 1 PR fix-wouter + AdminUserDetail.
- **F1**: 1 migration `2026XXXX_admin_full_access_policies.sql` + grants.
- **F2**: 1 PR por grupo (Events/Workshops, Magazine, Suppliers/Deals, Plans, Community, Quizzes, Certificates) + atualização do `AdminShell.NAV`.
- **F3**: 1 PR por página pública migrada.
- **F4**: checklist preenchido em `docs/ADMIN_SYSTEM_AUDIT.md`.
- **F5**: cleanup + doc final.

Nada é executado até este plano ser aprovado.
