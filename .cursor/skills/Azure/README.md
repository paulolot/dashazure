# Azure Skill Pack

Pacote de skill para compartilhar com Scrum Master e outros integrantes do time, permitindo usar o Cursor para operar cards no Azure DevOps do projeto Metanet.

## Conteúdo
- `SKILL.md`: definição oficial da skill.
- `QUICKSTART.md`: como configurar e executar em poucos minutos.
- `EXAMPLES.md`: comandos e cenários comuns.
- `REFERENCES.md`: referência de campos, WIQL e relações.

## O que esta skill cobre
- Acesso ao Azure DevOps com PAT.
- Listagem de cards por squad/coluna/estado/responsável.
- Consulta detalhada de work item.
- Atualização de campos em cards.
- Criação e vinculação de Tasks/Test Cases.
- Validação de PRs abertas e PRs ligadas aos cards.

## Boas práticas incorporadas
- Priorizar `ClosedDate` para consultas de concluídos por período.
- Usar `AreaPath` como filtro oficial de squad.
- Validar PR em dois níveis:
  - vínculo direto no card;
  - vínculo por hierarquia (pai/filho).
- Em lotes grandes, processar `workitemsbatch` em chunks.

## Dependências
- `tools/ado_tool.py` e `tools/card_manager.py` dentro da própria skill.
- `.ado_config.json` configurado na raiz da skill (não versionado).
- `.ado_config.example.json` como template para onboarding.
- Python via comando `py`.

## Onboarding interno (empresa)
- O template já vem com `organization: metanetsistema` e `project: Metanet`.
- Para novos devs, basta copiar `.ado_config.example.json` para `.ado_config.json` e preencher somente o `pat`.

## Observações de segurança
- Não compartilhar PAT real em chats, print de tela ou commits.
- Antes de compartilhar a pasta com terceiros, trocar PAT por placeholder no `.ado_config.json` e orientar cada pessoa a configurar seu próprio token.
