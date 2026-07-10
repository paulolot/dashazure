# DBA_RULES

## Objetivo

Centralizar todas as regras de banco de dados aplicadas no processo de Code Review para alterações com impacto em SQL Server.

Este arquivo é a fonte oficial para validações de banco e deve ser aplicado sempre que o diff envolver acesso a dados, scripts SQL, migrações, procedures, functions, views, triggers ou alterações de modelagem.

---

## Restrição de escopo (próximos editores)

Este documento é **exclusivamente** sobre SQL Server / persistência. Não adicionar aqui regras de outros escopos.

- **Aceito:** queries, DDL/DML, procedures, functions, views, triggers, índices, transações, e o **ângulo de persistência SQL** de Dapper/NHibernate (parametrização, plano de execução, performance de leitura/escrita).
- **Não aceito:** padrões de C# em geral (incluindo materialização de objetos, LINQ, `Cast<T>`/`OfType<T>`), arquitetura de camadas, regras fiscais/financeiras/comerciais, segurança aplicacional fora do banco, fluxos de UI, etc.
- **Enum/constante fora de SQL:** qualquer validação de enum em código C# (nomes, descrição, uso semântico) está fora deste arquivo e deve ser tratada no arquivo transversal correspondente (ex.: `GERAL_RULES.md`).
- Regras transversais (não setoriais e não-SQL) devem ir para `GERAL_RULES.md`.
- Regras de domínio (fiscal/financeiro/vendas/arquitetura) devem ir para os respectivos arquivos.

PR que adicionar regra fora desse escopo neste arquivo deve ser **recusada e movida** para o documento adequado.

---

## Escopo de aplicação

Aplicar estas regras quando houver alteração em:

- Repositórios, queries, Dapper, NHibernate, camada de persistência
- Arquivos `.sql`, scripts de migração, DDL ou DML
- Stored Procedures, Functions, Views, Triggers
- Alterações de tabelas, índices, constraints, tipos e transações

---

## Classificação de severidade

- **CRÍTICO**: risco de segurança, perda de integridade, indisponibilidade, bloqueio operacional ou regressão grave de performance. PR não deve ser aprovada sem correção.
- **ATENÇÃO**: risco moderado de qualidade, escalabilidade, concorrência ou manutenção. Aprovação a critério do Tech Lead.
- **SUGESTÃO**: melhoria recomendada sem bloqueio imediato.

---

## Gatilhos de detecção rápida

Padrões que o agente de Code Review deve marcar imediatamente ao encontrar no diff, sem necessidade de análise adicional:



* **SQL Inline em C#:** Bloquear strings literais contendo `SELECT`, `INSERT`, `UPDATE` ou `DELETE` passadas a métodos do Dapper (`Query`, `Execute`, etc.) ou atribuídas a `CommandText`. 
    * *Regra:* O sistema deve operar exclusivamente via **Stored Procedures**.
* **CommandType Omitido:** Chamadas `conn.Query()` ou `conn.Execute()` sem a definição explícita de `commandType: CommandType.StoredProcedure`.
* **NHibernate SQL Nativo:** Uso de `session.CreateSQLQuery(...)` para comandos DML/DQL em vez de utilizar Procedures ou Functions mapeadas.
* **Concatenação de SQL:** Uso de variáveis C# em strings SQL via interpolação (`$""`), concatenação (`+`) ou `string.Format`.
* **Loops com I/O de Banco:** Execução de `Query`, `Execute` ou `ExecuteScalar` dentro de blocos de repetição (`foreach`, `for`, `while`). Os dados devem ser processados em lote ou via TVP.
* **Tabelas Temporárias Ineficientes:** Uso de `DECLARE @TABLE` para cargas volumosas ou joins complexos. Deve-se preferir `#temp tables`.
* **Gestão de #Temp Tables:** Uso de `CREATE TABLE #Temp` sem o descarte explícito com validação de existência: 
    `IF OBJECT_ID('tempdb..#Temp') IS NOT NULL DROP TABLE #Temp;`
