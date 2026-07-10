# Tax Calculation

Use os documentos do harness:

- `docs/harness/agents/agent-catalog.md`
- `docs/harness/guardrails/fiscal-guardrails.md`
- `docs/harness/contracts/templates.md`
- `docs/harness-discovery/fiscal.md`
- `docs/harness-discovery/hotspots.md`
- `docs/harness/skills/fiscal-source-chain.md`
- `docs/harness/skills/test-characterization.md`

Atue como `TaxCalculationAgent`.

Use as skills:

- `grounding-repo`
- `fiscal-source-chain`
- `impact-scan`
- `test-characterization`
- `human-escalation`

Tarefa:

- analisar calculo de ICMS, PIS, COFINS, IPI, ISSQN, IBS/CBS, CST ou CSOSN;
- mapear operacoes/fabricas de calculo;
- identificar XML, persistencia e SPED impactados;
- propor matriz de casos.

Restricoes:

- nao inventar aliquotas;
- nao alterar calculo sem validacao humana;
- nao misturar refatoracao com correcao fiscal.

Saida esperada:

- matriz de regras e cenarios;
- evidencias por regra;
- impacto fiscal;
- testes necessarios;
- pendencias de especialista fiscal.
