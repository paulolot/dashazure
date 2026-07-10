---
title: Regras arquiteturais
description: Decisões e convenções do monorepo MetaNet (.NET Framework)
author: Equipe MetaNet
alwaysApply: true
---

# design-rules — Regras arquiteturais do monorepo MetaNet

Este arquivo define **decisões arquiteturais e princípios técnicos** para o repositório **MetaNet**: conjunto de solutions e projetos **.NET Framework** (predominantemente **4.8**) que compõem PDV, servidor, integrações e ferramentas.

**Hierarquia de documentos (`.cursor/rules/`):** o **mapa completo** e a ordem sugerida de consulta estão em **`prd.md`** (seção *Mapa de regras do repositório*). Abaixo, visão resumida.

| Documento | Função |
|-----------|--------|
| `prd.md` | Contexto de produto e **índice** dos rules (inclui domínios Fiscal, Financeiro, Vendas) |
| `design-rules.md` | Arquitetura e implementação neste repositório (este arquivo) |
| `cursor-rules.md` | Como o agente deve executar tarefas no Cursor |
| `flow-rules.md` | Fluxos e diagramas |
| `read-models-specification.md` | Read models e status derivados (onde existirem) |
| `security-guide.md` | Segurança |
| `DBA_RULES.md` | Banco de dados (**SQL/persistência apenas** — não acomoda regras transversais de C#) |
| `FISCAL_RULES.md` | Fiscal, SPED, impostos (ver escopo no arquivo) |
| `FINANCEIRO_RULES.md` | Financeiro / contábil (ver escopo no arquivo) |
| `VENDAS_RULES.md` | Vendas / canal comercial (ver escopo no arquivo) |
| `GERAL_RULES.md` | Boas práticas transversais de C#/.NET (CAST/`OfType`, materialização dinâmica, etc.) |
| `test-case.md` | Casos de teste |

Checklists detalhados de **fiscal / financeiro / vendas** não devem ser duplicados neste arquivo — use os `*_RULES.md` correspondentes.

---

## 1. Contexto do repositório

O workspace é um **monorepo** com dezenas/centenas de projetos C#. Não há um único “produto API” no sentido de uma Web API moderna isolada: há **várias solutions** (cada uma com conjunto de projetos e fronteiras de deploy), aplicações desktop (**WinForms** e similares), serviços, bibliotecas compartilhadas e projetos de integração (**APIs** de terceiros, jobs, etc.).

**Observação importante:** o projeto **`MetaAtualizador`** neste repositório é um **executável** (.NET Framework) usado no ecossistema de atualização, com referências como `UtilitariosAtualizacaoAutomatica` e `LogAPI`. **Não** corresponde a uma solução em camadas “Api / Application / Domain / Infrastructure” de outro repositório.

O projeto raiz **`Azure`** (assembly `Azure`) é uma **biblioteca de apoio** (por exemplo criação/restauração de banco via **BACPAC**, enums e comportamentos ligados a **Azure SQL**). **Não** representa “todo o Microsoft Azure” nem um backend serverless deste documento; trate-o como **código de domínio técnico** dentro do monorepo.

---

## 2. Organização em solutions e projetos

### 2.1 Solutions de referência

As principais linhas de produto aparecem como solutions próprias, por exemplo:

- **`MetaNet.sln`** — núcleo amplo: `MetaPosto`, `MetaServerGlobal`, `PDV`, `Business`, `ControllerView`, `View`, serviços e utilitários.
- **`MetaServerGlobal.sln`** — foco no servidor global e dependências associadas.
- **`MetaPosto.sln`**, **`PDV.sln`**, **`GerenciadorPDV.sln`**, **`MetaPista.sln`** — produtos ou frentes específicas.

Cada solution define **quais projetos compilam juntos** e **dependências entre projetos**. Antes de adicionar referência cruzada, prefira seguir o padrão já usado na mesma solution ou em projeto irmão.

### 2.2 Tipos comuns de projeto

| Tipo | Exemplos típicos | Papel |
|------|------------------|--------|
| Aplicação desktop / host | `MetaServerGlobal`, `MetaPosto`, `PDV`, `GerenciadorPDV` | UI, orquestração local, hospedagem de comportamentos |
| Biblioteca de negócio | `Business`, `ContractBusiness` | Regras e contratos reutilizados |
| Dados / persistência | `RepositorioComum`, `RepositorioComumDapper`, `Importacao` | Acesso a SQL e integrações de carga |
| Utilitários | `Utilitarios`, `UtilMetaPosto`, `EspecificacaoGeral` | Helpers compartilhados; cuidado para não virar “god library” |
| Integração / API cliente | `*API` (dezenas de projetos) | Clientes HTTP/SDK para terceiros |
| Jobs / agendamento | `Agendamentos`, `FactoryJobs*`, `Job*` | Tarefas em background e Quartz onde aplicável |
| Web legado | `WEB_*` | ASP.NET WebForms/MVC conforme o projeto |

### 2.3 Padrão `Meta/` em aplicações grandes

Projetos como **`MetaServerGlobal`** concentram grande parte do código sob pastas **`Meta/`**, com subdivisões como:

- `Meta\Servicos\Behaviors\` — comportamentos e fluxos de serviço  
- `Meta\Servicos\Factory\` — fábricas (ex.: `FabricaDeServicos`)  
- `Meta\Controller\`, `Meta\View\` — MVC desktop onde existir  
- `Meta\AtualizacaoBD\` — scripts e rotinas de banco  

Novas funcionalidades devem **seguir a estrutura do projeto em que estão**, em vez de inventar um novo arranjo “tipo DDD” só naquele arquivo.

---

## 3. Fluxo de dependências (regras práticas)

Não há um diagrama único “Api → Application → Domain” para todo o monorepo. Em vez disso:

1. **Respeite referências de projeto existentes** — evite criar ciclos (`A → B → A`).
2. **UI e hosts** (`MetaServerGlobal`, `View`, `ControllerView`, etc.) podem depender de **Business**, **ContractBusiness**, **RepositorioComum**, **Utilitarios**.
3. **Bibliotecas de baixo nível** (`Utilitarios`, `ModeloComum`, etc.) **não** devem depender de executáveis ou de camadas de UI.
4. **Regras de negócio** pertencem a **`Business`** (ou ao módulo `Meta/.../Behaviors` quando for o padrão local), não a formulários como blocos gigantes de lógica sem extração.
5. Ao compartilhar modelos, prefira projetos já usados na solution (**`ModeloComum`**, **`ContractBusiness`**, etc.) em vez de duplicar DTOs entre pastas.

Se uma alteração exigir nova referência entre projetos, **verifique** se outro projeto já resolve o mesmo problema com uma dependência equivalente.

---

## 4. Stack tecnológica (visão geral)

| Área | Tecnologia típica neste repositório |
|------|--------------------------------------|
| Runtime | .NET Framework **4.8** (e variantes em projetos mais antigos) |
| Banco | **Microsoft SQL Server** (scripts, procedures, Dapper/Repositorio conforme o caso) |
| UI | WinForms e stacks legadas associadas |
| Outros | MongoDB em alguns módulos (`BusinessMongoDB`, `UtilitariosMongoDB`), integrações diversas |

**Não** assuma como padrão global: **.NET 8**, **EF Core**, **PostgreSQL** ou **RabbitMQ** — salvo se o projeto específico que você está editando já usar (projeto novo ou exceção documentada).

---

## 5. Princípios de implementação

### 5.1 O que evitar

- **Lógica de negócio pesada em code-behind de formulários** sem passar por camadas já usadas no mesmo projeto (`Behavior`, serviço, `Business`).
- **Magic strings** para status, tipos de documento, códigos de integração: preferir **enums**, constantes centralizadas ou tabelas de domínio já existentes (`EspecificacaoGeral`, enumeradores em `Utilitarios`, etc., conforme o módulo).
- **Duplicar** regras que já existem em `Business` ou em um `Behavior` — extrair ou reutilizar.
- **Logar segredos** (senhas, tokens, chaves de API, connection strings completas). Ver `security-guide.md`.

### 5.2 O que favorecer

- **Consistência com o arquivo vizinho**: nomenclatura, regiões, padrão de `try/catch` e logging já usados no mesmo diretório.
- **Mudanças mínimas e revisáveis**: o monorepo é grande; alterações focadas reduzem risco.
- **Comentários** apenas onde o “porquê” não for óbvio (regra fiscal, workaround de terceiro, limitação de plataforma).
- **Testes** quando o projeto já tiver projeto de testes correspondente; seguir `cursor-rules.md` sobre responsabilidade QA vs Dev.

---

## 6. SQL e scripts

- Scripts e recursos embutidos costumam viver sob **`Meta\AtualizacaoBD\`** ou pastas equivalentes no projeto.
- Respeite convenções de nomenclatura e de versionamento de script já usadas naquele módulo.
- Para regras detalhadas de schema, migração e performance, use **`DBA_RULES.md`** em conjunto com este arquivo.

---

## 7. Integrações e APIs externas

Projetos `*API` costumam encapsular **clientes** para gateways (pagamento, fiscal, terceiros). Ao alterar:

- Mantenha **timeouts e tratamento de erro** alinhados ao restante do cliente.
- **Não** persistir credenciais em claro; use padrões já existentes (config criptografada, cofre, etc. — ver `security-guide.md`).
- Documente contratos alterados apenas se o repositório já tiver o hábito de comentário ou doc no mesmo projeto.

---

## 8. Observabilidade

- Use mecanismos já presentes (**`LogAPI`**, logs do servidor, traces existentes no fluxo).
- Logs devem permitir diagnóstico com **correlação** (empresa, terminal, id de operação) quando o módulo já expuser esses dados.
- Evite `Debug.WriteLine` como único rastro em código de produção novo.

---

## 9. Performance e limites

- Operações em **UI thread**: não bloquear com I/O longo; siga padrões assíncronos **se o projeto já utilizar** esse estilo naquele contexto (muitos trechos são síncronos legados — não refatore amplamente sem pedido).
- Consultas e cargas massivas: paginação e filtros quando aplicável; alinhar com `DBA_RULES.md` para SQL pesado.

---

## 10. Versionamento e compatibilidade

- O monorepo mantém **compatibilidade com instalações existentes** em clientes: mudanças em contratos de rede, arquivo ou banco exigem **cuidado com rollout** e, quando necessário, feature flag ou migração de script.
- APIs REST próprias (quando existirem em subprojetos) devem evitar breaking changes sem estratégia de migração.

---

## 11. Documentação e ADRs

- Documentos em **`.cursor/rules/`** guiam o agente e a equipe; mantenha links relativos consistentes.
- Decisões grandes (troca de padrão em um módulo crítico) podem ser registradas em **`docs/adr/`** na raiz do repositório **se a pasta existir ou for criada**; não é obrigatório para cada alteração pequena.

---

## 12. Objetivo

Manter o monorepo **coerente com seu próprio histórico**: camadas reais (`Business`, `Meta/...`, repositórios), **sem impor** um template de outro produto (por exemplo uma Web API .NET 8 isolada). Prioridade: **comportamento correto**, **baixo risco de regressão** e **clareza para o próximo desenvolvedor**.
