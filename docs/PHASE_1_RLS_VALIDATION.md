# Phase 1 — Validação RLS (Final)

Data: 2026-06-22  
Projeto Supabase: `omzwtfnqffseemrlylwu`

## Migration aplicada manualmente pela usuária

Conteúdo equivalente a `docs/migrations/20260622120000_grant_private_schema_execute.sql`:

```sql
grant usage on schema private to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;
grant execute on function private.has_course_access(bigint) to anon, authenticated;
grant execute on function private.has_active_plan_permission(public.plan_permission_key) to anon, authenticated;
grant execute on function private.can_access_channel(bigint) to anon, authenticated;
```

Confirmado pela usuária: nenhum `public.is_admin()` duplicado foi criado.

## Estado validado pela usuária na aplicação rodando

| # | Critério | Resultado |
|---|---|---|
| 1 | Login do admin master (`contact@casaalchemystudio.com`) | ✅ |
| 2 | `/admin/diagnostics` carrega | ✅ |
| 3 | `/admin/courses` lista 10 cursos | ✅ |
| 4 | `/mycourses` carrega catálogo | ✅ |
| 5 | `select` direto em `courses` sem 42501 | ✅ |
| 6 | leitura de `course_modules` | ✅ |
| 7 | leitura de `lessons` | ✅ |
| 8 | leitura + upsert reversível em `lesson_progress` | ✅ |
| 9 | nenhum erro 42501 no console / Network | ✅ |
| 10 | visitante sem login não acessa `/admin` | ✅ |
| 11 | visitante não vê drafts | ✅ |
| 12 | admin sem membership permanece com acesso | ✅ |

Catálogo conferido: 10 cursos, 10 módulos, 30 aulas.

## Conclusão

A Fase 1 está validada. RLS direto funciona para `anon`, `authenticated` e admin.  
A fachada admin (`admin-content-catalog`) continua disponível como caminho elevado para drafts.

Liberação para Fase 2 confirmada pela usuária.
