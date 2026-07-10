# DBA_GATILHOS — detecção rápida (Code Review)

> **Fonte operacional** para Code Review. Exemplos em [`DBA_EXEMPLOS.md`](DBA_EXEMPLOS.md). Referência legada completa: [`DBA_RULES.md`](DBA_RULES.md).

## Como usar no review

1. Escanear o patch (hunks `+`/`-` e contexto) com os **padrões** de cada gatilho abaixo.
2. Gatilho **não disparado** no arquivo → `PASS` (não abrir exemplos).
3. Gatilho **disparado** → ler **somente** a seção `### Gxx` em [`DBA_EXEMPLOS.md`](DBA_EXEMPLOS.md) e validar o hunk.
4. Regra complementar **R01** (timeout Dapper): ver seção [Regras complementares](#regras-complementares).

**Severidade padrão dos gatilhos G01–G25:** CRÍTICO, salvo indicação contrária no gatilho.

---

## Índice rápido

| ID | Nome |
|----|------|
| [G01](#g01) | SQL Inline em C# |
| [G02](#g02) | CommandType Omitido |
| [G03](#g03) | NHibernate SQL Nativo |
| [G04](#g04) | Concatenação de SQL |
| [G05](#g05) | Loops com I/O de Banco |
| [G06](#g06) | Tabelas Temporárias Ineficientes |
| [G07](#g07) | Gestão de #Temp Tables |
| [G08](#g08) | Controle de Fluxo Inseguro (WHILE) |
| [G09](#g09) | Dimensionamento de Tipos |
| [G10](#g10) | Uso de SELECT * |
| [G11](#g11) | Predicados Não SARGáveis |
| [G12](#g12) | NOLOCK sem Justificativa |
| [G13](#g13) | Lógica em Tabelas |
| [G14](#g14) | Operações sem Filtro |
| [G15](#g15) | Idempotência DDL |
| [G16](#g16) | Transações de Longa Duração |
| [G17](#g17) | DDL em Transação de Negócio |
| [G18](#g18) | Scripts SQL em `.cs` / legado |
| [G19](#g19) | Configuração de Projeto (csproj) |
| [G20](#g20) | Sincronização de GUID |
| [G21](#g21) | Uso de TVP |
| [G22](#g22) | FN_SIS_Array e similares |
| [G23](#g23) | Encapsulamento de Types |
| [G24](#g24) | Enums/constantes em SQL sem identificação |
| [G25](#g25) | Validação DBA (TRIGGER/INDEX) |

---

### G01 — SQL Inline em C#

- **Severidade:** CRÍTICO
- **Regra:** O sistema deve operar exclusivamente via **Stored Procedures** (sem `SELECT`/`INSERT`/`UPDATE`/`DELETE` inline em C#).
- **Padrões diff:** literais `"SELECT`, `'SELECT`, `"INSERT`, `"UPDATE`, `"DELETE` em `.cs` passados a `Query`, `Execute`, `QueryFirst`, `ExecuteScalar` ou `CommandText`
- **Contexto:** arquivos `.cs` com Dapper ou `DbCommand`
- **Exemplos:** [G01](DBA_EXEMPLOS.md#g01)

### G02 — CommandType Omitido

- **Severidade:** CRÍTICO
- **Regra:** Chamadas Dapper a procedures devem definir `commandType: CommandType.StoredProcedure`.
- **Padrões diff:** `.Query(`, `.Execute(`, `.QueryFirst` em hunks `+` **sem** `commandType:\s*CommandType\.StoredProcedure` no mesmo bloco de chamada; nome de objeto SQL como primeiro argumento string
- **Contexto:** arquivos `.cs` com Dapper
- **Exemplos:** [G02](DBA_EXEMPLOS.md#g02)

### G03 — NHibernate SQL Nativo

- **Severidade:** CRÍTICO
- **Regra:** Proibido `session.CreateSQLQuery(...)` para DML/DQL; usar Procedures ou Functions mapeadas.
- **Padrões diff:** `CreateSQLQuery`, `CreateQuery` com SQL literal em hunks `+`
- **Contexto:** arquivos `.cs` com NHibernate
- **Exemplos:** [G03](DBA_EXEMPLOS.md#g03)

### G04 — Concatenação de SQL

- **Severidade:** CRÍTICO
- **Regra:** Proibido montar SQL com interpolação (`$""`), concatenação (`+`) ou `string.Format` com variáveis C#.
- **Padrões diff:** `string.Format` + SQL, `$"SELECT`, `$"INSERT`, concatenação `+` com fragmentos SQL em `.cs`; em T-SQL dinâmico dentro de procedure, validar uso de `sp_executesql` com parâmetros (ver exemplos)
- **Contexto:** `.cs` (C#) ou `.sql`/`.xml`/`.cs` de script com SQL dinâmico inseguro
- **Exemplos:** [G04](DBA_EXEMPLOS.md#g04)

### G05 — Loops com I/O de Banco

- **Severidade:** CRÍTICO
- **Regra:** Proibido `Query`/`Execute`/`ExecuteScalar` dentro de `foreach`, `for` ou `while`; processar em lote ou TVP.
- **Padrões diff:** `foreach`/`for`/`while` no mesmo hunk ou método com `.Query(`, `.Execute(`, `.ExecuteScalar(`
- **Contexto:** arquivos `.cs`
- **Exemplos:** [G05](DBA_EXEMPLOS.md#g05)

### G06 — Tabelas Temporárias Ineficientes

- **Severidade:** ATENÇÃO (escalar CRÍTICO se volume alto em produção)
- **Regra:** Evitar `DECLARE @TABLE` para cargas volumosas ou joins complexos; preferir `#temp`.
- **Padrões diff:** `DECLARE @` + `TABLE` em hunks `+` de procedures/functions
- **Contexto:** `.sql`, scripts em `.xml`, literais SQL em `.cs`
- **Exemplos:** [G06](DBA_EXEMPLOS.md#g06)

### G07 — Gestão de #Temp Tables

- **Severidade:** ATENÇÃO
- **Regra:** `CREATE TABLE #Temp` deve ter descarte explícito: `IF OBJECT_ID('tempdb..#Temp') IS NOT NULL DROP TABLE #Temp;`
- **Padrões diff:** `CREATE TABLE #` em hunks `+` **sem** `DROP TABLE #` correspondente no mesmo arquivo/hunk estendido
- **Contexto:** procedures/functions SQL
- **Exemplos:** [G07](DBA_EXEMPLOS.md#g07)

### G08 — Controle de Fluxo Inseguro (WHILE)

- **Severidade:** CRÍTICO se risco de loop infinito; senão ATENÇÃO
- **Regra:** Todo `WHILE` deve ter incremento de variável, `BREAK`/`THROW` e/ou `@MaxIteracoes`.
- **Padrões diff:** `WHILE (` em hunks `+` sem `SET` de incremento nem `THROW`/`BREAK` no bloco
- **Contexto:** T-SQL em procedures/functions
- **Exemplos:** [G08](DBA_EXEMPLOS.md#g08)

### G09 — Dimensionamento de Tipos

- **Severidade:** ATENÇÃO
- **Regra:** `VARCHAR(X)`/`NVARCHAR(X)` aderente ao domínio; evitar `MAX` injustificado.
- **Padrões diff:** `VARCHAR(MAX)`, `NVARCHAR(MAX)`, tamanhos incoerentes entre parâmetro e coluna em hunks `+`
- **Contexto:** DDL, procedures, types SQL
- **Exemplos:** [G09](DBA_EXEMPLOS.md#g09)

### G10 — Uso de SELECT *

- **Severidade:** ATENÇÃO
- **Regra:** Proibido `SELECT *` em `.sql`, `.cs` ou `.xml`; explicitar colunas.
- **Padrões diff:** `SELECT *` ou `SELECT  *` em hunks `+`
- **Contexto:** qualquer artefato SQL
- **Exemplos:** [G10](DBA_EXEMPLOS.md#g10)

### G11 — Predicados Não SARGáveis

- **Severidade:** ATENÇÃO (CRÍTICO se tabela de alto volume)
- **Regra:** Evitar funções sobre colunas filtradas no `WHERE` (`YEAR()`, `CONVERT()`, `LEFT()`, `CAST` em coluna).
- **Padrões diff:** `WHERE` com `CONVERT(`, `YEAR(`, `MONTH(`, `LEFT(`, `CAST(` aplicado a nome de coluna em hunks `+`
- **Contexto:** T-SQL
- **Exemplos:** [G11](DBA_EXEMPLOS.md#g11)

### G12 — NOLOCK sem Justificativa

- **Severidade:** ATENÇÃO
- **Regra:** `WITH (NOLOCK)` exige comentário técnico justificando leitura suja.
- **Padrões diff:** `NOLOCK` ou `(NOLOCK)` em hunks `+` sem comentário `--` na mesma linha ou linha anterior
- **Contexto:** T-SQL
- **Exemplos:** [G12](DBA_EXEMPLOS.md#g12)

### G13 — Lógica em Tabelas

- **Severidade:** CRÍTICO
- **Regra:** Proibido colunas calculadas persistidas ou Scalar UDF usadas diretamente em tabelas.
- **Padrões diff:** `ALTER TABLE` + `ADD` coluna `AS (` calculada; `CREATE FUNCTION` escalar + uso em `DEFAULT`/`COMPUTED` de tabela
- **Contexto:** DDL SQL
- **Exemplos:** [G13](DBA_EXEMPLOS.md#g13)

### G14 — Operações sem Filtro

- **Severidade:** CRÍTICO
- **Regra:** `UPDATE`/`DELETE` devem ter `WHERE` seguro no mesmo contexto.
- **Padrões diff:** `UPDATE` ou `DELETE` em hunks `+` sem `WHERE` visível no mesmo statement
- **Contexto:** T-SQL ou SQL inline (G01)
- **Exemplos:** [G14](DBA_EXEMPLOS.md#g14)

### G15 — Idempotência DDL

- **Severidade:** CRÍTICO
- **Regra:** `CREATE`/`ALTER` de `TABLE`, `PROCEDURE`, `INDEX`, etc. com checagem `IF EXISTS` / `OBJECT_ID`.
- **Padrões diff:** `CREATE PROCEDURE`, `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE` em hunks `+` **sem** `IF EXISTS`, `IF OBJECT_ID`, `IF NOT EXISTS` no mesmo script/hunk
- **Contexto:** migrações `.xml`, `.sql`, literais em `.cs`
- **Exemplos:** [G15](DBA_EXEMPLOS.md#g15)

### G16 — Transações de Longa Duração

- **Severidade:** CRÍTICO
- **Regra:** Proibido `BEGIN TRAN`/`BeginTransaction` envolvendo HTTP, arquivos, filas ou serviços externos.
- **Padrões diff:** `BeginTransaction`/`BEGIN TRAN` no mesmo método/arquivo que `httpClient`, `PostAsync`, `GetAsync`, `File.`, `Queue`, `.Result` em I/O externo entre comandos SQL
- **Contexto:** `.cs` com transação
- **Exemplos:** [G16](DBA_EXEMPLOS.md#g16)

### G17 — DDL em Transação de Negócio

- **Severidade:** CRÍTICO
- **Regra:** Proibido DDL (`ALTER TABLE`, `ENABLE/DISABLE TRIGGER`) dentro de transação de lógica de negócio.
- **Padrões diff:** `BEGIN TRAN` + `ALTER TABLE`/`ENABLE TRIGGER`/`DISABLE TRIGGER` no mesmo bloco
- **Contexto:** T-SQL ou C# com transação
- **Exemplos:** [G17](DBA_EXEMPLOS.md#g17)

### G18 — Scripts SQL em `.cs` / legado

- **Severidade:** CRÍTICO
- **Regra:** Proibido versionar ou **alterar** scripts de banco em `.cs` (inclui `**/AtualizacaoBD/Classes/**/*.cs`). Novos objetos e refatorações devem ir para `.xml` com `EmbeddedResource`. *Funde antigo «Scripts de Banco em C#» + «Refatoração de Legado».*
- **Padrões diff:**
  - `CREATE PROCEDURE`, `CREATE FUNCTION`, `CREATE VIEW` em literal dentro de `.cs`
  - **ou** diff em path `AtualizacaoBD/Classes/` (adição/remoção/edição de classe geradora de script)
- **Contexto:** `.cs` de atualização automática de banco
- **Exemplos:** [G18](DBA_EXEMPLOS.md#g18)

### G19 — Configuração de Projeto (csproj)

- **Severidade:** CRÍTICO
- **Regra:** XML de script de banco no diff exige `<EmbeddedResource Include="..." />` no `.csproj`.
- **Padrões diff:** arquivo `.xml` com `<atualizacao-bd>` ou `<ScriptAutomatico>` adicionado; linha `+` em `.csproj` com `<None Include=` para script de banco **sem** `EmbeddedResource` correspondente
- **Contexto:** `.csproj` + scripts XML
- **Exemplos:** [G19](DBA_EXEMPLOS.md#g19)

### G20 — Sincronização de GUID

- **Severidade:** CRÍTICO
- **Regra:** Ao alterar script SQL versionado, o **GUID** de controle deve mudar.
- **Padrões diff:** hunks `+`/`-` em corpo SQL ou `ObterSql()` **sem** alteração correspondente em `Guid`/`guid=` na mesma classe ou XML
- **Contexto:** `AtualizacaoBD/Classes`, `.xml` com `guid=`
- **Exemplos:** [G20](DBA_EXEMPLOS.md#g20)

### G21 — Uso de TVP

- **Severidade:** CRÍTICO quando lista de IDs em `VARCHAR` longo; ATENÇÃO se padrão legado mantido sem alteração
- **Regra:** Listas de IDs devem usar `TYPE` + Table-Valued Parameters, não `VARCHAR(MAX)` + função de parsing.
- **Padrões diff:** `@IdEmpresas VARCHAR`, `FN_SIS_Array(@` em hunks `+`; ausência de `READONLY` TVP onde há lista de IDs nova
- **Contexto:** procedures e chamadas Dapper (`AddTable`)
- **Exemplos:** [G21](DBA_EXEMPLOS.md#g21)

### G22 — FN_SIS_Array e similares

- **Severidade:** CRÍTICO fora do padrão permitido
- **Regra:** `FN_SIS_Array`/`FN_SYS_ARRAY` **somente** para `INSERT INTO #temp (Id) SELECT * FROM função(@lista)`; proibido `JOIN`/`IN`/`CROSS APPLY` direto.
- **Padrões diff:** `FN_SIS_Array`, `FN_SYS_ARRAY` em `JOIN`, `IN (SELECT`, `CROSS APPLY` em hunks `+`
- **Contexto:** T-SQL
- **Exemplos:** [G22](DBA_EXEMPLOS.md#g22)

### G23 — Encapsulamento de Types

- **Severidade:** ATENÇÃO
- **Regra:** `TYPE` exclusivo de procedure: `DROP` + `CREATE` no mesmo arquivo da PC (exceto types globais de ID).
- **Padrões diff:** `CREATE TYPE` em arquivo/script separado da procedure que o consome, sem DROP no mesmo artefato
- **Contexto:** scripts SQL versionados
- **Exemplos:** [G23](DBA_EXEMPLOS.md#g23)

### G24 — Enums/constantes em SQL sem identificação

- **Severidade:** ATENÇÃO
- **Regra:** Literais mágicos em SQL (status, tipo, origem) exigem comentário técnico ou variável nomeada. *Somente SQL — enums C# vão em `GERAL_RULES.md`.*
- **Padrões diff:** `= 0`, `= 1`, `= 2`, `Status =`, `TipoDocumento =` em hunks `+` sem comentário `--` ou variável `@Status` nomeada nas proximidades
- **Contexto:** T-SQL em procedures/functions
- **Exemplos:** [G24](DBA_EXEMPLOS.md#g24)

### G25 — Validação DBA (TRIGGER/INDEX)

- **Severidade:** CRÍTICO (bloqueante até validação DBA)
- **Regra:** `CREATE TRIGGER` ou `CREATE INDEX` (exceto em `#temp`) exige validação prévia do DBA.
- **Padrões diff:** `CREATE TRIGGER`, `CREATE INDEX`, `CREATE NONCLUSTERED` em tabelas permanentes em hunks `+`
- **Contexto:** migrações e scripts SQL
- **Exemplos:** [G25](DBA_EXEMPLOS.md#g25)

---

## Regras complementares

| ID | Nome | Severidade | Quando disparar | Exemplos |
|----|------|------------|-----------------|----------|
| R01 | Timeout explícito Dapper → SP | ATENÇÃO | Diff com `.Query`/`.Execute` + `StoredProcedure` em hunks `+` **sem** `commandTimeout:` | [R01](DBA_EXEMPLOS.md#r01) |

---

## Escopo (resumo)

Aplicar quando o diff tocar: repositórios, Dapper, NHibernate, `.sql`, migrações, procedures, functions, views, triggers, `AtualizacaoBD`.

**Não aplicar aqui:** `Cast<T>`/`OfType`, arquitetura, fiscal/financeiro/vendas, UI — ver `GERAL_RULES.md` e rules de domínio.
