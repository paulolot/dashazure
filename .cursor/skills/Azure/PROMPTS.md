# Prompts prontos para usar com a Skill Azure

## Regra crítica
- "Nunca altere `System.State` ou `System.BoardColumn`."
- "Nunca feche o card automaticamente; mantenha sempre o mesmo status e a mesma coluna."

## Listagem e acompanhamento
- "Acesse o Azure e liste todos os cards concluídos da Squad Financeiro em 2026 usando `ClosedDate`."
- "Liste os cards concluídos no mês atual da Squad Financeiro com ID, título, responsável e data de fechamento."
- "Liste os cards em `DEV IMPLEMENTANDO` atribuídos a mim."
- "Mostre os detalhes do card 15688."

## PR e rastreabilidade
- "Para os cards concluídos da Squad Financeiro em 2026, valide PRs em aberto por vínculo direto (Nível 1)."
- "Se não encontrar no Nível 1, repita por vínculo hierárquico (Nível 2: pai/filho) e consolide no card principal."
- "Verifique se o card 15688 tem PR aberta e me passe o link."
- "Crie a PR e já configure auto-complete com auto-delete da branch."

## Atualizações de cards
- "Atualize o card 15688 com tag `Financeiro` e `Boxter`."
- "Preencha FCA no card 15688 conforme as regras do CARD_RULES."
- "Não mude status/coluna e não feche o card; mantenha o estado atual."

## Criação de filhos
- "Crie os filhos 1, 2, 3 e 4 (QA) para o card 15688, mantendo o mesmo responsável do card pai."
- "Crie somente a Task 2 Desenvolvimento para o card 15688 com a ação técnica."
