# FISCAL_RULES

## Objetivo

Centralizar validações de **domínio fiscal** no Code Review: documentos eletrônicos, obrigações (SPED), impostos, consistência com movimentação e **estoque no âmbito fiscal** (incluindo divergência físico vs fiscal).

Este arquivo é a fonte oficial para esse escopo. Não duplicar estes checklists em `codereview.md` ou em outros rules — remeta a este documento.

**Responsável / última revisão (preencher):** _Tech Lead Fiscal — data_

---

## Escopo de aplicabilidade

Aplicar **integralmente** quando **qualquer** condição abaixo for verdadeira para **ao menos um** arquivo do diff.

### 1) Por projeto (primeiro segmento do caminho no repositório)

- `NFModelo/**`, `NFServidor/**`
- `JobEmailComplienceFiscal/**`, `JobGerarArquivosGED/**`, `JobAtualizarDadosNCMTransparenciaTributos/**`, `JobExecutaAgendamentoEvento/**`, `JobGerarNFeAutomatica/**`, `JobManifestacaoDestinatario/**`
- `MetaDOCe/**`, `MetaDOCeView/**`, `MetaDOCeBarretos/**`, `MetaDOCeHomologacao/**`
- `ModeloSPED/**` (assembly ModeloFiscal — SPED/EFD)
- `SpedEfdContribuicoes/**`, `Exportacao/**`
- `Validacao/**` (quando o diff tocar validadores de exportação fiscal/SPED)
- `JobGerarNFeAutomatica/**`, `JobEmailComplianceFiscal/**`, `JobVerificarMercadoriasComplianceFiscal/**`
- `DynamicQuery/**` (apenas paths listados em *Por caminho* abaixo)

### 2) Por caminho (globs — monorepo MetaNet)

- `**/Meta/Queries/Fiscal/**`
- `**/Meta/**/Fiscal/**`
- `**/Sped/**`, `**/Exportacoes/SPED/**`
- `**/EfdFiscal/**`, `**/EfdPisCofins/**`
- `**/Meta/AtualizacaoBD/**` quando o patch alterar `FN_FIS_*`, `FIS_*`, `FN_EST_*`, `SpedFiscal`, `SpedContribuicoes`, `DocumentoFiscal`, `NFe`, `CTe`, `MDFe`
- `Business/**/Exportacoes/SPED/**`
- `MetaReport/**/Fiscal/**`, `ControllerView/**/Fiscal/**`, `View/**/Exportacao/SPED/**`, `ViewUtil/**/SPED/**`

### 3) Por conteúdo no patch (diff fora dos paths acima)

Aplicar também se o hunk contiver, de forma não trivial, referências a:
`NotaFiscalEletronica`, `NFCe`, `CTe`, `MDFe`, `SpedFiscal`, `EfdPisCofins`, `CFOP`, `CST`, `ICMS`, `IPI`, `PIS`, `COFINS`, `DocumentoFiscal`, `BeneficioFiscal`, `EstoqueFiscal`, tags/layout NF-e/CT-e.

### Exclusões (não aplicar checklist integral só por isso)

- `ImpressoraFiscal/**`, `ImpressoraNaoFiscal/**` — hardware/impressão ECF; revisar fiscal só se o diff alterar **regra** de documento eletrônico, tributo ou integração SEFAZ.
- Relatórios com nome `*Fiscal*` que forem apenas layout/consulta sem alterar cálculo, XML ou SPED — mencionar risco leve; checklist completo só se houver mudança em query/regra de apuração.

Se **nenhuma** condição for atingida, **não** aplicar este checklist como obrigatório (menção genérica de risco no `codereview` é suficiente).

---

## Classificação de severidade

- **CRÍTICO:** risco de rejeição SEFAZ, escrituração incorreta, inconsistência fiscal grave, bloqueio operacional ou multa.
- **ATENÇÃO:** risco moderado de qualidade fiscal ou divergência detectável em homologação.
- **SUGESTÃO:** melhoria recomendada sem bloqueio imediato.

---

## Documentos fiscais eletrônicos

O sistema realiza emissão e controle dos seguintes documentos fiscais eletrônicos:

- NF-e (Nota Fiscal Eletrônica — modelo 55)
- NFC-e (Nota Fiscal de Consumidor Eletrônica — modelo 65)
- CT-e (Conhecimento de Transporte Eletrônico)
- MDF-e (Manifesto Eletrônico de Documentos Fiscais)

Esses documentos possuem regras fiscais rígidas e validações que não podem ser quebradas.

