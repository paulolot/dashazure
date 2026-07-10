---
title: Regras arquiteturais
description: Estrutura de regras (Guidelines)
author: Saulo Lima
alwaysApply: true
---

# cursor-rules — Estrutura de regras (Guidelines)

> Este arquivo define **como aplicar** as regras do projeto dentro do Cursor IDE (agentes, comandos e respostas).
> Ele não substitui ADRs nem design-rules; ele garante consistência de execução.

## 1) Prioridade e resolução de conflitos
Em qualquer decisão, aplique a ordem:
1. Regras regulatórias / legais
2. ADRs + `design-rules.md` (arquitetura/domínio)
4. Preferências de implementação (estilo)

Se houver conflito, **declare o conflito**, escolha pela prioridade e siga.

## 2) Linguagem e estilo de resposta
- Idioma: **Português do Brasil**.
- Comunicação: objetiva, sem verborragia.
- Frases curtas, orientadas à decisão e execução.
- Quando assumir algo por falta de contexto, declarar:
  - `## Premissas`

## 3) Contexto e perguntas
- Se a demanda vier via Orquestrador, assuma o contexto como **completo**.
- Não repetir perguntas já respondidas.
- Se faltar informação essencial:
  - faça no máximo **3 perguntas** objetivas;
  - se ainda faltar, prossiga com **premissas explícitas** quando for seguro.

## 4) Como o Cursor deve acionar agentes/comandos
- O usuário não deve precisar alternar manualmente de agente.
- O Orquestrador pode simular internamente:
  - /developer (implementação)
  - /qa (qualidade/testes)
- O Dev não cria testes por padrão; QA é responsável por testes, salvo pedido explícito.

## 5) Estrutura padrão de entrega (obrigatória)
Sempre que a tarefa envolver entrega técnica, produzir um pacote único:

1. `## Visão Geral da Demanda`
2. `## Plano Técnico (Dev)`
3. `## Implementação Resumida`
4. `## Análise de Qualidade e Risco (QA)`
5. `## Sugestão de Work Item / Task (Azure DevOps)`
6. `## Commit Message Sugerida`

Observações:
- Se a tarefa for apenas análise/revisão, adapte as seções, mas mantenha o pacote único.
- Evitar “colagem” de respostas: consolidar e decidir.

## 6) Regras de arquitetura que o Cursor deve reforçar
Sempre validar explicitamente (conforme `design-rules.md` do monorepo):
- Está no **módulo/projeto** correto e sem referência circular indevida?
- Está na **camada** adequada ao projeto (ex.: `Business`, `Meta/.../Behaviors`, repositório, UI), em vez de inventar um arranjo novo?
- Evita vazamento de **regra de negócio** para code-behind de formulário ou para camada de apresentação quando o padrão local exige serviço/behavior?
- Evita overengineering (abstração prematura, padrões desnecessários)?
- Mantém baixo acoplamento e alta coesão?

Se houver risco estrutural:
- sinalizar em `## Riscos`
- propor mitigação objetiva (e.g., refatoração mínima, feature flag, rollout controlado).

## 7) Regras de observabilidade e segurança (gatilhos)
Sempre que houver:
- atualização de arquivos/pacotes,
- comunicação com Blob/API,
- validações de integridade,
- rollback,
- falhas de I/O ou rede,
- logs estruturados + correlação (trace_id/span_id quando aplicável),
- métricas (sucesso/falha/tempo por etapa),
- tratamento explícito de erro,
- conformidade com assinatura + checksum quando aplicável.

## 8) Geração de código e mudanças
Quando produzir código:
- Indicar arquivos criados/alterados (lista curta).
- Evitar dumps enormes: focar nas partes centrais e resumir o restante.
- “Compilação mental” obrigatória (tipos, usings, assinaturas, nullability).
- Não inserir segredos em código (API keys, SAS tokens, credenciais).

## 9) Convenção de commits
Formato:
- `type(scope): descrição objetiva`

Tipos recomendados:
- feat, fix, refactor, perf, chore, test, docs

Exemplos:
- `feat(agente-local): aplica validação de assinatura e checksum`
- `fix(pipeline): torna atualização do latest.json atômica`
- `refactor(rollback): extrai RollbackManagerService`

## 10) Qualidade mínima antes de concluir
Antes de “finalizar” uma resposta, verificar:
- Entrega segue ADRs e design-rules
- Plano e implementação estão coerentes
- Riscos relevantes foram listados
- Próximos passos para QA ou pipeline foram apontados quando necessário

## 11) Contexto de codebase (wiki técnica)
- A wiki técnica do repositório deve ser tratada como contexto base para navegação e decisões iniciais.
- Fonte única e canônica: `.cursor/codebase.md` (PT-BR).
