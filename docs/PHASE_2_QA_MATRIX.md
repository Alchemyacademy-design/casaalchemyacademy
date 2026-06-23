# PHASE 2 — QA MATRIX + PREMORTEM (read-only)

Plano de testes da Fase 2 sem usuários reais. Tudo via mocks tipados
(vitest + RTL). Nada é executado nesta fase.

## 1. Matriz de testes

### Catálogo (`/mycourses` + landing)

| ID | Cenário | Esperado |
|---|---|---|
| C1 | Admin autenticado | Vê cursos `draft` com badge DRAFT |
| C2 | Member sem entitlement, curso pago | Card aparece com Lock + CTA "Coming Soon" (Stripe adiado) |
| C3 | Member com entitlement | Vê "Continue" se `lesson_progress > 0`, senão "Start" |
| C4 | Sem cursos | Empty state com mensagem e ação secundária |
| C5 | Erro de fetch | `QueryStateView` mostra erro + Retry funcional |
| C6 | Busca "color" | Filtra por título/subtítulo, case-insensitive, debounced |
| C7 | Filtro status (admin) | `published` / `draft` / `archived` (archived oculto por padrão) |
| C8 | Curso arquivado | Nunca aparece para member |

### Course Detail (`/courses/:id`)

| ID | Cenário | Esperado |
|---|---|---|
| D1 | Curso com módulos+aulas+progresso | Renderiza overview, %, Learning Path, Continue → último lesson |
| D2 | Curso 0 aulas | % = 0, Start desabilitado com tooltip |
| D3 | Curso não encontrado | 404 amigável + Voltar |
| D4 | Erro fetch | Retry restaura |
| D5 | Admin preview drafts | Vê módulos draft com badge |
| D6 | Acesso negado | `AccessGate` mostra estado bloqueado |
| D7 | Materiais agregados | Lista única deduplicada |

### Module Detail (`/modules/:id`)

| ID | Cenário | Esperado |
|---|---|---|
| M1 | URL com `#lesson-3` | Aula 3 ativa, sidebar destaca, scroll |
| M2 | Sem hash | Primeira aula ativa |
| M3 | Mark Complete | Otimista + cross-tab + persistido |
| M4 | Unmark | Reverte estado + cross-tab |
| M5 | Previous na 1ª aula | Desabilitado |
| M6 | Next na última | Desabilitado ou vai para próximo módulo (decidido na E4) |
| M7 | Player YouTube válido | `<iframe>` com sandbox, sem autoplay |
| M8 | Player Vimeo válido | idem |
| M9 | Player URL inválida | Fallback link externo |
| M10 | Sem vídeo | Estado "Coming soon" |
| M11 | Material com host conhecido | Mostra hostname + Open |
| M12 | Sem material | Estado vazio |
| M13 | Aula arquivada | Não listada |
| M14 | Mobile | Sidebar colapsa em drawer/`<details>` |

### Acesso

| ID | Cenário | Esperado |
|---|---|---|
| A1 | `isAdmin` | Vê tudo |
| A2 | `isMember` | Vê cursos sem `access_plan_keys` restritivo |
| A3 | Entitlement por `course_id` | Acesso pontual |
| A4 | Visitante | Vê preview público (lessons.is_preview) |

### Quiz (planejamento, não implementar)

| ID | Cenário | Esperado |
|---|---|---|
| Q1 | Navegação Previous/Next | Estado mantido |
| Q2 | Seleção exclusiva | 1 opção por questão |
| Q3 | Submissão | Cria `quiz_attempt` + `quiz_answers` |
| Q4 | Resultado | Pontuação e regra de aprovação |
| Q5 | Persistência | Recarregar mostra tentativa anterior |

### Cross-tab + reliability (Fase 1, regressão)

| ID | Cenário | Esperado |
|---|---|---|
| X1 | Marcar em aba A | Aba B invalida cache de progresso |
| X2 | Cross-tab sem BroadcastChannel | Fallback `storage` event funciona |

## 2. Premortem

| Falha | Impacto | Probabilidade | 1º sinal | Prevenção | Rollback |
|---|---|---|---|---|---|
| Confundir curso ↔ módulo na UI | Confusão de navegação, métricas erradas | Médio | Card "módulo" abre overview de curso | Glossário em PR + lint de termos em copy | Revert PR de copy |
| Asset legado `/manus-storage/*` referenciado | 404 em produção | Médio | Imagens quebradas em `Home`/`Modules` | Proibir em PR (rg check no CI) | Substituir por placeholder |
| Player com iframe sem sandbox / XSS via URL | Risco de segurança | Baixo | URL atípica passando pelo regex | Whitelist YouTube/Vimeo + sandbox + `Content-Security-Policy` em `<iframe>` | Voltar para fallback link |
| Conteúdo draft vazando para member | Dados não publicados expostos | Médio | Curso draft visível sem admin | Testes C1/C2, filtros `.eq("status","published")` + RLS no servidor | Hotfix filtro |
| Progresso incorreto | Member não retoma aula | Médio | "Continue" levando à aula errada | `pickResumeLessonId` testado, mocks de progresso | Limpar cache |
| Aula/módulo arquivado aparecendo | Dados antigos visíveis | Baixo | `archived_at` ignorado | `.is("archived_at", null)` em hooks (Fase 1 já cobre) | Hotfix filtro |
| CTA financeiro chamando Stripe | Cobrança indevida | Baixa | Network call a `create-checkout-session` | Botões disabled + assert em teste E2E + revisão obrigatória do PR | Desativar rota |
| Responsividade quebrada (sidebar mobile) | Aula inacessível em mobile | Médio | Sidebar fora da viewport | Teste de viewport + `data-testid` no drawer | Forçar `<details>` fallback |
| Quiz sem vínculo a lesson/module | Quiz órfão | Médio | `quizzes.module_id` null | Validar schema na E7 antes de UI | Não publicar Quiz |
| Certificado emitido precocemente | Aluna inexistente recebe cert | Alto | Linha em `certificates` antes de 100% | Manter feature OFF na fase, gate por progresso real + quiz | Soft-delete por SQL admin |
| Identidade `--aa-*` sobrescrevendo tokens atuais | Visual quebrado | Médio | Cores destoam, fontes diferentes | Code review banindo hex `#C4A05A` etc., lint regex no CI | Reverter PR |
| Botão `btn-gold` legado deixado em ModuleDetail | Estilo fora do sistema | Alto (já presente) | Botão dourado destacado | Substituir por `Button` shadcn na E4 | Reverter classe |
| `VideoPreview` permanecendo em `CourseDetail` | Overlap com Module Detail | Alto (estado atual) | Vídeo na overview | Remover na E3 com teste D7 | Reverter remoção |
| Esquecer `rel="noopener noreferrer"` em materiais | Vulnerabilidade tabnabbing | Médio | DevTools mostra `window.opener` | Helper centralizado em `LessonMaterial` | Patch utilitário |

## 3. Confirmação

Read-only. Nada foi implementado ou alterado.


---
## Update — Phase 2A implemented (2026-06-23)

See `docs/PHASE_2A_IMPLEMENTATION_REPORT.md` for the diff, gates, and test counts. Status: `PHASE_2A_STATUS = IMPLEMENTED_PENDING_EXTERNAL_AUDIT`. Stripe untouched (`STRIPE_STATUS=ADIADO`). 141/141 tests pass.
