# Guia de Configuração e Manutenção de Regras de Alertas (Squad Fiscal)

Este documento descreve as regras de sinalização, alertas operacionais e cálculo de produtividade aplicados no Dashboard da Squad Fiscal. O comportamento dessas regras pode ser customizado diretamente através do arquivo [`rules_config.json`](file:///c:/Imex/drive-download-20260522T152140Z-3-001/rules_config.json) na raiz do projeto.

---

## 1. Níveis de Severidade de Alertas

Para organizar as prioridades operacionais da Squad, as sinalizações são classificadas em 4 níveis distintos:

1. 🛑 **Impedido (Blocker) — Vermelho**
   - **Gatilho:** Qualquer card com impedimento ativo (`ParadoAgora === "Sim"`) na base que esteja nessa situação há mais de 24 horas (configurável).
   - **Ação Recomendada:** Resolução imediata, contato com quem gerou o impedimento ou escalação.

2. 🟠 **Crítico (Critical) — Laranja**
   - **Gatilhos:**
     - Bugs abertos que superaram o tempo médio de resolução histórico do time (MTTR).
     - Bugs abertos com Classificação de Severidade no DevOps de nível `1 - Critical` ou `2 - High` (baseada na coluna `Severity` do card).
     - Cartões em andamento na coluna `Dev implementando` há mais de 16 horas.
     - Desvio de estimativa por etapa (tempo acumulado na coluna do board maior que a soma das estimativas das subtasks correspondentes).
   - **Ação Recomendada:** Foco prioritário de desenvolvimento no dia para escoar o fluxo de valor.

3. 🟡 **Atenção (Warning) — Amarelo**
   - **Gatilhos:**
     - Cards em estado ativo na coluna de Backlog parados há mais de 30 dias.
     - Bugs abertos há mais de 5 dias.
     - Cards parados na mesma coluna do board (excluindo Backlog/Ideias) há mais de 2 dias (48 horas).
     - Subtask individual de desenvolvimento (`Activity === "Development"`) contendo estimativa ou horas concluídas superiores a 16 horas.
     - Carga de WIP por desenvolvedor superior a 2 cards simultâneos.
   - **Ação Recomendada:** Planejar movimentação do card ou redistribuição no próximo Daily Scrum.

4. 🔵 **Info (Informação) — Azul**
   - **Gatilhos:**
     - Bugs ativos sem nenhum programador responsável designado (`Responsavel === "NENHUM"` ou vazio).
     - Risco de Lote Grande (User Story Gigante): Cards ativos com estimativa de tasks > 20h ou tempo acumulado em colunas de trabalho > 100h.
     - Cards contendo as tags de controle da Squad: `Legado` (dívida técnica), `!BUG` (desconsiderados como bugs reais) ou `GeradoPorUS` (regressões de sistema).
     - **[NOVO]** Tasks do mesmo tipo (Activity) em um card somando mais de 16h — sinaliza como *User Story Gigante (Lote Grande)*.
     - **[NOVO]** Cards (exceto Bugs e Atendimentos) sem nenhuma task filha cadastrada — sinaliza como *Tasks não definidas*.
     - **[NOVO]** Cards de Atendimento sem horas concluídas registradas — sinaliza como *Horas não informadas*.
     - **[NOVO]** Tasks com estado Closed/Done e CompletedWork = 0 — sinaliza como *Horas não informadas*.
     - **[NOVO]** Tasks sem o campo Activity definido — sinaliza como *Task com dados faltantes*.
     - **[NOVO]** Tasks sem responsável definido — sinaliza como *Task com dados faltantes*.
     - **[NOVO]** Bugs (abertos ou concluídos no período) sem nenhuma tag de classificação — sinaliza como *BUG sem validação*.
   - **Ação Recomendada:** Revisão de governança, refinamento ou homologação mais criteriosa.

   > **[NOVO] Nível Atenção adicional:**
   > - Cards com total de dias paralisados acumulados acima de 7 dias — sinaliza como 🟡 *Card paralizado além do permitido*.
   > - Bugs (abertos ou concluídos no período) sem responsável definido — sinaliza como 🟡 *Responsável não definido*.

---

## 2. Parâmetros de Configuração (`rules_config.json`)

O arquivo de configuração permite alterar os limites temporais e quantitativos sem mexer no código-fonte JavaScript:

* `backlog_aging_days` (Padrão: `30` dias): Limite para alertar envelhecimento no Backlog.
* `bug_yellow_days` (Padrão: `5` dias): Dias tolerados antes de um bug receber sinal amarelo de atenção.
* `bug_red_use_mttr` (Padrão: `true`): Se `true`, calcula e usa o MTTR médio de bugs resolvidos do período como o limite para sinal vermelho.
* `bug_red_days_fallback` (Padrão: `15` dias): Limite fixo de dias caso o cálculo dinâmico de MTTR não tenha amostras no período.
* `card_max_days_same_column` (Padrão: `2` dias): Limite tolerado de inatividade em uma mesma coluna.
* `dev_task_max_hours` (Padrão: `16` horas): Horas máximas previstas/gansas em uma única task de desenvolvimento.
* `dev_column_max_hours` (Padrão: `16` horas): Tempo limite acumulado na coluna Dev implementando.
* `person_hours_per_day` (Padrão: `8` horas): Carga teórica diária de trabalho útil para os colaboradores do time.
* `max_wip_per_developer` (Padrão: `2` cards): Limite de cards simultâneos sob a responsabilidade de um único programador.
* `large_us_task_hours_limit` (Padrão: `20` horas): Limite de horas de subtask de uma US para marcá-la como lote grande.
* `large_us_active_hours_limit` (Padrão: `100` horas): Tempo ativo tolerado de uma US antes de alertar complexidade.
* `blocked_alert_threshold_hours` (Padrão: `24` horas): Tempo tolerado com impedimento ativo antes de gerar alerta Blocker.
* `activity_column_map`: Dicionário que mapeia o nome da atividade (coluna `Activity` de subtasks) com a respectiva coluna do Kanban (coluna `BoardColumn` no histórico). Usado para calcular desvios de estimativa por etapa (Tasks em Atraso).

---

## 3. Gaps de Produtividade (Capacidade vs. Realizado)

A produtividade é mensurada a partir de:
1. **Dias Úteis do Período:** Apenas segunda a sexta-feira, mantendo feriados nacionais como dias teoricamente disponíveis (conforme diretriz).
2. **Capacidade Disponível:** $\text{Dias Úteis} \times \text{person\_hours\_per\_day}$ (8h).
3. **Tempo Realizado:** Soma do esforço concluído (`CompletedWork`) de subtasks e atendimentos atribuídos a cada colaborador no período.
4. **Alerta de Produtividade:** Gaps negativos (Horas Realizadas < Horas Disponíveis) são destacados visualmente para o time.
