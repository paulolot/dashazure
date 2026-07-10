# Exemplos de uso - Azure

## Regra crítica (status/coluna)
- Nunca executar atualização de `System.State`, `System.BoardColumn` ou equivalente.
- Nunca fechar card automaticamente nesta skill.
- O card deve permanecer na mesma coluna e no mesmo status de origem.

## 1) Listar cards concluídos em 2026 da Squad Financeiro (filtro recomendado)
```powershell
py ".cursor/skills/Azure/tools/ado_tool.py" query "SELECT [System.Id], [System.WorkItemType], [System.Title], [System.State], [System.AssignedTo], [Microsoft.VSTS.Common.ClosedDate] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.AreaPath] UNDER 'Metanet\\Squad Financeiro' AND [Microsoft.VSTS.Common.ClosedDate] >= '2026-01-01' AND [Microsoft.VSTS.Common.ClosedDate] < '2027-01-01' ORDER BY [Microsoft.VSTS.Common.ClosedDate] DESC"
```

## 2) Listar cards concluídos no mês (exemplo abril/2026)
```powershell
py ".cursor/skills/Azure/tools/ado_tool.py" query "SELECT [System.Id], [System.WorkItemType], [System.Title], [System.State], [System.AssignedTo], [Microsoft.VSTS.Common.ClosedDate] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.AreaPath] UNDER 'Metanet\\Squad Financeiro' AND [Microsoft.VSTS.Common.ClosedDate] >= '2026-04-01' AND [Microsoft.VSTS.Common.ClosedDate] < '2026-05-01' ORDER BY [Microsoft.VSTS.Common.ClosedDate] DESC"
```

## 3) Listar cards em DEV IMPLEMENTANDO no meu nome
```powershell
py ".cursor/skills/Azure/tools/ado_tool.py" query "SELECT [System.Id], [System.WorkItemType], [System.Title], [System.State], [System.BoardColumn], [System.AssignedTo] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.BoardColumn] = 'DEV IMPLEMENTANDO' AND [System.AssignedTo] = @Me ORDER BY [System.ChangedDate] DESC"
```

## 4) Consultar detalhes de um card
```powershell
py ".cursor/skills/Azure/tools/ado_tool.py" get 15688
```

## 5) Atualizar título de um card
```powershell
py ".cursor/skills/Azure/tools/ado_tool.py" update 15688 "[{\"op\":\"add\",\"path\":\"/fields/System.Title\",\"value\":\"Novo título\"}]"
```

## 6) Atualizar com patch em arquivo
Crie `patch.json`:

```json
[
  {
    "op": "add",
    "path": "/fields/System.Tags",
    "value": "Boxter;Financeiro"
  }
]
```

Execute:

```powershell
py ".cursor/skills/Azure/tools/ado_tool.py" update 15688 "@patch.json"
```

> Atenção: este exemplo é para campos não relacionados a status/coluna.

## 7) Criar Task filha (Hierarchy-Reverse)
Crie `fields.json`:

```json
{
  "System.Title": "1. Análise",
  "System.WorkItemType": "Task",
  "System.AssignedTo": "dev@metanetsistemas.com.br"
}
```

Crie `relations.json`:

```json
[
  {
    "rel": "System.LinkTypes.Hierarchy-Reverse",
    "url": "https://dev.azure.com/metanetsistema/Metanet/_apis/wit/workItems/15688"
  }
]
```

Execute:

```powershell
py ".cursor/skills/Azure/tools/ado_tool.py" create Task "@fields.json" "@relations.json"
```

## 8) Criar Test Case de QA (Tested By)
Crie `qa_fields.json`:

```json
{
  "System.Title": "4. QA",
  "System.WorkItemType": "Test Case",
  "System.AssignedTo": "qa@metanetsistemas.com.br"
}
```

Crie `qa_relations.json`:

```json
[
  {
    "rel": "Microsoft.VSTS.Common.TestedBy-Reverse",
    "url": "https://dev.azure.com/metanetsistema/Metanet/_apis/wit/workItems/15688",
    "attributes": {
      "name": "Tested By"
    }
  }
]
```

Execute:

```powershell
py ".cursor/skills/Azure/tools/ado_tool.py" create "Test Case" "@qa_fields.json" "@qa_relations.json"
```

## 9) Consultar PR específica
```powershell
py ".cursor/skills/Azure/tools/ado_tool.py" pr-get 12345
```

## 10) Criar PR
```powershell
py ".cursor/skills/Azure/tools/ado_tool.py" pr "features/us-15688_SO123456" "master" "us-15688 - Ajuste conferência rápida" "Implementação da US 15688"
```

## 10.1) Configurar PR com auto-complete e auto-delete (obrigatório)
Após criar a PR, configurar:
- `autoCompleteSetBy` com o usuário da PR.
- `completionOptions.deleteSourceBranch = true`.
- manter policy sem bypass por padrão.

## 11) Bloqueio de mudança de status/coluna
Exemplo de mensagem obrigatória:
- "Por regra da Skill Azure, não altero status/coluna e não fecho o card automaticamente. Vou manter o card no estado atual."

## 12) Validar PR em aberto para cards concluídos (Nível 1 - vínculo direto)
Fluxo recomendado:
1. Consultar cards concluídos no período por `ClosedDate` e `AreaPath`.
2. Listar PRs ativas no repositório.
3. Cruzar os IDs dos work items vinculados à PR com os IDs dos cards concluídos.

## 13) Validar PR em aberto (Nível 2 - vínculo por filhos/pai)
Quando o Nível 1 retornar vazio e houver suspeita de vínculo indireto:
1. Buscar filhos de cada card concluído (`Hierarchy-Forward`).
2. Buscar pai de task/test case quando a PR estiver vinculada no filho (`Hierarchy-Reverse`).
3. Consolidar o resultado no card principal antes de reportar.
