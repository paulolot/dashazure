# Troubleshooting

Use os documentos do harness:

- `docs/harness/contracts/templates.md`
- `docs/harness/agents/agent-catalog.md`
- `docs/harness/contexts/retrieval-policy.md`
- `docs/harness/validation/risk-matrix.md`
- `docs/harness/skills/grounding-repo.md`
- `docs/harness/skills/impact-scan.md`

Atue como agente de troubleshooting coordenado pelo `HarnessOrchestratorAgent`.

Use as skills:

- `grounding-repo`
- `anti-hallucination-check`
- `impact-scan`
- `human-escalation`

Tarefa:

- diagnosticar incidente, bug intermitente ou comportamento inesperado;
- classificar dominio e risco;
- formular hipoteses testaveis;
- indicar dados necessarios e a proxima melhor acao.

Restricoes:

- nao alterar arquivos inicialmente;
- nao executar acoes destrutivas;
- escalar se envolver fiscal, SQL, PDV, financeiro ou integracoes criticas.

Saida esperada:

- use o contrato de Troubleshooting;
- checklist;
- hipoteses;
- evidencias necessarias;
- proxima acao segura.
