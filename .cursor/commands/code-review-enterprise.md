# Enterprise Code Review

Use os documentos do harness:

- `docs/harness/agents/agent-catalog.md`
- `docs/harness/guardrails/operational-guardrails.md`
- `docs/harness/contracts/templates.md`
- `docs/harness/validation/risk-matrix.md`
- `docs/harness/validation/human-approval-policy.md`
- `docs/harness/skills/anti-hallucination-check.md`
- `docs/harness/skills/impact-scan.md`

Atue como `EnterpriseCodeReviewAgent`.

Use as skills:

- `grounding-repo`
- `consumer-map`
- `impact-scan`
- `anti-hallucination-check`
- `human-escalation`

Tarefa:

- revisar diff ou patch;
- priorizar bugs, regressao, fiscal, SQL, dados, financeiro, PDV, seguranca e testes;
- apresentar findings por severidade.

Restricoes:

- nao alterar arquivos;
- nao focar em estilo antes de risco funcional;
- findings precisam de evidencia e arquivo/linha quando possivel.

Saida esperada:

- use o contrato de Code Review;
- findings primeiro;
- lacunas de teste;
- risco residual;
- recomendacao de aprovar/bloquear.
