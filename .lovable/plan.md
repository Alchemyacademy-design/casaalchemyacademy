# Correção definitiva: login admin + leitura real dos cursos

## Causa raiz
1. `useAuth` é instanciado por componente, recriando listener `onAuthStateChange` e refazendo `auth-me` em paralelo. Isso gera estado intermediário onde `isAdmin=false` enquanto a query roda, e `AdminGuard` redireciona o admin para `/dashboard` antes de `auth-me` responder.
2. `AdminGuard` decide acesso só com `loading` + `isAdmin`, sem distinguir “sessão carregada” de “autorização carregada”.
3. `AdminCoursesList` faz consulta aninhada `courses → course_modules → lessons` e trata erro como “No courses yet”, escondendo qualquer falha de RLS/GRANT real.
4. Não existe diagnóstico visível para confirmar role, contagens e estado de `auth-me` quando algo falha.

Banco já está correto: 10 cursos / 10 módulos / 30 aulas e `contact@casaalchemystudio.com` com role `admin`. Nada será reimportado e nenhum schema alterado.

## Escopo
- Apenas frontend + uma edge function nova (`admin-content-catalog`).
- Sem Stripe, sem migrações de dados, sem novo Supabase, sem Lovable Cloud.

## Mudanças

### 1. AuthProvider global único
- Novo `src/manus/contexts/AuthContext.tsx` com Provider montado uma vez em `src/App.tsx`.
- Estado central: `session`, `user`, `profile`, `roles`, `membership`, `activeEntitlements`, `isAdmin`, `isMember`, `hasCourseAccess`, `hasPaidAccess`, `authReady`, `accessReady`, `loading`, `error`, `refreshAccess`, `logout`.
- Um único `onAuthStateChange` e uma única chamada `auth-me` por sessão. `staleTime: 30s`. Invalidação explícita em `SIGNED_IN`, `TOKEN_REFRESHED`, `USER_UPDATED`, `SIGNED_OUT`.
- `src/manus/hooks/useAuth.ts` reescrito como wrapper fino: `return useContext(AuthContext)`. Mantém a mesma API pública para não quebrar consumidores.
- Fallback se `auth-me` falhar: consulta autenticada só do próprio usuário em `user_roles` + `profiles`. Falha fechada para não-admin; admin vê estado de erro + retry.

### 2. AdminGuard corrigido
`src/components/AdminGuard.tsx` passa a usar a máquina de estados:

```text
!authReady                       -> skeleton
authReady && !session            -> Navigate("/login")
authReady && session && !accessReady && !error
                                 -> "Checking administrator access…"
accessReady && error             -> painel de erro + Retry
accessReady && !isAdmin          -> Navigate("/403")
accessReady && isAdmin           -> children
```

Nunca redirecionar admin enquanto `auth-me` está pendente.

### 3. Proteção do admin master no backend
Migração mínima criando trigger em `public.user_roles` que bloqueia `DELETE`/`UPDATE` da linha `role='admin'` quando `lower(trim(auth.users.email)) = 'contact@casaalchemystudio.com'`. Função `SECURITY DEFINER`, search_path fixo. Nenhuma alteração nos dados existentes.

### 4. Edge function `admin-content-catalog`
- `supabase/functions/admin-content-catalog/index.ts`, `verify_jwt = true`.
- Valida JWT, lê `user_roles` do caller via service role, confirma `admin` no servidor. Nunca confia em flag do cliente.
- Faz três consultas determinísticas (courses → modules → lessons) e devolve:

```json
{
  "courses": [...],
  "counts": {
    "courses": 10, "modules": 10, "lessons": 30,
    "missing_video_urls": n, "draft_courses": n, "published_courses": n
  }
}
```

- Não escreve dados, não retorna secrets.

### 5. Serviço admin tipado
`src/manus/services/admin-content.ts` com:
`getAdminContentCounts`, `getCourses`, `getCourseModules(courseIds)`, `getLessons(moduleIds)`, `getCoursesTree`, `getCourseById`, `updateCourse`, `updateModule`, `updateLesson`. Usa apenas `@/integrations/supabase/client`. Erros tipados (`code`, `message`, `details`, `hint`); distingue “vazio” de “bloqueado”.

