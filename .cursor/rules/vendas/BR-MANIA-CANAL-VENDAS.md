# BR Mania — Canal de vendas (arquivo de cupom)

**Versão da ficha:** 2.1  
**Última revisão:** maio/2026  
**Documento relacionado:** `.cursor/rules/VENDAS_RULES.md` (checklist de code review)

---

## Objetivo

Documentar a regra de preenchimento do atributo **Canal de Vendas** (`nomeCanalVenda` / `NomeCanalVenda`) na integração **BR Mania**, rotina de **vendas por cupom**, para identificar vendas originadas pelo **MetaNetPay** (Smart POS).

Esta ficha **não** substitui a especificação oficial da BR Mania — é o mapa operacional para PRs, `/codereview` e manutenção no monorepo MetaNet.

---

## Escopo da regra

Aplicar **somente** na geração/transmissão do **arquivo de vendas por cupom** da integração BR Mania.

**Incluído:**

- Scripts `[Integracao.BRMania].PC_Venda_PegarDocumentosEnviarBRMania` (produção) e `FN_Venda_PegarDocumentosEnviarBRMania` (legada)
- Propagação de `NomeCanalVenda` em `JobBRManiaTransmiteVenda` e `CupomFiscalBRManiaDTO`

**Fora de escopo (não alterar sem ticket explícito):**

- Envio de vendas mensais (`FN_Venda_PegarDadosVendasMesBRMania`, `JobBRManiaConsultaStatusTramissaoVendaMes`)
- Estoque, produtos e promoções BR Mania
- Demais campos do layout do cupom

---

## Regra de negócio

| Condição | Valor de `NomeCanalVenda` |
|----------|---------------------------|
| Venda originada pelo **MetaNetPay** (`IdentificadorPOS` preenchido) | `SMARTPOS` (exatamente, maiúsculas) |
| Demais casos | `PDV Metanet` (comportamento anterior) |

### Decisões fechadas

| Tema | Regra |
|------|--------|
| **MetaNetPay** | `PDV_DocumentoFiscal.IdentificadorPOS` preenchido → `SMARTPOS`. |
| **PDV convencional** | `IdentificadorPOS` vazio → `PDV Metanet`. |
| **Setor dos itens** | **Não** participa da regra de canal. |

---

## Implementação de referência

A regra é aplicada **no SQL** (procedure/function). O C# apenas propaga o valor retornado.

### Expressão SQL (procedure e function)

```sql
IIF(COALESCE(docPDV.IdentificadorPOS, '') <> '', 'SMARTPOS', 'PDV Metanet') AS NomeCanalVenda
```

| Camada | Responsabilidade |
|--------|------------------|
| **SQL** | Calcula `NomeCanalVenda` com base em `docPDV.IdentificadorPOS`. |
| **C#** | `JobBRManiaTransmiteVenda` normaliza e repassa `NomeCanalVenda` sem alterar o valor. |
| **API** | `CupomFiscalBRManiaDTO.NomeCanalVenda` → JSON `nomeCanalVenda`. |

### Fonte de verdade no repositório

| Artefato | Caminho |
|----------|---------|
| Procedure (produção) | `MetaServerGlobal/.../IntegracaoBRMania_PC_Venda_PegarDocumentosEnviarBRMania.xml` |
| Function (legada) | `MetaServerGlobal/.../IntegracaoBRMania_FN_Venda_PegarDocumentosEnviarBRMania.xml` |
| Repositório | `JobBRManiaVendas/Meta/Repositorio/RepositorioVendaBRMania.cs` |
| Job de transmissão | `JobBRManiaVendas/Meta/Job/JobBRManiaTransmiteVenda.cs` |
| DTO API | `BRManiaApi/Meta/Modelo/Parametro/Venda/CupomFiscalBRManiaDTO.cs` |
| Identificador MetaNetPay | `PDV_DocumentoFiscal.IdentificadorPOS` (usado no SQL, não exposto ao DTO) |

### Histórico de versão

| Versão | Regra / implementação |
|--------|------------------------|
| 1.0 | `SMARTPOS` com POS **e** ≥ 1 item `CodigoSetor = 'L'` (C#). |
| 2.0 | `SMARTPOS` para qualquer venda MetaNetPay (C#). |
| **2.1 (vigente)** | Mesma regra 2.0, implementada **no SQL**; C# sem lógica de canal. |

---

## Como usar no code review

1. Diff em escopo BR Mania cupom → aplicar `VENDAS_RULES.md` e **esta ficha**.
2. A regra deve estar **somente no SQL** — o C# (`JobBRManiaTransmiteVenda`) apenas propaga `NomeCanalVenda`; não adicionar lógica de canal no Job ou DTO.
3. Se alterar scripts `.xml`, atualizar **GUID** (`DBA_RULES.md`).
4. Registrar cenários validados na homologação.

**Gatilhos no diff (busca rápida):**

- `NomeCanalVenda`, `SMARTPOS`, `PDV Metanet`, `IdentificadorPOS`
- `IntegracaoBRMania_PC_Venda_PegarDocumentosEnviarBRMania`
- `IntegracaoBRMania_FN_Venda_PegarDocumentosEnviarBRMania`
- Alteração de `NomeCanalVenda` no C# (`JobBRManiaTransmiteVenda`) que recalcule o canal em vez de repassar o valor do SQL

---

## Severidade sugerida (violações)

| Violação | Severidade |
|----------|------------|
| Canal incorreto para MetaNetPay, ou regra fora do fluxo de cupom | **CRÍTICO** |
| Lógica duplicada/conflitante entre SQL e C# | **ATENÇÃO** |
| Script SQL alterado sem atualizar GUID | **CRÍTICO** (`DBA_RULES.md`) |

---

## Critérios de aceite (homologação)

| Cenário | Resultado esperado em `nomeCanalVenda` |
|---------|----------------------------------------|
| Qualquer venda via MetaNetPay | `SMARTPOS` |
| Venda via PDV convencional | `PDV Metanet` |
| Demais campos do cupom | Inalterados |

---

## Relação com outros documentos

- **`VENDAS_RULES.md`:** índice e escopo geral de vendas.
- **`DBA_RULES.md`:** GUID e convenções de scripts.
- **`design-rules.md`:** regra de negócio na camada de persistência/consulta SQL.
- **`FISCAL_RULES.md`:** não aplicável.
