# NT-INDEX — Catálogo de Notas Técnicas (SEFAZ)

**Versão do índice:** 0.1
**Última varredura no código:** maio/2026  
**Documento relacionado:** `.cursor/rules/FISCAL_RULES.md` (checklist de code review)

---

## Objetivo

Registrar **quais Notas Técnicas (NT)** o monorepo MetaNet conhece, **como são ativadas** (flag, data, ambiente) e **onde revisar** no código. Este arquivo **não** substitui o PDF oficial da SEFAZ — é o mapa operacional para PRs, `/codereview` e implementação.

### Definição (resumo)

Uma **Nota Técnica** é documento oficial da SEFAZ que altera layout XML, validações, eventos, tabelas auxiliares e comportamento dos webservices dos documentos eletrônicos (NF-e, NFC-e, CT-e, MDF-e).

---

## Como usar no code review

1. Diff em escopo fiscal → aplicar `FISCAL_RULES.md`.
2. Diff menciona `NT20`, `HabilitaNT`, `ENotaTecnica`, XSD, `EPacoteLiberacaoXmlSchema*` → cruzar com **este índice**.
3. Para NT marcada como **Alta atenção** ou **Em rollout**, abrir também a ficha em `.cursor/rules/fiscal/nt/` (quando existir).
4. No relatório do review, registrar: `NTs no escopo: NT 2025.002 (RTC), …` com base nas flags/datas alteradas.

**Gatilhos no diff (busca rápida):**

- `HabilitaNT`, `NFeHabilitaNT`, `NFCeHabilitaNT`, `HabilitarNT2025001`
- `ENotaTecnica`, `NotasTecnicas`, `ignorar_NT2025001.txt`
- `EPacoteLiberacaoXmlSchemaNFe`, `EPacoteLiberacaoXmlSchemaCTe`
- `UCNotaFiscalEletronica`, `UCNotaFiscalEletronicaConsumidor`, `UCConhecimentoTransporteEletronico`
- `ConfiguracaoEstabelecimentoCarga`, `FN_ConstruirSolicitacaoEnvio`

---

## Fonte de verdade no repositório

| Artefato | Caminho | Papel |
|----------|---------|--------|
| Enum canônico | `EspecificacaoGeral/Meta/ObjetoValor/NFe/Enumerador/ENotaTecnica.cs` | Flags de NT + pacote de schema XML |
| Montagem PDV (carga) | `IntegracaoGerenciadorPDV/Meta/Comum/Empresa/ConfiguracaoEstabelecimento.cs` → `NotasTecnicas` | Combina flags + **datas** + arquivo `ignorar_NT2025001.txt` |
| Montagem PDV (carga espelho) | `IntegracaoGerenciadorPDV/Meta/Comum/Carga/Empresa/ConfiguracaoEstabelecimentoCarga.cs` | Inclui `NT2026012` |
| NF-e retaguarda / PAF | `PAFECF/.../Conversores/ConversorNFe.cs`, `ConversorNFCe.cs` | Mesma lógica com pequenas variações de data |
| Envio servidor NF-e | `NFModelo/.../NFeSolicitacaoEnvio.cs` → `NotasTecnicas` | Inclui `HabilitarNT2026012` |
| Config empresa (MetaPosto) | `ModeloComum/.../ConfiguracoesNotaFiscalEletronica.cs` | `HabilitaNT*` persistidos |
| UI NF-e | `ViewUtil/.../UCNotaFiscalEletronica.cs` | Aba **Notas Técnicas** |
| UI NFC-e | `ViewUtil/.../UCNotaFiscalEletronicaConsumidor.cs` | Checkboxes NFC-e |
| CT-e | `ModeloComum/.../CTe/ConfiguracoesConhecimentoTransporteEletronico.cs` → `HabilitarNT2025001` | NT CT-e separada do enum NF-e |
| Emissão / XML / WS | `MetaDOCe/`, `NFServidor/`, `NFModelo/` | Preenchimento, validação, consumo SEFAZ |
| Carga PDV | `RepositorioComumDapper/.../EstabelecimentoCargaDTO.cs`, `GerenciadorPDV/.../ConfiguracaoEstabelecimentoCarga` | Colunas `CONFIGNFeHabilitaNT*` / `NFeHabilitaNT*` |

**Convenção de nomes:** no banco/carga PDV costuma aparecer `NFeHabilitaNT{AAAA}{NNN}`; na retaguarda `HabilitaNT{AAAA}{NNN}` ou `NFCeHabilitaNT*`.

---

## Legenda da tabela

