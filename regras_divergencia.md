# Regras de Cálculo de Divergências e Avisos de Horas

Este documento descreve as regras e critérios de validação aplicados nas tarefas e subtasks da Squad Fiscal para detecção de **divergências** (erros críticos) e **avisos** (alertas informativos).

---

## 1. Divergências Críticas (Divergências)

As divergências representam falhas graves no processo de lançamento de horas e no andamento do fluxo, somando diretamente no contador de `divergência(s)` do card do profissional. Uma tarefa é considerada divergente em qualquer uma das três situações a seguir:

### Cenário A: Tarefa de Desenvolvimento sem Estimativa
* **Identificação na Tabela**: `🛑 Dev sem estimativa (Nx)`
* **O que é**: Tarefa cuja atividade mapeada seja **Desenvolvimento**, possuindo trabalho concluído mas sem nenhuma estimativa original informada.
* **Fórmula**: `Atividade == "Desenvolvimento" e Estimativa Original == 0 e Trabalho Concluído > 0`
* **Nota**: Tarefas de outros tipos (como Requisitos, Testes ou Documentação) sem estimativa **não** são consideradas divergências críticas.

### Cenário B: Tarefa Fechada sem Horas de Trabalho
* **Identificação na Tabela**: `🛑 Closed sem horas (Nx)`
* **O que é**: Qualquer tarefa cujo estado esteja como **Closed** (Fechada), mas sem nenhum valor de horas de trabalho concluídas preenchido.
* **Fórmula**: `Estado da Task == "Closed" e Trabalho Concluído == 0`

### Cenário C: Card Concluído com Subtasks Abertas
* **Identificação na Tabela**: `🛑 Subtask aberta c/ Pai concluído (Nx)`
* **O que é**: O item pai (User Story ou Bug) está com estado **Closed** ou na coluna **Concluído** no Board, mas possui uma ou mais subtasks filhas que ainda estão **abertas** (estado diferente de `Closed`).
* **Fórmula**: `Estado do Pai == "Closed"/Coluna "Concluído" e Estado da Task != "Closed"`

---

## 2. Avisos / Alertas Informativos (Avisos)

Os avisos representam desvios de planejamento. Eles **não** somam no contador de divergências críticas, mas servem para sinalizar discrepâncias entre o estimado e o executado, gerando o contador de `aviso(s)` no cabeçalho do card.

### Cenário D: Desvio de Planejamento (Super ou Subestimativa)
* **Identificação na Tabela**: `⚠️ Desvio de estimativa (Nx)`
* **O que é**: A tarefa possui estimativa original cadastrada e horas de trabalho concluído registradas, mas os dois valores não coincidem.
* **Fórmula**: `Estimativa Original > 0 e Trabalho Concluído > 0 e Estimativa Original != Trabalho Concluído`

---

## 3. Exibição Visual no Painel

No painel de **Time e Capacidade**, as divergências e avisos são expostos em dois locais principais:

### 3.1. Nos Cards Individuais de Capacidade
* **Indicadores Globais**: O cabeçalho de cada card do profissional exibe badges vermelhas de `N divergência(s)` e badges amarelas de `M aviso(s)` correspondentes às suas subtasks atribuídas.
* **Sem Símbolos nas Atividades**: Removido qualquer símbolo visual de alerta de dentro das linhas de atividades do card para manter o layout limpo e focado no esforço de horas de cada responsável.

### 3.2. Na Tabela "Esforço de Tasks Planejado vs Realizado"
* A coluna **Divergências / Avisos** exibe de forma imediata o **motivo real** das divergências e avisos associados a cada Work Item Pai (User Story ou Bug):
  * Exibe textos detalhados como `🛑 Dev sem estimativa (1x)` ou `⚠️ Desvio de estimativa (2x)`.
  * Ao passar o mouse sobre cada alerta, um *tooltip* contextual descreve a regra do respectivo aviso/divergência.
