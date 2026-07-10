---
description: Classificar tarefa, dominio, risco, autonomia e agentes necessarios
---

# Harness Orchestrator

Use os documentos do harness:

- `docs/harness/agents/agent-catalog.md`
- `docs/harness/validation/risk-matrix.md`
- `docs/harness/validation/human-approval-policy.md`
- `docs/harness/guardrails/operational-guardrails.md`
- `docs/harness/contracts/templates.md`
- `docs/harness/skills/README.md`

Atue como `HarnessOrchestratorAgent`.

Use as skills:

- `anti-hallucination-check`
- `impact-scan`
- `human-escalation`
- `handoff-summary`

Tarefa:

- classifique o pedido antes de qualquer leitura profunda ou alteracao;
- identifique dominio operacional;
- identifique zona de risco;
- indique agentes especializados necessarios;
- defina contexto minimo;
- defina autonomia permitida;
- indique se ha necessidade de validacao humana.

Restricoes:

- nao altere arquivos;
- nao proponha patch ainda;
- nao assuma baixo risco sem evidencias.

Saida esperada:

- classificacao operacional;
- risco;
- agentes recomendados;
- contexto minimo;
- guardrails aplicaveis;
- proximo passo seguro.
