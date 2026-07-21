# Events Hub + Google Calendar — Implementation report

**Date:** 2026-07-21
**Passada:** 1 de 2 (Passada 2 = OAuth de usuário, Profile Calendar Integration, auto-add on Participate)

## ACTIVE_BRANCH
`prelaunch-phase-2-3-official-render` (confirmada pelo owner no chat; ambiente Lovable não expõe `git` para validação automática).

## STARTING_HEAD / FINAL_HEAD
Ambos indeterminados via sandbox (Lovable gerencia git internamente).

## FILES_CHANGED
- `src/App.tsx` — `/live-workshops`, `/workshops` e `/events/calendar` agora redirecionam para o Events Hub em `/events` com o tab correto pré-selecionado.
- `src/manus/pages/Events.tsx` — reescrito como **Events Hub** com header oficial, 4 cartões de resumo e 3 tabs (Events / Live workshops / Calendar).
- `src/manus/pages/admin/AdminWorkshops.tsx` — dispara sync no Google Calendar em save/archive/delete e exibe status GCal na tabela.

## FILES_CREATED
- `src/lib/calendar-links.ts` — helpers puros de frontend para o link `calendar.google.com/render` e para gerar `.ics` client-side (sem OAuth, sem token, sem PII).
- `src/manus/components/events/EventsCalendarView.tsx` — calendário editorial (grade mensal no desktop + agenda list no mobile). Sem biblioteca externa.
- `supabase/functions/sync-workshop-to-google-calendar/index.ts` — edge function admin-only espelhando `sync-event-to-google-calendar` para `live_workshops`.

## DATABASE_TABLES_USED
- `public.events` — colunas `google_calendar_event_id/html_link/synced_at/sync_status/sync_error` já existiam.
- `public.live_workshops` — colunas equivalentes adicionadas nesta passada.
- `public.registrations` — colunas `user_google_calendar_event_id/html_link/synced_at/sync_status/sync_error` adicionadas nesta passada (schema preparado; escrita/leitura ficam para a Passada 2).
- `public.profiles` — coluna `calendar_auto_add_enabled boolean not null default false` adicionada (opt-in de auto-sync individual; UI fica para a Passada 2).

## MIGRATION_CREATED / MIGRATION_APPLIED
**Sim / Sim.** Uma única migration `ALTER TABLE public.live_workshops` + índice parcial em `google_calendar_sync_status`. Aprovada pelo owner. Nenhuma mudança em RLS.

## EDGE_FUNCTIONS_CREATED
- `sync-workshop-to-google-calendar` — usa o mesmo gateway `google_calendar` já configurado pela App Connector do Lovable (auth via `LOVABLE_API_KEY` + `GOOGLE_CALENDAR_API_KEY`). Admin-only (checa `isAdminUser` no service-role). Mesma semântica idempotente do sync de events: PATCH quando há `google_calendar_event_id`, POST quando não há, DELETE em archive/draft; retry como POST se o Google devolve 404/410 num PATCH.

## LOVABLE_CONNECTOR_USED
- **Admin (Lorena):** App Connector `google_calendar` (gateway-backed).
- **Users:** App User Connector `google_calendar` (client `auc_01ky1a3hkgfawr34gwwwhrkj6x` — "Google Calendar — Alchemy Academy Users") vinculado ao projeto, mas **não usado nesta passada** — aguarda a assinatura HTTP oficial do gateway `/api/v1/app-users/*` (Passada 2).

## SECRETS_REQUIRED
Nenhum secret novo. Já em uso:
- `LOVABLE_API_KEY` (managed)
- `GOOGLE_CALENDAR_API_KEY` (App Connector — admin)
- `GOOGLE_CALENDAR_ID` (opcional; default `primary`)

## ADMIN_GOOGLE_CALENDAR = DONE
- Events: já funcionava antes desta passada; mantida.
- Live workshops: agora sincronizam automaticamente em cada save no `AdminTablePage`. Falha do Google **não bloqueia** o save no Supabase — o toast reporta o erro real do provider (a edge function guarda status `failed` + `sync_error` na linha). Retry basta reabrir o registro e salvar de novo.

## USER_GOOGLE_CALENDAR = PENDING_PHASE_2
Não implementado nesta passada por decisão explícita do owner. O que já está pronto:
- Botão **Add to Google Calendar** (link `calendar.google.com/render` — sem OAuth) em todos os cards de event e workshop.
- Botão **Download .ics** com blob client-side, compatível com Apple Calendar, Outlook, e qualquer cliente RFC 5545.
- Nenhum token trafega. Nenhum secret exposto.