| Coluna | Significado |
|--------|-------------|
| **Ativação** | `Config` = checkbox por empresa; `Data` = ligada por data/ambiente no código; `Config+Data` = ambos |
| **Status** | `Implementada` \| `Automática` \| `Em rollout` \| `Parcial` \| `Legado` |
| **Schema** | Pacote em `ENotaTecnica` / `EPacoteLiberacaoXmlSchema*` (quando houver) |

---

## NF-e e NFC-e (`ENotaTecnica`)

| NT | Modelo | Ativação | Flag(s) / propriedade | Status | Schema (enum) | Áreas principais no código |
|----|--------|----------|------------------------|--------|---------------|----------------------------|
| **2015.002** | NF-e | Config | `HabilitaNT2015002` | Legado / Implementada | `PL_008i2` | Grupo combustível; versão 3.10; `ConversorNFe`, tributação ICMS |
| **2016.002** | NF-e, NFC-e | Config | `HabilitaNT2016002`, `NFCeHabilitaNT2016002` | Implementada | `PL_009_V4_2016_002` | Layout 4.00; `IndPag`, duplicatas, GLP/combustível, cancelamento versão ambiente |
| **2018.005** | NF-e, NFC-e | Config | `NFeHabilitaNT2018005`, `NFCeHabilitaNT2018005` | Implementada | `PL_009_V4_00_NT_2018_005` | Campos condicionais em `ConversorNFe` |
| **2020.006** | NF-e, NFC-e | Config+Data | `NFe/NFCeHabilitaNT2020006` + sub-flags por data | Implementada | `PL_009_V4_00_NT_2020_006` e variantes | Pagamentos (`detPag`), PIX/cartões; ver sub-variantes abaixo |
| **2020.005** | NF-e, NFC-e | Config | `NFe/NFCeHabilitaNT2020005` | Implementada | `PL_009_V4_00_NT_2020_005` | GTIN `cBarra` / `cBarraTrib` |
| **2023.001** | NF-e, NFC-e | Config | `NFe/NFCeHabilitaNT2023001` | Implementada | `PL_009k_NT2023_001` | Combustível monofásico, `pBio`, `origComb` |
| **2019.001** | NF-e, NFC-e | Config+Data | `NFe/NFCeHabilitaNT2019001` (default true após vigência) | Implementada | `PL_009n_NT2023_004` (compartilhado) | ICMS redução base (`CalculoICMS51`) |
| **2023.004** | NF-e, NFC-e | Config+Data | `NFe/NFCeHabilitaNT2023004` (default true após vigência) | Implementada | idem | PIX/cartões, `GerarGrupoCartoesParaPix`; troco NFC-e (regra YA09-20 em `EMsgPadroes`) |
| **2025.001** | NF-e | **Data** (automática) | Sem checkbox; `ignorar_NT2025001.txt` desliga | Automática / Implementada | `PL_009q_NT2025_001` | Duplicatas/faturamento (`ConversorNFe` ~808); homolog. ≥ 02/06/2025, prod. ≥ 01/09/2025 |
| **2025.002 (RTC)** | NF-e, NFC-e | Config+Data | `NFe/NFCeHabilitaNT2025002` → `ENotaTecnica.NT2025002_RTC` | Em rollout | `PL_010b_NT2025_002` | IBS/CBS (`ImpostoIBSCBS`), `ExtensionsItemDocumentoFiscalImposto`, `DocumentoFiscalConverter`; homolog. ≥ 07/2025, prod. ≥ 10/2025 (datas no código — validar com fiscal) |
| **2026.012** | NF-e (NFC-e via flag NFe na carga) | Config+Data | `HabilitaNT2026012` / `NFeHabilitaNT2026012` | Em rollout | `PL_010b_NT2025_002` (mesmo pacote no enum) | `CalculoImpostoNotaFiscalSaida`, solicitação envio; vigência código: ≥ 01/04/2026 |
| **2026.002** | NF-e, NFC-e | Config+Data | `HabilitaNT2026002` (a criar) | Planejado ([#19756](https://dev.azure.com/metanetsistema/Metanet/_workitems/edit/19756)) | _A definir_ | Emissão tpImp=6, validações §4, ZX, contingência, cStat=120; SINIEF 13/2026; prod. ≥ 03/08/2026 |
| **2026.003** | NF-e | — (layout) | Depende de tpImp=6 (#19756) | Planejado ([#19871](https://dev.azure.com/metanetsistema/Metanet/_workitems/edit/19871)) | — | Leiaute impressão DANFE Tipo 2; prod. ≥ 03/08/2026 |
| **2026.004** | NF-e, NFC-e | **Substituição XSD** (sem flag) | Sem `HabilitaNT*` — regex `[0-9A-Z]{12}[0-9]{2}` aceita CNPJ numérico legado | Planejado ([#19882](https://dev.azure.com/metanetsistema/Metanet/_workitems/edit/19882)) | `PL_010d_NT2026.004` + `PL_Evento` + `CadConsultaCadastro` | XSD + regex C# + eventos + WS consulta/distribuição; homolog. até 15/06/2026, prod. 01/07/2026 |

### Sub-variantes **2020.006** (sem checkbox próprio)

Ativadas dentro de `NotasTecnicas` quando `NT2020006` está habilitada e a **data/ambiente** bate:

| Membro enum | Vigência (código) | Uso típico |
|-------------|-------------------|------------|
| `NT2020006_3108` | Homolog. ≥ 03/05/2021 ou prod. ≥ 01/09/2021 | `detPag.TipoPag`, regras pagamento |
| `NT2020006_0109` | Prod. ≥ 01/09/2021 | Pagamentos |
| `NT2021004_0404` | Homolog. ≥ 01/02/2022 ou prod. ≥ 04/04/2022 | Pagamentos |
| `NT2022003_0304` | Homolog. ≥ 07/02/2023 ou prod. ≥ 03/04/2023 | Pagamentos |

---

## CT-e (fora de `ENotaTecnica`)

| NT / pacote | Modelo | Ativação | Flag / propriedade | Status | Schema | Áreas principais |
|-------------|--------|----------|-------------------|--------|--------|------------------|
| **2025.001 (RT)** | CT-e 4.00 | Config | `ConfiguracoesConhecimentoTransporteEletronico.HabilitarNT2025001` | Implementada | `PL_CTe_400_NT2025001_RTC` | `MetaDOCe/Meta/ServicosCTe/**`, `ValidacaoObrigatorioModalRodoviario`, `OperacaoCalculoIBSCBSConhecimentoTransporteEletronico`, `EMsgPadroes` (pagamento frete, CIOT) |
| **2022.001** | CT-e 3.00 | Implícita no WS 3.00 | — | Implementada | `PL_CTe_300a_NT2022001` | Comportamentos `ConsumirWebServiceCTe*Comportamento_3_00*` |

UI: `ViewUtil/.../CTe/UCConhecimentoTransporteEletronico.cs` — label `NT 2025.001 1.05b (RT)`.

---

## NFS-e Nacional (CGNFSe — fora de `ENotaTecnica`)

| NT | Modelo | Ativação | Flag / propriedade | Status | Schema | Áreas principais no código |
|----|--------|----------|-------------------|--------|--------|----------------------------|
| **CGNFSe 009 v1.0 (RTC)** | NFS-e Nacional / DPS | Config | `RTCNFseNacional` + `UtilizaAmbienteNacional` | Em rollout | v1.01 atual → v1.04.00 alvo (Anexo VI NT009) | `NFModelo/.../ImplementacaoNFSe`, `ConversorNFSeNacional`, `ExtensionsNotaFiscalServico`, `UCNotaFiscalServicoEletronica` |

**Feature Azure DevOps:** [#19601](https://dev.azure.com/metanetsistema/Metanet/_workitems/edit/19601)  
**Ficha:** `.cursor/rules/fiscal/nt/NT-009-NFSe.md`  
**Cronograma oficial:** a publicar no [portal NFS-e](https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica) (monitorar).

---

## MDF-e

Não há enum `ENotaTecnica` nem flags `HabilitaNT*` dedicadas mapeadas nesta varredura. Alterações de layout/validação MDF-e costumam estar em `MetaDOCe` (serviços MDF-e) e schemas próprios. **Ao implementar NT de MDF-e:** adicionar linha nesta tabela e, se necessário, ficha em `fiscal/nt/`.

---

## NTs citadas na UI mas com lógica especial

| Referência UI / mensagem | Observação |
|--------------------------|------------|
| NT 2015.003 NA01 (partilha ICMS combustível) | Checkbox `chkmNaoValidarCodigoAnpPartilhaICMS` — regra de exceção, não é entrada em `ENotaTecnica` |
| NT 2023.004 — troco YA09-20 | Mensagem em `Utilitarios/.../EMsgPadroes.cs`; ligada à NT 2023.004 na NFC-e |
| `ignorar_NT2025001.txt` | Arquivo na pasta de execução do PDV; suprime `NT2025001` automática na montagem de `NotasTecnicas` |

---

## Datas de vigência embutidas no código (referência)

> **Atenção:** datas abaixo vêm do **código atual**; a NT oficial na SEFAZ prevalece em caso de divergência. Atualizar esta seção quando alterar `ConfiguracaoEstabelecimento` / conversores.

| NT | Homologação (aprox.) | Produção (aprox.) | Arquivo de referência |
|----|----------------------|-------------------|------------------------|
| 2019.001 + 2023.004 | 25/03/2024 | 01/07/2024 | `ConfiguracaoEstabelecimento.NotasTecnicas` |
| 2025.001 (NF-e) | 02/06/2025 | 01/09/2025 | idem + `ConversorNFe` |
| 2025.002 RTC | 07/2025 – 10/2025 (ver conversores) | 01/10/2025 – 06/10/2025 | `ConfiguracaoEstabelecimento`, `ConversorNFe` |
| 2026.012 | 01/04/2026 | 01/04/2026 | `ConversorNFe`, `NFeSolicitacaoEnvio`, `ConfiguracaoEstabelecimentoCarga` |
| 2026.002 (tpImp=6) | 01/07/2026 | 03/08/2026 | `nt/NT-2026-002.md`; cStat=120 prod. 05/10/2026 |
| 2026.003 (layout DANFE) | 01/07/2026 | 03/08/2026 | `nt/NT-2026-003.md`; feature #19871 |
| 2026.004 (CNPJ alfanumérico) | até 15/06/2026 | 01/07/2026 | `nt/NT-2026-004.md`; feature #19882 |

---

## Projetos típicos por tipo de mudança de NT

| Tipo de mudança | Projetos / pastas |
|-----------------|-------------------|
| XML / schema / WS NF-e | `MetaDOCe`, `NFModelo`, `NFServidor` |
| Conversão documento → XML | `PAFECF`, `NegocioMonetario`, `Business` |
| Configuração por empresa | `ViewUtil`, `ControllerView`, `ModeloComum`, `RepositorioComum` |
| Carga PDV | `GerenciadorPDV`, `IntegracaoGerenciadorPDV`, `RepositorioComumDapper` |
| CT-e | `MetaDOCe/Meta/ServicosCTe`, `Validacao`, `ViewUtil` (CTe) |
| Tributação | `MetaDOCe/Meta/Tributacao`, `NegocioMonetario` |

---

## Fichas detalhadas (`fiscal/nt/`)

Criar ficha quando a NT estiver em rollout, for obrigatória em curto prazo ou envolver vários PRs.

| NT | Ficha | Situação |
|----|-------|----------|
| CGNFSe 009 (NFS-e RTC) | `nt/NT-009-NFSe.md` | Em rollout |
| 2026.002 (SINIEF 13/2026) | `nt/NT-2026-002.md` | Planejado ([#19756](https://dev.azure.com/metanetsistema/Metanet/_workitems/edit/19756)) |
| 2026.003 (layout DANFE) | `nt/NT-2026-003.md` | Planejado ([#19871](https://dev.azure.com/metanetsistema/Metanet/_workitems/edit/19871)) |
| 2026.004 (CNPJ alfanumérico) | `nt/NT-2026-004.md` | Planejado ([#19882](https://dev.azure.com/metanetsistema/Metanet/_workitems/edit/19882)) |
| 2025.002 (RTC) | `nt/NT-2025-002.md` | _A criar_ |
| 2025.001 (CT-e) | `nt/NT-2025-001-CTe.md` | _A criar_ |
| 2026.012 | `nt/NT-2026-012.md` | _A criar_ |

---

## Manutenção deste índice

Responsável sugerido: **Tech Lead Fiscal**.

Ao mergear PR que:

1. Adiciona `HabilitaNT*` / coluna em `ConfiguracaoEstabelecimentoCarga`
2. Inclui membro em `ENotaTecnica`
3. Altera datas em `NotasTecnicas` ou conversores
4. Troca `EPacoteLiberacaoXmlSchema*`

→ **Atualizar esta tabela** na mesma PR (ou PR de documentação imediata).

**Varredura automatizável (sugestão):** buscar `HabilitaNT20` e `ENotaTecnica.` no repositório e comparar com a tabela acima.

---

## Links oficiais (preencher)

| Documento | URL |
|-----------|-----|
| Portal NF-e / NFC-e | _https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=04BIflQt1aY=_ |
| Portal CT-e | _https://www.cte.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=Y0nErnoZpsg=_ |
| NT específica | _Inserir link do PDF por NT na ficha ou nesta tabela_

---

## Histórico

| Data | Alteração |
|------|-----------|
| 2026-05 | Rascunho inicial gerado a partir de `ENotaTecnica`, flags de configuração e UI MetaNet |
| 2026-06-09 | NT 2026.002 (#19756) e NT 2026.003 (#19871) — features separadas, discovery e fichas |
| 2026-06-09 | NT 2026.004 (#19882) — CNPJ alfanumérico NF-e/NFC-e; US #19883–#19890; grounding e impacto |
| 2026-06-09 | NT 2026.004 — escopo reduzido: só XSD + eventos (#19884, #19886); sem flag NT; US01 eliminada |
| 2026-06-09 | NT 2026.004 — US05 #19887 reativada (WS); US02 inclui ajuste regex `[0-9]{14}` |
