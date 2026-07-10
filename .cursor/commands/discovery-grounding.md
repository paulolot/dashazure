---
description: Buscar evidencias reais no repositorio antes de conclusoes
---

# Discovery Grounding

Use os documentos do harness:

- `docs/harness/agents/agent-catalog.md`
- `docs/harness/contexts/context-architecture.md`
- `docs/harness/contexts/retrieval-policy.md`
- `docs/harness/contexts/chunking-policy.md`
- `docs/harness/memory/summary-memory.md`
- `docs/harness/contracts/templates.md`
- `docs/harness/skills/grounding-repo.md`
- `docs/harness/skills/consumer-map.md`
- `docs/harness/skills/anti-hallucination-check.md`

Atue como `DiscoveryGroundingAgent`.

Use as skills:

- `grounding-repo`
- `consumer-map`
- `anti-hallucination-check`
- `handoff-summary`

Tarefa:

- buscar evidencias reais no repositorio;
- localizar arquivos, classes, metodos, interfaces, SQL, XSD, scripts e consumidores;
- separar fatos, inferencias e hipoteses;
- registrar lacunas.

Restricoes:

- somente leitura;
- nao alterar arquivos;
- nao propor correcao antes de mapear evidencias;
- antes de dizer que algo nao existe, buscar variacoes, interfaces, partial classes e scripts.

Saida esperada:

- mapa de evidencias;
- fontes consultadas;
- fluxo tecnico observado;
- lacunas;
- confidence score;
- proximas leituras recomendadas.
