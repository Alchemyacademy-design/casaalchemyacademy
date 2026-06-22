# PLANO MASTER — ALCHEMY ACADEMY

Fonte: mensagem do usuário em 2026-06-22. Este arquivo é o plano de upgrade oficial.
Execução por ordem; cada fase termina com relatório + typecheck + testes + build + lint + pendências.

## Regras imutáveis
- Repo: `Alchemyacademy-design/alchemy-academy-preview`, branch `main`.
- Supabase: `omzwtfnqffseemrlylwu`. Plano gratuito — sem hospedar vídeo pesado.
- Admin master: `contact@casaalchemystudio.com` (role `admin` protegida).
- Banco: NÃO criar tabelas/colunas/enums, NÃO alterar RLS, NÃO migrations. Tudo no schema atual.
- Funções faltantes de schema → `docs/FUTURE_SCHEMA_BACKLOG.md`, nunca fingir pronto.
- Stripe: última fase. Até lá, sem secrets/Products/Prices/Checkout/webhook.
- Idioma: preservar o idioma de cada tela. Não misturar pt/en.
- Identidade visual: Instrument Serif (títulos), Manrope (texto). Paleta Sandstone/Cacao/Chocolate/Terracotta/Avocado/Moss/White. Sem azul/roxo/gradiente SaaS.

## Performance / plano gratuito
- Paginação 20, select colunas mínimas, lazy loading por rota, React Query cache, dedup, refetch só após mutation.
- Caches: auth 30s • catálogo 5min • curso 2min • admin 1min • eventos/workshops 2min • revista/fornecedores 5min • comunidade 30s.
- Vídeos via `external_video_url` / link externo. Nada de polling. Realtime só onde valha a pena.

## Fases
- Fase 0 — Baseline (concluída → `docs/PHASE_0_REPORT.md`)
- Fase 1 — Confiabilidade/perf (concluída → `docs/PHASE_1_REPORT.md`)
- Fase 2 — Experiência de aprendizagem premium (Dashboard, My Courses, Course, Lesson, Learning Path derivado)
- Fase 3 — Comunidade integrada (canais reais + botões Share/Ask/Discuss derivados)
- Fase 4 — Gamificação elegante derivada (milestones calculados, sem novas tabelas)
- Fase 5 — Eventos, Workshops, Magazine, Suppliers, Deals
- Fase 6 — Central admin sem código (CRUDs completos no schema atual)
- Fase 7 — Analytics educacionais derivadas (sem event tracking novo)
- Fase 8 — Mobile + PWA (manifest, drawer, responsivo). Sem offline/push/app nativo.
- Fase 9 — Busca global leve (debounce 300ms, mínimo 2 chars, paginada)
- Fase 10 — Diferenciais: Guided Journey, Weekly Focus, Continue, Smart Empty, Course Readiness
- Fase 11 — Backlog que exige schema → `docs/FUTURE_SCHEMA_BACKLOG.md`
- Fase 12 — QA (5 perfis × 13 telas × 4 viewports + persistência + performance)
- Fase 13 — Stripe (somente após tudo aprovado)

## Ordem de execução no Lovable
1. Fases 0+1 ✅
2. Fase 2 ← próxima
3. Fase 3
4. Fase 4
5. Fase 5
6. Fase 6
7. Fase 7
8. Fases 8+9
9. Fase 10
10. Fase 12
11. Stripe

## Regra de conclusão de qualquer mutation
Gravar → confirmar → invalidar cache → refetch → persistir após refresh → aparecer em segunda aba.

## Estado atual
- Plano salvo. Fase 1 entregue. Próximo passo aguarda aprovação: iniciar Execução 2 = Fase 2.
