# Referências - Azure DevOps (Metanet)

## Executável principal
- `.cursor/skills/Azure/tools/ado_tool.py`
- `.cursor/skills/Azure/tools/card_manager.py`

## Configuração local
- Resolução de `.ado_config.json` (em ordem):
  1. variável de ambiente `ADO_CONFIG_PATH`;
  2. `.cursor/skills/Azure/tools/.ado_config.json` (ao lado do script);
  3. `.cursor/skills/Azure/.ado_config.json` (raiz da skill no workspace);
  4. `C:\Users\<usuario>\.cursor\skills\AzureLocal\.ado_config.json` (fallback legado).
- Template versionado: `.cursor/skills/Azure/.ado_config.example.json`.
- O arquivo real (`.ado_config.json`) não é versionado — cada dev copia o exemplo e preenche apenas o `pat`.

Comandos suportados:
- `get <id>`
- `query <wiql>`
- `update <id> <patch_json | @arquivo>`
- `create <type> <fields_json | @arquivo> [relations_json | @arquivo]`
- `pr <source> <target> <title> <description>`
- `pr-get <pr_id>`
- `pr-auto-complete <pr_id> <user_id> [delete_source_branch]`
- `wiki <wiki_id> <page_id>`
- `teams-list`, `teams-members <team_id_or_name>`
- `git-refs <repository_id_or_name>`
- `git-commits <repository_id_or_name> <query_json>`
- `git-prs <repository_id_or_name> <query_json>`
- `git-branch-stats <repository_id_or_name> <branch_name>`
- `auditar-prs --squads <Squad...> --columns <Coluna...> [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--types <tipo...>] [--only-active]` (via `card_manager.py`)
- `branches-sem-pr [--team <nome>] [--repository <repo>] [--compare-branch <base>] [--max-branches N] [--include-active]` (via `card_manager.py`)
- `review-card <card_id> [--repo-path <caminho_do_repo>] [--no-patch]` (via `card_manager.py`)
- `encerrar-card <card_id> --so <numero_so> --repo-path <caminho_repo_git> --mensagem <resumo_commit> [--target-branch master] [--criar-pr] [--dry-run] [--fato <texto>] [--causa <texto>] [--acao <texto>]` (via `card_manager.py`)

## Comando utilitário de triagem
- `review-card` resolve automaticamente:
  1. Card informado (`id`, tipo, título, status, coluna, responsável)
  2. PR(s) vinculada(s) direta e hierarquicamente (pai/filhos)
  3. Range de commits da PR (`targetCommit...sourceCommit`)
  4. Diff local no repositório (`git diff --name-only` e patch completo, salvo `--no-patch`)
  5. Em revisão técnica final, reportar cada achado com localização obrigatória no formato `caminho/arquivo:linhaInicial-linhaFinal`
- Exemplo:
  - `py ".cursor/skills/Azure/tools/card_manager.py" review-card 14850 --repo-path "C:\Projeto\master 2"`

## Comando utilitário de branches sem PR (Git)
- `branches-sem-pr` (somente leitura) cruza:
  1. membros do time informado (API `projects/{project}/teams/{team}/members`);
  2. todas as `refs/heads/*` do repositório Git;
  3. autor do primeiro commit divergente em relação à branch base (`--compare-branch`, padrão `master`);
  4. PRs com `searchCriteria.sourceRefName` = `refs/heads/<branch>`.
- Categorias: **A** nenhuma PR; **B** somente `completed`/`abandoned`; com **active** a branch vai para `ignoradasComPRAtiva`.
- `ado_tool.py` expõe `teams-list`, `teams-members`, `git-refs`, `git-commits`, `git-prs`, `git-branch-stats` para depuração manual.

## Comando utilitário de auditoria de PR
- `auditar-prs` valida PR em dois níveis:
  1. vínculo direto no card;
  2. vínculo hierárquico (pai/filhos).
- Flag `--only-active`:
  - retorna apenas cards com PR ativa (`status = active`);
  - mantém os totais de varredura em `totals.scanned`.
- Exemplo (cards concluídos da última semana, apenas com PR ativa):
  - `py ".cursor/skills/Azure/tools/card_manager.py" auditar-prs --squads "Squad Financeiro" "Squad DBA" --columns "Concluído" --from 2026-04-20 --to 2026-04-27 --only-active`

## Comando utilitário de encerramento
- `encerrar-card` executa o roteiro completo:
  1. valida card pai (tipo e responsável)
  2. preenche card pai sem alterar `System.Description`:
     - `User Story`: preencher `Custom.Funcionalidade` (FCA formatado)
     - `Bug`: preencher `Custom.5d2ff7c5-f7be-48db-aa96-24e2b6144230` (post mortem/FCA)
  3. cria filhos 1/2/3/4 com responsável herdado
  4. preenche campos dos filhos por regra:
     - `1. Análise`: Fato + Causa com contexto de impacto
     - `2. Desenvolvimento`: Ação + lista de classes/arquivos alterados
     - `3. Teste`: descrição de teste DEV
  5. encerra automaticamente 1/2/3
  6. mantém `4 (QA)` e pai abertos
  7. cria branch/commit e, opcionalmente, PR com auto-complete e auto-delete
  8. valida padrão/case do nome da branch (`features/us-<id>_SO<so>` ou `bugs/bug-<id>_SO<so>`), com prefixo de pasta **sempre minúsculo** (`features/`, `bugs/`) — ver `CARD_RULES.md` e regra 17 da skill
  9. se o `git push` falhar no Windows com `cannot be resolved to branch`, tentar refspec explícito: `git push -u origin HEAD:refs/heads/<nome-da-branch-com-prefixo-minusculo>`
