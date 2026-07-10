# Skill: validacao-backlog

`validacao-backlog` padroniza a revisao de itens de backlog antes da implementacao, reduzindo retrabalho e risco de regressao.

## O que esta skill entrega

- avaliacao estruturada em 11 blocos de consistencia
- identificacao de lacunas, contradicoes e suposicoes ocultas
- perguntas de validacao para refinamento com responsaveis
- sugestoes praticas para melhorar clareza e testabilidade

## Quando acionar

Acione quando precisar:
- validar item de backlog
- fazer checagem de consistencia de requisito
- analisar impacto no sistema existente

## Como usar

1. Cole o item de backlog completo (story/feature/bug).
2. Informe contexto tecnico disponivel (modulo, regras, integracoes e criterios).
3. Solicite a analise com foco em coerencia sistemica.

Exemplo de comando:

`Use /validacao-backlog para avaliar este item e gerar inconsistencias, perguntas de validacao e melhorias.`

## Formato de resposta esperado

- resposta objetiva em bullet points
- inconsistencias marcadas com `⚠️`
- duvidas marcadas com `❓`
- melhorias marcadas com `💡`

## Estrutura

- `SKILL.md`: instrucoes operacionais da skill
- `references/detailed-guide.md`: guia estendido com exemplos
- `examples/`: area para casos de entrada e saida
- `scripts/`: area para futuras automacoes
