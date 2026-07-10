# Skill: orquestrador-tasks-azure

`orquestrador-tasks-azure` transforma um item de backlog em um plano de acao com tasks prontas para Azure DevOps, com foco em execucao, clareza e previsibilidade de estimativas.

## O que esta skill resolve

- quebra um item em tasks pequenas e objetivas
- aplica limite de ate 16h por task
- padroniza campos para facilitar cadastro em Azure DevOps
- inclui tarefas obrigatorias de revisao do plano, code review e QA
- reforca criterios de conclusao e qualidade

## Quando usar

Use quando a fase de analise de coerencia ja tiver sido concluida e o time precisar partir para execucao.

Gatilho principal:
- `gerar_plano_acao`

## Como acionar

1. Forneca o item de backlog ja validado.
2. Solicite o plano de acao com tasks para Azure DevOps.
3. Informe restricoes importantes (dependencias, prazo e escopo).

Exemplo:

`Use /orquestrador-tasks-azure para gerar plano de acao com tasks objetivas para Azure DevOps.`

## Formato de saida

A skill gera:
- resumo tecnico curto
- blocos `[TASK]` com `Titulo`, `Camada`, `Estimativa`, `Descricao`, `Criterio de conclusao`
- ordem de execucao sugerida
- pontos de atencao com `⚠️` e `🔗`

## Estrutura da pasta

- `SKILL.md`: regras operacionais completas
- `references/detailed-guide.md`: guia estendido de boas praticas
- `examples/README.md`: orientacoes para casos de exemplo
- `scripts/README.md`: espaco para automacoes futuras
