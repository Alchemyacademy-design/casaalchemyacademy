## Objetivo
Deixar o projeto Alchemy Academy 100% funcional no Lovable, resolvendo os erros reais que aparecem no console/rede e ajustando o design para a identidade editorial (creme, oliva, dourado) sem criar novo backend ou novo projeto Supabase.

## Problemas detectados nos logs de rede

1. `GET /rest/v1/profiles?select=*,user_roles(role),memberships(...)` → **PGRST200**: PostgREST não encontra o foreign key entre `profiles` e `user_roles`. A consulta usada em `adminUsers()` e `useAuth` faz embed implícito que o schema atual não suporta.
2. `HEAD /rest/v1/profiles`, `memberships`, `community_posts` → **401**: chamadas disparadas antes do login (AdminAnalytics carregando sem sessão) e sem GRANT a `anon`.
3. `GET /rest/v1/stripe_payments?status=eq.paid` → **42501 permission denied for anon** — query roda no AdminAnalytics e sem sessão de admin.
4. Aviso React Router v7 futures flags (cosmético).
5. Duas árvores de UI coexistem (`src/pages/*` legado + `src/manus/pages/*` ativo). Layout/Design tokens divergem; o `App.tsx` usa apenas a árvore Manus, mas a paleta editorial creme/oliva/dourado vive na árvore legada (`src/index.css` + `src/components/Layout.tsx`).

## Plano de correção (somente frontend)

### 1. Corrigir consultas tRPC-facade que dependem de FK inexistente
Em `src/manus/lib/trpc.ts`:
- `authMe()`: já faz queries separadas — confirmar que não usa embed; ok.
- `adminUsers()`: substituir o embed `profiles(*,user_roles(role),memberships(...))` por 3 queries paralelas e merge em memória por `user_id`. Elimina o PGRST200.
- `adminAllPosts()`: trocar o embed `profiles:author_id(full_name,email)` por fetch separado dos autores únicos e merge em memória.
- `communityPosts()`: mesmo tratamento (embed `profiles:author_id` falha sem FK declarada no cache).

### 2. Guardar rotas admin para não dispararem queries sem sessão
Em `src/manus/components/GlobalAccessController.tsx` e nas páginas `AdminPanel`/`AdminAnalytics`:
- Adicionar early-return e `enabled: isAdmin` nos `useQuery` para que `stripe_payments`, `profiles`, `memberships` só sejam buscados quando `roles.includes("admin")` e sessão presente.
- Redirecionar `/admin*` para `/login` quando não autenticado.

### 3. Unificar design no padrão editorial (creme · oliva · dourado)
- Manter `src/index.css` (paleta editorial já definida) como fonte única de tokens.
- Auditar `src/manus/contexts/ThemeContext.tsx` (default `dark`) → trocar para `light` editorial e remover overrides que escurecem o tema.
- Garantir que `src/manus/components/MemberLayout.tsx` e páginas Manus usem somente tokens semânticos (`bg-background`, `text-primary`, `text-accent`, `font-serif`) — substituir quaisquer `bg-black`/`text-white` hardcoded.
- Aplicar tipografia `Cormorant Garamond` (display) + `Inter` (body) já configurada em `tailwind.config.ts`/`index.css`.
- Reusar o cabeçalho/rodapé do `src/components/Layout.tsx` (legado) como base do `MemberLayout` para garantir consistência.

### 4. Remover árvore duplicada que confunde manutenção
- Deletar `src/pages/{Community,Course,Dashboard,Events,Lesson,Login,Magazine,MyCourses,PaymentCancel,PaymentSuccess,Plans,Profile,Signup,Suppliers}.tsx` (não referenciados pelo `App.tsx`).
- Manter apenas `src/pages/Index.tsx` e `src/pages/NotFound.tsx` se ainda referenciados; senão remover também.
- Manter `src/components/Layout.tsx` e `src/hooks/useAuth.tsx` apenas se usados pelo `MemberLayout` unificado; caso contrário, remover.

### 5. Pequenos polimentos
- Silenciar warnings React Router v7 com `future={{ v7_startTransition: true, v7_relativeSplatPath: true }}` no `<BrowserRouter>` em `src/main.tsx`.
- Conferir tratamento de erro nos `useQuery` que dependem de admin (toast amigável em vez de erro silencioso).

## O que NÃO será feito
- Não criar nenhuma tabela, migration, função SQL, edge function ou projeto Supabase.
- Não tocar nas funções/edge functions já deployadas.
- Não alterar `src/integrations/supabase/{client,types}.ts`.
- Não adicionar GRANTs no banco (qualquer ajuste de permissão fica como item pendente para o usuário aplicar manualmente no SQL Editor).

## Resultado esperado
- Página inicial e dashboard carregam sem 400/401 visíveis.
- Login redireciona corretamente: admin/membership → `/dashboard`, entitlement → `/mycourses`, demais → `/plans`.
- Identidade visual única e editorial em todas as telas autenticadas.
- Árvore de código sem páginas duplicadas.
