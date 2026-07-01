# Plano de Estabilização Funcional — Fase 2.7

Objetivo: tudo que o admin publicar aparece corretamente na área de membros; comunidade funcional; upload de avatar; criação de novo curso idêntica aos existentes; vídeos Dropbox tocando de fato.

## 1. Vídeos das aulas (Dropbox) tocando na área de membros

**Sintoma**: link salvo no admin, mas aula mostra "Video coming soon" ou "Unable to play".

Ações:
- Auditar `parseVideoUrl` para Dropbox `/scl/fi/...` sem extensão no path (caso comum de link "Copy link"). Adicionar suporte a extensão detectada via querystring (`?dl=0`) e, quando ausente, reescrever `dropbox.com` → `dl.dropboxusercontent.com` mantendo `rlkey` e forçando `raw=1`.
- Cobrir formato `dropbox.com/s/<id>/<file>.mp4?dl=0` (legado) além do atual `/scl/fi/`.
- Em `LessonPlayer`, quando `provider === "external"` e a URL for Dropbox mas sem extensão reconhecida, exibir aviso claro no admin com instrução ("cole o link direto do arquivo, não da pasta").
- Adicionar testes em `video-url.test.ts` para 4 formatos reais (scl/fi mp4, scl/fi mov, /s/ legacy, pasta compartilhada — deve cair em external).
- Validar com Playwright em `/courses/:id` + `/modules/:moduleId` que o `<video>` tem `src` normalizado com `raw=1`.

## 2. Criar Novo Curso — mesma estrutura dos existentes

**Sintoma**: botão "New course" abre rota `/admin/courses/new` que não existe (não há `AdminCourseNew.tsx`).

Ações:
- Criar `/admin/courses/new` reutilizando o mesmo formulário do `AdminCourseDetail` (form compartilhado: título, slug, subtitle, descrição, thumbnail via `ThumbnailField`, status, sort_order, plano requerido).
- Após criação, redirecionar para `/admin/courses/:id` onde o admin já adiciona módulos, aulas (com o mesmo `LessonVideoUpload` + campo `external_video_url` + `VideoPreview`) e quizzes — fluxo idêntico aos cursos existentes.
- Garantir que o INSERT respeite RLS de admin e defaults (`status='draft'`, `sort_order = max+1`).

## 3. Renderização admin → membros (sanity pass)

Para cada entidade editada no Admin Center, confirmar que o membro vê imediatamente:

| Admin | Membro | Verificação |
|-------|--------|-------------|
| Courses / Modules / Lessons | `/courses/:id`, `/modules/:id` | thumb, título, vídeo, materiais |
| Quizzes | dentro da última aula do módulo | já corrigido — revalidar |
| Magazine | `/magazine` | PDF + capa recém-upados |
| Events / Workshops | `/events`, `/live-workshops` | data, link, registro |
| Suppliers / Deals | `/suppliers`, `/deals` | listagem + categoria |
| Plans | `/plans` | preço, features, CTA |

Ação: criar `docs/PHASE_2_7_INTEGRATION_MATRIX.md` marcando cada célula verde/vermelha após smoke test manual + Playwright.

## 4. Upload de imagem de perfil + exibição na comunidade

Backend:
- Reusar bucket **public-assets** (já existe). Prefixo `avatars/{user_id}/{uuid}.{ext}`.
- Policy de INSERT/UPDATE: usuário só grava dentro de `avatars/<auth.uid()>/…`. SELECT público (bucket já é público).

Frontend:
- Em `Profile.tsx`, adicionar bloco "Profile picture": preview do avatar atual (`profile.avatar_path`), botão Upload (aceita jpg/png/webp, máx 2 MB), Remove.
- Escrever `avatar_path` = URL pública final (ou `avatars://key` → resolver via `getPublicUrl` no client, análogo a `uploadPublicAsset`).
- `CommunityPremium` já lê `profile.avatar_path` → nenhuma mudança lá, apenas garantir refetch após save.
- Fallback: iniciais permanecem quando `avatar_path` for null.

## 5. Comunidade funcional

Auditoria dirigida:
- Confirmar RLS de `community_spaces / channels / posts / replies / reactions` permite `authenticated` ler e escrever conforme escopo (post do próprio user; reply idem; reaction upsert por user).
- Testar fluxo end-to-end: escolher space → channel → criar post com título/body → responder → reagir → deletar próprio post → moderar (admin).
- Corrigir erros de invalidação do React Query após create/delete (revalidar `usePostsInfinite`, `useReplies`).
- Adicionar Playwright cobrindo: criar post, ver avatar renderizado, reagir, refresh e permanecer.

## 6. Testes e QA

- Vitest: novos testes de `video-url`, `Profile.avatar`, `AdminCourseNew`.
- Playwright autenticado como admin **e** como membro: /admin/courses/new, /courses/:id (play), /community (post+reação+avatar), /profile (upload).
- Rodar `bun install`, typecheck, lint, test, build. Registrar contagem final.

## 7. Entregáveis

- Código nas áreas acima.
- `docs/PHASE_2_7_INTEGRATION_MATRIX.md` (matriz admin↔membro).
- `docs/PHASE_2_7_STABILIZATION_REPORT.md` (HEAD, mudanças, riscos, resultado dos testes, screenshots Playwright).

## Fora de escopo
- Stripe / billing / webhooks.
- Mudanças em `main` ou merge do PR.
- Refatorações de design fora dos pontos citados.

## Detalhes técnicos-chave

- Dropbox regex atual em `video-url.ts` só reconhece extensão no path. Ampliar para: se host Dropbox e path `/scl/fi/…` sem extensão, ler último segmento do path — Dropbox sempre inclui o nome do arquivo com extensão no fim (`/scl/fi/<id>/<name.ext>`); portanto o parser já deveria pegar. Investigar se os links salvos foram truncados ou vieram no formato `?dl=0` sem extensão visível (link de pasta). Ajustar UI admin para rejeitar link de pasta.
- Avatar upload: usar `supabase.storage.from('public-assets').upload(...)` + `getPublicUrl` → gravar URL absoluta em `profiles.avatar_path` para simplificar consumo (community já usa como `<img src>`).
- New course: extrair `CourseForm` de `AdminCourseDetail` para componente compartilhado consumido por `AdminCourseDetail` e `AdminCourseNew`.
