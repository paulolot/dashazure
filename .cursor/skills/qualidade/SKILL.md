---
name: qualidade
description: Resume evidencias de teste no Azure DevOps a partir da task filha de Testing e publica comentario padronizado na US/Bug pai. Use quando o usuario pedir consolidacao de discussion de Testing, evidencia de QA, comentario MOVIDESK ou atualizacao de testes em work item.
---

# Skill Qualidade

## Objetivo
Automatizar o fluxo de evidencia de teste para US/Bug no Azure DevOps:
- localizar task filha de Testing;
- resumir discussion da task;
- montar comentario no template MOVIDESK;
- publicar comentario na US/Bug pai.

## Estrutura
- `.cursor/skills/qualidade/SKILL.md`
- `.cursor/skills/qualidade/templates/movidesk_template.md`
- `.cursor/skills/qualidade/tools/resumir_testing_e_comentar.py`

## Pre-requisitos
1. Python disponivel via `py`.
2. `.ado_config.json` valido com `organization`, `project` e `pat`.
3. Ordem de busca de configuracao:
   1. `ADO_CONFIG_PATH`
   2. `.cursor/skills/qualidade/tools/.ado_config.json`
   3. `.cursor/skills/qualidade/.ado_config.json`
   4. `.cursor/skills/Azure/tools/.ado_config.json`
   5. `.cursor/skills/Azure/.ado_config.json`
   6. `%USERPROFILE%\\.cursor\\skills\\AzureLocal\\.ado_config.json`

## Regra de selecao da task filha
1. Priorizar tasks filhas com `Microsoft.VSTS.Common.Activity = Testing`.
2. Se houver mais de uma candidata, escolher a de **maior quantidade de comentarios** na discussion.
3. Persistindo empate, priorizar a que tiver titulo contendo `Testing`.
4. Se nao houver task com `Activity = Testing`, usar fallback por titulo contendo `Testing`.

## Escopo da coleta
- Usar **somente** os comentarios da task de Testing selecionada.
- Processar evidencias apenas quando o comentario tiver tag `[EVIDENCIA]-N` (N numerico).
- Processar observacoes apenas quando o comentario tiver tag `[OBS]`.
- Se nao houver comentario com `[EVIDENCIA]-N`, interromper sem comentar no pai.

## Padrao de tags na discussion
- Evidencia de teste: `[EVIDENCIA]-1`, `[EVIDENCIA]-2`, `[EVIDENCIA]-3`...
- Observacao geral: `[OBS]`
- As tags sao apenas para leitura da automacao e **nao** aparecem no comentario final publicado.
- A exibicao dos passos segue a ordem de `N` nas evidencias.
- Quando houver imagem no comentario, ela e mantida no resultado final em linha propria.
- Quebras de linha relevantes do comentario original sao preservadas para facilitar leitura.
- Menções `@usuario` da discussion sao preservadas no resumo (nome visível e link clicável no Azure quando houver metadados).
- Nao incluir bloco repetido por evidência (`Resultado esperado` / `Evidencia` / `Status`); apenas o conteúdo da evidência.

## Comandos
Preview sem publicar:
```bash
py ".cursor/skills/qualidade/tools/resumir_testing_e_comentar.py" <ID_US_OU_BUG> --dry-run
```

Publicacao automatica:
```bash
py ".cursor/skills/qualidade/tools/resumir_testing_e_comentar.py" <ID_US_OU_BUG> --auto-post
```

Template customizado:
```bash
py ".cursor/skills/qualidade/tools/resumir_testing_e_comentar.py" <ID_US_OU_BUG> --dry-run --template "caminho/template.md"
```

## Template padrao
Formato base em `templates/movidesk_template.md`:
- `[MOVIDESK]`
- `Evidencia de Teste`
- executor e data
- observacao de branch
- passos executados
- resultado do teste
- bloco de observacoes (quando houver comentarios com `[OBS]`)
- blocos com espacos e quebras de linha obrigatorias para evitar texto achatado no Azure/MOVIDESK

## Exemplo de comentarios na task Testing
- `[EVIDENCIA]-1 TC-223-001 - Validacao do cenario A com sucesso`
- `[EVIDENCIA]-2 TC-223-002 - Validacao do cenario B com sucesso`
- `[OBS] Houve lentidao intermitente no primeiro carregamento, sem impacto no resultado`

## Publicacao no Azure
- O comentario e publicado com `format=html` na API de comentarios (7.1-preview.4).
- Isso preserva quebras de linha, indentacao e renderizacao de imagens no card.
- Menções coletadas da discussion sao reenviadas no payload (`mentions`) para manter `@` clicável.
- O preview em `--dry-run` mostra duas saidas: texto (referencia) e HTML (o que sera publicado).

## Regras obrigatorias
1. Nao expor PAT.
2. Nao alterar status/coluna do item pai.
3. Comentar sempre na US/Bug pai, nunca na task filha.
4. Em erro de dados insuficientes, retornar mensagem clara e nao publicar.