- Exemplo:
  - `py ".cursor/skills/Azure/tools/card_manager.py" encerrar-card 15169 --so 669933 --repo-path "C:\Projeto\master 2" --mensagem "Resumo do que foi implementado" --criar-pr`

## Campos de Work Item mais usados
- `System.Id`
- `System.WorkItemType`
- `System.Title`
- `System.State`
- `System.Reason`
- `System.AssignedTo`
- `System.AreaPath`
- `System.IterationPath`
- `System.BoardColumn`
- `System.Tags`
- `System.Description`
- `Microsoft.VSTS.Common.ClosedDate`
- `Custom.Funcionalidade`
- `Custom.5d2ff7c5-f7be-48db-aa96-24e2b6144230` (post mortem)

## Mapeamento FCA no fluxo de encerramento
- Card pai `User Story`:
  - `System.Description`: **não alterar**
  - `Custom.Funcionalidade`: resumo técnico + FCA (formatado)
- Card pai `Bug`:
  - `System.Description`: **não alterar**
  - `Custom.5d2ff7c5-f7be-48db-aa96-24e2b6144230`: FCA (formatado)
- Filhos:
  - `1. Análise`: Fato + Causa em descrição, funcionalidade e post mortem
  - `2. Desenvolvimento`: Ação em descrição, funcionalidade e post mortem
  - `3. Teste`: descrição de execução de teste DEV

## Filtros recomendados por cenário
- **Concluídos no período**:
  - base principal: `Microsoft.VSTS.Common.ClosedDate`
  - apoio opcional: `System.State = 'Closed'`
- **Por squad**:
  - `System.AreaPath` com `UNDER 'Metanet\\Squad X'`
- **Por responsável atual**:
  - `System.AssignedTo = @Me`

## Observação sobre coluna do board
- `System.BoardColumn` pode variar por processo/time (`Concluído`, `Concluido`, `Closed`) e pode vir `null` em itens filhos.
- Não usar coluna como único critério de itens concluídos.

## Relações comuns
- Filho para Pai:
  - `System.LinkTypes.Hierarchy-Reverse`
- Test Case QA para card:
  - `Microsoft.VSTS.Common.TestedBy-Reverse`

## WIQL úteis
### Cards do squad Financeiro concluídos em 2026
```sql
SELECT
  [System.Id],
  [System.WorkItemType],
  [System.Title],
  [System.State],
  [System.AssignedTo],
  [Microsoft.VSTS.Common.ClosedDate]
FROM WorkItems
WHERE
  [System.TeamProject] = @project
  AND [System.AreaPath] UNDER 'Metanet\Squad Financeiro'
  AND [Microsoft.VSTS.Common.ClosedDate] >= '2026-01-01'
  AND [Microsoft.VSTS.Common.ClosedDate] < '2027-01-01'
ORDER BY [Microsoft.VSTS.Common.ClosedDate] DESC
```

### Cards no board column DEV IMPLEMENTANDO do usuário atual
```sql
SELECT
  [System.Id],
  [System.WorkItemType],
  [System.Title],
  [System.State],
  [System.BoardColumn],
  [System.AssignedTo]
FROM WorkItems
WHERE
  [System.TeamProject] = @project
  AND [System.BoardColumn] = 'DEV IMPLEMENTANDO'
  AND [System.AssignedTo] = @Me
ORDER BY [System.ChangedDate] DESC
```

### Filhos de um card
```sql
SELECT
  [System.Id],
  [System.WorkItemType],
  [System.Title],
  [System.State]
FROM WorkItemLinks
WHERE
  [Source].[System.Id] = 15688
  AND [System.Links.LinkType] = 'System.LinkTypes.Hierarchy-Forward'
MODE (Recursive, ReturnMatchingChildren)
```

## Convenções importantes
- Sempre que possível, usar patch via arquivo JSON (`@arquivo`) para reduzir erros de escape.
- Para textos em HTML (FCA/steps), manter UTF-8 e acentuação correta.
- Respeitar `CARD_RULES.md` para nomenclatura de branch/commit e padrão de encerramento.
- Em lotes grandes com `workitemsbatch`, consultar em chunks de 100-200 IDs.

## Validação de PRs (padrão)
- **Nível 1 (direto)**:
  - card concluído com PR ativa vinculada diretamente.
- **Nível 2 (hierárquico)**:
  - PR vinculada em filho (Task/Test Case) ou pai do card.
- Sempre informar no resultado qual nível foi aplicado.
