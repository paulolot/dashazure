# Guia detalhado - orquestrador-tasks-azure

Este guia complementa a skill com criterios praticos para montar planos de acao consistentes e uteis para execucao no Azure DevOps.

## 1. Objetivo operacional

**Padrão de texto/HTML das tasks:** `task-description-padrao.md` (mesma pasta `references/`).

Converter backlog em sequencia de execucao, com tasks:
- pequenas o suficiente para previsibilidade
- claras para qualquer desenvolvedor do time
- com criterio de conclusao verificavel

## 2. Regras inegociaveis

- Task com estimativa maxima de 16h
- Task deve focar no objetivo, nao em passo-a-passo de implementacao
- Task com codigo deve incluir testes unitarios no criterio de conclusao
- Sempre incluir task de revisao do plano
- Sempre incluir task de code review
- Sempre incluir task de QA

## 3. Como dividir tasks corretamente

Quando uma task parecer grande:
- separar por objetivo de negocio (nao por arquivo)
- separar por camada quando houver fronteiras claras (Backend, Frontend, Banco, Integracao, Testes)
- manter cada task com resultado observavel e verificavel

Sinais de task mal dividida:
- estimativa acima de 16h
- descricao com multiplos objetivos distintos
- criterio de conclusao subjetivo ou generico

## 4. Qualidade da descricao

Uma boa descricao:
- deixa claro o que deve ser entregue
- evita ditar implementacao detalhada
- pode sugerir abordagem de forma opcional

Evite:
- listar tecnicismos desnecessarios
- impor nome de classe, arquivo ou metodo sem necessidade
- misturar desenvolvimento com revisao/QA na mesma task

## 5. Qualidade do criterio de conclusao

Criterios bons sao:
- objetivos
- observaveis
- testaveis

Exemplos:
- "Comportamento X validado nos cenarios principal e alternativos"
- "Testes unitarios implementados e passando"
- "Sem erros criticos nos cenarios de falha"

## 6. Ordem de execucao recomendada

Sequencia sugerida:
1. Revisar e ajustar plano de acao e estimativas
2. Executar tasks de desenvolvimento/integracao
3. Realizar code review
4. Executar testes de qualidade (QA)

## 7. Pontos de atencao

Sempre destacar no fim:
- `⚠️` riscos principais (ex.: dependencia externa instavel, regra de negocio ambigua)
- `🔗` dependencias relevantes (ex.: time externo, API de terceiro, janela de deploy)

## 8. Exemplo resumido de bloco task

[TASK]
Titulo: Implementar validacao de regra de aprovacao no fluxo principal
Camada: Backend
Estimativa: 8 horas

Descricao:
- Entregar comportamento de validacao conforme regra definida na User Story
- Opcional: sugerir abordagem orientada por testes

Criterio de conclusao:
- Regra aplicada no fluxo esperado
- Testes unitarios implementados e passando
