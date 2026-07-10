# FINANCEIRO_RULES

## Objetivo

Centralizar validações de **domínio financeiro e contábil** no Code Review: saldos, partidas dobradas, lançamentos e consistência contábil.

Este arquivo é a fonte oficial para esse escopo. Não duplicar estes checklists em `codereview.md` — remeta a este documento.

**Responsável / última revisão (preencher):** _Tech Lead Financeiro — data_

---

## Escopo de aplicabilidade

Aplicar **integralmente** quando o diff tocar (preencher com critérios reais):

- _(preencher: ex. projetos FIN, contabilidade, fechamento, integrações contábeis, etc.)_

Se o escopo não for atingido, **não** aplicar este checklist como obrigatório.

---

## Classificação de severidade

- **CRÍTICO:** risco de saldo incorreto, descasamento contábil, impacto em obrigações ou auditoria.
- **ATENÇÃO:** risco moderado de qualidade ou reconciliação.
- **SUGESTÃO:** melhoria recomendada sem bloqueio imediato.

---

## Contabilidade

O sistema faz controle de saldos contábeis e lançamentos de partida dobrada.

Durante a revisão, considerar riscos como:

- movimentações contábeis incorretas
- inconsistência de saldo contábil
- atualizações concorrentes

---

## Regras de negócio críticas (financeiro / contábil)

Se existir **qualquer dúvida** sobre impacto **contábil**, classificar o achado no mínimo como **ATENÇÃO**.

Alterações que impactem integração entre movimentação operacional e registros contábeis devem ser analisadas com atenção redobrada.

---

## Gatilhos de detecção rápida

*(Preencher pelo Tech Lead Financeiro.)*

- _(exemplo: alteração em contas, centros de custo, lançamentos automáticos, conciliação, etc.)_

---

## Regras obrigatórias de validação (expansão)

### 1) _(preencher tema)_

- _(preencher)_

### 2) _(preencher tema)_

- _(preencher)_

---

## Evidências mínimas no parecer

Para cada apontamento financeiro/contábil, registrar:

- Severidade (CRÍTICO, ATENÇÃO, SUGESTÃO)
- Arquivo/objeto impactado
- Trecho do diff analisado
- Descrição do risco e impacto potencial
- Correção recomendada

---

## Relação com outros documentos

- **`DBA_RULES.md`:** SQL, procedures, migrações — aplicar regras de banco quando houver persistência; não duplicar aqui.
- **`design-rules.md`:** arquitetura e camadas.
- **`FISCAL_RULES.md`:** SPED e tributos — quando o diff cruzar fiscal e contabilidade, revisar ambos os arquivos conforme aplicabilidade.
- **`VENDAS_RULES.md`:** fluxo de venda — quando houver impacto em receita/recebimentos conciliar com este documento.
