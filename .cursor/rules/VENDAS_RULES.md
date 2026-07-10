# VENDAS_RULES

## Objetivo

Centralizar validações de **domínio de vendas e canal comercial** no Code Review: PDV, combustível, conveniência e fluxos comerciais (preço, itens, totais da operação de venda), sem substituir as regras **fiscais** ou **financeiras** já definidas nos arquivos próprios.

Este arquivo é a fonte oficial para esse escopo. Não duplicar estes checklists em `codereview.md` — remeta a este documento.

**Responsável / última revisão (preencher):** _Tech Lead Vendas — maio/2026_

---

## Escopo de aplicabilidade

Aplicar **integralmente** quando **qualquer** condição abaixo for verdadeira para **ao menos um** arquivo do diff.

### 1) Por projeto (primeiro segmento do caminho)

- `PDV/**`, `PAFECF/**`, `GerenciadorPDV/**`
- `JobBRManiaVendas/**`, `BRManiaApi/**`
- `MetaLio/**`, `MetaPay/**`, `MetaHgfPay/**` (fluxos POS / MetaNetPay)
- `IntegracaoGerenciadorPDV/**` quando o patch alterar venda, cupom ou terminal POS

### 2) Por caminho (globs — monorepo MetaNet)

- `**/Meta/AtualizacaoBD/**/Integracao/BR/BRMania/Venda/**`
- `**/Implementacao/Venda/**`, `**/Controller/Venda/**`
- `**/TerminalPOS/**`, `**/ServicoLIO.cs`, `**/ServicoMetaPay.cs`

### 3) Por conteúdo no patch (diff fora dos paths acima)

Aplicar também se o hunk contiver, de forma não trivial, referências a:

`NomeCanalVenda`, `nomeCanalVenda`, `SMARTPOS`, `IdentificadorPOS`, `CodigoSetor`, `DepartamentoBRMania`, `FinalizadoraVenda`, `JobBRManiaTransmiteVenda`, `IntegracaoBRMania_PC_Venda_PegarDocumentosEnviarBRMania`.

### Exclusões

- Alteração **apenas** fiscal/XML/imposto sem impacto comercial → priorizar **`FISCAL_RULES.md`**, não checklist integral de vendas.
- Relatórios de venda somente leitura/consulta sem mudança de regra de fechamento ou canal → menção leve; checklist completo só se alterar query/regra comercial.

Se **nenhuma** condição for atingida, **não** aplicar este checklist como obrigatório.

---

## Classificação de severidade

- **CRÍTICO:** risco de venda incorreta, preço errado em massa, perda de receita ou incidente grave no canal de venda.
- **ATENÇÃO:** risco moderado de qualidade ou consistência comercial.
- **SUGESTÃO:** melhoria recomendada sem bloqueio imediato.

---

## Contexto do canal de venda

O ERP atende **postos de combustíveis** e **lojas de conveniência**. Em nível operacional de **vendas**, o sistema costuma envolver:

- venda de combustíveis
- venda de produtos de conveniência
- terminais POS (MetaNetPay) e PDV convencional

Detalhes de **documentos fiscais**, **SPED** e **obrigações** estão em **`FISCAL_RULES.md`**. Detalhes de **contabilidade** estão em **`FINANCEIRO_RULES.md`**.

---

## Cuidados específicos (ângulo vendas)

Durante a revisão de código, considerar riscos como:

- **inconsistência entre itens da venda e totais** (fluxo comercial / carrinho / fechamento de venda)
- alterações que afetem **preço**, **desconto** ou **composição do pedido** sem alinhamento com regras de produto
- **canal de vendas** incorreto em integrações com distribuidoras (ex.: BR Mania)

Questões de **valor fiscal**, **imposto** ou **XML** devem ser tratadas primariamente com **`FISCAL_RULES.md`**.

---

## Regras de negócio críticas (vendas)

Alterações que impactem **fluxo de venda**, **conferência de itens**, **totais da operação comercial** ou **canal de vendas em integrações** devem ser analisadas com atenção redobrada.

---

## Gatilhos de detecção rápida

- Alteração em tela ou serviço de **finalização de venda** (PDV, POS)
- `IdentificadorPOS`, `MetaNetPay`, terminal POS
- Integração **BR Mania** cupom: `NomeCanalVenda`, `SMARTPOS`, `IdentificadorPOS`, scripts `IntegracaoBRMania_*_PegarDocumentosEnviarBRMania`
- Preço, desconto, composição de itens no fechamento do cupom
- **`ShellBox`**, **`FinalizadoraShellBox`**, **`ShellBoxApi`**, `JsonPaymentDataShellBox`, `ObterValorMetodoShellBox` → aplicar **`integracao/shellbox.md`**

---

## Integrações parceiras (vendas / PDV)

Regras detalhadas por parceiro ficam em `.cursor/rules/integracao/`. Não duplicar contratos JSON aqui.

| Integração | Documento |
|------------|-----------|
| Shell Box (pagamento PDV, desconto NFC-e) | **`integracao/shellbox.md`** |

No code review, diff com gatilhos Shell Box acima → ler e validar **`integracao/shellbox.md`** integralmente.
**Severidade padrão dos gatilhos:** conforme classificação acima e fichas em `.cursor/rules/vendas/`.

---

## Regras obrigatórias de validação (expansão)

### 1) Integração BR Mania — canal de vendas (cupom)

Documentar a regra de preenchimento de `SMARTPOS` vs `PDV Metanet` no arquivo de vendas por cupom.

- **Ficha completa:** `.cursor/rules/vendas/BR-MANIA-CANAL-VENDAS.md`
- **Resumo:** MetaNetPay (`IdentificadorPOS` preenchido) → `SMARTPOS`; demais casos → `PDV Metanet`.
- **Implementação:** regra no SQL (`PC_Venda_PegarDocumentosEnviarBRMania` / `FN_Venda_PegarDocumentosEnviarBRMania`); C# apenas propaga `NomeCanalVenda`.

### 2) _(preencher tema — ex.: preço e totais no PDV)_

### 3) Shell Box — desconto vs. recebível

- Desconto no cupom/NFC-e: **somente** `payment.methods[]` com `receivable = false`.
- `receivable = true`: pagamento/recebível — **não** somar ao desconto.
- Ponto de implementação PDV: `ObterValorMetodoShellBox` em `FinalizadoraShellBox.cs` (detalhes em **`integracao/shellbox.md`**).

---

## Evidências mínimas no parecer

Para cada apontamento de vendas, registrar:

- Severidade (CRÍTICO, ATENÇÃO, SUGESTÃO)
- Arquivo/objeto impactado
- Trecho do diff analisado
- Descrição do risco e impacto potencial
- Correção recomendada

---

## Relação com outros documentos

- **`integracao/shellbox.md`:** contrato JSON Shell Box, desconto NFC-e e mapa de código — não duplicar regras `receivable` aqui.
- **`vendas/BR-MANIA-CANAL-VENDAS.md`:** canal SMARTPOS na integração BR Mania (cupom) — não duplicar tabelas de cenários aqui.
- **`DBA_RULES.md`:** persistência e SQL — aplicar quando houver impacto em banco (inclui GUID em scripts BR Mania).
- **`design-rules.md`:** arquitetura e camadas.
- **`FISCAL_RULES.md`:** quando a alteração afetar nota, imposto ou escrituração — revisar também o arquivo fiscal.
- **`FINANCEIRO_RULES.md`:** quando houver reflexo contábil direto da venda (ex.: `PC_ObterRateioDescontoShellBox`).
