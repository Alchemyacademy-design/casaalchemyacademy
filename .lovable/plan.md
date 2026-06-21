# Plano de Correção — Editor, Lista de Cursos e Perfil Admin

Princípio: **toda informação vem do banco Supabase real** (`omzwtfnqffseemrlylwu`). Nenhum dado mock, nenhum fallback de arquivo isolado.

---

## Bug 1 — Editor de curso fica em loading infinito ao clicar "Editar"

**Causa raiz:** `src/manus/pages/admin/AdminCourseDetail.tsx` (linha 494) não trata `isError` do React Query. `getCourse` (em `src/manus/lib/admin-content.ts:44`) usa `.single()`; quando RLS bloqueia o admin de ler cursos `draft` (ou o id não existe), o erro `PGRST116` é lançado, `data` fica `undefined`, e o componente cai eternamente no ramo `if (!course)` mostrando "Loading course…".

**Correções:**
1. `AdminCourseDetail.tsx` ~L494: destruturar `isError` e `error` do `useQuery` para `getCourse`, `getModulesByCourse`, `getLessonsByModule`.
2. ~L615: adicionar ramo `if (courseError)` antes do `if (!course)`, exibindo a mensagem real do Postgres (`error.message`, `code`, `hint`) — sem esconder o erro.
3. Trocar `.single()` por `.maybeSingle()` em `getCourse` para diferenciar "linha inexistente" de "erro de permissão".
4. Garantir via migração SQL que admin lê e edita cursos de qualquer status. Adicionar/ajustar policies em `courses`, `course_modules`, `lessons`:
   - `SELECT/INSERT/UPDATE/DELETE USING (public.has_role(auth.uid(), 'admin'))` além das policies existentes para alunos.
5. Validar com `/admin/diagnostics` que o admin recebe os 10 cursos, 10 módulos, 30 aulas direto do banco.

---

## Bug 2 — Lista pública de cursos vazia em `/mycourses` (Modules)

**Causa raiz:** `src/manus/pages/Modules.tsx` consulta a coluna inexistente `cover_image_url` (linhas 16, 29, 123). A coluna real, usada em todo o resto do projeto e nos dados do banco, é `cover_image_path`. O PostgREST devolve 400, a query falha, `courses` cai no default `[]` e o usuário vê "Nenhum curso".

**Correções:**
1. Em `src/manus/pages/Modules.tsx`, substituir `cover_image_url` por `cover_image_path` nas 3 ocorrências (tipo, string do `select`, leitura no JSX).
2. Auditar `Guides.tsx`, `CourseDetail.tsx` e qualquer outra página de catálogo para o mesmo typo — corrigir se existir.
3. Garantir que a query NÃO depende de `hasCourseAccess`/`isMember` para listar o catálogo público (lista deve aparecer para qualquer usuário autenticado; o gate de acesso é só ao abrir a aula).

---

## Bug 3 — Admin precisa ter acesso total à plataforma sem plano

**Causa raiz:** A lógica de roteamento (`GlobalAccessController.tsx:44`) já faz `if (isAdmin) return;` corretamente. O que está errado é cosmético/UX: o `MemberLayout` mostra o rótulo fixo "Member" e o Profile mostra "Free" mesmo para admin, dando a impressão de bloqueio.

**Correções:**
1. `src/manus/components/MemberLayout.tsx:167`: trocar o literal `"Member"` por `{isAdmin ? "Admin" : "Member"}` (consumindo `useAuth`).
2. Revisar cada página da área de membros (`Community`, `Suppliers`, `Events`, `Magazine`, `LiveWorkshops`, `Dashboard`) para garantir que qualquer guard local respeite `isAdmin === true` como bypass (e não exija `isMember`).
3. Não alterar regra de negócio para alunos pagos — apenas garantir o bypass do admin.

---

## Bug 4 — Profile mostra "Free" e nome errado para a admin Lorena Couto

**Causa raiz:**
- `src/manus/pages/Profile.tsx:77` exibe `user?.membershipTier || "Free"`. Admin não tem linha em `memberships`, então `membershipTier` é `undefined` → renderiza "Free".
- O nome cai em `user.email` quando `profiles.full_name` está nulo no banco.

**Correções:**
1. `Profile.tsx`: importar `isAdmin` do `useAuth` e usar `{isAdmin ? "Admin" : (user?.membershipTier ?? "Free")}`.
2. Adicionar badge/aviso "Acesso total — Administrador" quando `isAdmin`.
3. Atualizar a linha real em `public.profiles` da Lorena (via tool de insert/update) para `full_name = 'Lorena Couto'` e `display_name = 'Lorena Couto'` — dado vem do banco, não hard-coded.
4. Criar/garantir trigger `handle_new_user` em `auth.users` que insere em `public.profiles` copiando `raw_user_meta_data->>'full_name'`, para que novos usuários nunca caiam no fallback de email.

---

## Premortem — o que pode dar errado e como evito

| Risco | Mitigação |
|---|---|
| Policy nova de admin em `courses` causa recursão com `has_role` | `has_role` já é `SECURITY DEFINER` com `search_path` fixo — seguro. Testar `select * from courses` autenticado como admin antes de declarar pronto. |
| Trocar `cover_image_url` quebra outras telas | Buscar todas as ocorrências (`rg cover_image_url`) antes de editar; só `Modules.tsx` deve ter o typo. |
| `maybeSingle()` muda comportamento em outros lugares | Aplicar só em `getCourse`; manter `.single()` onde a linha é garantida. |
| Trigger `handle_new_user` conflita com profiles já existentes | Usar `ON CONFLICT (id) DO NOTHING`. |
| Admin perde rótulo "Member" quebra UI de aluno comum | Render condicional por `isAdmin`; aluno continua vendo "Member". |
| Lorena já tem `profiles.full_name` preenchido com outro valor | Antes do update, fazer `SELECT id, full_name, display_name FROM profiles WHERE id = (select id from auth.users where email='contact@casaalchemystudio.com')` e confirmar com a usuária. |

---

## Ordem de execução

1. Migração SQL: policies de admin em `courses`/`course_modules`/`lessons` + trigger `handle_new_user`.
2. Update da linha `profiles` da Lorena com `full_name`/`display_name` reais.
3. Código frontend: `Modules.tsx` (cover_image_path), `AdminCourseDetail.tsx` (isError + maybeSingle), `Profile.tsx` (isAdmin → "Admin"), `MemberLayout.tsx` (label dinâmico).
4. Validação manual com `contact@casaalchemystudio.com`:
   - `/admin/courses` → clicar Editar → formulário carrega com módulos e aulas.
   - `/mycourses` → 10 cursos aparecem com capas.
   - `/profile` → "Admin" e "Lorena Couto".
   - Navegar livremente em `/community`, `/events`, etc.

## Critério de pronto

- Editor abre qualquer curso em <2s sem loading infinito, lendo do Supabase real.
- `/mycourses` lista os 10 cursos reais do banco com capa.
- Perfil mostra "Admin" e "Lorena Couto" lidos de `profiles`.
- Nenhuma referência a dado mock ou JSON estático no caminho de leitura.
