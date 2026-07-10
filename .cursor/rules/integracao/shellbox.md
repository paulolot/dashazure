# Shell Box — regras de integração (PDV / NFC-e)

**Escopo:** pagamento Shell Box no PDV, interpretação do JSON `PaymentData` e destaque de desconto no documento fiscal (NFC-e / DANFE).

**Work item de referência:** [US 14311](https://dev.azure.com/metanetsistema/Metanet/_workitems/edit/14311) — destaque incorreto de desconto em transações Shell Box.

**Domínio pai no code review:** `VENDAS_RULES.md` (canal de vendas / PDV). Impacto fiscal do desconto no cupom: cruzar também com `FISCAL_RULES.md` quando o diff tocar em totalização ou XML.

---

## Contrato JSON (`payment.methods[]`)

Cada item em `payment.methods` possui, entre outros:

| Campo | Tipo | Significado operacional |
|-------|------|-------------------------|
| `methodCode` | int | Identificador do método (ex.: `30000` Minhas Campanhas, `20100` Shell Box Clube, `10000` Cartão) |
| `methodDescription` | string | Descrição exibida |
| `amount` | int | Valor em **centavos** |
| `receivable` | bool | **Regra central:** define se o valor é recebível pelo posto ou desconto de campanha |
| `mdr` | bool | Indica se há MDR sobre o recebível |

Valores em `payment.finalAmount` e `amount` vêm em **centavos**; converter para reais dividindo por `100`.

---

## Regras de negócio (obrigatórias)

### 1) Desconto no cupom / NFC-e

**Somente** métodos com `receivable = false` devem compor o **desconto** destacado no documento fiscal.

- Exemplo válido: **Minhas Campanhas** (`methodCode` 30000, `amount` 71 → R$ 0,71, `receivable: false`).
- **Não** tratar como desconto valores de campanhas ou clubes quando `receivable = true`.

### 2) Forma de pagamento / valor a receber

Métodos com `receivable = true` representam valores **recebíveis pelo estabelecimento** (pagamento / recebível Shell), **não** desconto.

- Exemplo: **Shell Box Clube** (`methodCode` 20100, `amount` 550 → R$ 5,50, `receivable: true`) — o posto recebe esse valor da Shell; **não** deve aparecer como desconto no cupom.

### Erro histórico (pré-correção US 14311)

A implementação original filtrava desconto pelo **`methodCode == 20100`** (Shell Box Clube). Isso invertia a regra: o clube é **recebível** (`receivable = true`), enquanto o desconto real vinha de **Minhas Campanhas** (`receivable = false`).

**Correção alinhada ao backlog:** identificar desconto pelo flag **`receivable == false`**, não pelo código fixo `20100`.

---

## Ponto único de implementação (PDV)

O valor de desconto Shell Box no fluxo de finalização é calculado em:

| Artefato | Caminho |
|----------|---------|
| Classe | `PAFECF/Meta/Implementacao/Venda/Finalizadoras/FinalizadoraShellBox.cs` |
| Método | `ObterValorMetodoShellBox(PaymentData paymentData)` |

Esse retorno alimenta, no mesmo `Iniciar`:

1. `ValorFinal` do pagamento (`finalAmount − desconto`).
2. Redução de `valorAPagar.ValorPagar`.
3. `AcrescimoDescontoSubTotal(..., DiferencaPrecoCupomShellBoxClub)` — **destaque de desconto no NFC-e / DANFE**.

**Conclusão para code review:** alterar **apenas** `ObterValorMetodoShellBox` para filtrar `receivable == false` (em vez de `methodCode == 20100`) atende os critérios de aceite da US 14311 no PDV, desde que a soma considere **todos** os métodos não recebíveis quando houver mais de um (preferir `Sum` sobre `FirstOrDefault`).

### Implementação esperada (referência)

```csharp
private decimal ObterValorMetodoShellBox(PaymentData paymentData)
{
    return paymentData.Payment.Methods
        .Where(m => m.Receivable == false)
        .Sum(m => m.Amount ?? 0m);
}
```

Atualizar XML doc do método: deixar de citar “Código 20100” como critério de desconto.

---

## Critérios de aceite (US 14311) × validação técnica

| Critério | Atendido pela correção em `ObterValorMetodoShellBox`? |
|----------|------------------------------------------------------|
| Desconto apenas com `receivable = false` | Sim |
| `receivable = true` tratado como pagamento (não desconto) | Sim — itens continuam persistidos em `ItemPagamentoDocumentoFiscalShellBox` com flag `Recebivel` |
| Valor correto no DANFE NFC-e | Sim — via `AcrescimoDescontoSubTotal` |
| Base fiscal não impactada incorretamente | Sim no PDV — desconto rateado deixa de incluir recebíveis |
| Cenários com múltiplos métodos (Shell + cartão) | Sim — cada método permanece na lista; só não recebíveis entram no desconto |

---

## Gatilhos de detecção rápida (code review)

Aplicar este documento quando o diff tocar:

- `FinalizadoraShellBox.cs`, `ObterValorMetodoShellBox`
- `ShellBoxApi/**`, `PaymentData`, `JsonPaymentDataShellBox`
- `ETipoFinalizadora.ShellBox`, `DiferencaPrecoCupomShellBoxClub`
- `ItemPagamentoDocumentoFiscalShellBox`, `PagamentoDocumentoFiscalShellBox`
- PDV: `ValidarAbastecimentoShellBox`, fluxos de pagamento Shell Box

**Severidade padrão:** **CRÍTICO** se desconto for calculado por `methodCode` fixo ou ignorar `receivable`.

---

## Fora do escopo desta regra (atenção em PRs adjacentes)

| Área | Observação |
|------|------------|
| Contabilidade | `[Financeiro.Contabil.Operacao].PC_ObterRateioDescontoShellBox` ainda filtra `CodigoPagamento IN (20100, 20000)` — lógica **financeira** distinta do PDV; mudança exige card próprio e `FINANCEIRO_RULES.md`. |
| Persistência | Itens Shell Box são gravados com `Recebivel` por método; não alterar sem necessidade. |

---

## Cenário de teste mínimo (US 14311)

JSON com três métodos:

- Minhas Campanhas: `amount` 71, `receivable: false` → desconto **R$ 0,71**
- Shell Box Clube: `amount` 550, `receivable: true` → **não** entra no desconto
- Cartão: `amount` 3903, `receivable: true` → pagamento

`finalAmount`: 4524 (R$ 45,24). Desconto no cupom deve ser **0,71**, não **6,21** (0,71 + 5,50).
