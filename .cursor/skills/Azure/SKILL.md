---
name: azure
description: Acessa e manipula cards no Azure DevOps do projeto Metanet (listar, consultar, atualizar, criar filhos e validar PRs) usando ado_tool.py.
---

# Skill Azure

## Objetivo
Padronizar o uso do Cursor para operar cards no Azure DevOps do projeto Metanet, com foco em:
- listar cards por squad, estado, coluna e responsável;
- consultar detalhes de um card;
- atualizar campos (descrição, funcionalidade, post mortem e tags);
- criar itens filhos (Tasks e Test Case);
- validar PRs vinculadas e PRs em aberto;
- auditar cards nas colunas `Concluído` e `Pronto pra Release`, com ou sem filtro por data de conclusão;
- auditar branches Git sem PR vinculada, filtrando por membros de um time (ex.: `Squad Financeiro`) e pelo autor do primeiro commit divergente da `master`.

## Estrutura esperada
Skill versionada no repositório e executada direto do workspace, sem necessidade de copiar para o user-home:
- `.cursor/skills/Azure/tools/ado_tool.py`
- `.cursor/skills/Azure/tools/card_manager.py`
- `.cursor/skills/Azure/CARD_RULES.md`
- `.cursor/skills/Azure/.ado_config.example.json` (template versionado)
- `.cursor/skills/Azure/.ado_config.json` (criado por cada dev a partir do exemplo, ignorado pelo Git)

Compatibilidade com setup legado:
- Devs que já mantêm o PAT em `C:\Users\<usuario>\.cursor\skills\AzureLocal\.ado_config.json` continuam funcionando — o `ado_tool.py` cai automaticamente nesse caminho quando o `.ado_config.json` do workspace não estiver presente.

## Pré-requisitos
1. Python disponível via launcher `py`.
2. Resolução de configuração feita pelo `ado_tool.py` nesta ordem:
   1. variável de ambiente `ADO_CONFIG_PATH`;
   2. `.cursor/skills/Azure/tools/.ado_config.json` (ao lado do script);
   3. `.cursor/skills/Azure/.ado_config.json` (raiz da skill no workspace);
   4. `C:\Users\<usuario>\.cursor\skills\AzureLocal\.ado_config.json` (fallback legado).
3. Arquivo `.ado_config.json` baseado no template `.ado_config.example.json`:
   - `organization` e `project` já padronizados para uso interno;
   - cada dev precisa preencher apenas o `pat`.
4. Conexão com a internet para acessar o Azure DevOps.

## Regras obrigatórias
1. Sempre respeitar o padrão definido em `CARD_RULES.md`.
2. Manter textos em português com acentuação correta (UTF-8).
3. Não expor PAT em logs, prints ou respostas para terceiros.
4. Antes de executar qualquer comando da skill, verificar primeiro a existência de `.cursor/skills/Azure/.ado_config.json` no workspace; se ausente, aceitar o fallback `C:\Users\<usuario>\.cursor\skills\AzureLocal\.ado_config.json`.
5. Para criação de filhos (1, 2, 3 e 4), manter `System.AssignedTo` igual ao responsável do card pai.
6. Se o card pai não tiver responsável, interromper e pedir definição antes de continuar.
7. Sempre validar o filtro de squad por `System.AreaPath` (`UNDER 'Metanet\\Squad X'`), evitando depender apenas da coluna do board.
8. Nunca alterar `System.State`, `System.BoardColumn` ou qualquer campo equivalente de status/coluna, exceto no fechamento automático dos filhos `1`, `2` e `3` quando eles forem criados pela própria automação.
9. Ao criar os cards filhos `1`, `2` e `3`, encerrar os três cards ao final do fluxo.
10. Fora da exceção dos filhos `1`, `2` e `3`, nunca fechar card automaticamente (`System.State = Closed`).
11. O card deve permanecer sempre na mesma coluna e no mesmo status de origem, exceto na exceção dos filhos `1`, `2` e `3`.
12. Toda PR criada pela automação deve sair com auto-complete habilitado.
13. Toda PR criada pela automação deve sair com exclusão automática da branch de origem (`deleteSourceBranch=true`).
14. Em validações de cards com PR aberta, conferir sempre os dois níveis:
   - **Nível 1 (direto)**: PR vinculada diretamente ao card.
   - **Nível 2 (hierárquico)**: PR vinculada em pai/filho relacionado.
