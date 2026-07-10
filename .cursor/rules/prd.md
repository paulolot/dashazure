# PRD — contexto de produto (monorepo MetaNet)

**Escopo:** Este repositório contém o **ecossistema MetaNet** (solutions .NET Framework: PDV, MetaPosto, MetaServerGlobal, integrações, jobs, utilitários, etc.).

**Versão do índice:** 1.1 — hub de regras ampliado (`FISCAL_RULES`, `FINANCEIRO_RULES`, `VENDAS_RULES`)
**Versão do índice:** 1.3 — DBA lazy (`DBA_GATILHOS.md` + `DBA_EXEMPLOS.md`); legado `DBA_RULES.md`

---

## Fonte de verdade para negócio

Não há um único PRD consolidado em `src/Api/...` neste workspace. Para regras de **produto e negócio** aplicáveis a uma alteração:

- Use **documentação interna**, **especificação do cliente** ou **tickets** como referência principal.
- O arquivo **`design-rules.md`** descreve **arquitetura e convenções de código** neste repositório, não substitui um PRD funcional completo.

---

## Mapa de regras do repositório

**Instrução para Code Review:** consulte **primeiro** esta tabela (e os arquivos apontados) para decidir **quais** documentos aplicar ao diff. Cada arquivo setorial define **escopo de aplicabilidade** no próprio texto — não aplique checklist de domínio quando o diff não atingir esse escopo.

### Núcleo de arquitetura e produto

| Documento | Conteúdo |
|-----------|----------|
| `design-rules.md` | **Arquitetura do monorepo**, camadas reais, stack, convenções de implementação — fonte primária para decisões estruturais (não checklist fiscal/financeiro detalhado). |
| `prd.md` | Este arquivo: contexto de produto e **índice** dos demais rules. |

### Validação por domínio (Code Review)

| Documento | Conteúdo |
|-----------|----------|
| `DBA_GATILHOS.md` + `DBA_EXEMPLOS.md` | **Code Review DBA (lazy):** detecção G01–G25 + exemplos por gatilho disparado. Ler GATILHOS no scan; abrir EXEMPLOS só do ID disparado. |
| `DBA_RULES.md` | Referência **legada** integral de banco de dados SQL Server — não usar no fluxo operacional do review. |
| `FISCAL_RULES.md` | Documentos fiscais eletrônicos, SPED, impostos, estoque no âmbito fiscal, integrações fiscais. |
| `fiscal/NT-INDEX.md` | Catálogo de Notas Técnicas SEFAZ (NF-e, NFC-e, CT-e) — flags, vigência e pontos no código. |
| `FINANCEIRO_RULES.md` | Contabilidade, partidas, saldos, impacto financeiro-contábil. |
| `VENDAS_RULES.md` | Canal de vendas, PDV, conveniência, consistência comercial (itens/totais de venda). |
| `vendas/BR-MANIA-CANAL-VENDAS.md` | Ficha: canal SMARTPOS na integração BR Mania (MetaNetPay → cupom). |
| `integracao/shellbox.md` | Shell Box: contrato JSON (`receivable`), desconto NFC-e, `FinalizadoraShellBox` / `ObterValorMetodoShellBox`. |
| `GERAL_RULES.md` | Boas práticas **transversais** de C#/.NET (ex.: CAST/`OfType`, materialização dinâmica, GDI+/WinForms, gatilho composto `ui-deadlock-espera-cooperativa` para `ThreadPool` + `while` na UI) que não cabem em domínio nem em SQL. |

**Regra de decisão rápida:** se o diff não for Fiscal, Financeiro, Vendas, SQL/persistência ou puramente arquitetural, avaliar `GERAL_RULES.md` antes de criar nova rule.

### Demais documentos (`.cursor/rules/`)

| Documento | Conteúdo |
|-----------|----------|
| `flow-rules.md` | Fluxos e diagramas |
| `read-models-specification.md` | Read models (onde aplicável) |
| `security-guide.md` | Segurança |
| `test-case.md` | Casos de teste |
| `cursor-rules.md` | Execução no Cursor |

---

## Outros documentos (legado da tabela única)

A tabela acima **substitui** a listagem antiga fragmentada; mantém-se o mesmo conjunto de arquivos, com **prioridade** ao **Mapa de regras** para navegação.

---

**Nota:** Versões anteriores deste arquivo apontavam para caminhos de outro projeto (por exemplo API isolada). Esse conteúdo foi **substituído** para refletir o monorepo atual.
