# CadastrarTasks (`/CadastrarTasks`)

## Finalidade

Automatizar o cadastro das **sete tasks-padrão** de backlog no Azure DevOps (projeto **Metanet**), como filhas (**Child**) de um card pai informado pelo usuário, alinhado ao checklist do Tech Lead e às convenções do time — e criar um **Test Case de QA** como **filho** da task **`7. Testing`** (título fixo `QA — Test Case`, **sem** Steps na criação inicial).

## Divergência em relação ao `techlead.md`

O documento **techlead.md** (pool Demandas; se o time versionar, manter cópia em `.cursor/skills/` do repositório) cita **cinco** tasks: Requirements, Development, TechnicalValidation, CodeReview e Testing. **Esta skill inclui** a task **`3. DevelopmentTests`** (testes automatizados do dev) e a task **`5. Documentation`** entre **TechnicalValidation** e **CodeReview**; **CodeReview** e **Testing** passam a ser **`6.`** e **`7.`**. Ajuste wiki ou DoD interno se o processo oficial ainda listar apenas cinco itens.

## Pré-requisitos

1. Python via `py`.
2. Arquivo **`.ado_config.json`** com `organization`, `project` e `pat`. Ordem de busca do script (a partir da raiz do repositório em `.cursor/skills/`):
   - variável de ambiente **`ADO_CONFIG_PATH`**;
   - `cadastrar-tasks-azure/tools/.ado_config.json`;
   - `cadastrar-tasks-azure/.ado_config.json`;
   - `Azure/tools/.ado_config.json` (mesmo arquivo usado pelo `ado_tool.py` versionado);
   - `Azure/.ado_config.json`;
   - `%USERPROFILE%\.cursor\skills\AzureLocal\.ado_config.json` (fallback legado, fora do repo).
3. Consulte a skill Azure versionada no repositório: [SKILL.md](../Azure/SKILL.md) (regras gerais; compatível com o setup legado **AzureLocal** no user profile apenas para PAT).
4. **Não** expor PAT em logs, chats ou repositório.

## Tabela fixa (única fonte — Requirements / títulos / Activity)

Não usar variações ad hoc de título ou Activity fora desta tabela.

O campo **Activity** (`Microsoft.VSTS.Common.Activity`) do tipo Task inclui os valores **`DevelopmentTest`** e **`Documentation`** na picklist do processo Metanet (junto a `Requirements`, `Development`, `CodeReview`, etc.).

| Ordem | `System.Title` | `Microsoft.VSTS.Common.Activity` |
|------:|----------------|-----------------------------------|
| 1 | `1. Requirements` | `Requirements` |
| 2 | `2. Development` | `Development` |
| 3 | `3. DevelopmentTests` | `DevelopmentTest` |
| 4 | `4. TechnicalValidation` | `TechnicalValidation` |
| 5 | `5. Documentation - Documentação de implementações na Wiki` | `Documentation` |
| 6 | `6. CodeReview` | `CodeReview` |
| 7 | `7. Testing` | `Testing` |

### Test Case de QA (filho da task 7)

Após as sete tasks, o script garante um work item **Test Case** com título **`QA — Test Case`**, ligado como **filho** (`Hierarchy`) da task **`7. Testing`** (não do card pai). **Não** envia o campo **Steps** (`Microsoft.VSTS.TCM.Steps`) na criação; o time preenche depois. Se já existir Test Case com esse **título exato** sob a task 7, **não** recria.

### Descrições pré-preenchidas na criação

Arquivo versionado: **`cadastrar-tasks-azure/tools/descriptions_padrao.json`** (chaves `developmentTests`, `technicalValidation` e `documentation`, HTML para `System.Description`). Edite esse JSON para ajustar textos sem alterar o Python.

