# Análise de Gaps: PDF Real vs Dashboard Atual

> **PDF analisado:** `Relatório Rastreabilidade Junho 2026.pdf` — texto extraído via `pdfminer.six`  
> **Importante:** o PDF tem conteúdo **diferente** do `relExempo.md`. São relatórios complementares.

---

## O que o PDF contém (4 páginas)

O PDF é um **relatório gerencial de rastreabilidade** da Squad Fiscal com foco em:
1. Volume de cards finalizados por tipo, com horas de Dev e Teste
2. Consolidado de horas por colaborador (Estimate × Dev Implementando × Testando)
3. Tempo gasto por **Status de bloqueio** (causa raiz da espera)
4. Taxa de bugs convertidos em User Story (indicador de qualidade de refinamento)
5. Distribuição diária de WIP por coluna (snapshots diários)
6. Gargalos observados e resumo executivo gerencial

---

## Dados extraídos do PDF — Junho 2026

### Cards Finalizados no Mês

| Tipo | Qtd | % Total | Horas Dev | Horas Testando |
|---|---|---|---|---|
| User Story | 44 | 53,66% | 334,42 h | 126,65 h |
| Bug | 19 | 23,17% | 96,38 h | 79,65 h |
| Atendimento | 19 | 23,17% | 55,48 h | 0 h |
| **Total** | **82** | **100%** | **486,28 h** | **206,30 h** |

### Consolidado por Colaborador

| Colaborador | Estimate | Dev Implementando | Testando |
|---|---|---|---|
| Julio Andreata | 81,12 h | 11 h | 46,05 h |
| Fabio Nobre | 46,50 h | 22 h | 51,88 h |
| Ivan Pionelli Junior | 16,72 h | 8 h | 29,70 h |
| Leandro Andrade | 0,58 h | 0 h | 67,32 h |
| Demais | ... | ... | ... |

### Tempo Gasto por Status (Bloqueios)

| Causa de Bloqueio | Tempo |
|---|---|
| Aguardando retorno de parceiro externo | **116,45 h** |
| Retorno solicitante | 51,28 h |
| Aguardando Revisão | 50,37 h |
| Parou para fazer outro ticket | 41,97 h |
| Aguardando PO | 31,23 h |
| Demais status | ... |

### Métricas de Qualidade de Refinamento

- **Total de Bugs:** 35
- **Bugs convertidos em User Story:** 16
- **Taxa de conversão Bug → US:** **45,71%** ⚠️

> Causa raiz identificada no PDF: predominância de **refinamentos insuficientes** — "melhorias de especificação", "correções de entendimento de regra fiscal", "necessidade de maior validação antes do desenvolvimento".

### Snapshots Diários de WIP (CardsEmColunas)

| Coluna | Registros |
|---|---|
| Dev Implementando | 62 |
| Fazendo Análise | 28 |
| Testando | 26 |

- 19 coletas diárias, 117 registros de cards
- Snapshot às ~08:30 todos os dias

---

## Gaps Identificados (PDF vs Dashboard)

### 🔴 Gap PDF-1 — Horas de Dev vs Teste por Tipo de Card (não existe)

O PDF apresenta, para cada tipo de Work Item, a separação entre:
- **Horas de Dev Implementando** (tempo ativo de desenvolvimento)
- **Horas de Testando** (tempo ativo de QA/testes)

**O que o dashboard faz hoje:** a página "Time e Capacidade" mostra horas por responsável e por Activity (baseado em Tasks filhas), mas **não cruza Horas Dev × Horas Teste por Tipo de WI** de forma agregada.

**Por que importa:** em junho, bugs consumiram 96h de dev mas **79h de teste** — quase 1:1. User Stories consumiram 334h dev e 127h teste — proporção 2,6:1. Essa diferença de proporção é um sinal de que bugs demandam esforço de QA desproporcional.

---

### 🔴 Gap PDF-2 — Taxa de Conversão Bug → User Story (não existe)

O PDF mostra que **45,71% dos bugs foram convertidos em User Story** (16 de 35). Isso é um KPI de qualidade de refinamento, não de qualidade de código.

**O que o dashboard faz hoje:** nenhuma métrica rastreia Work Items que mudaram de tipo (Bug → User Story) no histórico de transições.

**Por que importa:** uma taxa alta (>30%) indica que muitos "bugs" na verdade são funcionalidades não especificadas ou entendidas errado — sinal de processo de refinamento inadequado, não de defeito técnico. Essa métrica é **totalmente diferente do Bug Rate atual** do dashboard.

**Dado disponível:** `fiscal-transicoes.csv` guarda o histórico completo de mudanças de campo — incluindo mudanças de `WorkItemType`. A detecção é viável sem novo dado.

---

### 🔴 Gap PDF-3 — Tempo por Status de Bloqueio / Causa Raiz de Espera (não existe)

O PDF apresenta um ranking dos **status de paralisação por tempo consumido**, revelando o motivo real da espera:

1. Aguardando retorno de parceiro externo — 116h
2. Retorno solicitante — 51h
3. Aguardando Revisão — 50h
4. Parou para fazer outro ticket — 42h
5. Aguardando PO — 31h

