# Plano — Central Administrativa 100% funcional

Objetivo: deixar o Admin Center inteiro operando no preview/front-end com dados reais do Supabase, sem mocks, com o e-mail `contact@casaalchemystudio.com` sempre reconhecido como administrador e com todos os botões principais salvando, renderizando e atualizando a UI imediatamente.

## Correção imediata já encaminhada

- Corrigir o erro que quebrava `/admin/analytics` no gráfico de receita.
- Garantir que o endpoint de sessão (`auth-me`) reforce automaticamente o papel `admin` quando o usuário logado for `contact@casaalchemystudio.com`.
- Reexecutar o bootstrap do administrador designado para confirmar que esse usuário já possui role `admin`.

## Fase 1 — Acesso administrativo blindado

1. Verificar o fluxo completo de login no preview:
   - login com `contact@casaalchemystudio.com`;
   - `auth-me` retorna `roles: ["admin"]`;
   - `useAuth().isAdmin` fica `true`;
   - `AdminGuard` libera `/admin`, `/admin/courses`, `/admin/analytics` e demais rotas.

2. Consolidar fallback seguro:
   - se o carregamento principal falhar, a leitura direta de `user_roles` continua funcionando;
   - nenhuma regra usa comparação de e-mail no front-end para liberar admin;
   - o e-mail designado só é usado no backend para auto-restaurar a role.

3. QA obrigatório:
   - usuário admin entra direto no Admin Center;
   - usuário comum recebe 403;
   - logout/login atualiza permissões sem precisar limpar cache.

## Fase 2 — Inventário de telas e botões do Admin Center

Mapear e testar cada rota administrativa:

```text
/admin
/admin/courses
/admin/courses/new
/admin/courses/:id
/admin/lessons
/admin/students
/admin/events
/admin/workshops
/admin/magazine
/admin/suppliers
/admin/supplier-categories
/admin/deals
/admin/plans
/admin/certificates
/admin/analytics
/admin/diagnostics
```

Para cada tela:
- listar botões existentes;
- identificar se apenas abre modal, salva no Supabase, atualiza lista, navega ou está quebrado;
- registrar erro real: console, network, RLS, permissão, loading infinito ou renderização vazia.

## Fase 3 — Supabase, permissões e renderização

1. Conferir GRANTs e RLS das tabelas usadas pelo Admin Center:
   - `courses`, `course_modules`, `lessons`;
   - `profiles`, `user_roles`, `memberships`, `course_entitlements`;
   - `events`, `live_workshops`, `magazine_issues`;
   - `suppliers`, `supplier_categories`, `exclusive_deals`;
   - `membership_plans`, `certificates`;
   - tabelas de comunidade já criadas.

2. Regra alvo:
   - admin pode ler, criar, editar e excluir o conteúdo administrativo quando fizer sentido;
   - estudante continua limitado por RLS;
   - `service_role` mantém acesso total para Edge Functions;
   - sem liberar dados sensíveis publicamente.

3. Corrigir renderização:
   - se o banco retorna dados mas a tela não renderiza, corrigir mapeamento de campos;
   - se a UI espera campos antigos, adaptar para o schema atual;
   - se a query está filtrando status errado, ajustar para admin enxergar drafts e published.

## Fase 4 — Cursos 100% funcionais

1. `/admin/courses`
   - listar cursos reais;
   - botão `New course` cria curso sem loading infinito;
   - curso recém-criado aparece imediatamente;
   - editar status, título, slug, descrição, ordem e publicação.

2. `/admin/courses/:id`
   - salvar cabeçalho do curso;
   - criar, editar, reordenar e excluir módulos;
   - criar, editar, reordenar e excluir lessons;
   - toda ação invalida as queries certas e atualiza a lista sem reload.

3. `/admin/lessons`
   - edição em massa de lessons;
   - status, vídeo, conteúdo, ordem e módulo vinculados corretamente;
   - erros de RLS ou validação aparecem em toast claro.

## Fase 5 — CRUDs administrativos genéricos

Transformar os CRUDs baseados em `AdminTablePage` em fluxos confiáveis:

- `events`;
- `live_workshops`;
- `magazine_issues`;
- `suppliers`;
- `supplier_categories`;
- `exclusive_deals`;
- `membership_plans`;
- `certificates`.

Para cada CRUD:
- botão `New` cria registro válido com defaults corretos;
- editar salva no Supabase;
- excluir funciona ou vira soft-delete quando necessário;
- campos JSON/datetime/boolean não quebram;
- lista refetch/invalida cache após salvar.

## Fase 6 — Estudantes, permissões e acessos

1. `/admin/students`
   - listar usuários reais;
   - puxar roles, memberships e entitlements;
   - abrir detalhe do estudante.

2. `/admin/users/:id`
   - conceder/remover assinatura manual;
   - conceder/remover acesso a curso;
   - promover/rebaixar admin quando permitido;
   - impedir remoção do admin designado;
   - registrar auditoria quando aplicável.

3. Limite de escopo:
   - Stripe/billing continua fora de escopo até pedido explícito;
   - botões de assinatura paga ficam desabilitados ou com mensagem clara quando dependerem de billing.

## Fase 7 — Analytics e diagnósticos

1. `/admin/analytics`
   - corrigir gráficos Recharts;
   - tratar arrays vazios sem quebrar;
   - mostrar cards e tabelas mesmo com dados parciais;
   - remover dependência de dados mockados.

2. `/admin/diagnostics`
   - mostrar sessão, role admin, fonte do acesso e teste `auth-me`;
   - botão de reteste atualiza o contexto de auth;
   - mensagens em português ou neutras e acionáveis.

## Fase 8 — Preview QA ponta a ponta

Executar verificação real no navegador:

```text
Login admin
→ /admin
→ /admin/courses
→ criar curso
→ abrir curso
→ criar módulo
→ criar lesson
→ voltar lista
→ confirmar renderização imediata
→ testar CRUDs principais
→ abrir analytics
→ validar sem ErrorBoundary
```

Também verificar:
- console sem erros fatais;
- network sem 401/403 inesperado;
- nenhuma tela presa em loading infinito;
- botões principais têm estado loading/success/error;
- dados criados aparecem no Supabase e no front-end.

## Entrega final

Ao concluir a implementação:

- Admin designado vinculado ao preview e ao front-end via `isAdmin` real.
- Central administrativa navegável sem bloqueios indevidos.
- Cursos, módulos e lessons funcionando com criação/edição/renderização imediata.
- CRUDs administrativos salvando no Supabase.
- Analytics sem crash.
- Diagnóstico mostrando claramente se o usuário atual está como admin.
- Relatório final atualizado com o que foi validado e qualquer pendência real restante.