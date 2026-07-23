## Escopo confirmado

- `/` vira landing page pública. Usuários logados são redirecionados automaticamente para `/dashboard` ao acessar `/`.
- HubSpot via **Private App Token** (`HUBSPOT_PRIVATE_APP_TOKEN` como secret).
- Email de confirmação via **Resend**.
- Vídeo da free lesson: **usar placeholder até você me passar o link** (edito depois em 1 minuto).

---

## Etapa 1 — Landing page pública em `/`

Refazer `Home.tsx` como landing de conversão, mantendo a identidade visual (Instrument Serif + Manrope, paleta atual). Estrutura:

1. **Hero** — headline emocional, sub, CTA duplo: "Watch free lesson" (abre pop-up) + "Take the quiz".
2. **Sobre o método** — 3 pilares curtos, tom Lorena.
3. **Cursos em destaque** — 3-4 cards puxados de `courses` (published + featured), link pra `/courses`.
4. **Bloco quiz** — banner "Not sure which course is right for you?" com CTA pra `/quiz`.
5. **Depoimentos / prova social** — placeholder editável (você me passa depois).
6. **Lead magnet inline** — bloco fixo perto do footer com o mesmo formulário do pop-up (Name/Email/Phone → "Watch the free lesson").
7. **FAQ** curto + **Footer** com links legais.

Logados vão pra `/dashboard` automaticamente (guard em `Home.tsx`).

---

## Etapa 2 — Lead magnet pop-up

- Componente `LeadMagnetDialog.tsx` que abre 10s após load, uma vez por visitante.
- Suprimido para: usuários logados, `localStorage.leadPopupDismissedAt` < 7 dias atrás, admin.
- Campos: Name, Email, Phone (todos required) + honeypot invisível anti-bot.
- Validação client-side com Zod.
- Submit chama edge function `capture-lead` → redireciona pra `/free-lesson`.
- Página `/free-lesson` pública com o vídeo embed (placeholder até você me passar o link).
- Versão inline (não-modal) do mesmo form no footer da landing.

---

## Etapa 3 — Quiz de recomendação em `/quiz`

- 5 perguntas de múltipla escolha (mapeadas para cursos existentes) num arquivo `quizConfig.ts` fácil de editar.
- Draft inicial baseado no seu texto (cores, sala, jantar, quarto) + 1 pergunta de estilo e 1 de orçamento/timeline.
- Progress bar, uma pergunta por tela, botão "voltar".
- Antes de revelar o resultado, gate com form Name/Email/Phone ("unlock your result and free gift").
- Após submit → mostra o curso recomendado + botão "Watch your free lesson" → `/free-lesson`.
- Backend igual ao pop-up, mas `source = 'quiz'` + `metadata.recommended_course` gravado.

---

## Etapa 4 — Backend

### Migration
- Tabela `public.leads` (name, email, phone, source enum `'popup'|'quiz'`, metadata jsonb, ip_hash text, user_agent text, created_at).
- `GRANT INSERT` para `anon` (sem SELECT). `SELECT/UPDATE/DELETE` só para admin via RLS.
- Índice único parcial em `(lower(email), source)` para deduplicar.

### Edge function `capture-lead`
- CORS habilitado. Aceita POST público sem JWT.
- Valida payload com Zod. Rate limit simples via `checkout_rate_limits` (reutiliza padrão existente) por IP.
- Insere em `leads` (upsert on conflict).
- Chama HubSpot Contacts API (`PATCH /crm/v3/objects/contacts/{email}?idProperty=email` com fallback pra POST):
  - Cria/atualiza propriedades: `firstname`, `lastname`, `email`, `phone`, `lead_source` (custom).
  - Se `lead_source` property não existir no HubSpot, cria via `POST /crm/v3/properties/contacts` uma vez (ignora 409).
  - Se `HUBSPOT_LEAD_LIST_ID` estiver setado, adiciona à static list; senão skip com log.
- Chama Resend (`/emails`) com o email de confirmação (subject/copy editáveis).
- Retorna `{ ok: true, redirect: '/free-lesson' }`.

### Secrets
- `HUBSPOT_PRIVATE_APP_TOKEN` — pedirei via secure form.
- `HUBSPOT_LEAD_LIST_ID` — opcional, você me passa depois; skip gracioso enquanto ausente.
- `RESEND_API_KEY` — se ainda não configurado, conectarei o connector Resend.
- `FREE_LESSON_VIDEO_URL` — opcional; se ausente, `/free-lesson` mostra um "coming soon" só para admin poder testar.

---

## Etapa 5 — Ordem de execução

1. Migration `leads` + índice + RLS.
2. `add_secret` para `HUBSPOT_PRIVATE_APP_TOKEN` (você preenche no formulário seguro).
3. Conectar Resend (se ainda não conectado) via connector.
4. Edge function `capture-lead`.
5. Componentes: `LeadMagnetDialog`, `LeadMagnetInlineBlock`, `/free-lesson` page.
6. Página `/quiz` + `quizConfig.ts`.
7. Reescrita de `Home.tsx` como landing.
8. Guard: logado em `/` → `/dashboard`.
9. Typecheck + smoke test com Playwright.

---

## Pendências que travam produção (não bloqueiam o build)

Vou entregar tudo funcional com placeholders claros. Depois você me passa:

1. Link do vídeo da free lesson.
2. ID da static list HubSpot ("Lead Magnet Sign-ups") — ou aprovação para eu criar via API na primeira execução.
3. Subject + corpo do email de confirmação.
4. Wording final das 5 perguntas do quiz + mapeamento answer → curso.
5. Scopes na Private App HubSpot: `crm.objects.contacts.read`, `crm.objects.contacts.write`, `crm.lists.write`, `crm.schemas.contacts.write`.

Confirma que posso executar assim? Se quiser mudar algo (ex.: adiar quiz, cortar Resend), me avisa antes.