- **Linha 3 (`3. DevelopmentTests`):** conteúdo da chave `developmentTests` — orientação para testes unitários e de integração.
- **Linha 4 (`4. TechnicalValidation`):** conteúdo da chave `technicalValidation`.
- **Linha 5 (Documentation):** conteúdo da chave `documentation`.
- **Demais linhas (1, 2, 6 e 7):** quando o card vier de **plano de ação**, o agente deve preencher `System.Description` em HTML seguindo `../orquestrador-tasks-azure/references/task-description-padrao.md` — **não** deixar apenas `<p>Preencher descrição.</p>`.
- **Task `1. Requirements`:** resumo completo da análise/conversa (decisões, escopo IN/OUT, critérios de aceite) — ver variação **1. Requirements** no arquivo acima.
- **Tasks `2.x` Development:** uma entrega por task, com exemplo simplificado e limites de escopo (`O que NÃO fazer`) — ver variação **2.x Development** no arquivo acima.
- **Tasks `6. CodeReview` e `7. Testing`:** quando o plano de ação definir escopo específico, usar o mesmo padrão HTML; caso contrário, placeholder até preenchimento manual.

No fluxo manual com `ado_tool.py`, usar HTML conforme `task-description-padrao.md` ou copiar do JSON quando for texto padrão fixo (DevelopmentTests/TechnicalValidation/Documentation). Após `cadastrar_tasks_padrao.py`, usar `ado_tool.py update` para tasks 1, 2, 6 e 7 quando houver plano de ação na conversa.

## Regras obrigatórias (skill Azure do repositório + CARD_RULES)

1. Respeitar [CARD_RULES.md](../Azure/CARD_RULES.md) e a [skill Azure](../Azure/SKILL.md) para texto em **português** com **UTF-8** e acentuação correta.
2. **`System.AssignedTo` (tasks):**
   - **`1. Requirements`** e **`6. CodeReview`:** atribuir ao **usuário que invoca** `/cadastrar-tasks` (resolvido automaticamente pelo PAT em `.ado_config.json`; override opcional com `--assignee EMAIL`).
   - **Demais tasks (2, 3, 4, 5 e 7):** **não** enviar `System.AssignedTo` na criação.
3. **`System.AssignedTo` (Test Case de QA):** **nunca** atribuir na criação — o QA ainda não foi definido nesta etapa; o time atribui manualmente depois.
4. Copiar do pai: **`System.AreaPath`**, **`System.IterationPath`**.
5. **Não** alterar `System.State`, `System.BoardColumn` nem equivalentes no **pai** (nem forçar mudança nos filhos por esta skill).
6. **Test Case de QA:** após existir a task **`7. Testing`** (criada neste run ou já existente como filha do pai), criar **um** work item **Test Case** com título **`QA — Test Case`** como **filho** dessa task (`System.LinkTypes.Hierarchy-Reverse` apontando para a URL da task 7). **Não** preencher **Steps** na criação. **Não** preencher **`System.AssignedTo`**. **Duplicidade:** se já existir Test Case filho da task 7 com o **mesmo** `System.Title`, não recriar.
7. **Não** criar vínculo `Tested By` entre Test Case e card pai nesta skill (apenas hierarquia task 7 → Test Case).
8. Descrição inicial: linhas **3**, **4** e **5** usam o HTML de `tools/descriptions_padrao.json` (`developmentTests`, `technicalValidation` e `documentation`). Linhas **1, 2, 6 e 7**: se houver **plano de ação** na conversa, preencher com HTML conforme `../orquestrador-tasks-azure/references/task-description-padrao.md`; se **não** houver plano, o script pode criar com placeholder `<p>Preencher descrição.</p>` até atualização manual.
9. **Duplicidade (tasks):** se já existir filho com o **mesmo** `System.Title` da tabela, **não** recriar. Para a linha **5**, considerar duplicata se já existir filho cujo título **comece com** `5. Documentation` (compatível com títulos já criados no board).

## Fluxo do agente (invocação `/CadastrarTasks`)

