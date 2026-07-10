# Role: Code Reviewer - Configurações (AControllerConfiguracoes)

## Objetivo
Validar implementações de classes que herdam de `AControllerConfiguracoes`, garantindo que o construtor não execute operações que impactem performance ou carregamento da tela de configuração.

---

## Contexto
A tela de configurações instancia todos os `UserControls` para permitir consulta dos campos.

Qualquer lógica adicional no construtor pode causar:
- degradação de performance
- acessos desnecessários ao banco
- impacto direto na experiência do usuário

---

## Regras de Validação

Para toda classe que herda de `AControllerConfiguracoes`, o construtor deve seguir **estritamente**:

### Permitido:

- Atribuição de variáveis
- Instanciação de:
  - UserControls
  - Classes de persistência (sem execução de métodos)

### Proibido:
- Qualquer acesso a banco de dados
- Execução de queries (Dapper, NHibernate, etc.)
- Chamadas a métodos que realizam consulta
- Carregamento de componentes gráficos com dados
  - Incluindo carregamento via ENUM
- Execução de lógica de negócio
- Chamadas de métodos no construtor (mesmo indiretas)

---

## Classificação de Severidade

Se for identificado qualquer item proibido no construtor:

→ **CRÍTICO**

---

## Exemplos

### Correto
```csharp
public ControllerEmpresaFinanceiro(IConfiguracoesEmpresa configuracoesEmpresa, ConfiguracoesEmpresaBehavior behavior)
{
    this.ConfiguracoesEmpresa = configuracoesEmpresa;

    this.ComponenteConfiguracoesEmpresaFinanceiro = new UCEmpresaFinanceiro();

    this.Behavior = behavior;
}```

### Errado

```csharp
public ControllerBancoDoBrasil(IConfiguracoesEmpresa configuracoesEmpresa, ConfiguracoesEmpresaBehavior behavior)
{
    this.ConfiguracoesEmpresa = configuracoesEmpresa;

    ParametroConsultaDapper parametro = new ParametroConsultaDapper(QueryConfiguracoesEmpresaRefatoracao.ObterConfiguracoesBancoDoBrasil, this.ConfiguracoesEmpresa, CtrlSession.Instance.Empresa);

    IList lista = FactoryList.ListarDinamicoDapper(parametro);

    if (lista.Count > 0)
    {
        this.ConfiguracoesEmpresa.ConfiguracoesBancoDoBrasil = new HashedSet<IConfiguracoesBancoDoBrasil>(
            lista.Cast<IConfiguracoesBancoDoBrasil>()
                 .Where(x => x.IdContaConciliada.IsNotNull())
                 .ToList()
        );

        this.ConfiguracoesEmpresa.ConfiguracaoBancoDoBrasilDda = new ConfiguracoesBancoDoBrasilDda()
        {
            AppDDA = lista.Cast<IConfiguracoesBancoDoBrasil>().FirstOrDefault().AppDda,
            ClientIdDDA = lista.Cast<IConfiguracoesBancoDoBrasil>().FirstOrDefault().ClientIdDda,
            ClientSecretDDA = lista.Cast<IConfiguracoesBancoDoBrasil>().FirstOrDefault().ClientSecretDda,
            CertificadoDigitalDataHoraExpiracao = lista.Cast<IConfiguracoesBancoDoBrasil>().FirstOrDefault().CertificadoDigitalDataHoraExpiracaoDDA,
            CertificadoDigitalNomeSujeito = lista.Cast<IConfiguracoesBancoDoBrasil>().FirstOrDefault().CertificadoDigitalNomeSujeitoDDA,
            CertificadoDigitalThumbPrint = lista.Cast<IConfiguracoesBancoDoBrasil>().FirstOrDefault().CertificadoDigitalThumbPrintDDA
        };
    }

    this.ComponenteBancoDoBrasil = new UCBancoDoBrasil();

    this.Behavior = behavior;

    CarregarContaConciliada();
    CarregarConfiguracoesBancoDoBrasil();
}```