Durante a revisão de código, avaliar se alterações podem causar:

- inconsistência de valores fiscais
- erro de cálculo de impostos
- quebra de geração de XML fiscal
- falha no envio para SEFAZ
- inconsistência de totais da nota

---

## Obrigações fiscais geradas (SPED e afins)

O sistema também gera arquivos fiscais obrigatórios, incluindo:

- SPED Fiscal (EFD ICMS/IPI)
- SPED Contribuições

Esses arquivos devem respeitar regras contábeis e fiscais rígidas.

Durante a análise, avaliar riscos como:

- alterações que possam gerar dados inconsistentes
- quebra de layout fiscal
- cálculos fiscais incorretos
- inconsistência entre movimentação e registros fiscais

---

## Controle de estoque (âmbito fiscal)

O sistema realiza controle de estoque de combustíveis e produtos.

Durante a revisão, considerar riscos como:

- movimentações de estoque incorretas
- inconsistência de saldo
- atualizações concorrentes
- erros que possam gerar estoque negativo indevido
- divergência entre estoque físico e fiscal

---

## Cuidados específicos (ângulo fiscal)

Durante a revisão de código, considerar também:

- divergência entre valor da venda e **valor fiscal**
- erros em **arredondamento fiscal**
- alteração indevida de **regras tributárias**
- impacto em **totais da nota** e consistência documento fiscal
- impacto em **integrações fiscais**

---

## Regras de negócio críticas (fiscal)

Alterações que impactem **regras fiscais**, **cálculo de impostos**, **geração de documentos fiscais** ou **movimentação de estoque** com reflexo fiscal devem ser analisadas com atenção redobrada.

---

## Notas Técnicas (SEFAZ)

NTs alteram layout XML, validações, eventos e webservices (NF-e, NFC-e, CT-e, MDF-e).

- **Catálogo e status no produto:** `.cursor/rules/fiscal/NT-INDEX.md`
- **Fichas por NT (quando existirem):** `.cursor/rules/fiscal/nt/NT-*.md`

No code review:

- Diff com `HabilitaNT`, `ENotaTecnica`, `NotasTecnicas`, `EPacoteLiberacaoXmlSchema*` → cruzar com o índice e flags de empresa.
- Não aprovar desativação de NT obrigatória em vigência sem ticket/ADR explícito.
- Registrar no parecer quais NTs o PR impacta (ex.: `NT 2025.002 RTC`).

---

## Gatilhos de detecção rápida

- `HabilitaNT*`, `NFeHabilitaNT*`, `NFCeHabilitaNT*`, `HabilitarNT2025001`, `ENotaTecnica`, `ignorar_NT2025001.txt`
- Alteração em tags XML NF-e/NFC-e/CT-e, XSD, `WsNFe_*`, `MetaDOCe/Meta/ServicosCTe/**`
- CFOP, CST, alíquotas, IBS/CBS, arredondamento fiscal, totais da nota
- Cadastro de tributos, geração EFD/SPED, `FN_FIS_*`, estoque fiscal (bloco K, divergência físico/fiscal)

**Severidade padrão dos gatilhos:** conforme classificação acima.

---

## Regras obrigatórias de validação (expansão)

### 1) _(preencher tema — ex.: XML e schema)_

- _(preencher)_

### 2) _(preencher tema — ex.: cálculo de impostos)_

- _(preencher)_

---

## Evidências mínimas no parecer

Para cada apontamento fiscal, registrar:

- Severidade (CRÍTICO, ATENÇÃO, SUGESTÃO)
- Arquivo/objeto impactado
- Trecho do diff analisado
- Descrição do risco e impacto potencial
- Correção recomendada

---

## Relação com outros documentos

- **`fiscal/NT-INDEX.md`:** Notas Técnicas SEFAZ — flags, datas de vigência e mapa de código; não duplicar tabelas de NT aqui.
- **`DBA_RULES.md`:** alterações em SQL, procedures, migrações ou persistência — aplicar também as regras de banco; não repetir normas SQL aqui.
- **`design-rules.md`:** arquitetura e camadas do monorepo.
- **`VENDAS_RULES.md`:** fluxo comercial e frente de venda quando o foco não for documento/escrituração — pode haver sobreposição; priorizar o ângulo fiscal neste arquivo quando ambos se aplicarem.
- **`FINANCEIRO_RULES.md`:** contabilidade e partidas — convergir impacto em lançamentos quando o diff tocar nos dois domínios.