### 6. AdminCoursesList reescrito
- Fonte primária: edge function `admin-content-catalog`. Fallback: serviço em três etapas com RLS.
- React Query: `queryKey: ["admin","courses-tree", session.user.id]`, `enabled: authReady && accessReady && isAdmin`, `refetchOnMount: "always"`, `refetchOnWindowFocus: true`, `retry: 2`.
- Estados: skeleton, erro real (mostra `code/message/details/hint` + Retry), vazio real (“No courses yet” somente em sucesso com zero linhas), sucesso.
- Cada linha mostra: title, slug, status, sort_order, subtitle, módulos, aulas totais, aulas com vídeo, aulas sem vídeo, thumbnail, botão Manage.

### 7. AdminCourseDetail
Mantém edição dos registros existentes pelo ID real. Campos editáveis: nome, descrição, thumbnail, ordem, status, `external_video_url`, `external_resource_url`, `duration_seconds`, `is_preview`. Sem recriar curso.

### 8. /admin/content-import com duas abas
- “Current database”: dados reais via `admin-content-catalog` (cursos, módulos, aulas, status, vídeos faltantes, thumbnails faltantes).
- “Import package”: preview do `manus-import.json` com aviso “The import package is not the current database. Use this page only to preview or update missing records.”
- Sem importação automática. Botão de importar fica desabilitado se for duplicar por slug.

### 9. /admin/diagnostics
Nova rota dentro de `AdminGuard`. Mostra (sem secrets): user_id, email, session exists, authReady, accessReady, roles, isAdmin, Project Ref, status do `auth-me`, contagens (courses/modules/lessons), último erro. Botões: Refresh session, Refresh access, Reload courses, Copy diagnostic report. Nunca exibe access token, anon key ou service role.

### 10. Higiene de cache/listeners
Auditoria: `createClient(`, `onAuthStateChange(`, `auth.me`. Garantir uma única origem em cada caso. Remover qualquer listener duplicado em componentes.

## Arquivos a criar
- `src/manus/contexts/AuthContext.tsx`
- `src/manus/services/admin-content.ts`
- `src/manus/pages/admin/AdminDiagnostics.tsx`
- `supabase/functions/admin-content-catalog/index.ts`
- Migração: trigger de proteção do admin master em `public.user_roles`

## Arquivos a modificar
- `src/App.tsx` (montar AuthProvider, registrar `/admin/diagnostics`)
- `src/manus/hooks/useAuth.ts` (vira wrapper do contexto)
- `src/components/AdminGuard.tsx` (máquina de estados nova)
- `src/manus/pages/admin/AdminCoursesList.tsx` (consulta determinística + estados de erro reais)
- `src/manus/pages/admin/AdminCourseDetail.tsx` (somente onde necessário para usar o serviço)
- `src/manus/pages/admin/ContentImport` (separar “Current DB” x “Import package”)
- `supabase/config.toml` (`[functions.admin-content-catalog] verify_jwt = true`)

## Critério de aceite
Logado como `contact@casaalchemystudio.com`:

1. `/admin` abre direto, sem redirect.
2. `/admin/courses` mostra exatamente: 10 cursos · 10 módulos · 30 aulas.
3. Cursos draft visíveis para admin; aulas sem vídeo marcadas como Missing.
4. `/admin/diagnostics` confirma roles=["admin"], `isAdmin=true`, `accessReady=true`, contagens 10/10/30.
5. `/admin/content-import` separa “Current database” (banco real) de “Import package” (JSON).
6. Refresh da página e nova aba mantêm acesso admin.
7. Estudante não acessa `/admin` nem vê drafts.

Não declaro pronto até esses sete itens passarem visualmente.

## Fora deste plano
Stripe, checkout, webhooks, Lovable Cloud, novo Supabase, novo repositório, reimport de cursos, novas tabelas, mudanças de schema além do trigger de proteção do admin master.