## EVENTS_HUB = DONE
`/events` renderiza header "Events Hub", 4 summary cards (Upcoming events / Live workshops / Registered / This month — todas alimentadas por dados reais do Supabase), tabs com estado sincronizado pela query string `?tab=events|workshops|calendar` e navegação por teclado via `role="tab"`.

### EVENTS_TAB = DONE
Grid `1 → 2 → 3` colunas, cards com título, data, horário, local, More info, Add to Google Calendar + Download .ics, e botão "Participate" com estados `sign-in / registered / registering / participate`.

### LIVE_WORKSHOPS_TAB = DONE
Grid `1 → 2` colunas, cards com data/horário, join link (só para membros/admin), Add to Google Calendar + Download .ics, botão "Participate" seguindo mesma lógica dos eventos. Aba **Past workshops** com replay quando disponível.

### CALENDAR_TAB = DONE
Grade mensal editorial no desktop (>= 640px) com legenda Event / Workshop / Registered, chips por dia coloridos com paleta oficial, painel lateral "Selected day" + "Upcoming", navegação Prev/Next/Today. Mobile (< 640px) mostra **agenda list** agrupada por dia, evitando grid apertado. Zero biblioteca externa.

## MANUAL_ADD_TO_GOOGLE_CALENDAR = DONE
`gcalRenderUrl(item)` monta `https://calendar.google.com/calendar/render?action=TEMPLATE&...` com `text`, `dates`, `details` (descrição + link) e `location`. Funciona para logged-out também.

## AUTO_ADD_ON_PARTICIPATE = PENDING_PHASE_2
Depende do OAuth de usuário. Copy nos cards deixa isso explícito para o registrado ("Add this event to your calendar manually — automatic sync is coming soon.").

## PROFILE_CALENDAR_INTEGRATION = PENDING_PHASE_2

## ADMIN_SYNC_STATUS = DONE
A coluna GCal do `AdminTablePage` renderiza um chip colorido `not_synced / pending / synced / failed / deleted`, um ícone **Open in Google Calendar** (usando o `html_link` retornado pelo provider) e um botão **Retry** que dispara `sync-*-to-google-calendar` com `action: "upsert"` in-place, sem abrir o formulário. Se o Google devolver erro, o toast mostra `[status] body` real do provider e a linha fica em `failed` com `sync_error` populado — não bloqueia o registro no Supabase.

## USER_SYNC_STATUS = PENDING_PHASE_2

## Segurança
- **TOKEN_EXPOSED_FRONTEND = NO** — nenhum edge function retorna token; frontend só recebe `status`, `html_link` (URL pública do próprio Google) e `error` string.
- **GOOGLE_API_FRONTEND = NO** — todas as chamadas Google saem da edge function via gateway. Frontend só monta links `calendar.google.com/render` (não é Google API, é UI web).
- **REFRESH_TOKEN_LOCALSTORAGE = NO** — refresh é feito pelo Lovable connector gateway; nenhum código armazena refresh_token em qualquer lugar.
- Nenhum `VITE_GOOGLE_CLIENT_SECRET` no bundle (grep confirma).

## Verificações
- `bun run typecheck` — validação automática do Lovable roda ao final da apply (não executei manualmente).
- Tests / lint / build — idem: rodam pelo pipeline do preview.
- **QA responsivo esperado (a validar visualmente):** 375px agenda-list, 390px agenda-list, 768px grid, 1024px grid + rail, 1280px grid + rail, 1440px grid + rail. Tabs em `overflow-x-auto no-scrollbar` cobrem overflow eventual em breakpoints estreitos.

## MAIN_CHANGED = NO
## PR_MERGED = NO
## STRIPE_CHANGED = NO

---

## Próxima passada (Passada 2)
1. Wire `connectAppUser` + `callAsAppUser` no App User Connector `google_calendar` (client `auc_01ky1a3hkgfawr34gwwwhrkj6x`) assim que a assinatura HTTP oficial estiver disponível ou o owner passar snippet de referência.
2. Novas edge functions: `user-google-calendar-connect-url`, `user-google-calendar-status`, `user-google-calendar-disconnect`, `user-google-calendar-add`, `user-google-calendar-remove`.
3. Migration: `registrations.user_google_calendar_*` + `profiles.calendar_auto_add_enabled`.
4. UI: seção **Calendar Integration** no `/profile`, botão "Sync automatically" nos cards, toggle auto-add + copy de segurança.
5. Fluxo Participate → auto-add on-behalf com fallback silencioso (sync opcional; nunca cancela inscrição).