15. Em consultas por coluna, usar `System.AreaPath` como filtro principal de squad e `System.BoardColumn` apenas para delimitar o estágio pedido (`Concluído` ou `Pronto pra Release`).
16. Quando o usuário pedir intervalo por data de conclusão, aplicar o filtro em `Microsoft.VSTS.Common.ClosedDate`, explicitar o intervalo usado na resposta e não assumir período implícito diferente do solicitado.
17. **Pastas de branch sempre em minúsculas** (conforme `CARD_RULES.md`, seção *Rastreabilidade e nomenclatura*): usar exclusivamente os prefixos `features/` e `bugs/` em **minúsculo** no nome completo da branch (ex.: `features/us-16293_SO652058`, `bugs/bug-1234_SO567890`). **Nunca** usar `Features/`, `BUGS/` ou outra variação de maiúsculas no primeiro segmento — no Windows o Git trata caminhos como case-insensitive e a coexistência de refs com case diferente (ex.: entradas antigas em `packed-refs` como `refs/heads/Features/...` vs. branch local `refs/heads/features/...`) pode gerar falhas graves no `git push` (`cannot be resolved to branch`) ou ambiguidade de checkout.

## Fluxo padrão de operação
1. **Identificar contexto**: ID do card, squad, tipo (`Bug` ou `User Story`) e responsável.
2. **Consultar card**: `get <id>`.
3. **Listar relacionados** (quando necessário): WIQL para filhos e vínculos.
4. **Aplicar mudanças**: `update <id> "@patch.json"`.
5. **Criar itens e validar PRs**:
   - criar itens quando aplicável: `create Task|Test Case`;
   - **Nível 1 (direto)**: PR vinculada diretamente ao card.
   - **Nível 2 (hierárquico)**: PR vinculada a filho/pai (Task/Test Case <-> User Story/Bug).
6. **Quando criar PR**:
   - habilitar auto-complete;
   - habilitar auto-delete da branch de origem;
   - manter policies ativas (sem bypass, salvo instrução explícita do usuário).

**Regra de bloqueio no fluxo**:
- Não existe passo automático de mudança de status/coluna.
- Fechar automaticamente apenas os filhos `1`, `2` e `3` quando forem criados pela própria automação.
- Manter sempre a coluna e o status originais do card principal e dos demais itens fora dessa exceção.
- PR deve ser configurada com auto-complete e auto-delete da branch sempre que for criada.

## Filtros recomendados
- Para itens concluídos, priorizar:
  - `Microsoft.VSTS.Common.ClosedDate` (intervalo de data), e
  - `System.State = 'Closed'` quando necessário.
- Usar `System.BoardColumn` como apoio visual, não como filtro único de verdade.
- Aceitar variações comuns de coluna/estado (`Concluído`, `Concluido`, `Closed`, `null` em Tasks).
- Para auditoria de PR em aberto:
  - `Pronto pra Release`: filtrar por `System.BoardColumn = 'Pronto pra Release'`.
  - `Concluído`: aceitar variações da coluna (`Concluído`/`Concluido`) e, se necessário, combinar com `System.State = 'Closed'`.
- Quando o pedido citar "range", "intervalo", "entre datas" ou "data de conclusão", aplicar o recorte em `Microsoft.VSTS.Common.ClosedDate >= dataInicial` e `< dataFinal`.

## Períodos padrão
- **Mês atual**: do primeiro dia do mês até o primeiro dia do próximo mês.
- **Ano atual**: de `YYYY-01-01` até `YYYY+1-01-01`.
- Ao responder, sempre explicitar o intervalo aplicado.
- Se o usuário não pedir período em consultas por `Pronto pra Release`, não impor recorte de data.
- Se o usuário pedir cards em `Concluído` sem informar datas, usar como padrão o **mês atual** e deixar isso explícito na resposta.