1. Confirmar existência de `.ado_config.json` (prioridade: `Azure/` ou `cadastrar-tasks-azure/` na worktree; depois fallback em `%USERPROFILE%\.cursor\skills\AzureLocal\` se aplicável).
2. Obter do usuário o **ID numérico** do card pai (Bug, User Story ou Feature).
3. Executar o script (recomendado) ou, na ausência de script, repetir `ado_tool.py create` conforme [EXAMPLES.md](../Azure/EXAMPLES.md) (secção 7), uma linha da tabela por vez.
4. Relacionar cada **Task** ao pai com `System.LinkTypes.Hierarchy-Reverse` para o card pai. O **Test Case** de QA liga-se com `Hierarchy-Reverse` **apenas** para a task `7. Testing` (URL `_links.self` da task).
5. Ao **concluir** (sucesso ou falha parcial), incluir **exatamente uma** sugestão curta de melhoria do fluxo (ex.: ampliar detecção de duplicados para outros prefixos numerados) para evoluir o hábito até estabilizar.

## Script recomendado

```text
py ".cursor/skills/cadastrar-tasks-azure/tools/cadastrar_tasks_padrao.py" <ID_PAI>
py ".cursor/skills/cadastrar-tasks-azure/tools/cadastrar_tasks_padrao.py" <ID_PAI> --assignee usuario@empresa.com.br
```
(executar na **raiz do repositório** do workspace)

- **`--dry-run`:** só valida o pai (existência, área) e lista o que seria criado ou pulado (sem POST).
- **`--assignee`:** opcional; sobrescreve o e-mail usado em `1. Requirements` e `6. CodeReview` (padrão: usuário do PAT).

## Referência técnica (ado_tool)

```text
py ".cursor/skills/Azure/tools/ado_tool.py" get <ID>
py ".cursor/skills/Azure/tools/ado_tool.py" create Task "@fields.json" "@relations.json"
py ".cursor/skills/Azure/tools/ado_tool.py" create "Test Case" "@qa_fields.json" "@qa_relations.json"
```

Para o Test Case de QA (manual), `qa_relations.json` deve usar `Hierarchy-Reverse` com a URL `_links.self` da task **7. Testing** (não use `Tested By` para o card pai, se quiser espelhar o script).

## Changelog (validação de processo)

| Data | Nota |
|------|------|
| 2026-05-12 | Referência WI **15521** (User Story) e filha **17009** (Task): campo `Microsoft.VSTS.Common.Activity` = `Development` confirmado no processo Metanet. |
| 2026-05-13 | **Documentation:** valor `Documentation` em Activity confirmado na picklist do tipo Task (processo Metanet). Título canônico da linha 4 alinhado ao padrão do board: `4. Documentation - Documentação de implementações na Wiki`. Se algum outro valor da tabela falhar na API (picklist), ajustar só a coluna Activity e registrar aqui. **TechnicalValidation:** descrição HTML padrão na criação da task `3.`. **Descrições:** textos das linhas 3 e 4 em `tools/descriptions_padrao.json`. **Caminhos:** links e exemplos relativos à worktree (`.cursor/skills/Azure/`); `cadastrar_tasks_padrao.py` resolve `.ado_config.json` em `Azure/tools` e `Azure/` do repositório antes do fallback `%USERPROFILE%\.cursor\skills\AzureLocal\`. |
| 2026-05-14 | **AssignedTo:** removido bloqueio quando o pai está sem responsável; `System.AssignedTo` nas filhas só é definido se o pai tiver assignee. **Test Case QA:** após garantir a task `6. Testing`, o script cria o item `QA — Test Case` como **filho** dessa task (sem Steps iniciais); duplicata se já existir Test Case com o mesmo título sob a task 6. |
| 2026-05-18 | **AssignedTo:** tasks e Test Case de QA passam a ser criados **sempre sem** `System.AssignedTo`, independentemente do responsável do card pai. |
| 2026-05-19 | **AssignedTo:** tasks **`1. Requirements`** e **`5. CodeReview`** passam a ser atribuídas ao usuário que invoca o comando (PAT ou `--assignee`); demais tasks e **Test Case de QA** permanecem **sem** responsável na criação (QA definido depois). |
| 2026-06-18 | **Descrição de tasks:** padrão HTML movido para `orquestrador-tasks-azure/references/task-description-padrao.md`; regra 8 alinhada (plano de ação → HTML completo; sem plano → placeholder). |
| 2026-06-23 | **DevelopmentTests:** nova task **`3. DevelopmentTests`** com Activity `DevelopmentTest` e descrição padrão (`developmentTests` em `descriptions_padrao.json`) orientando testes unitários e de integração. Renumeração: TechnicalValidation → `4.`, Documentation → `5.`, CodeReview → `6.`, Testing → `7.`. Test Case de QA passa a ser filho da task **`7. Testing`**. AssignedTo em **`1. Requirements`** e **`6. CodeReview`**. |