**O que o dashboard faz hoje:** a página "Fluxo e Gargalos" mostra paralisados vs ativos (donut) e tempo médio por coluna — mas **não detalha a CAUSA da paralisação** (que status de "Paralisado" o card estava quando parou).

**Por que importa:** "Aguardando parceiro externo" e "Aguardando PO" são problemas de processo/dependência externa — não de capacidade técnica. Confundir as causas leva a ações corretivas erradas.

**Dado disponível:** `fiscal-paralizacoes.csv` e `fiscal-paralizacao-resumo.csv` já existem no projeto — é provável que o motivo de paralisação esteja lá.

---

### 🟠 Gap PDF-4 — Snapshots Diários de WIP por Coluna (parcial)

O PDF faz **coleta diária às 08:30** e mostra a distribuição acumulada de cards por coluna ao longo do mês (ex: "Dev Implementando" apareceu 62 vezes nos snapshots). Isso permite identificar padrões de acúmulo ao longo do tempo.

**O que o dashboard faz hoje:** o WIP por Coluna do Board é um **snapshot instantâneo** (situação atual). Não há histórico de como o WIP evoluiu dia a dia ao longo do mês.

**Por que importa:** saber que cards ficaram "vários dias consecutivos na mesma coluna" é diferente de saber quantos cards estão lá agora. O PDF detectou que o desenvolvimento foi o gargalo **durante todo o mês**, não apenas no momento da análise.

---

### 🟠 Gap PDF-5 — Coluna "Fato Causa Ação" / Retrospectiva de Causa Raiz (não existe)

O PDF menciona análise da coluna **"Fato Causa Ação"** nos cards, que registra o motivo de bugs e retrabalhos:

> "Os registros apontam principalmente para melhorias de especificação, correções de entendimento de regra fiscal, refinamentos insuficientes, necessidade de maior validação antes do desenvolvimento."

**O que o dashboard faz hoje:** nenhuma análise de campos textuais de causa raiz dos cards.

**Por que importa:** essa análise mostra que **a causa dos bugs não é técnica** — é de processo (refinamento). Essa conclusão não seria visível em nenhuma métrica atual do dashboard.

**Observação:** este gap pode ser difícil de automatizar pois depende de texto livre preenchido manualmente nos cards.

---

### 🟡 Gap PDF-6 — Resumo Executivo Automático em "1 Minuto" (não existe)

O PDF encerra com um **Resumo Executivo** narrativo (bullets em linguagem de gestão), consolidando os pontos mais críticos do mês para apresentação rápida.

**O que o dashboard faz hoje:** exibe métricas interativas — mas não gera um texto resumido/narrativo para gestores que não querem interagir com o dashboard.

**Sugestão:** um painel estático de "Resumo do Mês" gerado automaticamente com as 5-7 métricas mais relevantes em linguagem natural.

---

## Tabela Resumo — Todos os Gaps (PDF + Markdown)

| # | Gap | Origem | Criticidade | Dado disponível? |
|---|-----|--------|-------------|-----------------|
| PDF-1 | Horas Dev × Horas Teste por tipo de WI | PDF | 🔴 Alta | Sim (fiscal-tasks.csv) |
| PDF-2 | Taxa Bug → User Story (refinamento) | PDF | 🔴 Alta | Sim (fiscal-transicoes.csv) |
| PDF-3 | Tempo por causa de bloqueio/status | PDF | 🔴 Alta | Sim (fiscal-paralizacoes.csv) |
| PDF-4 | Histórico diário de WIP por coluna | PDF | 🟠 Média | Parcialmente |
| PDF-5 | Análise da coluna "Fato Causa Ação" | PDF | 🟠 Média | Depende do campo no ADO |
| PDF-6 | Resumo executivo automático | PDF | 🟡 Baixa | Sim (derivado) |
| MD-1 | Classificação de origem dos bugs | Markdown | 🔴 Alta | Parcialmente |
| MD-2 | Lead Time de Bug até PRR | Markdown | 🔴 Alta | Sim |
| MD-3 | Complexidade por arquivos no PR | Markdown | 🟠 Média | Não (requer PR API) |
| MD-4 | US Merge excluído do throughput | Markdown | 🟠 Média | Sim |
| MD-5 | Bugs sem responsável identificado | Markdown | 🟡 Baixa | Sim |

---

## Recomendação de Prioridade para Implementação

### Fase 1 — Com dados já disponíveis (sem alterar sync_devops.py)
1. **PDF-2** — Taxa de conversão Bug → User Story (`fiscal-transicoes.csv`)
2. **PDF-3** — Tempo por causa de bloqueio (`fiscal-paralizacoes.csv`)
3. **PDF-1** — Horas Dev × Horas Teste por tipo (`fiscal-tasks.csv`)
4. **MD-2** — Lead Time de Bug até PRR (`fiscal-tempo-coluna.csv`)
5. **MD-4** — Excluir US Merge do throughput (filtro no `app.js`)

### Fase 2 — Requer ajuste no sync_devops.py
6. **MD-1** — Classificação de origem dos bugs (análise de PR titles)
7. **PDF-4** — Histórico diário de WIP (nova coleta no sync)

---

*Análise gerada em 03/07/2026 com base no texto completo extraído do PDF via pdfminer.six e no relExempo.md*
