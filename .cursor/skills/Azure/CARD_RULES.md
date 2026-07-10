Boas Práticas e Regras para Gestão de Cards (Azure DevOps)
===========================================================

Origem das regras
-----------------
- Baseado na wiki interna de boas práticas de cards (`Boas-Práticas-Cards`) e no guia local `facs_cards.md`.
- Aplicado especificamente aos cards do projeto **Metanet** e ao fluxo de desenvolvimento da **Squad Financeiro**.

1. Abertura de cards
--------------------
- **Descrição concisa e fiel**
  - Sempre criar o card com uma descrição breve e clara do problema ou implementação.
  - Para bugs/incidentes, preferir copiar a descrição diretamente do **Movidesk** para evitar divergências.
  - Incluir no campo de descrição (ou em um campo específico, se existir) o número da **SO do Movidesk**.

- **Tipo de work item**
  - Bugs: usar o tipo de item configurado para bugs (ex.: `Bug`).
  - Implementações: usar `User Story` ou outro tipo definido para novas funcionalidades.

2. Conclusão de cards
---------------------
- **Preencher Fato, Causa e Ação**
  - Ao concluir um card de bug ou incidente, registrar:
    - **Fato**: o que aconteceu do ponto de vista do usuário/negócio.
    - **Causa**: raiz do problema (tabela, regra, processo, dado incorreto, etc.).
    - **Ação**: o que foi feito para corrigir (ajustes, scripts, mudanças de config).
  - Sempre que possível, anexar:
    - Prints de tela relevantes.
    - Trechos de código (fragmentos) que ilustrem a correção.

3. Documentação na Wiki
-----------------------
- **Criação de página**
  - Para **bugs**: se não existir página de Wiki relacionada ao contexto, criar uma nova página.
    - Incluir:
      - Link da User Story (US) associada.
      - Data de conclusão.
      - Breve descrição do problema, podendo reaproveitar Fato/Causa/Ação.
  - Para **implementações**:
    - Detalhar menus afetados, telas, regras de negócio e fluxo de funcionamento.
    - Usar exemplos como referência (ex.: "Carga de Preço Prioritária").

- **Atualização de página existente**
  - Se já existir página de Wiki para o tema:
    - Adicionar um **novo separador** (seção) para o card atual.
    - Registrar Fato, Causa, Ação, data, e referência ao card/US.

4. Tasks de documentação ligadas ao card
----------------------------------------
- As atividades de documentação e execução do card devem ser rastreáveis, divididas em quatro etapas:

- **2.3.1 Análise**
  - Descrever requisitos e/ou bugs apresentados pelo cliente.
  - Detalhar o processo que será feito para correção (FATO e CAUSA).
  - Criar um work item do tipo **Task** com link **Child** para o card principal.

- **2.3.2 Desenvolvimento**
  - Registrar ajustes realizados, tabelas afetadas, classes modificadas e nova funcionalidade.
  - Foco técnico, voltado para outros devs.
  - Criar um work item do tipo **Task** com link **Child**.

- **2.3.3 Teste (DEV)**
  - Detalhar testes executados em DEV:
    - Prints de cada operação relevante.
    - Descrição dos cenários testados.
    - Scripts SQL utilizados, se aplicável.
  - Criar **Test Case** com link **Child** para o card principal.

- **2.3.4 QA**
  - Criar **Test Case** focado em QA/negócio:
    - Passo a passo do roteiro de teste.
    - Critérios de aceitação e dados de exemplo.
  - Vincular com link **Tested By** ao card principal.

5. Rastreabilidade e nomenclatura
---------------------------------
- **Branches**
  - Para bugs:
    - Formato: `bugs/bug-0001_SO0000`
      - `0001`: número da US/bug.
      - `SO0000`: número da SO do Movidesk.
  - Para implementações:
    - Formato: `features/us-0001_SO0000`
      - `0001`: número da US.
      - `SO0000`: número da SO do Movidesk.

- **Commits detalhados**
  - Para bugs:
    - Formato: `bug-555_SO669933 - ERRO TELA FINANCEIRO`
  - Para implementações:
    - Formato: `us-555_SO669933 - IMPLEMENTAÇÃO`
  - Sempre respeitar:
    - Singular/plural.
    - Case sensitive (maiúsculas/minúsculas) conforme padrão definido.

6. Pull Requests (PR) relacionadas aos cards
-------------------------------------------
- **Reviewers**
  - Definir sempre **2 code reviewers obrigatórios**.
  - O PR só é considerado completo após:
    - Aprovação dos reviewers.
    - Testes realizados e documentados.

- **Exclusão de branch**
  - Habilitar opção de **auto-excluir branch** ao criar a PR.
  - Garantir que o branch seja removido após o merge, evitando acúmulo de branches antigas.

- **Configurações adicionais**
  - Desmarcar opções que possam burlar validações de qualidade configuradas no repositório (policies).

7. Alteração de categoria da tarefa
-----------------------------------
- Quando um **BUG** for convertido em **US**:
  - Na primeira linha da descrição, informar claramente o **motivo da mudança**.
  - Adicionar a tag `!BUG` ao work item.

8. Aplicação prática com automações/scripts
-------------------------------------------
- Este arquivo serve como referência única para scripts Python que fazem gestão dos cards (por exemplo, `ado_tool.py` e `card_manager.py`).
- Ao automatizar criação/atualização de cards, garantir que:
  - Os campos de Fato/Causa/Ação sejam respeitados quando o contexto for bug.
  - Nomenclatura de branch e commits siga os padrões descritos.
  - Links de relação (Child, Tested By) sejam criados conforme as etapas 2.3.1–2.3.4.

9. Padrão obrigatório de acentuação e preenchimento (US e Bug)
--------------------------------------------------------------
- Todo texto criado automaticamente para os campos do Azure DevOps deve ser gravado com acentuação correta em português (UTF-8), sem versão "ASCII simplificada".
- Em qualquer encerramento de card (`US` ou `Bug`), manter este padrão em:
  - `System.Description` (quando aplicável ao item).
  - `Custom.Funcionalidade` (quando aplicável ao item).
  - `Custom.5d2ff7c5-f7be-48db-aa96-24e2b6144230` (postMortem).
- Regras por tipo:
  - **US (card pai)**: preencher FCA em `Custom.Funcionalidade` e postMortem.
  - **Bug (card pai)**: preencher FCA no postMortem (sem remover regras já acordadas para descrição do pai).
- Regras para filhos:
  - **1. Análise**: preencher **Fato + Causa** em descrição, funcionalidade e postMortem.
  - **2. Desenvolvimento**: preencher **Ação** em descrição, funcionalidade e postMortem.
  - **3. Teste**: criar como filho.
  - **4. QA**: criar Test Case e vincular no pai via **Tested By**.
- Atribuição de responsável (obrigatório):
  - Ao criar os itens **1, 2, 3 e 4 (QA)** no fluxo "encerrar card", todos devem receber `System.AssignedTo` igual ao `System.AssignedTo` do card pai.
  - Se o card pai não tiver responsável definido, interromper a automação e solicitar definição do responsável antes de concluir o fluxo.
