
# Plano — Premortem + Importação + Edição em lote

## Objetivo
Rodar a importação do Manus com sucesso, gerar `import-report.json` (links e thumbnails faltantes) e entregar no admin uma tela de **edição em lote** das aulas (nome, URL de vídeo, descrição, thumbnail e status Draft/Published).

## Premortem — o que pode dar errado

1. **Import via edge function não invocável do app**
   - Hoje `/admin/content-import` faz upserts no client. RLS pode bloquear inserts em `courses/course_modules/lessons` mesmo para admin, fazendo o botão "Importar" parecer travado.
   - Sintoma do erro relatado: o "Run the Manus import" no chat só funciona via `supabase.functions.invoke`, não via fetch direto.
   - **Mitigação:** trocar a página para chamar `supabase.functions.invoke("manus-import", { body: { pack } })` (já dá certo com service-role).

2. **Edge function exigia `pack` no body**
   - Se algum caller chamar sem `pack`, retorna 400.
   - **Mitigação:** importar `manus-import.json` no client e enviar como `pack`. Manter o suporte a upload de JSON customizado.

3. **Edição em lote pode salvar lixo / sobrescrever**
   - Multi-edição inline sem confirmação pode corromper dezenas de aulas.
   - **Mitigação:** seleção explícita de linhas, modelo "Save All" único com diff visível, validação simples (URL válida, título não vazio), e nenhuma publicação automática.

4. **Publicar em massa sem checklist**
   - Publicar uma aula sem vídeo válido quebra a experiência do aluno.
   - **Mitigação:** ao marcar "Publish" em lote, ignorar (e sinalizar no toast) linhas sem `external_video_url`.

5. **Thumbnails legados (`/manus-storage/...`)**
   - 9 thumbs não existem no Storage.
   - **Mitigação:** botão de upload por linha (já temos `uploadCoverImage`) + relatório.

## Mudanças

### A. Importação funcional
- `AdminContentImport.tsx`: substituir o loop client-side por uma chamada única a `supabase.functions.invoke("manus-import", { body: { pack } })`.
- Renderizar o `report` retornado e disponibilizar **Download `import-report.json`**.
- Continua suportando upload de JSON do usuário; padrão = `manus-import.json` do repo.

### B. Nova tela: edição em lote de aulas
- Rota: `/admin/lessons` (link no AdminShell).
- Carrega todas as aulas com join de curso/módulo:
  - colunas: `[ ] select`, course, module, #, **title** (input), **video URL** (input), **description** (textarea), **thumbnail** (upload + preview), **status** (select Draft/Published/Archived).
- Filtros: por curso, por status, "sem vídeo", "sem thumb", busca por texto.
- Edição inline com tracking de "dirty rows"; botão **Save changes (N)** envia updates em paralelo via `updateLesson`.
- Ações em lote sobre seleção: **Publish selected**, **Move to Draft**, **Archive**, **Delete** (com confirm). Publish pula aulas sem `external_video_url` e mostra toast com quantos foram pulados.
- Sem schema novo, sem Stripe, sem mexer em RLS.

### C. Pequenos ajustes
- Adicionar link "Lessons (bulk)" no `AdminShell`.
- Reaproveitar `VideoPreview` para preview do URL após colar.

## Fora de escopo
- Mudanças no Supabase (schema/RLS), Stripe, autenticação, publicação automática de cursos.

## Validação
- Build limpo.
- Rodar import via UI: esperar 10 cursos / 10 módulos / 30 aulas + `report.missing_video_links.length === 30` e `missing_thumbnails.length === 9`.
- Editar 2 aulas em lote, salvar, recarregar e confirmar persistência.
