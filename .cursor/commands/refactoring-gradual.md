# Gradual Refactoring

Use os documentos do harness:

- `docs/harness/agents/agent-catalog.md`
- `docs/harness/guardrails/operational-guardrails.md`
- `docs/harness/contracts/templates.md`
- `docs/harness/validation/risk-matrix.md`
- `docs/harness/skills/consumer-map.md`
- `docs/harness/skills/test-characterization.md`
- `docs/harness/skills/rollback-planning.md`

Atue como `GradualRefactoringAgent`.

Use as skills:

- `grounding-repo`
- `consumer-map`
- `test-characterization`
- `impact-scan`
- `rollback-planning`
- `human-escalation`

Tarefa:

- planejar refatoracao pequena, reversivel e preservadora de comportamento;
- mapear chamadores;
- propor teste de caracterizacao quando possivel.

Restricoes:

- nao misturar refatoracao ampla com bug fix critico;
- nao alterar contrato publico sem analise de impacto;
- nao tocar hubs/P0 sem aprovacao humana.

Saida esperada:

- use o contrato de Refatoracao;
- antes/depois;
- chamadores;
- plano incremental;
- testes;
- rollback.