* **Controle de Fluxo Inseguro:** Uso de `WHILE` sem incremento de variável, sem cláusulas de saída (`BREAK`/`THROW`) ou sem limite de segurança.
* **Dimensionamento de Tipos:** `VARCHAR(X)` ou `NVARCHAR(X)` com tamanhos incompatíveis com o domínio ou uso injustificado de `MAX`.
* **Uso de SELECT *:** Proibido em arquivos `.sql`, `.cs` ou `.xml`. As colunas devem ser explicitadas.
* **Predicados Não SARGáveis:** Funções aplicadas sobre colunas filtradas no `WHERE` (ex: `YEAR(coluna)`, `LEFT(coluna, n)`, `CAST`).
* **NOLOCK sem Justificativa:** O uso de `WITH (NOLOCK)` exige um comentário técnico justificando a necessidade de leitura suja.
* **Lógica em Tabelas:** Proibido o uso de colunas calculadas ou Scalar Functions diretamente em tabelas.
* **Operações sem Filtro:** Comandos `UPDATE` ou `DELETE` sem a cláusula `WHERE` no mesmo contexto.
* **Idempotência DDL:** Criação/Alteração de objetos (`TABLE`, `PROCEDURE`, `INDEX`) sem checagem de existência (`IF EXISTS`, `OBJECT_ID`, etc.).
* **Transações de Longa Duração:** Bloquear `BEGIN TRAN` que envolva chamadas externas como HTTP, leitura de arquivos, filas ou serviços de terceiros.
* **DDL em Transação de Negócio:** Execução de comandos DDL (ex: `ENABLE/DISABLE TRIGGER`) dentro de transações de lógica de negócio.
* **Scripts de Banco em C#:** Literais de `CREATE PROCEDURE`, `VIEW` ou `FUNCTION` dentro de arquivos `.cs`. Devem ser movidos para arquivos `.xml` de migração.
* **Configuração de Projeto (csproj):** Adição de XML de script sem a entrada `<EmbeddedResource Include="..." />` correspondente.
* **Sincronização de GUID:** Sempre que um script SQL for atualizado, o respetivo **GUID** de controle também deve ser obrigatoriamente alterado.
* **Refatoração de Legado:** Bloquear diffs de scripts de banco versionados em `.cs`. Estes devem ser refatorados para o formato `.xml`.
* **Uso de Table-Valued Parameters (TVP):** Utilizar `TYPE` para passar listas de parâmetros (ex: lista de IDs) em vez de strings longas em `VARCHAR`.
* **Funções de parsing de lista (`FN_SIS_Array` e similares):** Uso de `FN_SIS_Array`, `FN_SYS_ARRAY` ou funções equivalentes (table-valued que expandem string em lista de IDs) **fora** do padrão permitido. **Bloquear** quando não for exclusivamente para popular uma `#temp` de identificadores: `INSERT INTO #NomeTemp (Id) SELECT * FROM <função>(@paramLista);` (ou nome de coluna alinhado ao contrato se não for `Id`). Detalhes e exemplos na **seção 7)**.
* **Encapsulamento de Types:** Ao criar um `TYPE`, manter o `DROP` e `CREATE` no mesmo ficheiro da Procedure (Type exclusivo), exceto para tipos de Identificadores (IDs).
* **Enums/constantes em SQL sem identificação:** uso de códigos numéricos/literais mágicos em scripts SQL (ex.: status, tipo, origem, situação) sem identificação clara no próprio SQL (comentário técnico ou alias/variável nomeada). **Esta regra vale somente para SQL**; validação de enums em C# não pertence ao `DBA_RULES.md`.
* **Validação DBA:** Regras em `TRIGGER` ou criação de `INDEX` (exceto índices em tabelas temporárias `#temp`) exigem validação prévia do DBA antes da aprovação do Pull Request.

Cada gatilho identificado deve ser reportado com a regra correspondente e a severidade definida nesta documentação.

**Severidade padrão:** CRÍTICO (bloqueante)

