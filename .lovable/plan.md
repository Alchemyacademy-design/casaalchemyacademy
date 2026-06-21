# Plano: Sistema 100% funcional — front ↔ Supabase em todas as áreas

## Estado atual (auditoria rápida)

✅ **Já lendo do Supabase:** `/admin/*` (todas), `/mycourses`, `/courses/:id`, `/community`, `/suppliers`, `/dashboard` (parcial).

❌ **Ainda com dados estáticos / desconectado do banco:**

| Página | Tabela alvo | O que falta |
|---|---|---|
| `/` Home | `courses` + `live_workshops` (próximos) | `MODULES`, `TESTIMONIALS`, `BENEFITS` hardcoded |
| `/courses` Guides | `courses` | catálogo com 10 módulos fixos |
| `/events` | `events` | `UPCOMING_EVENTS`/`PAST_EVENTS` arrays |
| `/magazine` | `magazine_issues` | `ARCHIVES` array, download fake |
| `/live-workshops` | `live_workshops` | página estática |
| `/plans` | `membership_plans` | conteúdo hardcoded |
| `/profile` | `profiles` + `memberships` | sem leitura/edição real |
| `/dashboard` | múltiplas | só usa tRPC modules; falta progress real, próximos eventos, certificados |

⚠️ **Risco transversal:** algumas tabelas podem ter `GRANT` / RLS faltando para leitura anônima ou de membro autenticado — confirmamos caso a caso e adicionamos numa única migração.

---

## Fases (executar em ordem)

### Fase A — Auditoria de RLS/GRANT (uma migração só)
- Edge function `admin-audit` (já criada) varre, como admin logado, `SELECT count` em cada tabela exposta no front. Acrescentar leitura como `anon` e como `authenticated` simulando políticas reais.
- Para cada falha PostgREST/`42501`, gerar uma migração única adicionando:
  - `GRANT SELECT ON public.<t> TO anon` (apenas tabelas com policy `status='published'` USING true).
  - `GRANT SELECT, INSERT, UPDATE, DELETE ON public.<t> TO authenticated` quando faltar.
  - `GRANT ALL ON public.<t> TO service_role` quando faltar.
- Confirmar que policies de **insert/update/delete** para admin usam `has_role(auth.uid(),'admin')` em: `events`, `live_workshops`, `magazine_issues`, `membership_plans`, `exclusive_deals`, `certificates`, `suppliers`, `supplier_categories`.

### Fase B — Páginas públicas dinâmicas
- **`/events`**: substituir arrays por `supabase.from('events').select('*').eq('status','published').order('starts_at')`; separar futuros × passados por `starts_at`. Botão "Register" usa `registrations` (já existe RPC `register_for_event`).
- **`/live-workshops`**: idem com `live_workshops`. Mostrar `join_url` só para usuários com `membership` ativa.
- **`/magazine`**: ler `magazine_issues` publicadas, link "Read" usa `external_file_url` real.
- **`/courses` (Guides)**: transformar em catálogo público de cursos lidos de `courses` `status='published'`. Manter o painel "What's included" e o upsell. CTA "Get Casa Consult" abre `SubscribeModal` com o `slug` correto.
- **`/plans`**: ler `membership_plans` (key, name, description, duration, all_courses, community_access, events_access, active=true), ordenar por `id`. Renderizar features dinâmicas. Botão de assinar continua desativado com mensagem "Stripe em breve" (alinhado à memória).

### Fase C — Home dinâmica
- Manter narrativa/copy, mas:
  - Seção "Modules"/"Curriculum" lê `courses` publicadas (top 6).
  - Seção "Próximos workshops" (nova ou no lugar de testimonials) lê 3 próximos `live_workshops` ou `events`.
  - Botões `Login`/`Signup`/`Get Started` permanecem.
- Manter `BENEFITS` e `TESTIMONIALS` (dados de marketing imutáveis), porém movê-los para `src/manus/content/home.ts` exportado para fácil futura edição.

### Fase D — Perfil e Dashboard reais
- **`/profile`**:
  - Ler `profiles` do usuário (`auth.uid()`); permitir editar `full_name`, `display_name`, `avatar_url`, `country`, `bio` com UPDATE direto.
  - Mostrar `memberships` ativas (plano, expiração) e cursos com `course_entitlements`.
  - Botão "Logout".
- **`/dashboard`**:
  - Saudação com profile name.
  - Progresso real: `lesson_progress` agregado por curso (% completo, próxima aula).
  - Próximos `events` + `live_workshops` agendados.
  - Certificados emitidos do usuário.
  - Atalhos: continuar curso, abrir comunidade, ver workshops.

### Fase E — Comunicação de escrita (botões reais)
- **Registrar em evento/workshop**: chamar `register_for_event(target_type, target_id)` RPC; refletir estado "Inscrito" com `registrations` do usuário.
- **Favoritar fornecedor**: `supplier_favorites` insert/delete com toast.
- **Marcar aula completa**: já funcional em `CourseDetail`.
- **Comunidade**: postar, responder, reagir — confirmar mutations existentes em `useCommunityData` e adicionar feedback visual de erro RLS (mesmo padrão de `describeError` do `AdminTablePage`).
- **Editar perfil**: UPDATE em `profiles` com toast amigável.

