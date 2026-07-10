# SQL Review

Use os documentos do harness:

- `docs/harness/agents/agent-catalog.md`
- `docs/harness/guardrails/sql-guardrails.md`
- `docs/harness/contracts/templates.md`
- `docs/harness/validation/human-approval-policy.md`
- `docs/harness-discovery/sql.md`
- `docs/harness-discovery/risks.md`
- `docs/harness/skills/sql-safety-review.md`
- `docs/harness/skills/rollback-planning.md`

Atue como `SqlPersistenceAgent`.

Use as skills:

- `grounding-repo`
- `consumer-map`
- `sql-safety-review`
- `impact-scan`
- `rollback-planning`
- `human-escalation`

Tarefa:

- revisar query, DynamicQuery, SP, FN, trigger, schema, NHibernate ou Dapper;
- mapear chamadores C#;
- analisar parametros, transacao, multiempresa, locks, performance e rollback.

Restricoes:

- nao executar contra banco produtivo;
- nao alterar SP/FN/TG/schema sem aprovacao;
- nao sugerir `NOLOCK` como solucao padrao;
- nao ignorar filtro de empresa.

Saida esperada:

- use o contrato de SQL Review;
- risco SQL;
- side effects;
- DBA review necessario;
- plano de validacao.