**Nota para Code Review:** esta lista é para **detecção rápida** de padrões típicos; **não dispensa** a leitura das **Regras obrigatórias de validação** nas seções numeradas abaixo sempre que o diff tocar persistência, Dapper/NHibernate, scripts `.xml`, procedures, performance SQL ou transações. Exemplo frequente fora da lista de gatilhos: **timeout explícito** em chamadas Dapper a procedures (§3 — Uso correto de Dapper e acesso a dados).

---

**Exemplos:**

Ruim (`SELECT` inline em C# - proibido):

```csharp
var sql = "SELECT Quantidade FROM EST_EstoqueFisicoSintetico WHERE IdEmpresa = @IdEmpresa AND IdMercadoria = @IdMercadoria";
var saldo = conn.QueryFirstOrDefault<decimal>(sql, new { IdEmpresa = idEmpresa, IdMercadoria = idMercadoria });
```

Ruim (`UPDATE` inline em C# - proibido):

```csharp
conn.Execute(
    "UPDATE EST_EstoqueFisicoSintetico SET Quantidade = @Quantidade WHERE IdEmpresa = @IdEmpresa AND IdMercadoria = @IdMercadoria",
    new { Quantidade = quantidade, IdEmpresa = empresaId, IdMercadoria = idMercadoria });
```

Bom (chamada de Stored Procedure para leitura):

```csharp
var saldo = conn.ExecuteScalar<decimal>(
    "SP_EST_PegarSaldoMercadoria",
    new { IdEmpresa = empresaId, IdMercadoria = idMercadoria },
    commandType: CommandType.StoredProcedure);
```

Bom (Function existente para cálculo em SQL):

```sql
SELECT dbo.FN_FIN_GetTotalSuprido(@IdFechamentoTurno);
```

Bom (chamada de Stored Procedure para escrita):

```csharp
conn.Execute(
    "SP_EST_AtualizaSaldoMercadoria_EST_EstoqueFisicoSintetico",
    new
    {
        IdEmpresa = empresaId,
        IdLocalEstoque = idLocalEstoque,
        IdMercadoria = idMercadoria,
        DataMovimentacao = dataMovimentacao,
        Fluxo = fluxo
    },
    commandType: CommandType.StoredProcedure);
```

---

## Regras obrigatórias de validação

### 1) Segurança e parametrização

- Não permitir SQL Injection.
- Não concatenar entrada de usuário em SQL.
- Usar parâmetros corretamente em queries e comandos.
- Em SQL dinâmico, utilizar `sp_executesql` com parâmetros tipados.

**Severidade padrão:** CRÍTICO

**Exemplos:**

Ruim (concatenação com entrada do usuário - SQL Injection e SQL inline):

```csharp
var sql = "SELECT SUM(Quantidade) FROM EST_EstoqueFisicoSintetico WHERE IdEmpresa = " + idEmpresa + " AND IdMercadoria = " + idMercadoria;
var saldo = conn.QueryFirstOrDefault<decimal>(sql);
```

Bom (chamada de Stored Procedure com parâmetros tipados):

```csharp
var parametros = new DynamicParameters();
parametros.Add("@IdEmpresa", empresaId, DbType.Int64);
parametros.Add("@IdMercadoria", idMercadoria, DbType.Int64);

var saldo = conn.ExecuteScalar<decimal>(
    "SP_EST_PegarSaldoMercadoria",
    parametros,
    commandType: CommandType.StoredProcedure);
```

Bom (SQL dinâmico dentro de Procedure, usando `sp_executesql` e parâmetros tipados):

```sql
CREATE PROCEDURE [SP_EST_PegarSaldoMercadoria]
    @IdEmpresa bigint,
    @IdMercadoria bigint
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @sql nvarchar(max) = N'SELECT SUM(Quantidade)
                                   FROM EST_EstoqueFisicoSintetico
                                   WHERE IdEmpresa = @IdEmpresa
                                     AND IdMercadoria = @IdMercadoria';

    EXEC sp_executesql @sql,
        N'@IdEmpresa bigint, @IdMercadoria bigint',
        @IdEmpresa = @IdEmpresa,
        @IdMercadoria = @IdMercadoria;
END
```

### 2) Eficiência e qualidade de consulta

- Evitar queries ineficientes.
- Garantir filtros mínimos coerentes com a regra de negócio.
- Evitar consultas pesadas sem justificativa técnica.
- Não utilizar `SELECT *`; listar colunas explicitamente.
- Validar paginação em listagens de grande volume.
- Evitar padrões não SARGáveis em predicados quando possível.

**Severidade padrão:** ATENÇÃO  
**Escalonar para CRÍTICO:** quando houver risco direto de degradação severa em produção.

**Exemplos:**

Ruim (`SELECT *` sem filtro):

```sql
SELECT * FROM EST_EstoqueFisicoAnalitico;
```

Bom (colunas explícitas e filtro sargável):

```sql
SELECT Id, IdEmpresa, IdMercadoria, Quantidade, DataMovimentacao
FROM EST_EstoqueFisicoAnalitico
WHERE IdEmpresa = @IdEmpresa
  AND DataMovimentacao >= @DataInicio
  AND DataMovimentacao < @DataFim;
```

Ruim (predicado não SARGável - função sobre a coluna):

```sql
WHERE CONVERT(varchar(10), DataMovimentacao, 120) = '2026-01-01'
```

Bom (faixa sargável usa índice):

```sql
WHERE DataMovimentacao >= '2026-01-01'
  AND DataMovimentacao <  '2026-01-02'
```

### 3) Uso correto de Dapper e acesso a dados

- Validar o uso correto de parâmetros no Dapper.
- Evitar materialização desnecessária de dados.
- Identificar e tratar potencial N+1 query.
- Garantir mapeamento de tipos compatível com SQL Server para evitar conversões implícitas custosas.
- Validar timeout explícito em chamadas Dapper para Stored Procedures. No padrão utilizado neste projeto, quando aplicável ao fluxo, usar `commandTimeout: int.MaxValue`.

**Severidade padrão:** ATENÇÃO

**Exemplos:**

Ruim (N+1 query - chamada de Procedure por item em loop):

```csharp
foreach (var idMercadoria in mercadoriasIds)
{
    var saldo = conn.ExecuteScalar<decimal>(
        "SP_EST_PegarSaldoMercadoria",
        new { IdEmpresa = empresaId, IdMercadoria = idMercadoria },
        commandType: CommandType.StoredProcedure);
}
```

Ruim (SQL inline em C# - viola a regra fundamental e ainda aplica N+1):

```csharp
foreach (var idMercadoria in mercadoriasIds)
{
    var saldo = conn.QueryFirstOrDefault<decimal>(
        "SELECT SUM(Quantidade) FROM EST_EstoqueFisicoSintetico WHERE IdEmpresa = @IdEmpresa AND IdMercadoria = @IdMercadoria",
        new { IdEmpresa = empresaId, IdMercadoria = idMercadoria });
}
```

Bom (chamada única de Procedure para o cenário - evita N+1 e não usa SQL inline):

```csharp
var encerrantes = conn.Query<EncerranteDto>(
    "SP_PST_PegarEncerrantesDoMes",
    new { Ano = ano, Mes = mes },
    commandType: CommandType.StoredProcedure);
```

Bom (parâmetros tipados em chamada de Procedure evitam conversão implícita e perda de índice):

```csharp
var parametros = new DynamicParameters();
parametros.Add("@IdEmpresa", empresaId, DbType.Int64);
parametros.Add("@IdMercadoria", idMercadoria, DbType.Int64);

var saldo = conn.ExecuteScalar<decimal>(
    "SP_EST_PegarSaldoMercadoria",
    parametros,
    commandType: CommandType.StoredProcedure);
```

Bom (chamada de Procedure com timeout explícito no padrão adotado):

```csharp
var limite = conn.QueryFirstOrDefault<decimal>(
    "[Financeiro].[PC_ObterLimiteDisponivelParceiroNegocioClientePrazo]",
    new { idParceiro = idParceiroNegocio },
    commandType: CommandType.StoredProcedure,
    commandTimeout: int.MaxValue);
```

### 4) Padrões para DML e camada de persistência

- Evitar DML direto no repositório quando o padrão do projeto exigir Procedures/Functions para centralização e governança.
- Para operações críticas de escrita, preferir objetos SQL versionados e auditáveis.
- `UPDATE` e `DELETE` devem possuir `WHERE` seguro e condizente com o contexto.

**Severidade padrão:** ATENÇÃO  
**Escalonar para CRÍTICO:** `UPDATE/DELETE` sem filtro seguro ou com alto risco de atualização indevida em massa.

**Exemplos:**

Ruim (`UPDATE` sem `WHERE` - atualiza a tabela inteira):

```sql
UPDATE EST_EstoqueFisicoSintetico
SET Quantidade = 0;
```

Bom (`UPDATE` com filtro pela chave e pelo multiempresa):

```sql
UPDATE EST_EstoqueFisicoSintetico
SET Quantidade = @Quantidade
WHERE IdEmpresa = @IdEmpresa
  AND IdLocalEstoque = @IdLocalEstoque
  AND IdMercadoria = @IdMercadoria
  AND Mes = @Mes
  AND Ano = @Ano;
```

Bom (invocação de Procedure versionada no repositório):

```csharp
conn.Execute(
    "SP_EST_AtualizaSaldoMercadoria_EST_EstoqueFisicoSintetico",
    new { IdEmpresa = empresaId, IdLocalEstoque = idLocalEstoque, IdMercadoria = idMercadoria, DataMovimentacao = dataMovimentacao, Fluxo = fluxo },
    commandType: CommandType.StoredProcedure);
```

### 5) DDL, idempotência e segurança de migração

- Em DDL, validar existência prévia de objetos (tabelas, colunas, índices, constraints) antes de criar/alterar/remover.
- Scripts devem ser idempotentes sempre que aplicável.
- Não adicionar comandos DDL em transações de negócio da aplicação.
- Avaliar impacto de DDL em índices, locks e janela operacional.

**Severidade padrão:** CRÍTICO

**Exemplos:**

Ruim (DDL sem checagem dentro de transação de negócio):

```sql
BEGIN TRAN;
    ALTER TABLE EST_EstoqueFisicoAnalitico ADD DataIntegracao datetime NULL;
    UPDATE EST_EstoqueFisicoAnalitico SET DataIntegracao = GETDATE() WHERE Status = 0;
COMMIT;
```

Bom (DDL idempotente e fora de transação de negócio):

```sql
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.EST_EstoqueFisicoAnalitico')
      AND name = N'DataIntegracao'
)
BEGIN
    ALTER TABLE dbo.EST_EstoqueFisicoAnalitico ADD DataIntegracao datetime NULL;
END
```




### 6) Concorrência e alto fluxo transacional (SQL Server)

- Manter transações curtas, com escopo mínimo e sem processamento desnecessário dentro da transação.
- Avaliar risco de lock escalation, deadlock e bloqueios prolongados.
- Revisar ordem de acesso e estratégia de índices para reduzir contenção.
- Evitar cursores em fluxos transacionais quando houver alternativa set-based.
- Para cargas em lote e parâmetros volumosos, avaliar TVP (`Table-Valued Parameters`) quando aplicável.

**Severidade padrão:** ATENÇÃO  
**Escalonar para CRÍTICO:** quando houver risco relevante de indisponibilidade/degradação sistêmica.

**Exemplos:**

Ruim (transação longa cobrindo chamada externa - segura locks no banco enquanto aguarda HTTP):

```csharp
using (var tran = conn.BeginTransaction())
{
    conn.Execute(
        "SP_EST_AtualizaSaldoMercadoria_EST_EstoqueFisicoSintetico",
        new { IdEmpresa = empresaId, IdLocalEstoque = idLocalEstoque, IdMercadoria = idMercadoria, DataMovimentacao = dataMovimentacao, Fluxo = fluxo },
        tran, commandType: CommandType.StoredProcedure);

    var retorno = httpClient.PostAsync(urlGatewayFiscal, payload).Result;

    conn.Execute(
        "SP_EST_PegarSaldoMercadoria",
        new { IdEmpresa = empresaId, IdMercadoria = idMercadoria },
        tran, commandType: CommandType.StoredProcedure);

    tran.Commit();
}
```

Ruim (SQL inline em C# dentro de transação - viola a regra fundamental e agrava o risco):

```csharp
using (var tran = conn.BeginTransaction())
{
    conn.Execute("UPDATE EST_EstoqueFisicoSintetico SET Quantidade = Quantidade + 1 WHERE IdEmpresa = @IdEmpresa", new { IdEmpresa = empresaId }, tran);
    conn.Execute("INSERT INTO FIN_LancamentoContabil (IdMovimentacaoContabil, IdDebitoContaContabil, IdCreditoContaContabil, OperacaoNegocio, Versao) VALUES (1,1,1,1,1)", transaction: tran);
    tran.Commit();
}
```

Bom (transação curta somente no trecho de banco, via Procedures):

```csharp
var retorno = httpClient.PostAsync(urlGatewayFiscal, payload).Result;

using (var tran = conn.BeginTransaction())
{
    conn.Execute(
        "SP_EST_AtualizaSaldoMercadoria_EST_EstoqueFisicoSintetico",
        new { IdEmpresa = empresaId, IdLocalEstoque = idLocalEstoque, IdMercadoria = idMercadoria, DataMovimentacao = dataMovimentacao, Fluxo = fluxo },
        tran, commandType: CommandType.StoredProcedure);

    conn.Execute(
        "SP_EST_PegarSaldoMercadoria",
        new { IdEmpresa = empresaId, IdMercadoria = idMercadoria },
        tran, commandType: CommandType.StoredProcedure);

    tran.Commit();
}
```

Bom (processamento em lote sem SQL inline, centralizado em Procedure existente):

```csharp
conn.Execute(
    "SP_EST_InsereMovimentacao_EST_EstoqueFisicoAnalitico",
    new
    {
        IdEmpresa = empresaId,
        IdLocalEstoque = idLocalEstoque,
        IdMercadoria = idMercadoria,
        Fluxo = fluxo,
        Status = status,
        DataRegistro = dataRegistro,
        DataEmissao = dataEmissao,
        DataMovimentacao = dataMovimentacao,
        Quantidade = quantidade,
        DocumentoOrigem = documentoOrigem,
        ItemDocumentoOrigem = itemDocumentoOrigem
    },
    commandType: CommandType.StoredProcedure);
```

### 7) Padrões de implementação para Procedures/Functions (SQL Server)

- Em cenários de volume relevante ou joins complexos, evitar `@table` e preferir `#temp` para melhor estimativa de cardinalidade e possibilidade de índices.
- Não sinalizar automaticamente criação de índices em tabelas temporárias `#temp` como violação; essa decisão pertence ao domínio de implementação/performance da própria procedure.
- Sempre que uma `#temp` deixar de ser necessária, remover explicitamente com validação de existência (`OBJECT_ID` em `tempdb`) para liberar recursos do `tempdb` mais cedo.
- Definir `VARCHAR(X)`/`NVARCHAR(X)` com tamanho aderente ao domínio e alinhado entre parâmetro, coluna e contrato da aplicação.
- Usar `NVARCHAR` somente quando houver necessidade de Unicode/acentuação.
- Evitar `MAX` por padrão; reservar para conteúdo realmente variável e potencialmente grande.
- Tratar risco de truncamento como ponto obrigatório de revisão quando o limite for incerto.
- Todo `WHILE` deve ter progresso explícito, limite de segurança (`@MaxIteracoes`) e saída controlada (`BREAK`/`THROW`) para impedir loop infinito.
- Funções de parsing de lista (ex.: `FN_SIS_Array`, `FN_SYS_ARRAY` e equivalentes): permitidas **somente** para materializar IDs numa `#temp` com coluna de identificador (padrão `Id`), via `INSERT INTO #Nome (Id) SELECT * FROM <função>(@paramLista);`. Proibido `JOIN` direto com a função, `WHERE ... IN (SELECT * FROM <função>(...))`, `CROSS APPLY` no corpo da consulta fora desse passo de carga, ou qualquer uso que não seja esse `INSERT` em `#temp`.
- Fora desse padrão, o otimizador tende a subestimar cardinalidade, repetir avaliação da função e dificultar índices úteis frente ao fluxo recomendado: popular `#temp` e depois `JOIN` com tabelas base.

**Severidade padrão:** ATENÇÃO  
**Escalonar para CRÍTICO:** risco de loop infinito, truncamento com impacto de negócio, padrão com alto potencial de degradação sistêmica no `tempdb`, ou **violação do uso obrigatório de funções tipo `FN_SIS_Array`** (apenas `INSERT` em `#temp` de IDs — ver exemplos abaixo). `FN_SYS_ARRAY` e outras variações de nome aplicam a mesma regra que `FN_SIS_Array`.

**Exemplos:**

Ruim (`@table` em cenário volumoso com join):

```sql
DECLARE @Itens TABLE
(
    IdMercadoria bigint,
    Quantidade decimal(18,4)
);

INSERT INTO @Itens (IdMercadoria, Quantidade)
SELECT IdMercadoria, Quantidade
FROM EST_EstoqueFisicoAnalitico
WHERE DataMovimentacao >= @DataInicio;

SELECT p.Id, i.IdMercadoria, i.Quantidade
FROM EST_EstoqueFisicoAnalitico p
JOIN @Itens i ON i.IdMercadoria = p.IdMercadoria;
```

Bom (`#temp` com uso set-based e descarte explícito seguro):

```sql
CREATE TABLE #Itens
(
    IdMercadoria bigint NOT NULL,
    Quantidade decimal(18,4) NOT NULL
);

INSERT INTO #Itens (IdMercadoria, Quantidade)
SELECT IdMercadoria, Quantidade
FROM EST_EstoqueFisicoAnalitico
WHERE DataMovimentacao >= @DataInicio;

CREATE CLUSTERED INDEX IX_#Itens_IdMercadoria ON #Itens (IdMercadoria);

SELECT p.Id, i.IdMercadoria, i.Quantidade
FROM EST_EstoqueFisicoAnalitico p
JOIN #Itens i ON i.IdMercadoria = p.IdMercadoria;

IF OBJECT_ID('tempdb..#Itens') IS NOT NULL
    DROP TABLE #Itens;
```

Ruim (`WHILE` sem progresso explícito):

```sql
DECLARE @Indice int = 1;
DECLARE @Total int = (SELECT COUNT(1) FROM FIN_LancamentoContabil WHERE IdEmpresa = @EmpresaId);

WHILE (@Indice <= @Total)
BEGIN
    EXEC SP_FIN_GeraCustoMedioSintetico_FIN_CustoMedioSintetico @Indice;
    -- faltou incrementar @Indice
END
```

Bom (`WHILE` com limite de segurança e saída controlada):

```sql
DECLARE @Indice int = 1;
DECLARE @Total int = (SELECT COUNT(1) FROM FIN_LancamentoContabil WHERE IdEmpresa = @EmpresaId);
DECLARE @MaxIteracoes int = @Total + 100;

WHILE (@Indice <= @Total)
BEGIN
    IF (@Indice > @MaxIteracoes)
        THROW 51000, 'Loop excedeu limite de segurança.', 1;

    EXEC SP_FIN_GeraCustoMedioSintetico_FIN_CustoMedioSintetico @Indice;
    SET @Indice += 1;
END
```

Ruim (função de lista em `JOIN` ou em subconsulta — fora do padrão permitido):

```sql
SELECT t.Id, t.IdMercadoria
FROM EST_EstoqueFisicoAnalitico t
INNER JOIN dbo.FN_SIS_Array(@idMercadorias) m ON m.Id = t.IdMercadoria;

SELECT Id
FROM FIN_LancamentoContabil
WHERE Id IN (SELECT * FROM dbo.FN_SIS_Array(@idsLancamentos));
```

Bom (popular `#temp` de IDs e depois usar joins normais com tabelas base):

```sql
-- Popular as tabelas temporárias
INSERT INTO #TempTurnos (Id)
SELECT * FROM dbo.FN_SIS_Array(@idTurnos);

INSERT INTO #TempMercadorias (Id)
SELECT * FROM dbo.FN_SIS_Array(@idMercadorias);

-- Em seguida: CREATE INDEX em #temp se necessário, JOIN com #TempTurnos / #TempMercadorias, etc.
```

### 8) Scripts XML de banco (obrigatório para projetos .NET)

- Identificar no diff todo XML de script de banco contendo `<atualizacao-bd>` ou `<ScriptAutomatico>`.
- Para cada XML identificado, validar se existe referência no `.csproj` como `EmbeddedResource`.
- A referência esperada deve seguir o padrão:

  `<EmbeddedResource Include="caminho/do/xml" />`

- Ausência de `EmbeddedResource` para XML de banco é falha de execução em runtime.
- Em scripts/versionamentos com identificador, o GUID deve ser único para evitar conflito entre execuções.
- Todo novo script de banco (Procedure, Function, View, Trigger e afins) deve ser versionado em arquivo `.xml`.
- Não é permitido adicionar novo script de banco em classe `.cs` (exemplo bloqueante: `SP_EST_PegarSaldoMercadoria.cs`).

**Severidade padrão:** CRÍTICO (bloqueante)

**Exemplos:**

Ruim (script versionado em classe `.cs` - bloqueante):

```csharp
// Arquivo: ESTOQUE/Scripts/SP_EST_PegarSaldoMercadoria.cs
public static class ScriptGerarTitulo
{
    public const string Sql = @"
        CREATE PROCEDURE SP_EST_PegarSaldoMercadoria
            @IdEmpresa bigint, @IdMercadoria bigint
        AS
        BEGIN
            -- corpo
        END";
}
```

Bom (script versionado em `.xml` com `EmbeddedResource` no `.csproj`):

```xml
<!-- Arquivo: ESTOQUE/Scripts/SP_EST_PegarSaldoMercadoria.xml -->
<atualizacao-bd guid="8b2a1f3e-2c4b-4a7f-9b1d-6f3a0e4b1a11" versao="1.0">
  <script>
    <![CDATA[
      IF OBJECT_ID(N'SP_EST_PegarSaldoMercadoria', N'P') IS NULL
          EXEC('CREATE PROCEDURE SP_EST_PegarSaldoMercadoria AS BEGIN SET NOCOUNT ON; END');
      GO
      ALTER PROCEDURE SP_EST_PegarSaldoMercadoria
          @IdEmpresa bigint, @IdMercadoria bigint
      AS
      BEGIN
          SET NOCOUNT ON;
          -- corpo da procedure
      END
    ]]>
  </script>
</atualizacao-bd>
```

```xml
<!-- Arquivo: Estoque.csproj -->
<ItemGroup>
  <EmbeddedResource Include="Scripts\SP_EST_PegarSaldoMercadoria.xml" />
</ItemGroup>
```

Ruim (XML presente no repositório mas sem `EmbeddedResource` no `.csproj`):

```xml
<!-- Arquivo: Estoque.csproj -->
<ItemGroup>
  <None Include="Scripts\SP_EST_PegarSaldoMercadoria.xml" />
</ItemGroup>
```

---

## Evidências mínimas no parecer

Para cada apontamento de banco, registrar:

- Severidade (CRÍTICO, ATENÇÃO, SUGESTÃO)
- Arquivo/objeto impactado
- Trecho do diff analisado
- Descrição do risco e impacto potencial
- Correção recomendada



---

## Relação com o processo de review

O comando de Code Review deve referenciar este arquivo explicitamente e aplicar estas regras de forma mandatória em toda alteração com impacto de banco de dados. 
