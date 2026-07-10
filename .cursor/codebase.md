# Wiki de Código (Suíte MetaPosto / MetaNet)

## 1. Visão Geral do Projeto

Este repositório é uma base de código .NET com múltiplas soluções que compila uma suíte de aplicações normalmente implantadas em conjunto:

- Aplicações desktop Windows (POS/PDV, launchers, utilitários)
- Um “host de servidor” Windows que pode rodar como WinForms ou como Windows Service (MetaServerGlobal)
- Portais web legados em ASP.NET MVC (System.Web / Global.asax)
- Uma Web API moderna em ASP.NET Core (.NET 6)
- Um grande conjunto de bibliotecas compartilhadas que implementam regras de negócio, persistência, integrações e padrões de UI/controller

Na prática, funciona como um “monólito modular”: muitos projetos compilam em DLLs compartilhadas por um conjunto menor de aplicações host.

## 2. Estrutura do Repositório

Na raiz você encontrará várias solutions do Visual Studio e muitos projetos `*.csproj`:

- Solutions (exemplos): [MetaPosto.sln](file:///c:/Projeto/master%202/MetaPosto.sln), [MetaServerGlobal.sln](file:///c:/Projeto/master%202/MetaServerGlobal.sln), [PDV.sln](file:///c:/Projeto/master%202/PDV.sln)
- Definição do pipeline de build: [azure-pipelines.yml](file:///c:/Projeto/master%202/azure-pipelines.yml)
- Helper de build via linha de comando (caminho local fixo): [build.bat](file:///c:/Projeto/master%202/build.bat)
- Binários de terceiros/nativos: [Dlls](file:///c:/Projeto/master%202/Dlls)
- Cada projeto normalmente possui `app.config` e/ou `packages.config` (restore no padrão NuGet “packages.config”).

## 3. Arquitetura em Alto Nível

### 3.1 Camadas (direção típica de dependências)

- **Aplicações host**
  - Clientes desktop: PDV, MetaNet, MetaPista, etc.
  - Host de servidor: MetaServerGlobal
  - Portais web: WEB_*
  - Web API: MetaServerGlobalWebAPI
- **Camada de aplicação/UI**
  - Projetos de controller (`ControllerView`, `ControllerModel`, etc.) implementam controladores de UI, fábricas de telas e padrões de “behavior” para fluxos do usuário.
- **Camada de domínio/negócio**
  - O projeto `Business` contém a maior parte das regras e orquestrações (“Behavior*Business”).
- **Persistência e infraestrutura**
  - Repositórios Dapper/NHibernate, helpers de MongoDB, jobs Quartz, logging, configuração, segurança/licenciamento.
- **Adaptadores de integração**
  - Projetos `*API` e `Integracao*` encapsulam serviços externos e integrações com parceiros.

### 3.2 Fluxos principais em runtime

- **Boot do MetaServerGlobal**
  - Valida o ambiente, grava/atualiza a configuração gerada, depois constrói um `ServiceContext` via uma fábrica de serviços e inicia os serviços.
  - Suporta execução como Windows Service (`/service`) ou como app WinForms.
- **Boot do PDV**
  - Aplica hotfix do atualizador (se existir), evita execução paralela do atualizador, carrega i18n, valida licença e inicia o fluxo de startup via controller de splash.
- **Tarefas agendadas**
  - O módulo `Agendamentos` roda um loop em background que executa um conjunto de implementações de `ITarefa` montadas por uma fábrica.

## 4. Principais Pontos de Entrada (Executáveis / Hosts)

### 4.1 PDV (cliente POS)

- Entry: [PDV/Program.cs](file:///c:/Projeto/master%202/PDV/Program.cs)
- Responsabilidades:
  - Handoff do atualizador (`AtualizarMetaAtualizador`, `ValidarSeExisteUmaAtualizacaoEmAndamento`)
  - Lê o XML de configuração do PDV e carrega traduções
  - Valida licenciamento (MetaProt)
  - Inicia o fluxo de UI via `ControllerSplash.Run(args)`
- Métodos-chave:
  - `Main(string[] args)` (startup + proteções)
  - `AtualizarMetaAtualizador()` (copia binários mais novos do atualizador de uma pasta temporária para o diretório de trabalho)
  - `ValidarSeExisteUmaAtualizacaoEmAndamento()` (evita atualizador concorrente)

### 4.2 MetaNet (launcher/bootstrapper)

- Entry: [MetaNet/Program.cs](file:///c:/Projeto/master%202/MetaNet/Program.cs)
- Responsabilidades:
  - Garante que `MetaPosto.exe.config` é um XML válido; se for inválido, deleta o arquivo
  - Inicia `MetaPosto.exe`

### 4.3 MetaServerGlobal (host do servidor: WinForms ou Windows Service)

- Entry: [MetaServerGlobal/Program.cs](file:///c:/Projeto/master%202/MetaServerGlobal/Program.cs)
- Responsabilidades:
  - Handoff do atualizador + checagens de licença
  - Garante requisitos de runtime do .NET
  - Carrega a configuração de runtime (`configuracao-msg.xml`)
  - Gera configuração WCF em runtime a partir de um recurso embutido (template) escrito no `.config` efetivo
  - Cria e inicia serviços centrais por meio de uma fábrica (`FabricaDeServicos`)
- Métodos-chave:
  - `Main(string[] args)` (pipeline geral de boot)
  - `ConfiguraAppConfig(...)` (gera e dá refresh nas seções WCF/serviços)
  - `AbrirComoServico(...)` / `AbrirComoAplicacao(...)` (seleção do modo de host)

### 4.4 MetaServerGlobalWebAPI (Web API .NET 6)

- Entry: [MetaServerGlobalWebAPI/Program.cs](file:///c:/Projeto/master%202/MetaServerGlobalWebAPI/Program.cs)
- Startup: [MetaServerGlobalWebAPI/Startup.cs](file:///c:/Projeto/master%202/MetaServerGlobalWebAPI/Startup.cs)
- Projeto: alvo .NET 6 ([MetaServerGlobalWebAPI.csproj](file:///c:/Projeto/master%202/MetaServerGlobalWebAPI/MetaServerGlobalWebAPI.csproj))
- Responsabilidades:
  - Hospeda controllers HTTP de API
  - Configura Swagger
  - Habilita CORS (allow-any)
  - Configura autenticação/autorização via métodos de extensão referenciados no `Startup`
- Observações:
  - O `Startup` chama métodos de extensão como `AddConfiguracaoJwt`, `AddEndPoint`, `AddConfiguracaoInjecaoDependencia` e `AddConfiguracaoSwagger`. As implementações não estão na pasta do projeto Web API; localize-as na solution completa buscando por esses nomes.

### 4.5 Portais Web Legados (ASP.NET MVC / System.Web)

Exemplos de portais que usam `Global.asax`:

- [WEB_GARM/Global.asax](file:///c:/Projeto/master%202/WEB_GARM/Global.asax)
- [WEB_GPRM/Global.asax](file:///c:/Projeto/master%202/WEB_GPRM/Global.asax)
- [Mobilewww/Global.asax](file:///c:/Projeto/master%202/Mobilewww/Global.asax)

Esses projetos seguem o pipeline clássico do System.Web (Global.asax + Web.config + roteamento em App_Start).

## 5. Módulos Principais e Responsabilidades

### 5.1 Business (orquestração de domínio/negócio)

- Projeto: [Business/Business.csproj](file:///c:/Projeto/master%202/Business/Business.csproj)
- Framework alvo: .NET Framework 4.8 (`<TargetFrameworkVersion>v4.8</TargetFrameworkVersion>`)
- Responsabilidades:
  - Behaviors de negócio implementando casos de uso em fiscal, financeiro, PDV, integrações, relatórios, etc.
  - Hub central de dependências: referencia muitos projetos de integração e módulos base (exemplos aparecem em `<ProjectReference>` no csproj).
- Convenções:
  - A maioria dos casos de uso fica em `Business/Meta/Business/Behavior/...` e tem nomes no padrão `*BehaviorBusiness`.

### 5.2 Agendamentos (tarefas agendadas/batch)

- Projeto: [Agendamentos/Agendamentos.csproj](file:///c:/Projeto/master%202/Agendamentos/Agendamentos.csproj)
- Tipos-chave:
  - Fábrica de tarefas: [FabricaTarefa](file:///c:/Projeto/master%202/Agendamentos/Meta/Fabrica/FabricaTarefa.cs)
  - Executor/gerenciador: [GerenciadorAgendamento](file:///c:/Projeto/master%202/Agendamentos/Meta/Contexto/GerenciadorAgendamento.cs)
- Responsabilidades:
  - Define muitas implementações de `ITarefa` agrupadas por modelo de persistência (Dapper, MongoDB, híbrido, etc.)
  - Executa tarefas em um loop em background e aguarda entre ciclos
- Guia de extensão:
  - Para adicionar uma nova tarefa agendada:
    - Implemente `ITarefa` em `Agendamentos.Meta.Tarefa.*`
    - Adicione-a no método apropriado em [FabricaTarefa](file:///c:/Projeto/master%202/Agendamentos/Meta/Fabrica/FabricaTarefa.cs)
    - Garanta que tenha os atributos/metadados corretos (ex.: classificação item/serviço) para que `GerenciadorAgendamento` decida quando executá-la

### 5.3 Serviços do MetaServerGlobal (service behaviors)

- Montagem/fábrica de serviços:
  - [FabricaDeServicos](file:///c:/Projeto/master%202/MetaServerGlobal/Meta/Servicos/Factory/FabricaDeServicos.cs)
- Orquestrador em runtime:
  - [ServiceContext](file:///c:/Projeto/master%202/Server/Meta/Services/Context/ServiceContext.cs)
- Responsabilidades:
  - `FabricaDeServicos` monta uma lista ordenada de `IServiceBehavior` (atualização de BD, persistência, WCF, behaviors em background, etc.)
  - `ServiceContext` inicia/para/reinicia serviços e expõe helpers para a configuração efetiva (`AppConfigPath`, XML de `AppConfig`)
- Comportamento relevante:
  - `FabricaDeServicos` suporta um modo reduzido “somente WCF” quando existe um arquivo sinalizador (`ModoSomenteWCF.CB9`).

### 5.4 Sistema de configuração (MetaServerGlobal)

- Objeto principal de configuração: [MetaServerGlobal.Meta.Configuracoes.Configuracao](file:///c:/Projeto/master%202/MetaServerGlobal/Meta/Configuracoes/Configuracao.cs)
- Arquivo-base: `configuracao-msg.xml` (carregado no startup; suporta campos criptografados)
- O que controla (exemplos):
  - IP do servidor global e portas HTTP/TCP (`PortaHttp`, `PortaTcp`)
  - String de conexão do banco (`StringConexaoBancoDados`), com versionamento de criptografia
  - Configurações de conexão do MongoDB
  - Flags como `VariasInstancias`, nível de log WCF, etc.

### 5.5 Camada de controller (padrões de UI)

Vários projetos implementam um padrão de UI/controller com “factory + behavior”; exemplo de factory:

- [CtrlViewFormularioFactoryServicosGlobal](file:///c:/Projeto/master%202/ControllerView/Meta/Factories/CtrlViewFormularios/Utilitarios/CtrlViewFormularioFactoryServicosGlobal.cs)

Conceitos comuns:

- Classes `CtrlView*` que coordenam um form/view e behaviors
- Classes “Behavior” que encapsulam um workflow (save/search/menu binding)
- Factories que criam instâncias de controller/view com base em um comando enum (`EComando`)

## 6. Relações de Dependência (Conceitual)

Este é um overview conceitual; as referências exatas variam por solution e alvo.

```mermaid
flowchart LR
  subgraph Hosts
    PDV[PDV.exe]
    MSG[MetaServerGlobal.exe/service]
    MN[MetaNet.exe]
    API[MetaServerGlobalWebAPI]
    WEB[WEB_* portals]
  end

  subgraph CoreLibraries
    Util[Utilitarios + Util*]
    Domain[EspecificacaoGeral + Modelo* + Contract*]
    Biz[Business]
    Sched[Agendamentos]
    Server[Server (ServiceContext/IServiceBehavior)]
  end

  subgraph Integrations
    APIs[*API projects]
    Int[*Integracao* projects]
  end

  PDV --> Biz
  PDV --> Util
  MN --> PDV
  MSG --> Server
  MSG --> Biz
  MSG --> Sched
  MSG --> Util
  Biz --> Domain
  Biz --> APIs
  Biz --> Int
  Sched --> Biz
  Sched --> Util
  API --> Biz
  API --> Util
  WEB --> Biz
  WEB --> Util
```

## 7. Dependências Externas (Observadas)

O repositório mistura NuGet (packages.config) e binários distribuídos pelo vendor em `Dlls/`.

Bibliotecas usadas com frequência:

- DevExpress 13.2 (UI/relatórios) — referenciada em múltiplos projetos e citada em [README.txt](file:///c:/Projeto/master%202/README.txt)
- Dapper (acesso a SQL)
- NHibernate (ORM / mappings)
- MongoDB.Driver (persistência MongoDB)
- Newtonsoft.Json
- Existem módulos relacionados a Quartz (ex.: `AgendadorJobsQuartz` e `FactoryJobsQuartzMetaServerGlobal`)
- WCF (System.ServiceModel) com bindings HTTP e net.tcp (muitos templates de endpoints ficam em arquivos `AppConfig.ini`)

## 8. Build e Execução

### 8.1 Pré-requisitos (a partir da documentação do repo e definições de build)

Com base em [README.txt](file:///c:/Projeto/master%202/README.txt) e [azure-pipelines.yml](file:///c:/Projeto/master%202/azure-pipelines.yml):

- Visual Studio com workloads de .NET desktop + ASP.NET
- SQL Server (desenvolvimento local costuma usar SQL Server 2017 Developer conforme README)
- MongoDB Community Edition (usado por Business/Agendamentos)
- DevExpress 13.2 (muitos projetos referenciam)
- Suporte a restore do NuGet (padrão packages.config)

### 8.2 Escolhendo a solution correta

Escolha a solution que corresponde ao que você quer rodar:

- Host de servidor: [MetaServerGlobal.sln](file:///c:/Projeto/master%202/MetaServerGlobal.sln)
- Cliente POS: [PDV.sln](file:///c:/Projeto/master%202/PDV.sln)
- Suíte completa: [MetaPosto.sln](file:///c:/Projeto/master%202/MetaPosto.sln)

### 8.3 Build (Visual Studio)

- Abra a solution (`*.sln`) no Visual Studio
- Restaure os pacotes NuGet (muitos projetos dependem de `packages.config`)
- Faça o build na configuração/plataforma necessária (o CI compila x86 e x64 em algumas solutions)

### 8.4 Build (referência do CI / script)

O pipeline do Azure é a “fonte de verdade” mais confiável para build de todos os artefatos:

- Restaura pacotes para `**/MetaNet.sln`
- Compila solutions de forma sequencial e gera ZIPs:
  - `MetaServerGlobal.sln` (x86 + x64)
  - `MetaPosto.sln` (x86 + x64)
  - `GerenciadorPDV.sln` (x86)
  - `PDV.sln` (x86)
  - `MetaPista.sln` (x86)
  - `MetaImportador.sln` (Any CPU)
  - Ver [azure-pipelines.yml](file:///c:/Projeto/master%202/azure-pipelines.yml)

O helper local [build.bat](file:///c:/Projeto/master%202/build.bat) é um exemplo de invocação do MSBuild, mas contém caminho específico de máquina e não é portável sem ajustes.

### 8.5 Executando o MetaServerGlobal

- Garanta que `configuracao-msg.xml` exista e seja válido no diretório de trabalho (ver `NomeArquivoConfiguracao` em [Configuracao.cs](file:///c:/Projeto/master%202/MetaServerGlobal/Meta/Configuracoes/Configuracao.cs))
- Iniciar como app WinForms:
  - Execute `MetaServerGlobal.exe`
- Iniciar como Windows Service mode:
  - Execute `MetaServerGlobal.exe /service` (ver [Program.Main](file:///c:/Projeto/master%202/MetaServerGlobal/Program.cs))

### 8.6 Executando o PDV

- Execute `PDV.exe` com os argumentos esperados (se sua ferramenta de implantação exigir)
- Garanta que o XML de configuração exista e contenha o atributo `idioma` (o startup lê e faz parse em [PDV/Program.cs](file:///c:/Projeto/master%202/PDV/Program.cs))
- Garanta que as dependências de licenciamento (MetaProt) estejam configuradas corretamente no seu ambiente

### 8.7 Executando o MetaServerGlobalWebAPI

- O projeto tem alvo .NET 6 ([MetaServerGlobalWebAPI.csproj](file:///c:/Projeto/master%202/MetaServerGlobalWebAPI/MetaServerGlobalWebAPI.csproj))
- Configurações de runtime:
  - [appsettings.json](file:///c:/Projeto/master%202/MetaServerGlobalWebAPI/appsettings.json)
  - [launchSettings.json](file:///c:/Projeto/master%202/MetaServerGlobalWebAPI/Properties/launchSettings.json)
- Para rodar localmente, é necessário ter um runtime/SDK .NET 6+ disponível na máquina.

## 9. Guia Prático de Navegação

Para entender ou modificar o comportamento com segurança, uma boa ordem de leitura é:

- Build + orquestração de solutions: [azure-pipelines.yml](file:///c:/Projeto/master%202/azure-pipelines.yml), [README.txt](file:///c:/Projeto/master%202/README.txt)
- Boot do servidor e geração de configuração: [MetaServerGlobal/Program.cs](file:///c:/Projeto/master%202/MetaServerGlobal/Program.cs), [Configuracao.cs](file:///c:/Projeto/master%202/MetaServerGlobal/Meta/Configuracoes/Configuracao.cs)
- Composição de serviços do servidor: [FabricaDeServicos](file:///c:/Projeto/master%202/MetaServerGlobal/Meta/Servicos/Factory/FabricaDeServicos.cs), [ServiceContext](file:///c:/Projeto/master%202/Server/Meta/Services/Context/ServiceContext.cs)
- Scheduler: [GerenciadorAgendamento](file:///c:/Projeto/master%202/Agendamentos/Meta/Contexto/GerenciadorAgendamento.cs), [FabricaTarefa](file:///c:/Projeto/master%202/Agendamentos/Meta/Fabrica/FabricaTarefa.cs)
- Startup do PDV e proteções de atualizador/licença: [PDV/Program.cs](file:///c:/Projeto/master%202/PDV/Program.cs)

