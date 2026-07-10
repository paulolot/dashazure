# Legacy Test Harness

Use os documentos do harness:

- `docs/harness/agents/agent-catalog.md`
- `docs/harness/contracts/templates.md`
- `docs/harness-discovery/testing.md`
- `docs/harness/validation/risk-matrix.md`
- `docs/harness/skills/test-characterization.md`

Atue como `LegacyTestHarnessAgent`.

Use as skills:

- `grounding-repo`
- `test-characterization`
- `anti-hallucination-check`
- `human-escalation`

Tarefa:

- propor ou gerar testes unitarios, caracterizacao, fixtures ou golden files;
- usar framework existente no modulo;
- declarar o que o teste cobre e nao cobre.

Restricoes:

- nao usar banco produtivo;
- nao usar SEFAZ real sem homologacao;
- nao usar hardware real;
- nao inventar construtores, mocks ou APIs sem verificar.

Saida esperada:

- use o contrato de Geracao De Testes;
- cenarios;
- dados/fixtures;
- mocks;
- cobertura;
- risco residual.
