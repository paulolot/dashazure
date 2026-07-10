# Guia detalhado - validacao-backlog

Este guia detalha como aplicar a skill em cenarios reais de backlog para obter uma avaliacao consistente e acionavel.

## 1. Objetivo da validacao

A validacao de backlog busca responder: "o que foi pedido esta claro, consistente e seguro para implementar no sistema atual?"

O foco eh evitar:
- implementacao de requisitos contraditorios
- impacto nao mapeado em modulos existentes
- criterios de aceite nao testaveis
- retrabalho por falta de refinamento

## 2. Entrada minima recomendada

Para resultados melhores, inclua:
- contexto de negocio do item
- comportamento atual e comportamento desejado
- regras e excecoes conhecidas
- pontos de integracao (API, fila, banco, servico externo)
- criterios de aceite preliminares

Se faltar informacao, a skill deve seguir com analise parcial e registrar perguntas obrigatorias.

## 3. Heuristicas por bloco de analise

### Coerencia com objetivo
- verificar se o item resolve um problema real do dominio
- validar se o escopo nao mistura objetivos diferentes

### Consistencia com funcionalidades existentes
- checar sinais de duplicidade funcional
- identificar choque de responsabilidade entre modulos

### Regras de negocio
- procurar contradicoes entre regra principal e excecoes
- validar se o comportamento em erro esta definido

### Fluxo e comportamento
- avaliar fluxo feliz e principais fluxos alternativos
- observar lacunas de transicao de estado

### Dados e estado
- confirmar origem e dono do dado
- confirmar persistencia, historico e idempotencia quando aplicavel

### Integracoes e dependencias
- mapear servicos internos e externos afetados
- avaliar necessidade de contrato, timeout e fallback

### Impacto e regressao
- identificar telas, jobs, APIs e processos que podem quebrar
- sinalizar necessidade de testes de regressao e observabilidade

### Criterios de aceite
- garantir linguagem objetiva e verificavel
- exigir criterios para sucesso, falha e borda

## 4. Exemplo resumido de saida boa

- `⚠️` Regra de cancelamento conflita com regra de faturamento em aberto.
- `⚠️` Item pressupoe integracao com servico externo sem contrato definido.
- `❓` Qual modulo sera fonte de verdade para status final?
- `❓` O criterio "rapido" pode ser traduzido para SLA objetivo?
- `💡` Incluir criterio de aceite para timeout e retentativa de integracao.
- `💡` Separar escopo em dois itens: ajuste de regra e melhoria de UX.

## 5. Anti-padroes a evitar

- analise generica sem apontar evidencias do texto do item
- assumir detalhes tecnicos sem explicitar suposicao
- ignorar impacto transversal em processos existentes
- aceitar criterio subjetivo sem proposta de metrica

## 6. Checklist rapido antes de concluir

- todos os 11 blocos foram cobertos
- inconsistencias estao marcadas com `⚠️`
- perguntas criticas estao marcadas com `❓`
- melhorias acionaveis estao marcadas com `💡`
- riscos de regressao foram explicitamente avaliados