## Fluxo específico para validar cards com PR em aberto
1. **Identificar escopo**: squad(s), coluna(s) alvo (`Concluído` e/ou `Pronto pra Release`) e se existe filtro de data de conclusão.
2. **Montar WIQL principal**:
   - filtrar sempre por `System.AreaPath UNDER 'Metanet\\Squad X'`;
   - filtrar por `System.BoardColumn` conforme a coluna pedida;
   - para `Concluído` com período, adicionar `Microsoft.VSTS.Common.ClosedDate`.
3. **Buscar cards raiz**: normalmente `User Story` e `Bug`, salvo instrução diferente.
4. **Validar relações de PR**:
   - checar PR direta no card;
   - checar PR em itens pai/filho relacionados.
5. **Classificar pendências**:
   - card em `Concluído` com PR `active`;
   - card em `Pronto pra Release` com PR `active`;
   - card sem PR;
   - card com PR apenas concluída/abandonada.
6. **Responder com links**:
   - sempre retornar o número da US/Bug com link do work item;
   - link da PR quando existir;
   - informar se a PR está `active`, `completed` ou `abandoned`.
7. **Bloqueio obrigatório**:
   - nunca alterar `System.State`;
   - nunca alterar `System.BoardColumn`;
   - a validação é sempre somente leitura, salvo pedido explícito de atualização permitido pela skill.

## Escalabilidade e robustez
- Para consultas grandes em lote (`workitemsbatch`), usar paginação/chunks de 100-200 IDs por chamada.
- Em erro HTTP 500 no batch, reduzir o tamanho do lote e reexecutar.
- Em retorno vazio inesperado, revisar:
  - `AreaPath` do squad;
  - intervalo de data;
  - tipo de vínculo de PR (direto vs hierárquico).
- **Git no Windows e case de branch**: se `git push -u origin <nome-da-branch>` falhar com `cannot be resolved to branch` apesar da branch existir localmente, suspeitar de conflito de case no histórico de refs (`Features/` vs. `features/`). Mitigação imediata: `git push -u origin HEAD:refs/heads/<nome-correto-em-minusculo-no-prefixo>` (ex.: `HEAD:refs/heads/features/us-16293_SO652058`). **Melhoria recomendada para `card_manager.py`**: após falha desse tipo, repetir o push com refspec explícito e/ou validar que o nome gerado respeita a regra 17.

## Comandos base
- Consultar card:
  - `py ".cursor/skills/Azure/tools/ado_tool.py" get 15688`
  - Com relations / expand (`$expand` da API): `py ".cursor/skills/Azure/tools/ado_tool.py" get 15688 all`
- Contexto do card + PRs vinculadas + sugestão de `git diff` (sem checkout; alinha com `.cursor/commands/codereview-from-ado.md` no repositório):
  - `py ".cursor/skills/Azure/tools/ado_tool.py" wi-pr-context 15688`
  - O JSON inclui `recommendedGitDiffBaseCommit` / `recommendedGitDiffHeadCommit` (SHAs da PR — **prioridade** para code review). Se exit ≠ 0 ou stdout vazio, usar fallback documentado em `codereview-from-ado.md` (`get` + `pr-get`).
- Consultar por WIQL:
  - `py ".cursor/skills/Azure/tools/ado_tool.py" query "<WIQL>"`
- Atualizar card:
  - `py ".cursor/skills/Azure/tools/ado_tool.py" update 15688 "@patch.json"`
- Criar filho:
  - `py ".cursor/skills/Azure/tools/ado_tool.py" create Task "@fields.json" "@relations.json"`
- Auditar cards com PR:
  - `py ".cursor/skills/Azure/tools/card_manager.py" auditar-prs --squads "Squad Financeiro" --columns "Pronto pra Release"`
  - `py ".cursor/skills/Azure/tools/card_manager.py" auditar-prs --squads "Squad DBA" "Squad Financeiro" --columns "Concluído" --from 2026-04-01 --to 2026-05-01`
- Branches sem PR (Git), por time do projeto e dono = autor do 1º commit divergente da `master` (somente leitura):
  - `py ".cursor/skills/Azure/tools/card_manager.py" branches-sem-pr --team "Squad Financeiro" --repository "projeto-metaposto-net.git"`
  - Opcional: `--compare-branch master` (padrão), `--max-branches N` (teste), `--include-active` (mantém metadado quando há PR ativa).

