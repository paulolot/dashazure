# Dashboard Squad Fiscal — Sincronização direta com o Azure DevOps

Este projeto foi atualizado para extrair dados em tempo real diretamente do **Azure DevOps**, eliminando a dependência de planilhas manuais do Google Sheets.

A sincronização é realizada por um script local em Python (`sync_devops.py`) que utiliza a API REST oficial do Azure DevOps e as credenciais configuradas localmente de forma segura.

---

## 1. Pré-requisitos
* **Python 3** instalado e disponível no terminal.
* Pacotes padrão do Python (o script usa apenas a biblioteca padrão do Python: `urllib`, `json`, `csv`, `datetime`).
* **Personal Access Token (PAT)** do Azure DevOps com escopo de leitura de Work Items (`Work Items - Read`).

---

## 2. Configurando o Acesso
Crie ou edite o arquivo `.cursor/skills/Azure/.ado_config.json` na pasta do projeto com a seguinte estrutura:

```json
{
  "organization": "metanetsistema",
  "project": "Metanet",
  "pat": "SEU_PAT_AQUI"
}
```

> **Atenção**: Nunca commite o seu arquivo `.ado_config.json` com o PAT real no repositório. Ele está incluído no `.gitignore` por padrão na pasta de skills.

---

## 3. Como Executar

### Sincronização e Inicialização do Servidor (Recomendado)
Execute o arquivo batch na raiz do projeto:
```cmd
rodarServer.bat
```
Este comando executará automaticamente a extração de dados do Azure DevOps e iniciará o servidor local na porta `8080`.

### Apenas Sincronização dos Dados
Se você quiser apenas atualizar as planilhas locais CSV sem reiniciar o servidor web:
```cmd
py sync_devops.py
```

---

## 4. O que o Script de Sincronização Faz?
O script `sync_devops.py` executa o seguinte fluxo:
1. Conecta-se às APIs do Azure DevOps usando o PAT local.
2. Consulta todos os cards de tipo `User Story`, `Bug` e `Atendimento` sob a área da Squad Fiscal (`Metanet\Squad Fiscal`).
3. Extrai recursivamente todas as subtasks associadas.
4. Consulta as revisões/históricos dos cards (Updates API) de forma otimizada para:
   * Mapear a linha do tempo exata das colunas do board (para calcular tempo líquido em coluna e transições).
   * Identificar o histórico do campo **`Paralisado`** (nome do campo interno no banco: `Custom.Status`) para gerar o relatório de impedimentos.
5. Calcula métricas clássicas de Kanban:
   * **Lead Time**: Tempo total desde a criação do item até o fechamento.
   * **Cycle Time**: Tempo líquido desde o início do desenvolvimento (colunas configuradas com `ContaCycleTime = Sim`) até o fechamento.
6. Grava os 12 arquivos de dados CSV locais na raiz do projeto no formato exato que o dashboard (`app.js`) necessita.
