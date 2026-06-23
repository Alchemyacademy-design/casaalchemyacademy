# PHASE 0 — CURRENT AUDIT (read-only, corrigida)

- Commit de código auditado: `d9d63f9bcb8b69c8c4fc95d6b8768dd3298ba1fa`
- Commit final da `main` ao publicar esta revisão: HEAD posterior, contendo
  apenas os cinco relatórios (sem alteração funcional).

## Comandos

| Comando | Exit | Observação |
|---------|------|------------|
| `bun run typecheck` | 0 | — |
| `bun run test` | 0 | 78/78 |
| `bun run build` | 0 | bundle 1.419,77 kB (aviso Vite > 500 kB) |
| `bun run lint` | **1** | 25 errors / 12 warnings — todos `no-explicit-any` |

CI no GitHub: **AUSENTE** (`.github/workflows/` não existe).

## Schema vs. código (correção)

Reexaminado nesta revisão:

- `is_published` não aparece em `src/` nem em `supabase/functions/`. O código
  público usa `eq("status", "published")` e o schema tem `status`,
  `published_at`, `archived_at`. **Não há regressão `courses.is_published`.**
  O `42703` reportado na auditoria anterior foi causado pela sonda consultando
  uma coluna inexistente.
- `lessons.video_url` também não aparece no código. O schema usa
  `lessons.external_video_url`; `src/manus/lib/trpc.ts` mapeia
  `videoUrl = l.external_video_url`. **Schema e código alinhados.**

## FASE_0_STATUS

`FASE_0_STATUS = PARCIAL`

Pendências confirmadas:

- Lint reprovado (25 `no-explicit-any`).
- Bundle único grande (sem `React.lazy` / `manualChunks`).
- Ausência de CI independente no GitHub.

Removido da lista: “drift `courses.is_published`” e “drift `lessons.video_url`”
(não confirmados).
