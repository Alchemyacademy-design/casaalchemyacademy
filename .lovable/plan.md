# Pre-mortem — Tornar o sistema 100% real e conectado ao banco

Objetivo: cada página, botão e seção deve ler/escrever no Supabase com as permissões (RLS + GRANT) corretas, sem dados hardcoded; admin enxerga tudo, membros enxergam o que têm direito, visitantes enxergam o público.

## Riscos identificados (pre-mortem)

1. **Páginas com dados estáticos restantes** — `Home.tsx` (MODULES/BENEFITS/TESTIMONIALS) e `Guides.tsx` (catálogo de cursos) ainda usam arrays locais.
2. **GRANT/RLS lacunares** — várias tabelas podem estar sem `GRANT SELECT TO anon` para conteúdo público (events, live_workshops, magazine_issues, courses publicados, membership_plans, exclusive_deals, suppliers, supplier_categories) ou sem `INSERT/UPDATE/DELETE TO authenticated` para admin via `has_role`.
3. **Botões “mudos”** — alguns CTAs ainda navegam sem persistir (favoritar fornecedor, registrar em workshop, marcar lição concluída em telas antigas).
4. **Realtime ausente** em events/live_workshops/community → conteúdo não atualiza sem reload.
5. **Entitlements espalhados** — cada página recalcula acesso; falta hook único `useEntitlements()`.
6. **Sem QA end-to-end** garantindo que admin cria → membro vê → registra → progresso persiste.

## Plano de execução (8 fases sequenciais, aprovação única)

### Fase A — Auditoria RLS + GRANT (migração única)
- Rodar `admin-audit` para listar tabelas/colunas/policies atuais.
- Migração que garante, por tabela pública:
  - `GRANT SELECT TO anon` apenas em: `courses`, `course_modules`, `lessons` (filtrando `status='published'` via policy), `events`, `live_workshops`, `magazine_issues`, `membership_plans`, `exclusive_deals`, `suppliers`, `supplier_categories`, `community_spaces`, `community_channels`.
  - `GRANT SELECT, INSERT, UPDATE, DELETE TO authenticated` em todas as tabelas de usuário (`profiles`, `memberships`, `registrations`, `lesson_progress`, `quiz_*`, `supplier_favorites`, `community_posts/replies/reactions`, `certificates`).
  - `GRANT ALL TO service_role` em tudo.
- Policies admin via `has_role(auth.uid(),'admin')` para INSERT/UPDATE/DELETE em todas tabelas de conteúdo.

### Fase B — Hook central `useEntitlements()`
- Retorna `{ isAdmin, isMember, hasCommunity, hasEvents, hasWorkshops, courseIds[], planKey }` a partir de `user_roles` + `memberships` ativas + `course_entitlements`.
- Substitui checagens ad-hoc em Plans, CourseDetail, LiveWorkshops, Community.

### Fase C — Home dinâmica
- `Home.tsx`: módulos puxam de `courses` (top 6 publicados); workshops próximos de `live_workshops`; eventos de `events`.
- Copy estática (BENEFITS, TESTIMONIALS) movida para `src/manus/content/home.ts` (mantida, mas isolada).

### Fase D — Guides (`/courses`) catálogo real
- Lista de cursos publicados do Supabase com badge de acesso (Free/Plus/Pro), botão “Acessar” se entitled ou “Ver Planos”.

### Fase E — Botões reais
- `Suppliers`: favoritar grava em `supplier_favorites`.
- `LiveWorkshops`/`Events`: já registram via `register_for_event`; adicionar “Cancelar inscrição”.
- `CourseDetail`: confirmar `markComplete` + criação automática de `certificates` ao 100%.
- `Community`: confirmar create post/reply/reaction com `describeError()`.

### Fase F — Realtime
- Migração: `ALTER PUBLICATION supabase_realtime ADD TABLE` para `events`, `live_workshops`, `registrations`, `community_posts`, `community_replies`, `community_reactions`, `lesson_progress`.
- Subscriptions já existentes em `usePublicContent` e `useCommunityData` cobrem o front.

### Fase G — Admin polish
- Confirmar que cada AdminXxx faz invalidate da query pública correspondente após save/publish.
- Toggle “publicado” unificado em todas as listas.

### Fase H — QA end-to-end
- Script Playwright único: login admin → cria curso+módulo+aula+workshop+evento+magazine → publica → logout → login membro → vê tudo → registra workshop → marca aula concluída → confere certificado → edita perfil. Screenshots em cada passo.

## Entregáveis
- 1 migração (Fase A) + 1 migração (Fase F).
- Novo hook `useEntitlements.ts`.
- Reescritas: `Home.tsx`, `Guides.tsx`.
- Ajustes pontuais: `Suppliers.tsx`, `CourseDetail.tsx`, admin pages para invalidate.
- Script `/tmp/browser/qa_full/` com prints.

## Fora de escopo
- Stripe/checkout real (mantém disabled com mensagem).
- Migração de dados legados / seeds.
- Novas features visuais — apenas conectar o que existe.

## Critério de sucesso
- `rg "const (MODULES|TESTIMONIALS|BENEFITS|UPCOMING|PAST|ARCHIVES)" src/manus/pages/` → vazio.
- Admin cria conteúdo e ele aparece para o membro sem reload.
- Nenhum toast “permission denied” em fluxos válidos.
- Playwright QA passa 100%.

Pronto para eu executar Fase A (auditoria + migração de GRANTs)?
