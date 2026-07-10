# Padrão de descrição de tasks (plano de ação → Azure DevOps)

Fonte canônica do formato de `System.Description` (HTML) para tasks geradas por plano de ação.

**Usar em:**
- skill `orquestrador-tasks-azure` (gerar plano e textos no chat)
- skill `cadastrar-tasks-azure` (publicar no Azure DevOps)
- reescrita manual de tasks filhas após validação de backlog

**Objetivo:** o desenvolvedor deve entender **o que entregar** sem depender de jargão técnico disperso. Priorize linguagem de **produto/negócio**; detalhes de implementação só quando indispensáveis (nome de tabela, contrato, etc.) e sempre explicados em uma frase simples.

**Não** usar listas técnicas soltas nem bullets genéricos como único conteúdo.

---

## Regras de redação

1. Texto em **português**, frases curtas, vocabulário acessível ao time de desenvolvimento e QA.
2. Cada task deve deixar claro: **para que serve**, **o que entregar**, **exemplo prático** e **como saber que terminou**.
3. Delimitar escopo com **O que NÃO fazer nesta task** e **Dependências** (tasks irmãs anteriores/posteriores).
4. Tasks de **Development** numeradas (`2.1`, `2.2`, …): uma entrega por task; não misturar escopo de outra task.
5. Task **`1. Requirements`:** resumo completo da conversa/análise (contexto, decisões de produto, escopo IN/OUT, critérios de aceite, exemplos e mensagens sugeridas).
6. **Proibido** como descrição final: apenas bullets técnicos (`NHibernate`, `DTO`, `insert`) sem explicar o propósito para o usuário do sistema ou para o dev que vai implementar.

---

## Estrutura obrigatória do HTML (`System.Description`)

Usar estas seções, nesta ordem (adaptar títulos se a task for Requirements, QA, etc.):

| Seção | Conteúdo |
|--------|----------|
| **Para que serve esta task** | Problema que resolve e por que existe no plano (1–3 parágrafos). |
| **Em termos simples** | (opcional) Uma frase ou analogia do que o dev vai fazer. |
| **O que deve ser entregue** | Lista **numerada** de artefatos/comportamentos concretos (o que existe ao final). |
| **Exemplo simplificado** | Cenário prático, tabela ou passo a passo mínimo (dados de exemplo quando couber). |
| **Como saber que a task está concluída** | Critérios verificáveis (checklist). Incluir testes unitários **somente** se o time/card exigir. |
| **O que NÃO fazer nesta task** | Escopo excluído, com referência às tasks irmãs (`2.7`, `2.9`, etc.). |
| **Dependências** | Tasks ou entregas que precisam estar prontas antes. |

---

## Modelo mínimo (copiar e adaptar)

```html
<h2>Para que serve esta task</h2>
<p>...</p>

<h2>Em termos simples</h2>
<p>...</p>

<h2>O que deve ser entregue</h2>
<ol>
  <li>...</li>
</ol>

<h2>Exemplo simplificado do que deve funcionar ao final</h2>
<p>...</p>
<table border="1" cellpadding="6">...</table>

<h2>Como saber que a task está concluída</h2>
<ul>
  <li>...</li>
</ul>

<h2>O que NÃO fazer nesta task</h2>
<ul>
  <li><strong>Não</strong> ... (task <strong>X.Y</strong>).</li>
</ul>

<h2>Dependências</h2>
<p>Task <strong>X.Y</strong> concluída — ...</p>
```

---

## Variações por tipo de task

| Task | Ajuste |
|------|--------|
| **1. Requirements** | Incluir contexto, decisões fechadas, escopo IN/OUT, critérios de aceite e textos sugeridos (mensagens, pop-up). Pode ser mais longa. |
| **2.x Development** | Foco em entrega verificável; exemplo com dados fictícios; limites de escopo explícitos. |
| **3. DevelopmentTests** | Orientar testes unitários (regras isoladas, sem I/O) e de integração (interação entre camadas); listar cenários a cobrir conforme o escopo do card. |
| **4. TechnicalValidation** | Roteiro do que validar do ponto de vista do usuário/sistema; evidências esperadas. |
| **5. Documentation** | O que documentar na Wiki e para quem (suporte, implantação). |
| **6. CodeReview** | O que o revisor deve conferir (aderência às tasks 2.x, textos, escopo). |
| **7. Testing** | Tabela cenário × resultado esperado; referência ao Test Case filho. |

---

## Checklist antes de publicar a descrição

- [ ] Um dev que não participou da análise entende o objetivo em uma leitura.
- [ ] Está claro o que **entra** e o que **não entra** na task.
- [ ] Há pelo menos um **exemplo** concreto.
- [ ] Os critérios de conclusão são **testáveis**.
- [ ] Não há contradição com o card pai nem com tasks irmãs.
