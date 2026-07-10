# Análise de Gaps: Relatório de Rastreabilidade vs Dashboard Atual

> Fonte analisada: `Relatório Rastreabilidade Junho 2026.pdf` (Squad Venda) e `relExempo.md`  
> Dashboard atual: Squad Fiscal — `index.html` + `app.js`

---

## Resumo Executivo

O relatório de rastreabilidade traz **5 dimensões analíticas** que hoje **não existem** no dashboard ou existem de forma parcial/incompleta. As duas mais críticas estão relacionadas à **classificação de origem dos bugs** (Legado N3, Legado Dívida Técnica, Nossa Implementação, Indeterminado) e à **métrica de Lead Time calculada até "Pronto pra Release" (PRR)** — distinta do Lead Time geral já exibido.

---

## Gaps por Dimensão

### 🔴 Gap 1 — Classificação de Origem dos Bugs (CRÍTICO — não existe no dash)

O relatório classifica cada bug em **4 categorias de origem**:

| Categoria | Critério | Exemplo Junho/26 |
|-----------|----------|-----------------|
| **Legado N3** | Cherry-pick / replicação do N3 | 9 bugs (38%) |
| **Legado Dívida Técnica** | Correção estrutural de fluxo antigo | 9 bugs (38%) |
| **Nossa Implementação** | Tag `Implementacao feita por IA` ou código recente do squad | 2 bugs (8%) |
| **Indeterminado** | Sem PR vinculado ou tag `!BUG` | 4 bugs (17%) |

**O que o dashboard faz hoje:** exibe bugs por *severidade* e *tags operacionais*, mas **não classifica a origem do bug**. Não há distinção entre bug de legado vs. bug introduzido pelo próprio squad.

**Por que importa:** a origem determina a responsabilidade e a ação corretiva. Um bug de Legado N3 é tratado de forma diferente de um bug de "Nossa Implementação". Sem essa dimensão, o gerente não sabe se o squad está introduzindo novos bugs ou apenas pagando dívida técnica.

**Dado necessário:** campo `Tags` ou `PR Title` já estão nos CSVs (`fiscal-tags.csv`, `fiscal-transicoes.csv`). A lógica de classificação pode ser replicada da skill `analise-squad-mes`.

---

### 🔴 Gap 2 — Lead Time de Bug calculado até PRR (CRÍTICO — parcialmente diferente)

O relatório usa como marco de fechamento do bug a entrada na coluna **"Pronto pra Release" (PRR)**, não o fechamento final (Resolved/Closed):

> **Lead Time Bug = Data Criação → Data entrada em PRR**

O dashboard atual calcula Lead Time genérico (criação → fechamento). Isso gera **divergência nas métricas**:

- Junho/26 relatório: mediana **20,7 h**, média **44 h** (somente bugs com PRR)
- Dashboard: provavelmente mostrará valor diferente (inclui bugs fechados sem PRR no histórico e usa data de Closed)

**Casos especiais não tratados:**
- Bugs fechados **sem PRR no histórico** (4 casos) — o relatório os lista explicitamente
- Bugs fechados com tag `!BUG` — o relatório os destaca separadamente (2 casos)
- Bugs **em aberto sem PRR** (4 casos) — o relatório os rastreia com alerta

**O que o dashboard faz hoje:** a tabela de bugs mostra "Dias em Aberto / Resolução" mas não separa o cálculo por marco PRR vs. fechamento final.

---

### 🟠 Gap 3 — Complexidade de Bug por Quantidade de Arquivos no PR (não existe)

O relatório classifica cada bug pela **complexidade do Pull Request**:

| Complexidade | Critério (FilesChanged no PR) |
|---|---|
| Simples | 1–2 arquivos |
| Médio | 3–4 arquivos |
| Complexo | 5+ arquivos |
| Indeterminado | Sem PR vinculado |

**O que o dashboard faz hoje:** nenhuma métrica de complexidade por PR.

**Por que importa:** bugs complexos (5+ arquivos) tendem a introduzir regressões e merecem revisão de QA mais rigorosa. Rastrear essa distribuição ao longo do tempo revela se a dívida técnica está crescendo ou diminuindo.

**Dado necessário:** seria necessário integrar dados de PR da API do Azure DevOps (Pull Requests API) — que o `sync_devops.py` atual **não coleta**.

---

### 🟠 Gap 4 — Separação explícita "Entregável vs Não-Entregável" (parcial)

O relatório separa rigorosamente o que conta como entrega real:

| Categoria | Entra nas métricas? |
|---|---|
| Bug | ✅ Sim |
| US Feature | ✅ Sim |
| US Merge | ❌ Não (operacional Git) |
| Atendimento | ❌ Não (suporte) |

**O que o dashboard faz hoje:** a página "Entregas e Produtividade" exibe todos os Work Items concluídos (com filtro por tipo Bug/User Story), e "Atendimentos" tem página separada. **US Merge não é distinguido de US Feature** na contagem de throughput — se o squad fechar 5 US Merge e 3 US Feature na semana, o throughput aparece como 8.