## Comando natural "encerre o card X"
- Quando o usuário pedir `encerre o card X`, mapear para o fluxo `encerrar-card` do `card_manager.py`.
- Exemplo de execução completa:
  - `py ".cursor/skills/Azure/tools/card_manager.py" encerrar-card 15169 --so 669933 --repo-path "C:\Projeto\master 2" --mensagem "Resumo da implementação" --criar-pr --target-branch master --fato "..." --causa "..." --acao "..."`
- Fluxo obrigatório executado:
  1. validar card pai (tipo e responsável);
  2. preencher card pai (`System.Description`, `postMortem` e `Custom.Funcionalidade` para US);
  3. criar filhos `1`, `2`, `3` e `4 (QA)` com o mesmo responsável;
  4. preencher FCA conforme regra (`1 = Fato+Causa`, `2 = Ação`);
  5. encerrar automaticamente filhos `1`, `2`, `3`;
  6. manter pai e QA sem mudança de status/coluna;
  7. criar branch/commit e PR (com auto-complete e auto-delete) quando solicitado.
- Bloqueios obrigatórios:
  - não alterar `System.State`/`System.BoardColumn` do card pai;
  - não fechar automaticamente o card pai;
  - interromper se `System.AssignedTo` estiver vazio no pai.

## Exemplos de consulta para auditoria de PR
- `Pronto pra Release` sem período:
  - `Select [System.Id] From WorkItems Where [System.TeamProject] = 'Metanet' And [System.WorkItemType] In ('User Story','Bug') And [System.AreaPath] UNDER 'Metanet\\Squad Financeiro' And [System.BoardColumn] = 'Pronto pra Release'`
- `Concluído` no mês atual:
  - `Select [System.Id] From WorkItems Where [System.TeamProject] = 'Metanet' And [System.WorkItemType] In ('User Story','Bug') And [System.AreaPath] UNDER 'Metanet\\Squad Financeiro' And [System.BoardColumn] In ('Concluído','Concluido') And [Microsoft.VSTS.Common.ClosedDate] >= '2026-04-01' And [Microsoft.VSTS.Common.ClosedDate] < '2026-05-01'`
- `Concluído` em range informado pelo usuário:
  - `Select [System.Id] From WorkItems Where [System.TeamProject] = 'Metanet' And [System.WorkItemType] In ('User Story','Bug') And [System.AreaPath] UNDER 'Metanet\\Squad DBA' And [System.BoardColumn] In ('Concluído','Concluido') And [Microsoft.VSTS.Common.ClosedDate] >= 'YYYY-MM-DD' And [Microsoft.VSTS.Common.ClosedDate] < 'YYYY-MM-DD'`

## Formato recomendado de resposta
Sempre retornar:
1. **Escopo aplicado**: squad, período e tipo de validação de PR.
2. **Totais**: total encontrado e total pendente.
3. **Lista objetiva**: `ID`, tipo, título, responsável, data e PR(s) associadas.
4. **Pendências**: o que precisa de ação (ex.: PR antiga aberta, card fechado com PR ativa).
5. **Bloqueio aplicado**: informar explicitamente que status/coluna não foram alterados por regra da skill.
6. **Próximo passo sugerido**: consulta complementar, atualização de campos permitidos ou follow-up com responsável.
7. **Links**: quando houver PR, listar o link clicável da PR; quando não houver, listar ao menos o link do card.
8. **Acesso rápido**: priorizar sempre a exibição do número da US/Bug já linkado para facilitar abertura direta no Azure DevOps.
9. **Code Review com localização**: quando a resposta for de review técnico, cada problema deve conter `Localização (obrigatório)` no formato `caminho/arquivo:linhaInicial-linhaFinal` e um trecho curto do diff correspondente.

## Materiais de apoio
- `QUICKSTART.md`: setup em 5 minutos.
- `EXAMPLES.md`: exemplos prontos de comandos.
- `REFERENCES.md`: campos Azure, WIQLs úteis e padrões de relação.

## Sugestões
- Sempre sugerir melhorias na Skill Azure, mesmo que seja para melhorar/ajustar Prompts feitos pelo usuário.
- Alimentar 'REFERENCES.md' com novos campos usuados que serão relevantes futuramente para novas solicitações.