### Fase F — Permissões & visibilidade por plano
- Helper `useEntitlements()` central que devolve `{ isAdmin, isMember, hasCommunity, hasEvents, courseIds }` a partir de `memberships` + `course_entitlements` + `has_role`.
- Aplicar em: gates dos vídeos (`CourseDetail`), botão "Join workshop", botão "Register event", `community` (read-only para não membros).
- Estado `loading` claro, sem flash de "negado" antes da sessão carregar.

### Fase G — Realtime onde faz sentido
- Já existe em `community_posts`. Adicionar realtime em `events` e `live_workshops` (admin publica → site refresca via `invalidateQueries`).
- Habilitar publication: `ALTER PUBLICATION supabase_realtime ADD TABLE public.events, public.live_workshops;` (migração curta).

### Fase H — QA end-to-end
- Roteiro Playwright (script único `e2e-fullsystem.py`) percorre:
  1. Login admin → cria curso/módulo/aula com vídeo → publica.
  2. Logout → login como membro de teste → vê o curso em `/mycourses`, abre, marca aula completa.
  3. Admin cria evento → membro vê em `/events` e clica Register → confirma `registrations` no DB.
  4. Admin publica workshop, magazine, deal, plano → membro/visitante vê.
  5. Membro abre comunidade, posta, reage; outro membro recebe via realtime.
  6. Membro edita perfil → reload mostra valor persistido.
- Capturar screenshots por etapa e listar falhas.

---

## Detalhes técnicos

**Convenções a manter**
- Hook `useAuth()` com `isAdmin`, `session`, `accessReady` — não checar role por email no front.
- Toda mutation passa por `describeError()` (mesmo padrão do `AdminTablePage`) para mensagens amigáveis com hint de RLS.
- `useQuery` keys padronizadas `["public", "<table>", filters]` e `["me", "<resource>"]` para invalidação cruzada.

**Arquivos a criar**
- `src/manus/hooks/useEntitlements.ts`
- `src/manus/hooks/usePublicContent.ts` (events, workshops, magazine, plans, courses)
- `src/manus/content/home.ts` (copy marketing)
- `supabase/migrations/<ts>_grants_and_admin_policies.sql` (apenas o que faltar, gerado pós-auditoria)
- `supabase/migrations/<ts>_enable_realtime_events_workshops.sql`

**Arquivos a reescrever**
- `src/manus/pages/Home.tsx`
- `src/manus/pages/Guides.tsx`
- `src/manus/pages/Events.tsx`
- `src/manus/pages/Magazine.tsx`
- `src/manus/pages/LiveWorkshops.tsx`
- `src/manus/pages/Plans.tsx`
- `src/manus/pages/Profile.tsx`
- `src/manus/pages/Dashboard.tsx`

**Fora do escopo (alinhado à memória)**
- Implementação real de checkout Stripe — botões seguem desativados com mensagem.
- Mudanças em billing, webhooks, edge functions de pagamento.

---

## Riscos & mitigação (premortem)

| Risco | Mitigação |
|---|---|
| RLS bloqueando leitura anon de `events`/`magazine`/etc | Auditoria A roda primeiro; migração corrige antes de tocar UI. |
| Membro sem entitlement vê curso completo | `useEntitlements` centralizado + gate no Player. |
| Tabelas vazias deixam home/dashboard com cara de "quebrado" | Estados de empty bem desenhados ("Em breve…"). |
| Realtime explodindo conexões | Subscrição só dentro de `useEffect` com cleanup (regra já no projeto). |
| Mutation falhando silenciosamente | `describeError` + toast obrigatório em toda mutação. |
| RLS recursiva via `profiles` | Continuar usando `has_role` SECURITY DEFINER; nunca consultar `profiles`/`user_roles` dentro de uma policy de outra tabela diretamente. |

---

## Critério de aceite (Phase done)
1. Nenhum array hardcoded de conteúdo (eventos, workshops, planos, magazine, cursos) nas páginas públicas.
2. Toda mutation com toast amigável (sucesso/erro classificado).
3. Roteiro Playwright H passa do início ao fim sem 401/403/RLS.
4. Admin consegue publicar qualquer recurso e o site público reflete em ≤ 2s (invalidate + realtime onde aplica).
5. Membro vê apenas o que seu plano libera; não-membro vê apenas o público.

---

## Ordem de execução sugerida
A → B (events/magazine/workshops/plans) → D (profile/dashboard) → C (home dinâmica) → E (botões de escrita) → F (gates de plano) → G (realtime) → H (QA).

Posso começar pela Fase A já — me confirme se topa este escopo ou se prefere ajustar algo antes (por ex. manter `/courses` Guides como marketing puro, ou priorizar `/profile` antes de eventos).