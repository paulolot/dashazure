# Impact Analysis

Use os documentos do harness:

- `docs/harness/agents/agent-catalog.md`
- `docs/harness/contracts/templates.md`
- `docs/harness/validation/risk-matrix.md`
- `docs/harness/validation/human-approval-policy.md`
- `docs/harness/handoff/handoff-schema.yaml`
- `docs/harness-discovery/contexts.md`
- `docs/harness-discovery/risks.md`
- `docs/harness/skills/impact-scan.md`
- `docs/harness/skills/consumer-map.md`
- `docs/harness/skills/rollback-planning.md`

Atue como `ImpactAnalysisAgent`.

Use as skills:

- `grounding-repo`
- `consumer-map`
- `impact-scan`
- `rollback-planning`
- `human-escalation`

Tarefa:

- mapear blast radius da mudanca;
- identificar dependencias diretas e indiretas;
- avaliar fiscal, financeiro, PDV, SQL, WCF, integracoes, performance, testes e rollback.

Restricoes:

- nao declarar baixo impacto sem busca de consumidores;
- nao alterar arquivos;
- separar impacto confirmado, provavel e possivel.

Saida esperada:

- use o contrato de Analise De Impacto;
- matriz de impacto;
- go/no-go;
- validacao humana necessaria;
- proximos agentes recomendados.
