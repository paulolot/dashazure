# DBA_EXEMPLOS — exemplos por gatilho

> **Fonte operacional** para Code Review. Ler **somente** a seção do gatilho disparado (ID em [`DBA_GATILHOS.md`](DBA_GATILHOS.md)). Referência legada: [`DBA_RULES.md`](DBA_RULES.md).

---

### G01 {#g01}

**SQL Inline em C#** — usar exclusivamente Stored Procedures.

Ruim (`SELECT` inline):

```csharp
var sql = "SELECT Quantidade FROM EST_EstoqueFisicoSintetico WHERE IdEmpresa = @IdEmpresa AND IdMercadoria = @IdMercadoria";
var saldo = conn.QueryFirstOrDefault<decimal>(sql, new { IdEmpresa = idEmpresa, IdMercadoria = idMercadoria });
```

Ruim (`UPDATE` inline):

```csharp
conn.Execute(
    "UPDATE EST_EstoqueFisicoSintetico SET Quantidade = @Quantidade WHERE IdEmpresa = @IdEmpresa AND IdMercadoria = @IdMercadoria",
    new { Quantidade = quantidade, IdEmpresa = empresaId, IdMercadoria = idMercadoria });
```

Bom (leitura via Procedure):

```csharp
var saldo = conn.ExecuteScalar<decimal>(
    "SP_EST_PegarSaldoMercadoria",
    new { IdEmpresa = empresaId, IdMercadoria = idMercadoria },
    commandType: CommandType.StoredProcedure);
```

Bom (escrita via Procedure):

```csharp
conn.Execute(
    "SP_EST_AtualizaSaldoMercadoria_EST_EstoqueFisicoSintetico",
    new { IdEmpresa = empresaId, IdLocalEstoque = idLocalEstoque, IdMercadoria = idMercadoria, DataMovimentacao = dataMovimentacao, Fluxo = fluxo },
    commandType: CommandType.StoredProcedure);
```

---

### G02 {#g02}

**CommandType Omitido** — chamadas a procedures devem declarar `CommandType.StoredProcedure`.

Ruim:

```csharp
var saldo = conn.Query<decimal>("SP_EST_PegarSaldoMercadoria", new { IdEmpresa = empresaId, IdMercadoria = idMercadoria });
```

Bom:

```csharp
var saldo = conn.ExecuteScalar<decimal>(
    "SP_EST_PegarSaldoMercadoria",
    new { IdEmpresa = empresaId, IdMercadoria = idMercadoria },
    commandType: CommandType.StoredProcedure);
```

---

### G03 {#g03}

**NHibernate SQL Nativo** — usar Procedures/Functions mapeadas.

Ruim:

```csharp
var sql = String.Format(@"SELECT * FROM [Financeiro].[FN_Relatorio0358]({0}, {1})", empresas, dataInicio);
ISQLQuery query = sessao.CreateSQLQuery(sql);
return query.List();
```

Bom (Dapper + Procedure):

```csharp
var result = connection.Query<RelatorioDto>(
    "[Financeiro].[PC_Relatorio0358]",
    param: parameters,
    commandType: CommandType.StoredProcedure,
    commandTimeout: int.MaxValue);
return result.ToList();
```

---

### G04 {#g04}

**Concatenação de SQL** — proibido interpolar/concatenar variáveis C# em SQL.

