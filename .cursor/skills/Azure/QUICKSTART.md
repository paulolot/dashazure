# Quickstart - Skill Azure

## 1) Preparar ambiente
1. Validar Python:
   - `py --version`
2. Validar arquivos:
   - `.cursor/skills/Azure/tools/ado_tool.py`
   - `.cursor/skills/Azure/.ado_config.example.json`

## 2) Configurar acesso Azure DevOps
Copiar `.cursor/skills/Azure/.ado_config.example.json` para `.cursor/skills/Azure/.ado_config.json`.

Para uso interno da empresa:
- `organization` e `project` já vêm preenchidos no template;
- o dev precisa apenas substituir o valor de `pat`.

Arquivo esperado:

```json
{
  "organization": "metanetsistema",
  "project": "Metanet",
  "pat": "SEU_PAT_AQUI"
}
```

## 3) Testar consulta simples
Executar:

```powershell
py ".cursor/skills/Azure/tools/ado_tool.py" query "SELECT [System.Id], [System.Title] FROM WorkItems WHERE [System.TeamProject] = @project ORDER BY [System.ChangedDate] DESC"
```

Se retornar JSON com `workItems`, acesso está funcionando.

## 4) Validar escopo por squad (exemplo Financeiro)
```powershell
py ".cursor/skills/Azure/tools/ado_tool.py" query "SELECT [System.Id], [System.Title], [System.AreaPath] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.AreaPath] UNDER 'Metanet\\Squad Financeiro' ORDER BY [System.ChangedDate] DESC"
```

## 5) Consultar card específico
```powershell
py ".cursor/skills/Azure/tools/ado_tool.py" get 15688
```

## 6) Consultar cards em DEV IMPLEMENTANDO para o usuário logado
```powershell
py ".cursor/skills/Azure/tools/ado_tool.py" query "SELECT [System.Id], [System.WorkItemType], [System.Title], [System.State], [System.BoardColumn], [System.AssignedTo] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.BoardColumn] = 'DEV IMPLEMENTANDO' AND [System.AssignedTo] = @Me ORDER BY [System.ChangedDate] DESC"
```

## 7) Concluídos por período (base recomendada)
```powershell
py ".cursor/skills/Azure/tools/ado_tool.py" query "SELECT [System.Id], [System.Title], [System.State], [Microsoft.VSTS.Common.ClosedDate] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.AreaPath] UNDER 'Metanet\\Squad Financeiro' AND [Microsoft.VSTS.Common.ClosedDate] >= '2026-04-01' AND [Microsoft.VSTS.Common.ClosedDate] < '2026-05-01' ORDER BY [Microsoft.VSTS.Common.ClosedDate] DESC"
```

## 8) Troubleshooting rápido
- **HTTP 500 em lote**: reduzir volume e processar IDs em chunks (100-200).
- **Resultado vazio**: revisar `AreaPath`, período e tipo de vínculo de PR.
- **Acentuação quebrada**: confirmar execução em UTF-8 e evitar salvar arquivos JSON em ANSI.

## 9) Próximos passos
- Para cenários prontos, use `EXAMPLES.md`.
- Para referência de campos/links, use `REFERENCES.md`.
- Para regras de processo, use `CARD_RULES.md`.
