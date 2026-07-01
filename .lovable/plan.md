# Plano — Renderização de Quizzes + Auditoria do Admin Center

## Objetivo
1. Garantir que quizzes editados/publicados no admin apareçam corretamente nas aulas/módulos da plataforma.
2. Tornar cada item do menu da Central Administradora 100% funcional (CRUD do admin → renderiza para o aluno).

---

## Parte A — Correção do Fluxo de Quizzes

### A1. Bug crítico: quizzes "course-level" nunca aparecem
Hoje, quando um quiz é criado sem `lesson_id` (default), ele fica invisível no player. O `seed-pilot-quizzes` cria exatamente nesse formato — por isso os 10 quizzes semeados não aparecem.

**Correção:**
- `AdminQuizEditor.tsx`: tornar o seletor de escopo (curso/módulo/aula) obrigatório antes de permitir `status = published`; bloquear publish quando `lesson_id` for null (a menos que se decida por escopo "final do módulo").
- `ModuleDetail.tsx`: além de quizzes por `lesson_id`, também buscar quizzes com `module_id` = módulo atual e `lesson_id = null` e renderizar como "Quiz do módulo" após a última aula.
- `get-member-quiz`: manter o gate por `status = 'published'` e validar acesso pelo `course_id` (já ok).

### A2. Painel `/admin/quizzes` funcional de verdade
Hoje é só "seed + preview". Vamos transformar em CRUD completo:
- Listagem paginada de todos os quizzes (join com curso/módulo/aula).
- Botão "Editar" abre o `AdminQuizEditor` existente inline.
- Botão "Criar quiz" com seletor de curso + escopo obrigatório.
- Coluna com status (draft/published/archived) e contador de perguntas.
- Aviso vermelho quando um quiz publicado estiver órfão (sem lesson_id nem module_id) — link direto para corrigir.

### A3. Publicação segura
- Checklist antes de publicar: ≥1 pergunta, todas com ≥2 opções e ≥1 correta, escopo definido, passing_score válido.
- Ao publicar, invalidar query cache de `lessonQuiz` para o módulo alvo.

### A4. Verificação end-to-end
- Testes: `quiz.routing.test.ts` cobrindo (a) quiz de aula, (b) quiz de módulo, (c) quiz órfão não aparece.
- Playwright: login admin → criar quiz em aula → publicar → abrir a aula na área de membros → responder → conferir tentativa em `quiz_attempts`.

---

## Parte B — Auditoria do Menu Admin

Legenda: ✅ funcional · 🟡 parcial · 🔴 não funcional

| # | Item | Status | Ação |
|---|---|---|---|
| 1 | Overview | ✅ | Nada a fazer |
| 2 | Courses | ✅ | Nada a fazer (CRUD → Modules/CourseDetail) |
| 3 | Lessons (bulk) | ✅ | Nada a fazer |
| 4 | **Quizzes** | 🟡 | Ver Parte A |
| 5 | Events | ✅ | Nada a fazer |
| 6 | Live workshops | ✅ | Nada a fazer |
| 7 | Magazine | ✅ | Nada a fazer |
| 8 | **Suppliers** | 🟡 | Trocar campo `category_id` (number puro) por **select** populado de `supplier_categories` |
| 9 | **Supplier categories** | 🟡 | Adicionar filtro por categoria na página `/suppliers` (aluno) |
| 10 | **Deals** | 🔴 | Criar página membro `/deals` consumindo `useDeals()` (hook já existe); adicionar link na sidebar do membro |
| 11 | **Plans** | 🟡 | Expor campos `stripe_*_price_id` no editor (edição controlada) + botão "Validar preço no Stripe" via edge function existente |
| 12 | **Certificates** | 🟡 | Ao inserir/emitir manualmente pelo admin, validar % de conclusão do aluno (ou marcar como override com auditoria) |
| 13 | Students | ✅ | Nada a fazer |
| 14 | Diagnostics | ✅ | Nada a fazer |
| 15 | Analytics | ✅ | Nada a fazer |

---

## Ordem de execução sugerida

1. **Parte A (quizzes)** — bloqueio crítico, primeiro.
2. **Deals** — criar rota `/deals` (impacto visível imediato para o aluno).
3. **Suppliers + Supplier categories** — dropdown + filtro.
4. **Plans** — expor `stripe_price_id` no admin.
5. **Certificates** — validação de conclusão no insert admin.
6. Rodar Playwright end-to-end + `bun test` + verificar logs das edge functions.

## Detalhes técnicos

- Arquivos principais a alterar:
  - `src/manus/components/admin/AdminQuizEditor.tsx`
  - `src/manus/pages/admin/AdminQuizzes.tsx`
  - `src/manus/pages/ModuleDetail.tsx`
  - `src/manus/lib/trpc.ts` (nova query `quizzes.byModule`)
  - `src/manus/pages/admin/AdminSuppliers.tsx` + `AdminTablePage` (suporte a `select` async)
  - `src/manus/pages/Suppliers.tsx` (filtro categoria)
  - `src/manus/pages/Deals.tsx` (novo) + rota em `App.tsx` + link em `MemberLayout`
  - `src/manus/pages/admin/AdminPlans.tsx` (campos Stripe)
  - `src/manus/pages/admin/AdminCertificates.tsx` (validação)
- Sem migração de schema nova (todas as tabelas já existem).
- Sem novas secrets.

Confirma pra eu executar?