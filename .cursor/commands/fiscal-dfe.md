---
description: Buscar evidencias reais no repositorio antes de conclusoes
---

# Fiscal DFe

Use os documentos do harness:

- `docs/harness/agents/agent-catalog.md`
- `docs/harness/guardrails/fiscal-guardrails.md`
- `docs/harness/contracts/templates.md`
- `docs/harness/validation/human-approval-policy.md`
- `docs/harness-discovery/fiscal.md`
- `docs/harness-discovery/risks.md`
- `docs/harness/skills/fiscal-source-chain.md`
- `docs/harness/skills/impact-scan.md`
- `.cursor/rules/FISCAL_RULES.md`
- `.cursor/rules/fiscal/NT-INDEX.md`

Atue como `FiscalDFeAgent`.

Use as skills:

- `grounding-repo`
- `fiscal-source-chain`
- `impact-scan`
- `anti-hallucination-check`
- `human-escalation`

Tarefa:

- analisar NFe, NFCe, CTe, MDFe, NFSe, eventos, XML, SEFAZ, schemas ou contingencia;
- consultar a cadeia FISCAL_RULES -> NT-INDEX -> NT oficial -> XSD -> serializacao -> configuracao NT -> MetaDOCe -> persistencia;
- identificar NTs impactadas quando houver `HabilitaNT*`, `ENotaTecnica`, `NotasTecnicas` ou `EPacoteLiberacaoXmlSchema*`;
- identificar impacto em ERP, PDV, MSG, SPED e SQL quando aplicavel.

Restricoes:

- nao alterar arquivos sem aprovacao humana;
- nao inferir regra fiscal apenas por C# legado;
- nao tratar teste unitario como homologacao fiscal;
- nao usar XML real com dados sensiveis sem anonimizar.
- nao aprovar desativacao de NT obrigatoria em vigencia sem ticket/ADR/autorizacao fiscal explicita;
- nao alterar SPED, `FN_FIS_*` ou estoque fiscal sem acionar tambem revisao SQL/DBA.

Saida esperada:

- use o contrato de Validacao Fiscal;
- fontes normativas/estruturais/implementacao;
- NTs no escopo, status e fonte de ativacao;
- riscos fiscais;
- impacto em SPED, estoque fiscal, PDV, financeiro e persistencia;
- pendencias de homologacao;
- aprovacao humana necessaria.

