# FUTURE SCHEMA BACKLOG

Recursos que exigem alteração de banco. NÃO implementar enquanto a regra for "schema atual congelado".
Cada item descreve o quê, por que precisa de schema novo, e a forma mínima sugerida.

## My Home Project
Galeria pessoal do aluno com ambientes/fotos antes-depois.
Precisa: tabela `home_projects (id, user_id, name, room, cover_url, created_at)` + `home_project_items (project_id, image_url, note)`.

## Moodboards persistidos
Hoje a UI pode montar moodboard em memória; persistir exige `moodboards` + `moodboard_items` com RLS por `user_id`.

## Notas pessoais por aula
Precisa: `lesson_notes (user_id, lesson_id, body, updated_at)`, PK composta, RLS owner.

## Streaks persistidos
Hoje calculável em runtime a partir de `lesson_progress`. Para mostrar streak real entre sessões sem recalcular, precisa coluna `current_streak`, `last_active_date` em `profiles` ou tabela `user_streaks`.

## Badges persistidos
Os milestones da Fase 4 são derivados. Para badges com data de conquista, ordenação e revogação manual: `user_badges (user_id, badge_key, awarded_at, source)`.

## Notificações internas
Inbox in-app: `notifications (id, user_id, type, payload jsonb, read_at, created_at)` + Realtime opcional.

## Automações (drip / e-mail por evento)
Worker + tabela de regras `automation_rules` e fila `automation_jobs`. Edge functions agendadas (`cron` Supabase).

## Histórico de IA / Alchemy Mentor
`ai_conversations` + `ai_messages` com `user_id`. Secret do provider via `add_secret` e edge function gateway.

## Learning paths personalizadas
Hoje derivado de `sort_order`. Para trilhas curadas por persona: `learning_paths` + `learning_path_steps (path_id, course_id, order)`.

## Auditoria avançada
Atualmente `admin_access_audit_log` é tratado como "indisponível" se faltar. Auditoria completa exige tabela definitiva + trigger por mutation administrativa.

## Métricas de comportamento / heatmaps / funis / cohorts
Event tracking persistido: `analytics_events (user_id, event, props jsonb, ts)`. Volume alto — exige plano pago ou agregador externo.

## Recomendações por IA
Edge function + cache de recomendações por usuário (`user_recommendations`). Depende de gateway IA.

---
Atualizar sempre que uma feature for adiada por dependência de schema.