Ruim (C#):

```csharp
var sql = "SELECT SUM(Quantidade) FROM EST_EstoqueFisicoSintetico WHERE IdEmpresa = " + idEmpresa + " AND IdMercadoria = " + idMercadoria;
var saldo = conn.QueryFirstOrDefault<decimal>(sql);
```

Bom (Procedure parametrizada):

```csharp
var parametros = new DynamicParameters();
parametros.Add("@IdEmpresa", empresaId, DbType.Int64);
parametros.Add("@IdMercadoria", idMercadoria, DbType.Int64);
var saldo = conn.ExecuteScalar<decimal>("SP_EST_PegarSaldoMercadoria", parametros, commandType: CommandType.StoredProcedure);
```

Bom (SQL dinâmico **dentro** de Procedure com `sp_executesql`):

```sql
DECLARE @sql nvarchar(max) = N'SELECT SUM(Quantidade) FROM EST_EstoqueFisicoSintetico WHERE IdEmpresa = @IdEmpresa AND IdMercadoria = @IdMercadoria';
EXEC sp_executesql @sql, N'@IdEmpresa bigint, @IdMercadoria bigint', @IdEmpresa = @IdEmpresa, @IdMercadoria = @IdMercadoria;
```

---

### G05 {#g05}

**Loops com I/O de Banco** — processar em lote ou TVP.

Ruim (N+1):

```csharp
foreach (var idMercadoria in mercadoriasIds)
{
    var saldo = conn.ExecuteScalar<decimal>(
        "SP_EST_PegarSaldoMercadoria",
        new { IdEmpresa = empresaId, IdMercadoria = idMercadoria },
        commandType: CommandType.StoredProcedure);
}
```

Bom (chamada única):

```csharp
var encerrantes = conn.Query<EncerranteDto>(
    "SP_PST_PegarEncerrantesDoMes",
    new { Ano = ano, Mes = mes },
    commandType: CommandType.StoredProcedure);
```

---

### G06 {#g06}

**Tabelas Temporárias Ineficientes** — preferir `#temp` a `@table` em volume.

Ruim:

```sql
DECLARE @Itens TABLE (IdMercadoria bigint, Quantidade decimal(18,4));
INSERT INTO @Itens SELECT IdMercadoria, Quantidade FROM EST_EstoqueFisicoAnalitico WHERE DataMovimentacao >= @DataInicio;
SELECT p.Id FROM EST_EstoqueFisicoAnalitico p JOIN @Itens i ON i.IdMercadoria = p.IdMercadoria;
```

Bom:

```sql
CREATE TABLE #Itens (IdMercadoria bigint NOT NULL, Quantidade decimal(18,4) NOT NULL);
INSERT INTO #Itens SELECT IdMercadoria, Quantidade FROM EST_EstoqueFisicoAnalitico WHERE DataMovimentacao >= @DataInicio;
CREATE CLUSTERED INDEX IX_#Itens_IdMercadoria ON #Itens (IdMercadoria);
SELECT p.Id FROM EST_EstoqueFisicoAnalitico p JOIN #Itens i ON i.IdMercadoria = p.IdMercadoria;
IF OBJECT_ID('tempdb..#Itens') IS NOT NULL DROP TABLE #Itens;
```

---

### G07 {#g07}

**Gestão de #Temp Tables** — descarte explícito.

Ruim (`CREATE TABLE #` sem `DROP`):

```sql
CREATE TABLE #Itens (Id bigint NOT NULL);
INSERT INTO #Itens SELECT Id FROM FIN_LancamentoContabil WHERE IdEmpresa = @IdEmpresa;
SELECT * FROM #Itens;
-- faltou DROP
```

Bom:

```sql
IF OBJECT_ID('tempdb..#Itens') IS NOT NULL DROP TABLE #Itens;
CREATE TABLE #Itens (Id bigint NOT NULL);
-- uso...
IF OBJECT_ID('tempdb..#Itens') IS NOT NULL DROP TABLE #Itens;
```

---

### G08 {#g08}

**Controle de Fluxo Inseguro (WHILE)** — incremento e limite de segurança.

Ruim:

```sql
DECLARE @Indice int = 1;
DECLARE @Total int = (SELECT COUNT(1) FROM FIN_LancamentoContabil WHERE IdEmpresa = @EmpresaId);
WHILE (@Indice <= @Total)
BEGIN
    EXEC SP_FIN_GeraCustoMedioSintetico @Indice;
    -- faltou incrementar @Indice
END
```

Bom:

```sql
DECLARE @Indice int = 1;
DECLARE @Total int = (SELECT COUNT(1) FROM FIN_LancamentoContabil WHERE IdEmpresa = @EmpresaId);
DECLARE @MaxIteracoes int = @Total + 100;
WHILE (@Indice <= @Total)
BEGIN
    IF (@Indice > @MaxIteracoes) THROW 51000, 'Loop excedeu limite de segurança.', 1;
    EXEC SP_FIN_GeraCustoMedioSintetico @Indice;
    SET @Indice += 1;
END
```

---

### G09 {#g09}

**Dimensionamento de Tipos** — tamanho aderente ao domínio.

Ruim:

```sql
CREATE PROCEDURE SP_Exemplo @Observacao VARCHAR(MAX), @Codigo NVARCHAR(MAX) AS ...
```

Bom:

```sql
CREATE PROCEDURE SP_Exemplo
    @Observacao VARCHAR(500),  -- limite do domínio / coluna destino
    @Codigo VARCHAR(20)
AS ...
```

---

### G10 {#g10}

**Uso de SELECT *** — explicitar colunas.

Ruim:

```sql
SELECT * FROM EST_EstoqueFisicoAnalitico;
```

Bom:

```sql
SELECT Id, IdEmpresa, IdMercadoria, Quantidade, DataMovimentacao
FROM EST_EstoqueFisicoAnalitico
WHERE IdEmpresa = @IdEmpresa
  AND DataMovimentacao >= @DataInicio
  AND DataMovimentacao < @DataFim;
```

---

### G11 {#g11}

**Predicados Não SARGáveis** — faixa em vez de função sobre coluna.

Ruim:

```sql
WHERE CONVERT(varchar(10), DataMovimentacao, 120) = '2026-01-01'
```

Bom:

```sql
WHERE DataMovimentacao >= '2026-01-01'
  AND DataMovimentacao <  '2026-01-02'
```

---

### G12 {#g12}

**NOLOCK sem Justificativa** — exige comentário técnico.

Ruim:

```sql
SELECT Id, Quantidade FROM EST_EstoqueFisicoSintetico WITH (NOLOCK) WHERE IdEmpresa = @IdEmpresa;
```

Bom:

```sql
-- NOLOCK: relatório analítico tolera leitura suja; sem lock para evitar bloqueio em fechamento
SELECT Id, Quantidade FROM EST_EstoqueFisicoSintetico WITH (NOLOCK) WHERE IdEmpresa = @IdEmpresa;
```

---

### G13 {#g13}

**Lógica em Tabelas** — evitar coluna calculada persistida / UDF escalar em tabela.

Ruim:

```sql
ALTER TABLE EST_Mercadoria ADD PrecoComImposto AS (Preco * (1 + Aliquota)) PERSISTED;
```

Bom (lógica na procedure ou view, não coluna calculada na tabela base):

```sql
CREATE PROCEDURE SP_EST_ListarPrecoComImposto
    @IdEmpresa bigint
AS
SELECT m.Id, m.Preco * (1 + m.Aliquota) AS PrecoComImposto
FROM EST_Mercadoria m
WHERE m.IdEmpresa = @IdEmpresa;
```

---

### G14 {#g14}

**Operações sem Filtro** — `UPDATE`/`DELETE` com `WHERE`.

Ruim:

```sql
UPDATE EST_EstoqueFisicoSintetico SET Quantidade = 0;
```

Bom:

```sql
UPDATE EST_EstoqueFisicoSintetico
SET Quantidade = @Quantidade
WHERE IdEmpresa = @IdEmpresa
  AND IdLocalEstoque = @IdLocalEstoque
  AND IdMercadoria = @IdMercadoria;
```

---

### G15 {#g15}

**Idempotência DDL** — checagem antes de criar/alterar.

Ruim:

```sql
CREATE PROCEDURE [Financeiro].[PC_Exemplo] AS BEGIN SET NOCOUNT ON; END
```

Bom:

```sql
IF OBJECT_ID('[Financeiro].[PC_Exemplo]', 'P') IS NOT NULL
    DROP PROCEDURE [Financeiro].[PC_Exemplo];
GO
CREATE PROCEDURE [Financeiro].[PC_Exemplo] AS BEGIN SET NOCOUNT ON; END
```

---

### G16 {#g16}

**Transações de Longa Duração** — sem I/O externo dentro da transação.

Ruim:

```csharp
using (var tran = conn.BeginTransaction())
{
    conn.Execute("SP_EST_AtualizaSaldo", param, tran, commandType: CommandType.StoredProcedure);
    var retorno = httpClient.PostAsync(urlGatewayFiscal, payload).Result;
    conn.Execute("SP_EST_PegarSaldo", param2, tran, commandType: CommandType.StoredProcedure);
    tran.Commit();
}
```

Bom:

```csharp
var retorno = httpClient.PostAsync(urlGatewayFiscal, payload).Result;
using (var tran = conn.BeginTransaction())
{
    conn.Execute("SP_EST_AtualizaSaldo", param, tran, commandType: CommandType.StoredProcedure);
    conn.Execute("SP_EST_PegarSaldo", param2, tran, commandType: CommandType.StoredProcedure);
    tran.Commit();
}
```

---

### G17 {#g17}

**DDL em Transação de Negócio** — DDL fora de transação de negócio.

Ruim:

```sql
BEGIN TRAN;
    ALTER TABLE EST_EstoqueFisicoAnalitico ADD DataIntegracao datetime NULL;
    UPDATE EST_EstoqueFisicoAnalitico SET DataIntegracao = GETDATE() WHERE Status = 0;
COMMIT;
```

Bom:

```sql
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.EST_EstoqueFisicoAnalitico') AND name = N'DataIntegracao')
BEGIN
    ALTER TABLE dbo.EST_EstoqueFisicoAnalitico ADD DataIntegracao datetime NULL;
END
```

---

### G18 {#g18}

**Scripts SQL em `.cs` / legado** — versionar em `.xml` + `EmbeddedResource`.

Ruim A (novo `.cs` com DDL embutido):

```csharp
public const string Sql = @"
    CREATE PROCEDURE SP_EST_PegarSaldoMercadoria @IdEmpresa bigint AS BEGIN ... END";
```

Ruim B (MetaReport — substituir FN por PC ainda em `AtualizacaoBD/Classes`, sem `.xml`):

```csharp
// Diff: remove Financeiro_FN_Relatorio0358....cs
// Diff: adiciona Financeiro_PC_Relatorio0358....cs com CREATE PROCEDURE no ObterSql()
```

Bom (`.xml` + `.csproj`):

```xml
<atualizacao-bd guid="8b2a1f3e-2c4b-4a7f-9b1d-6f3a0e4b1a11" versao="1.0">
  <script><![CDATA[
    IF OBJECT_ID(N'SP_EST_PegarSaldoMercadoria', N'P') IS NULL EXEC('CREATE PROCEDURE ...');
    ALTER PROCEDURE SP_EST_PegarSaldoMercadoria ...
  ]]></script>
</atualizacao-bd>
```

```xml
<EmbeddedResource Include="Scripts\SP_EST_PegarSaldoMercadoria.xml" />
```

---

### G19 {#g19}

**Configuração de Projeto (csproj)** — `EmbeddedResource` para scripts XML.

Ruim:

```xml
<None Include="Scripts\SP_EST_PegarSaldoMercadoria.xml" />
```

Bom:

```xml
<EmbeddedResource Include="Scripts\SP_EST_PegarSaldoMercadoria.xml" />
```

---

### G20 {#g20}

**Sincronização de GUID** — alterar GUID ao alterar script.

Ruim (SQL alterado, GUID igual):

```csharp
public String Guid { get { return "CE488B2A-00A9-456E-93E2-65C865A874DB"; } }
// ObterSql() com corpo de procedure modificado, GUID inalterado
```

Bom:

```csharp
public String Guid { get { return "B328A6CF-C6C2-43BD-94CF-9EB674D712F9"; } }
// Novo GUID após alteração substantiva do script
```

---

### G21 {#g21}

**Uso de TVP** — listas via `TYPE` + TVP, não `VARCHAR` + parsing.

Ruim:

```sql
CREATE FUNCTION ... (@IdEmpresas VARCHAR(MAX) ...)
...
WHERE FDF.IdEmpresa IN (SELECT number FROM FN_SIS_Array(@IdEmpresas))
```

Bom (procedure + Dapper):

```sql
CREATE PROCEDURE SP_Exemplo @IdsEmpresa [Financeiro].[TypeFiltro_Id] READONLY AS ...
```

```csharp
parameters.AddTable("@IdsEmpresa", "[Financeiro].[TypeFiltro_Id]", idsEmpresas);
```

---

### G22 {#g22}

**FN_SIS_Array e similares** — só para popular `#temp` de IDs.

Ruim:

```sql
SELECT t.Id FROM EST_EstoqueFisicoAnalitico t
INNER JOIN dbo.FN_SIS_Array(@idMercadorias) m ON m.Id = t.IdMercadoria;
```

Bom:

```sql
INSERT INTO #TempMercadorias (Id) SELECT * FROM dbo.FN_SIS_Array(@idMercadorias);
SELECT t.Id FROM EST_EstoqueFisicoAnalitico t
INNER JOIN #TempMercadorias m ON m.Id = t.IdMercadoria;
```

---

### G23 {#g23}

**Encapsulamento de Types** — DROP/CREATE no mesmo artefato da procedure.

Ruim (TYPE em script separado, sem vínculo com PC):

```sql
-- Arquivo A: CREATE TYPE [Financeiro].[TypeFiltro_Custom] ...
-- Arquivo B: CREATE PROCEDURE PC_Exemplo usa o TYPE sem DROP/CREATE no mesmo arquivo
```

Bom:

```sql
IF TYPE_ID(N'[Financeiro].[TypeFiltro_ExclusivoPc]') IS NOT NULL
    DROP TYPE [Financeiro].[TypeFiltro_ExclusivoPc];
CREATE TYPE [Financeiro].[TypeFiltro_ExclusivoPc] AS TABLE (Id bigint);
GO
CREATE PROCEDURE [Financeiro].[PC_Exemplo] @Ids [Financeiro].[TypeFiltro_ExclusivoPc] READONLY AS ...
```

---

### G24 {#g24}

**Enums/constantes em SQL sem identificação** — comentário ou variável nomeada.

Ruim:

```sql
WHERE FDF.TipoDocumento = 2 AND FDF.Status = 1
```

Bom:

```sql
-- TipoDocumento 2 = NF-e; Status 1 = PROCESSADO
WHERE FDF.TipoDocumento = 2 AND FDF.Status = @StatusProcessado
```

---

### G25 {#g25}

**Validação DBA (TRIGGER/INDEX)** — aprovação DBA antes do merge.

Ruim:

```sql
CREATE NONCLUSTERED INDEX IX_EST_Estoque_IdEmpresa ON EST_EstoqueFisicoSintetico (IdEmpresa, IdMercadoria);
```

Bom:

```sql
-- DBA: aprovado em WI-12345 / e-mail DBA 2026-06-01 — índice para relatório 358
CREATE NONCLUSTERED INDEX IX_EST_Estoque_IdEmpresa ON EST_EstoqueFisicoSintetico (IdEmpresa, IdMercadoria);
```

---

### R01 {#r01}

**Timeout explícito Dapper → SP** — padrão do projeto: `commandTimeout: int.MaxValue` quando aplicável.

Ruim:

```csharp
var result = connection.Query<Dto>(sqlQuery, param: parameters, commandType: CommandType.StoredProcedure);
```

Bom:

```csharp
var result = connection.Query<Dto>(
    sqlQuery,
    param: parameters,
    commandType: CommandType.StoredProcedure,
    commandTimeout: int.MaxValue);
```
