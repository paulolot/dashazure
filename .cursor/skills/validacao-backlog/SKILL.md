# validacao-backlog

## Finalidade

Esta skill deve ser usada para validar itens de backlog (User Story, Feature ou Bug) antes do desenvolvimento, verificando coerencia com o sistema existente, riscos de regressao e lacunas de definicao.

## Quando usar

Use esta skill quando houver necessidade de:
- validar item de backlog
- checagem de consistencia de requisito
- analise de impacto no sistema atual

## Entradas esperadas

Fornecer, sempre que possivel:
- descricao completa do item (objetivo, escopo e comportamento esperado)
- contexto funcional ou modulo afetado
- regras de negocio conhecidas
- criterios de aceite existentes
- dependencias e integracoes esperadas

Se o item vier incompleto, a skill deve continuar a analise e listar as perguntas de validacao obrigatorias.

## Fluxo obrigatorio de analise

1. Coerencia com o objetivo
- O pedido faz sentido como evolucao do sistema?
- Ha contradicao com comportamentos esperados?

2. Consistencia com funcionalidades existentes
- Pode ser duplicacao de algo que ja existe?
- Pode conflitar com funcionalidade atual?
- Ha sobreposicao de responsabilidade?

3. Regras de negocio
- Regras internas estao consistentes?
- Existe regra contraditoria ou incompleta?
- Existem regras implicitas nao consideradas?

4. Fluxo e comportamento
- O fluxo descrito eh logico?
- Ha lacunas de comportamento?
- Existem cenarios importantes ausentes?

5. Dados e estado
- Os dados mencionados fazem sentido no sistema atual?
- Ha risco de inconsistencias de dados?
- Falta definicao de origem, transformacao ou persistencia?

6. Integracoes e dependencias
- Ha integracoes presumidas sem descricao?
- Existe dependencia implicita de outro modulo/sistema?

7. Impacto no sistema atual
- Pode quebrar comportamentos existentes?
- Pode gerar efeitos colaterais?
- Ha risco de regressao?

8. Criterios de aceite
- Estao coerentes com a descricao?
- Sao objetivos e testaveis?
- Cobrem cenarios principais e excecoes relevantes?

9. Lacunas e inconsistencias
- Listar todos os pontos contraditorios, ambiguos ou mal definidos.

10. Perguntas para validacao
- Listar perguntas que devem ser respondidas antes da implementacao.

11. Sugestoes de melhoria
- Sugerir ajustes para clareza, testabilidade e alinhamento ao sistema existente.

## Formato de saida obrigatorio

- Ser direto e objetivo
- Usar bullet points
- Marcar inconsistencias com `⚠️`
- Marcar duvidas com `❓`
- Marcar melhorias com `💡`

## Template de resposta

Use exatamente esta estrutura:

### 1) Coerencia com o objetivo
- ...

### 2) Consistencia com funcionalidades existentes
- ...

### 3) Regras de negocio
- ...

### 4) Fluxo e comportamento
- ...

### 5) Dados e estado
- ...

### 6) Integracoes e dependencias
- ...

### 7) Impacto no sistema atual
- ...

### 8) Criterios de aceite
- ...

### 9) Lacunas e inconsistencias
- `⚠️` ...

### 10) Perguntas para validacao
- `❓` ...

### 11) Sugestoes de melhoria
- `💡` ...

## Regras de qualidade da analise

- Nao inventar comportamento do sistema sem sinalizar suposicao.
- Quando faltar dado, registrar limitacao e seguir com analise parcial.
- Priorizar riscos de negocio, integracao e regressao.
- Diferenciar claramente fato observado vs inferencia.
- Evitar texto generico; ancorar cada ponto no item analisado.
