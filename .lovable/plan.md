
# Fase 0 + Fase 1 — Baseline e Fundação Técnica

Trabalho restrito a este projeto Lovable (repo `Alchemyacademy-design/alchemy-academy-preview`, Supabase `omzwtfnqffseemrlylwu`, admin `contact@casaalchemystudio.com`). Sem novas migrations, sem mexer em Stripe, sem refazer páginas existentes.

## Resultados de pré-checagem já confirmados

- Commit atual: `8be9822` (branch de edição). React Router 6.30.1 já é a única dependência de routing.
- **Wouter**: `rg wouter src/ package.json` retorna zero. Nada para remover hoje — o relatório apenas registrará a ausência e adicionará um lint guard (`no-restricted-imports: ["wouter"]`) para impedir reintrodução.
- **AdminUserDetail**: já usa `react-router-dom` (`useNavigate`, `useParams`). Sem conversão pendente; documentar.
- **`subtitle` inexistente**: confirmado no `types.ts` — `events` e `live_workshops` não têm `subtitle`; apenas `courses` tem. Páginas a corrigir: `AdminEvents.tsx` (remover) e `AdminWorkshops.tsx` (remover). `AdminCourseDetail` / `AdminCoursesList` continuam usando `subtitle` corretamente.
- **`admin_access_audit_log`**: tabela ausente; já referenciada em `AdminOverview.tsx` e `AdminUserDetail.tsx` via `db: any`. Atualmente "silencia" via `?? []`, mas mistura erro com vazio — endurecer para detectar `code === '42P01'` / `PGRST205` e tratar como "auditoria indisponível" sem quebrar a página nem mostrar lista falsa.

## Fase 0 — Baseline (somente leitura)

1. Rodar e capturar saídas brutas: `tsc --noEmit`, `bunx vitest run`, build (via harness), `bun run lint` (se existir script; senão `bunx eslint .`).
2. Auditar todas as páginas em `src/manus/pages/admin/` cruzando cada `field.name` contra colunas reais em `src/integrations/supabase/types.ts`. Produzir tabela de incompatibilidades.
3. Verificar via UI/Diagnostics atual: session/roles/isAdmin e contagens de catálogo (courses/modules/lessons).
4. Escrever `docs/PHASE_0_REPORT.md` com: identidade do projeto, commit, resultados crus dos comandos, mapa de telas/rotas/Edge Functions, lista de mocks/botões mudos remanescentes, e a tabela de incompatibilidades de campo.

## Fase 1 — Fundação técnica (edições mínimas)

Edições focadas, sem refatorar lógica de negócio:

1. **`src/manus/pages/admin/AdminEvents.tsx`** — remover o campo `subtitle` da config `fields`.
2. **`src/manus/pages/admin/AdminWorkshops.tsx`** — remover o campo `subtitle` da config `fields`.
3. **Outros campos incompatíveis** detectados na Fase 0 — corrigir cada um na própria página admin (apenas remover/renomear chave; sem mudar UX). Antes de aplicar, listar a alteração no chat e no relatório.
4. **`AdminOverview.tsx` + `AdminUserDetail.tsx`** — extrair helper local `fetchAuditSafe()` que executa o select e, em caso de erro com código de tabela inexistente, retorna `{ available: false, rows: [] }`. UI mostra um aviso "Audit log not provisioned yet" em vez de tabela vazia, e nunca lança.
5. **Padronizar status de query nas telas afetadas** (Overview, UserDetail, e qualquer outra encontrada na auditoria): distinguir `isLoading` (skeleton), `error` (mensagem `describeError`), `data.length === 0` (estado vazio explícito) e sucesso. Não introduzir novos componentes; usar os já existentes em `AdminShell` e shadcn.
6. **Guard anti-Wouter**: adicionar regra em `eslint.config.js`:
   ```
   "no-restricted-imports": ["error", { "paths": [{ "name": "wouter", "message": "Use react-router-dom." }] }]
   ```
7. **AuthProvider, AdminGuard, cliente Supabase**: nenhuma mudança (já corretos). Apenas verificar e documentar.
8. Re-rodar typecheck/lint/testes/build; abrir `/admin/diagnostics` autenticado como master admin e verificar:
   - session = yes
   - roles inclui `admin`
   - isAdmin = true
   - courses = 10 / modules = 10 / lessons = 30
9. Escrever `docs/PHASE_1_REPORT.md` com: arquivos alterados, diffs conceituais, campos removidos/corrigidos, comportamento da auditoria ausente, resultado final dos 4 checks do diagnóstico, status de typecheck/test/build/lint, e pendências para a Fase 2 (cursos/módulos/aulas: archive vs delete, checklist de publicação, bulk editor, thumbnails, validação de URL externa).

## Fora de escopo nesta execução

- Stripe (qualquer arquivo).
- Migrations SQL (incluindo criação de `admin_access_audit_log` — apenas pendência documentada).
- Refatorar `AdminTablePage` para archive em vez de delete (Fase 2).
- Remover mocks da área de membros (Fase 3).
- Camada `src/manus/services/*` consolidada (Fase 2+).

## Critérios de aceite

- `bun run typecheck`, `bunx vitest run`, build e lint passam.
- Zero imports de `wouter` + regra ESLint bloqueando reintrodução.
- `AdminEvents` e `AdminWorkshops` não enviam mais `subtitle`.
- Falha de auditoria não derruba `/admin` nem `/admin/users/:id`.
- `/admin/diagnostics` exibe os 6 valores esperados.
- `docs/PHASE_0_REPORT.md` e `docs/PHASE_1_REPORT.md` criados com todas as seções pedidas.

Parar após a Fase 1 e aguardar revisão.