**Impacto:** o throughput semanal do dashboard pode estar inflado por US Merge (integrações Git), distorcendo a percepção de velocidade real.

---

### 🟡 Gap 5 — Monitoramento de US Grandes (Lead ≥ 100h ou PR ≥ 14 arquivos)

O relatório identifica **US "grandes"** por critério combinado:

> PR ≥ 14 arquivos **OU** Lead ≥ 100h **OU** ≥ 20h em tasks

E exibe uma tabela com:
- Arquivos no PR, Lead time, Nº de Tasks, Horas de task, Horas estimadas
- Razão **Arq/h task** (indicador de eficiência)
- Razão **Lead/h task** (indicador de bloqueio externo)

**O que o dashboard faz hoje:** a tabela "Top 20 Itens com Maior Envelhecimento" mostra itens velhos, mas **não classifica US grandes pelo critério acima** nem calcula as razões de eficiência.

---

### 🟡 Gap 6 — Bugs sem Responsável Identificado (parcial)

O relatório lista explicitamente os bugs **sem nenhum responsável** no histórico de PRs:

> "Bugs sem responsável: 2 (#20300, #20587)"

**O que o dashboard faz hoje:** a coluna "Responsável" na tabela de bugs exibe o `AssignedTo` atual do Work Item, mas **não verifica se alguém efetivamente trabalhou no bug via PR**. Um bug pode estar "assignado" mas sem PR, ou sem assignee e sem PR.

---

### 🔵 Gap 7 — Participações por Programador em Bugs (análise de colaboração)

O relatório mostra uma tabela de **participações** (não apenas responsável único):

| Programador | Participações | Via PR Título | Somente PR Título |
|---|---|---|---|
| gilmar | 19 | 12 | 0 |
| fabio | 16 | 0 | 0 |
| ... | ... | ... | ... |

Isso revela colaboração real (quantos bugs cada dev tocou, mesmo que não seja o "assignee").

**O que o dashboard faz hoje:** mostra volume de entregas **por responsável no fechamento** (1 pessoa por item). Não mapeia colaboração multi-dev em um mesmo bug.

---

## Tabela Resumo de Priorização

| # | Gap | Criticidade | Dado já disponível? | Esforço estimado |
|---|-----|-------------|---------------------|-----------------|
| 1 | Classificação de origem dos bugs (Legado N3 / Dívida / Nossa Impl.) | 🔴 Alta | Parcialmente (tags + PR title nos CSVs) | Médio |
| 2 | Lead Time de Bug calculado até PRR (vs. fechamento) | 🔴 Alta | Sim (fiscal-tempo-coluna.csv tem histórico de colunas) | Baixo |
| 3 | Complexidade de bug por FilesChanged no PR | 🟠 Média | Não (requer integração PR API) | Alto |
| 4 | Separação US Merge vs US Feature no throughput | 🟠 Média | Parcialmente (tipo está nos CSVs, subtipo não) | Médio |
| 5 | US Grandes (Lead ≥ 100h ou PR ≥ 14 arq.) com razões Arq/h e Lead/h | 🟡 Baixa | Parcialmente (lead time sim, arquivos de PR não) | Médio |
| 6 | Bugs sem responsável identificado (sem PR e sem assignee) | 🟡 Baixa | Sim (transicoes + assignee) | Baixo |
| 7 | Participações multi-dev por bug (colaboração real) | 🔵 Info | Parcialmente (via PR titles nos transicoes) | Médio |

---

## Recomendação de Implementação Imediata

Os gaps **2 e 6** podem ser implementados agora com os dados já existentes nos CSVs, sem nenhuma mudança no `sync_devops.py`:

### Gap 2 — Lead Time até PRR
Na página **Qualidade e Bugs**, adicionar duas novas métricas na tabela mestre:
- Coluna: **Lead Time até PRR** (criação → entrada em PRR, quando houver)
- Badge: **"Fechado sem PRR"** para bugs que foram fechados sem passar pela coluna PRR
- KPI de destaque: **% de bugs com PRR** (cobertura do processo)

### Gap 6 — Bugs sem Responsável
No alerta de bugs, adicionar regra:
- **Blocker:** Bug em estado ativo sem `AssignedTo` e sem transição de "Em desenvolvimento" nos últimos 7 dias

### Gap 1 — Origem dos Bugs (maior valor)
Requer lógica similar à da skill `analise-squad-mes`:
1. Verificar se o bug tem PR vinculado (via `fiscal-transicoes.csv`, campo PR title)
2. Classificar pela presença de referência N3 no título do PR (`"N3"`, `"cherry"`, `"replicando"`)
3. Verificar tag `Implementacao feita por IA` em `fiscal-tags.csv`
4. Demais com PR → Legado Dívida; sem PR → Indeterminado

Isso permitiria um **novo gráfico de pizza na página Qualidade** mostrando a distribuição de origem dos bugs.

---

*Gerado em 03/07/2026 com base na análise de `relExempo.md` e `index.html`*
