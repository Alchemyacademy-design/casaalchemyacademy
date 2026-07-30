# Support Materials (Materiais de apoio)

Hoje o "material" existe só como um único link solto (`external_resource_url`) por aula. A tabela `lesson_attachments` já existe no banco (com RLS correta), mas nunca foi usada pela interface. O plano transforma isso num recurso completo: arquivos e links de apoio, anexáveis ao **curso inteiro** ou a uma **aula específica**, gerenciáveis pelo admin e visíveis para os alunos com acesso.

## 1. Banco de dados (uma migração)

Estender `lesson_attachments` para suportar também material de curso:

- `lesson_id` passa a aceitar vazio (nulo) e entra a coluna `course_id` (referência ao curso, apaga em cascata).
- Regra: cada material aponta para uma aula **ou** para um curso — nunca os dois, nunca nenhum (validado por constraint).
- Novas colunas: `title` (nome amigável mostrado ao aluno), `description`, `external_url` (para material que é só um link, sem upload), `sort_order`.
- `storage_path` passa a aceitar vazio quando o material for apenas um link externo.
- Índice por `course_id`.

Regras de acesso (RLS) atualizadas:

- Admin e content manager: acesso total (já existe, estender para linhas de curso).
- Instrutor: acesso total aos materiais dos próprios cursos/aulas.
- Aluno: leitura quando `can_access_lesson(lesson_id)` for verdadeiro, ou — para material de curso — quando tiver assinatura ativa / entitlement do curso / curso gratuito (mesma lógica já usada em `can_access_lesson`, encapsulada numa nova função `can_access_course(_course_id)`).

Storage: usar o bucket privado **`course-assets`** já existente. Políticas em `storage.objects` para que admin/content manager/instrutor possam subir e apagar em `course-assets/materials/...`, e leitura via URL assinada gerada no cliente para quem passa na RLS.

## 2. Camada de dados no app

Novo arquivo `src/manus/lib/support-materials.ts`:

- `listCourseMaterials(courseId)` / `listLessonMaterials(lessonId)`
- `uploadMaterial({ file | externalUrl, title, description, courseId | lessonId, isDownloadable })` — sobe o arquivo para `course-assets/materials/<course|lesson>/<id>/<uuid>-<nome>` e grava a linha
- `updateMaterial(id, patch)` — editar título, descrição, link, ordem, flag de download
- `deleteMaterial(id)` — apaga a linha **e** o arquivo do storage
- `getMaterialUrl(material)` — devolve o `external_url` ou uma URL assinada de curta duração
- Validação no upload: máx. 50 MB, tipos permitidos (PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, ZIP, imagens, TXT, CSV, MP3), nome de arquivo sanitizado.

## 3. Admin — Course Management

Componente novo `src/manus/components/admin/SupportMaterialsPanel.tsx`, reutilizado nos dois escopos (recebe `courseId` ou `lessonId`):

- Área de **arrastar e soltar** (ou clicar para escolher arquivo), com barra de progresso e feedback de erro.
- Alternador "Arquivo" / "Link externo" para cadastrar material que é só uma URL.
- Lista dos materiais existentes com ícone por tipo, tamanho, título editável em linha, descrição, ordenação por arrastar, botão de baixar (pré-visualizar) e botão de excluir com confirmação.
- Chave "Permitir download" por material.

Onde aparece:

- **`AdminCourseDetail.tsx`** — nova aba/seção "Support materials" no nível do curso, ao lado do banner e da checklist de publicação. Materiais aqui valem para o curso todo.
- **Lesson editor** (o painel expandido de cada aula, dentro do mesmo arquivo) — a mesma seção "Support materials" dentro da aula, permitindo adicionar, editar e excluir por aula, como pedido.
- Um contador ("3 materiais") aparece na linha fechada da aula para saber de relance quais aulas já têm material.

## 4. Renderização para o aluno

- **`ModuleDetail.tsx`** (player da aula): abaixo do vídeo, bloco "Support materials" listando os materiais da aula — título, tipo, tamanho e botão de baixar/abrir (URL assinada gerada na hora do clique). Some quando a aula não tem material. Mantém o link legado `external_resource_url` se existir.
- **`CourseDetail.tsx`**: a seção "Materials" atual passa a mostrar os materiais reais — primeiro os do curso, depois os agregados das aulas (agrupados por aula), em vez de apenas os `external_resource_url`. Para quem não tem acesso, os itens aparecem bloqueados com cadeado e chamada para assinar.
- Estilo seguindo os tokens existentes (cartões dourados/escuros da área de membros), responsivo, alvos de toque de 44 px.

## 5. Ordem de execução

1. Migração do banco (schema + RLS + função `can_access_course` + políticas de storage)
2. `support-materials.ts`
3. `SupportMaterialsPanel.tsx`
4. Integração no `AdminCourseDetail.tsx` (curso + lesson editor)
5. Renderização em `ModuleDetail.tsx` e `CourseDetail.tsx`

## Premortem — o que poderia dar errado

- **Materiais vazando para não-assinantes**: mitigado usando bucket privado + URL assinada gerada só depois da checagem de RLS; nada de URL pública.
- **Arquivos órfãos no storage** ao excluir aula/curso: o `ON DELETE CASCADE` limpa as linhas, mas não os arquivos. Excluir material pela interface remove os dois; para exclusão em cascata, os arquivos ficam no bucket privado sem referência (inofensivos, e limpáveis depois).
- **Upload grande travando a interface**: limite de 50 MB e progresso visível.
- **Constraint de escopo**: garante que nenhum material fique "solto" sem curso nem aula.

## Detalhes técnicos

Tabela final `lesson_attachments`: `id, lesson_id (nullable), course_id (nullable), title, description, file_name, storage_bucket, storage_path (nullable), external_url, file_type, file_size, is_downloadable, is_public, sort_order, created_by, created_at, updated_at` + `CHECK (num_nonnulls(lesson_id, course_id) = 1)` + `CHECK (storage_path IS NOT NULL OR external_url IS NOT NULL)`.
