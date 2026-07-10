# orquestrador-tasks-azure

## Finalidade

Esta skill deve ser usada para transformar um item de backlog, ja previamente analisado quanto a coerencia, em um plano de acao executavel com tasks simples, claras e objetivas, prontas para Azure DevOps.

## Quando usar

Use esta skill quando houver necessidade de:
- gerar plano de acao para execucao
- quebrar item de backlog em tasks objetivas
- preparar lista de tasks para Azure DevOps

Gatilho principal:
- `gerar_plano_acao`

## Premissas de entrada

Considere sempre que:
- o item de backlog ja foi informado anteriormente na conversa
- a analise de coerencia ja foi realizada
- o foco agora eh somente execucao

Se faltar contexto, a skill deve explicitar suposicoes minimas e seguir com plano de acao pragmatico.

## Fluxo obrigatorio da resposta

### 1) Resumo tecnico
- Explicar rapidamente o que precisa ser feito.

### 2) Geracao de tasks (obrigatorio)

Gerar tasks seguindo estritamente estas regras:
- cada task deve ter no maximo 16 horas
- quando necessario, dividir em tasks menores
- tasks devem focar no objetivo, nao no detalhamento de implementacao
- evitar dizer exatamente onde alterar ou como codar
- pode sugerir abordagem apenas como opcional
- toda task com codigo deve considerar testes unitarios

Formato obrigatorio de cada task:

[TASK]
Titulo: <objetivo da task>
Camada: <Backend | Frontend | Banco | Integracao | Testes>
Estimativa: <X horas, maximo 16h>

Descricao:
- Seguir **integralmente** o padrao em `references/task-description-padrao.md` (mesma pasta desta skill).
- No chat: usar as secoes do padrao em prosa ou HTML; ao cadastrar no ADO, o agente deve converter para `System.Description` em HTML.
- Linguagem de produto: para que serve, o que entregar, exemplo simplificado, criterios de conclusao, o que NAO fazer, dependencias.
- Evitar bullets tecnicos soltos sem contexto; detalhe de implementacao apenas como opcional e em linguagem simples.

Criterio de conclusao:
- <resultado esperado, alinhado a secao "Como saber que a task esta concluida" em `references/task-description-padrao.md`>
- <testes unitarios implementados e passando> (quando envolver codigo e o card/time exigir)

### 3) Task de revisao do plano (obrigatorio)

Sempre incluir esta task:

[TASK]
Titulo: Revisar e ajustar plano de acao e estimativas da User Story
Camada: Backend
Estimativa: 2h a 4h

Descricao:
- Revisar todas as tasks geradas
- Validar divisao e granularidade
- Ajustar estimativas
- Identificar gaps ou riscos nao considerados

Criterio de conclusao:
- Plano revisado
- Tasks ajustadas
- Pronto para execucao

### 4) Task de Code Review (obrigatorio)

Sempre incluir esta task:

[TASK]
Titulo: Realizar code review da implementacao
Camada: Backend
Estimativa: 2h a 4h

Descricao:
- Revisar codigo implementado
- Validar aderencia ao padrao do projeto
- Verificar clareza, simplicidade e manutencao
- Avaliar cobertura e qualidade dos testes unitarios
- Identificar possiveis problemas ou melhorias

Criterio de conclusao:
- Codigo aprovado ou com ajustes solicitados
- Feedback registrado
- Sem issues criticos pendentes

### 5) Task de Testes de Qualidade (QA) (obrigatorio)

Sempre incluir esta task:

[TASK]
Titulo: Executar testes de qualidade e validar comportamento da funcionalidade
Camada: Testes
Estimativa: 2h a 6h

Descricao:
- Validar funcionamento da funcionalidade implementada
- Testar cenarios principais e alternativos
- Validar casos de erro
- Verificar se comportamento atende ao esperado da User Story

Criterio de conclusao:
- Funcionalidade validada
- Nenhum defeito critico
- Evidencias de teste registradas (quando aplicavel)

### 6) Ordem de execucao (sugerido)
- Apresentar sequencia logica das tasks, incluindo revisao, desenvolvimento, code review e QA.

### 7) Pontos de atencao (resumido)
- Riscos principais com marcador `⚠️`
- Dependencias relevantes com marcador `🔗`

## Regras de resposta

- Ser direto
- Evitar detalhamento excessivo
- Priorizar clareza sobre profundidade
- Preferir tasks simples e objetivas

## Padrão de descrição (referência)

Ao gerar texto de tasks para Azure DevOps, ler e aplicar:

- `references/task-description-padrao.md`

## Checklist interno antes de responder

- Existe resumo tecnico curto.
- Descricoes das tasks seguem `references/task-description-padrao.md`.
- Todas as tasks estao em formato `[TASK]`.
- Nenhuma task excede 16h.
- Existem as 3 tasks obrigatorias: revisao do plano, code review e QA.
- Tasks com codigo incluem criterio de testes unitarios passando.
- Ordem de execucao foi sugerida.
- Pontos de atencao contem riscos `⚠️` e dependencias `🔗`.
