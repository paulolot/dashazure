---
description: Cadastra as 7 tasks-padrão do Tech Lead no Azure DevOps (filhas do card pai) e o Test Case de QA filho da task 7. Testing
---
# `/CadastrarTasks`

Use a skill **[cadastrar-tasks-azure](../skills/cadastrar-tasks-azure/SKILL.md)** ao invocar este comando.

## O que fazer

1. Ler o `SKILL.md` da skill (tabela fixa, Test Case de QA, bloqueios, evolução).
2. Pedir ou receber o **ID do card pai** (Bug, User Story ou Feature).
3. Executar o script na **raiz do repositório** (com `--dry-run` primeiro se o usuário preferir validar sem criar):

```powershell
py ".cursor/skills/cadastrar-tasks-azure/tools/cadastrar_tasks_padrao.py" --dry-run <ID_PAI>
py ".cursor/skills/cadastrar-tasks-azure/tools/cadastrar_tasks_padrao.py" <ID_PAI>
```

4. Se o script não estiver disponível, seguir o fluxo manual com [ado_tool.py](../skills/Azure/tools/ado_tool.py) e [EXAMPLES.md](../skills/Azure/EXAMPLES.md): criar cada **Task** com `Hierarchy-Reverse` para o **card pai**, **uma linha da tabela por vez**. Para **`3. DevelopmentTests`**, **`4. TechnicalValidation`** e **`5. Documentation`**, copiar em `System.Description` o HTML de [`descriptions_padrao.json`](../skills/cadastrar-tasks-azure/tools/descriptions_padrao.json). Depois, criar o **Test Case** `QA — Test Case` com `Hierarchy-Reverse` para a URL da task **`7. Testing`** (filho da task 7, não do card pai), **sem** Steps e **sem** responsável.
5. Respeitar [SKILL Azure](../skills/Azure/SKILL.md) e [CARD_RULES](../skills/Azure/CARD_RULES.md): **não** alterar estado/coluna do pai. **Atribuição:** preencher `System.AssignedTo` apenas em **`1. Requirements`** e **`6. CodeReview`** (usuário que invoca o comando / PAT); **não** atribuir nas demais tasks nem no Test Case de QA.
6. Ao finalizar, incluir **uma** sugestão curta de melhoria do fluxo (conforme a skill).

## Configuração

- `ADO_CONFIG_PATH` ou `.cursor/skills/Azure/.ado_config.json` na raiz do workspace (preferencial), ou `%USERPROFILE%\.cursor\skills\AzureLocal\.ado_config.json` como fallback legado — **nunca** expor o PAT.
