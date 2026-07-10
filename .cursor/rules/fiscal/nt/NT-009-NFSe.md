# NT CGNFSe 009 — Adequações NFS-e (Reforma Tributária)

**Versão normativa:** 1.0 (04/06/2026)  
**Emissor:** SE/CGNFS-e  
**Status no MetaNet:** Em rollout (feature [#19601](https://dev.azure.com/metanetsistema/Metanet/_workitems/edit/19601))  
**Schema alvo:** Anexo VI v1.04.00 → `ANEXO_I-SEFIN_ADN-DPS_NFSe-SNNFSe` (produção)

---

## Documentos oficiais

| Documento | Versão | Uso |
|-----------|--------|-----|
| NT CGNFSe 009 PDF | v1.0 | Alterações normativas |
| Anexo VI — LeiautesRN_RTC_IBSCBS | v1.04.00 NT009 | Layout + RN DPS/NFS-e |
| Anexo VII — IndOp_IBSCBS | v1.02.00 | Tabela cIndOp |

Portal: https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica

---

## Ativação no MetaNet

| Mecanismo | Detalhe |
|-----------|---------|
| Flag | `CFG_NotaFiscalServicoEletronica.RTCNFseNacional` |
| Pré-requisito | `UtilizaAmbienteNacional = true` |
| Layout atual | DPS v1.01 (`verAplic = MetaNet_1.01`) |
| Layout alvo | v1.04.00 (US10) |
| Cronograma produção | **A publicar** no portal NFS-e (monitorar) |

---

## Tópicos e User Stories

| Tópico NT | US Azure | Título resumido |
|-----------|----------|-----------------|
| 2.1 | #19673 | CNPJ alfanumérico |
| 2.2 | #19674 | Notas ajuste crédito/débito |
| 2.3 | #19675 | vAjusteBC unificado |
| 2.4 | #19676 | Simples Nacional IBS/CBS |
| 2.5 | #19677 | indFinal |
| 2.6 | #19678 | Bens imóveis 99.03 |
| 2.7 | #19683 | bensMoveis |
| 2.8 | #19680 | gPgtoVinc |
| Anexo VII | #19681 | cIndOp v1.02.00 |
| Enabler | #19682 | Layout/schemas/RN |
| Monolítica (legado) | #19602 | Escopo completo (referência) |

---

## Cadeia de implementação (Harness)

```
NT PDF → Anexo VI/XSD → NFModelo (classes) → ConversorNFSeNacional
  → ExtensionsNotaFiscalServico → Cálculo tributário → UI → SEFIN
```

**Agentes:** FiscalDFeAgent, TaxCalculationAgent, SqlPersistenceAgent (se schema), LegacyTestHarnessAgent.

---

## Áreas de código

| Área | Caminho |
|------|---------|
| XSD/Modelo | `NFModelo/Meta/ImplementacaoNFSe/NFSe/Leiautes/Nacional/` |
| Conversor | `MetaDOCe/Meta/ServicosNFSe/Servicos/Nacional/Conversores/ConversorNFSeNacional.cs` |
| Extensions | `NegocioMonetario/.../ExtensionsNotaFiscalServico.cs` |
| Validação | `MetaDOCe/Meta/ServicosNFSe/Validacoes/ValidacaoGenericaNFSe.cs` |
| Config UI | `ViewUtil/.../UCNotaFiscalServicoEletronica.cs` |
| Discovery | `docs/harness-discovery/nfse-nt009-grounding.md` |
| Matriz fiscal | `docs/harness-discovery/nfse-nt009-tax-matrix.md` |

---

## Riscos

- Zona **VERMELHA** — validação humana obrigatória.
- RN de notas de ajuste parcialmente tachadas no anexo.
- CNPJ alfanumérico transversal (jul/2026).
- Motor de cálculo IBS/CBS reutiliza NFe — validar fórmulas NFSe.

---

## Histórico

| Data | Alteração |
|------|-----------|
| 2026-06-09 | Ficha criada; classificação Harness; US granulares #19673–#19682 |
