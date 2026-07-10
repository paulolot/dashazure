---
title: Especificação de Read Models (Status Derivados)
description: Regras de cálculo de status para interfaces de usuário
author: Paulo Lot
version: 1.0
date: 2025-02-06
---

# read-models-specification.md — Especificação de Read Models

> Este documento define **regras obrigatórias** para cálculo de **status derivados** exibidos nas interfaces de usuário.
>
> **Princípios fundamentais:**
> - Status derivados são **exclusivamente para leitura (read models)**
> - Status derivados **NÃO são persistidos** no banco de dados
> - Status derivados **NÃO dirigem regras de negócio** ou fluxos do sistema
> - Status derivados **NÃO substituem enums do domínio**
> - Frontend **consome, não calcula** — toda lógica está na camada Application
>
> **Hierarquia de documentos:**
> - Este documento **complementa** `design-rules.md` (seção 12)
> - Baseado nas regras de negócio do `prd.md`

---

## 1. CONCEITOS FUNDAMENTAIS

### 1.1 O que são Status Derivados?

Status derivados são **valores calculados em tempo de consulta** a partir do estado persistido no banco de dados. Servem exclusivamente para:
- Exibição em dashboards
- Indicadores visuais (cores, ícones)
- Filtros e agrupamentos na UI
- Relatórios e exportações

### 1.2 Implementação

**Onde calcular:**
```
Application/
├── Companies/
│   └── Queries/
│       ├── GetCompanyStatus/
│       │   ├── GetCompanyStatusQuery.cs
│       │   └── GetCompanyStatusQueryHandler.cs  ← Calcula status
│       └── GetCompanyDashboard/
│           ├── GetCompanyDashboardQuery.cs
│           └── GetCompanyDashboardQueryHandler.cs  ← Calcula status
```

**Como calcular:**
- Queries buscam dados persistidos (planos, comandos, agentes, módulos)
- Handler aplica regras de cálculo (definidas neste documento)
- Retorna DTO com status derivado já calculado

**Exemplo:**
```csharp
public class GetCompanyStatusQueryHandler : IQueryHandler<GetCompanyStatusQuery, CompanyStatusDto>
{
    public async Task<CompanyStatusDto> Handle(GetCompanyStatusQuery query, CancellationToken ct)
    {
        var company = await _queries.GetCompanyAsync(query.CompanyId);
        var activePlan = await _queries.GetActivePlanAsync(query.CompanyId);
        var lastPlan = await _queries.GetLastCompletedOrFailedPlanAsync(query.CompanyId);
        var activeVersion = await _queries.GetActiveSystemVersionAsync();
        
        // Aplica regras de cálculo (seção 2 deste documento)
        var status = CalculateCompanyStatus(company, activePlan, lastPlan, activeVersion);
        
        return new CompanyStatusDto 
        { 
            CompanyId = company.Id,
            CompanyName = company.NomeFantasia,
            Status = status,
            DistributionVersion = activeVersion?.Version,
            // ... outros campos
        };
    }
    
    private string CalculateCompanyStatus(
        Company company,
        CompanyUpdatePlan? activePlan,
        CompanyUpdatePlan? lastPlan,
        SystemVersion? activeVersion)
    {
        // Implementação das regras da seção 2.2
    }
}
```

---

## 2. STATUS DA EMPRESA

### 2.1 Conceitos Base

| Conceito | Definição | Fonte |
|----------|-----------|-------|
| **Plano Ativo** | `CompanyUpdatePlan` com status `PENDING` ou `RUNNING` | Banco de dados |
| **Último Plano** | Plano mais recente com status `COMPLETED` ou `FAILED` | Banco de dados |
| **Versão Ativa do Sistema** | `SystemVersion` com `IsActive = true` | Banco de dados |
| **Versão Global da Empresa** | Versão ativa do módulo `MetaServerGlobal` em todos os agentes online | Agregação de `AgentModule.ActiveVersion` |
| **Estado IDLE** | Empresa sem plano ativo (estado lógico, não persistido) | Derivado |

### 2.2 Regras de Cálculo

#### 2.2.1 Cenário 1: Empresa COM Plano Ativo

| Condição | Status Derivado | Descrição |
|----------|----------------|-----------|
| Existe plano com status `PENDING` ou `RUNNING` | **Atualizando** | Atualização em andamento |

**Implementação:**
```csharp
if (activePlan != null)
{
    return "Atualizando";
}
```

#### 2.2.2 Cenário 2: Empresa SEM Plano Ativo (IDLE)

**Ordem de avaliação:**
1. Verifica falha no último plano
2. Verifica versão global vs. versão disponível
3. Verifica resultado dos módulos no último plano

| Condição | Status Derivado | Descrição |
|----------|----------------|-----------|
| `lastPlan.Status == FAILED` | **Atualização Falhou** | Última tentativa de atualização falhou |
| `globalVersion == activeSystemVersion` AND `lastPlan.Status == COMPLETED` AND **todos os módulos** concluídos com sucesso | **Atualizado** | Empresa totalmente atualizada |
| `globalVersion == activeSystemVersion` AND `lastPlan.Status == COMPLETED` AND **pelo menos um módulo** falhou | **Atualizado Parcialmente** | Atualização com falhas parciais |
| `globalVersion < activeSystemVersion` | **Pendente Atualização** | Nova versão disponível |

**Implementação:**
```csharp
// Empresa IDLE (sem plano ativo)
if (lastPlan == null)
{
    return "Pendente Atualização";
}

if (lastPlan.Status == CompanyUpdatePlanStatus.FAILED)
{
    return "Atualização Falhou";
}

// Buscar versão global (MetaServerGlobal) da empresa
var globalVersion = await _queries.GetCompanyGlobalVersionAsync(company.Id);
var activeSystemVersion = activeVersion?.Version;

if (globalVersion == null || activeSystemVersion == null)
{
    return "Pendente Atualização";
}

if (globalVersion == activeSystemVersion)
{
    if (lastPlan.Status == CompanyUpdatePlanStatus.COMPLETED)
    {
        // Verificar se todos os stages foram bem-sucedidos
        var hasFailedStages = await _queries.HasFailedStagesAsync(lastPlan.Id);
        
        if (!hasFailedStages)
        {
            return "Atualizado";
        }
        else
        {
            return "Atualizado Parcialmente";
        }
    }
}

if (CompareVersions(globalVersion, activeSystemVersion) < 0)
{
    return "Pendente Atualização";
}

return "Pendente Atualização"; // fallback
```

### 2.3 Validações e Edge Cases

| Cenário | Comportamento |
|---------|---------------|
| Empresa sem agentes | Retornar `"Pendente Atualização"` |
| Empresa sem planos (nunca atualizada) | Retornar `"Pendente Atualização"` |
| Versão do sistema não definida (`IsActive = false` em todas) | Retornar `"Pendente Atualização"` |
| Versão global não identificável (agentes offline) | Retornar último status conhecido ou `"Offline"` |
| Plano COMPLETED mas sem stages | Tratar como `"Atualizado Parcialmente"` |

---

## 3. STATUS DO AGENTE

### 3.1 Conceitos Base

| Conceito | Definição | Fonte |
|----------|-----------|-------|
| **Heartbeat SLA** | 10 minutos (`AgentPolicy.OfflineThreshold`) | Constante do domínio |
| **Online** | `LastHeartbeatAt >= (NOW() - 10 minutos)` | Cálculo em runtime |
| **Offline** | `LastHeartbeatAt < (NOW() - 10 minutos)` | Cálculo em runtime |
| **Comando Ativo** | `AgentCommand` com status `IN_PROGRESS` para o agente | Banco de dados |

### 3.2 Regras de Cálculo

**Ordem de prioridade (avaliação sequencial):**
1. **Offline** (maior prioridade)
2. **Atualizando**
3. **Online** (default)

| Condição | Status Derivado | Descrição |
|----------|----------------|-----------|
| `LastHeartbeatAt < (NOW() - 10 min)` | **Offline** | Agente sem comunicação |
| Existe `AgentCommand` com status `IN_PROGRESS` | **Atualizando** | Atualização em execução |
| `LastHeartbeatAt >= (NOW() - 10 min)` | **Online** | Agente funcionando normalmente |

**Implementação:**
```csharp
private string CalculateAgentStatus(Agent agent, bool hasActiveCommand)
{
    var now = DateTime.UtcNow;
    var threshold = TimeSpan.FromMinutes(AgentPolicy.OfflineThreshold);
    
    // 1. Verifica offline (maior prioridade)
    if (agent.LastHeartbeatAt == null || (now - agent.LastHeartbeatAt.Value) > threshold)
    {
        return "Offline";
    }
    
    // 2. Verifica se está atualizando
    if (hasActiveCommand)
    {
        return "Atualizando";
    }
    
    // 3. Default
    return "Online";
}
```

### 3.3 Casos Especiais

| Cenário | Comportamento |
|---------|---------------|
| Agente nunca enviou heartbeat (`LastHeartbeatAt = null`) | Considerar **Offline** |
| Agente com múltiplos comandos `IN_PROGRESS` | Status permanece **Atualizando** |
| Agente offline com comando `IN_PROGRESS` | **Offline** (prioridade) |

---

## 4. STATUS DOS MÓDULOS DO AGENTE

### 4.1 Conceitos Base

| Conceito | Definição | Fonte |
|----------|-----------|-------|
| **Versão Ativa** | `AgentModule.ActiveVersion` | Banco de dados |
| **Versão de Distribuição** | Versão alvo do plano ou `SystemVersion.Version` ativa | Banco de dados |
| **Comando Ativo** | `AgentCommand` com `IN_PROGRESS` para o módulo específico | Banco de dados |
| **Último Comando** | Comando mais recente (por `CreatedAt`) para o módulo | Banco de dados |

### 4.2 Regras de Cálculo

**Ordem de avaliação (sequencial):**
1. **Atualizando** (comando em execução)
2. **Falha na Atualização** (último comando falhou)
3. **Atualizado** (versão ativa == versão de distribuição)
4. **Atualização Pendente** (versão ativa < versão de distribuição)

| Condição | Status Derivado | Cor Sugerida | Descrição |
|----------|----------------|--------------|-----------|
| Existe `AgentCommand` com `IN_PROGRESS` para o módulo | **Atualizando** | Amarelo | Atualização em andamento |
| Último comando do módulo com status `FAILED` | **Falha na Atualização** | Vermelho | Última tentativa falhou |
| `ActiveVersion == DistributionVersion` | **Atualizado** | Verde | Módulo na versão esperada |
| `ActiveVersion < DistributionVersion` | **Atualização Pendente** | Azul | Nova versão disponível |

**Implementação:**
```csharp
private string CalculateModuleStatus(
    AgentModule module,
    string distributionVersion,
    bool hasActiveCommand,
    AgentCommand? lastCommand)
{
    // 1. Comando em execução (maior prioridade)
    if (hasActiveCommand)
    {
        return "Atualizando";
    }
    
    // 2. Último comando falhou
    if (lastCommand?.Status == AgentCommandStatus.FAILED)
    {
        return "Falha na Atualização";
    }
    
    // 3. Versão ativa == versão de distribuição
    if (module.ActiveVersion == distributionVersion)
    {
        return "Atualizado";
    }
    
    // 4. Versão ativa < versão de distribuição
    if (CompareVersions(module.ActiveVersion, distributionVersion) < 0)
    {
        return "Atualização Pendente";
    }
    
    // 5. Fallback (versão ativa > distribuição, caso raro)
    return "Atualizado";
}
```

### 4.3 Casos Especiais

| Cenário | Comportamento |
|---------|---------------|
| Módulo sem versão ativa (`ActiveVersion = null`) | Retornar `"Atualização Pendente"` |
| Módulo sem comando registrado | Avaliar apenas versões (itens 3 e 4 da tabela) |
| Versão ativa > versão de distribuição | Considerar `"Atualizado"` (downgrade não é caso normal) |
| Comando `EXPIRED` como último | Tratar como `"Atualização Pendente"` |
| Múltiplos comandos `IN_PROGRESS` para o módulo | Status permanece `"Atualizando"` |

---

## 5. STATUS DO PLANO DE ATUALIZAÇÃO

### 5.1 Conceitos Base

| Conceito | Definição | Fonte |
|----------|-----------|-------|
| **Status do Plano** | `CompanyUpdatePlan.Status` (enum persistido) | Banco de dados |
| **Stages do Plano** | Coleção de `CompanyUpdateStage` | Banco de dados |

### 5.2 Status Derivados do Plano

**Importante:** O status do plano (`CompanyUpdatePlanStatus`) **É persistido** e **NÃO é derivado**. No entanto, alguns indicadores visuais podem ser derivados:

| Indicador Derivado | Condição | Uso |
|-------------------|----------|-----|
| **Progresso Percentual** | `(stages COMPLETED / total stages) * 100` | Barra de progresso |
| **Tempo Decorrido** | `NOW() - StartedAt` | Tempo em execução |
| **Tempo Estimado** | Média de tempo por stage * stages restantes | Estimativa de conclusão |
| **Taxa de Sucesso** | `(comandos SUCCESS / total comandos) * 100` | Indicador de qualidade |

**Implementação (exemplo - progresso):**
```csharp
private decimal CalculatePlanProgress(Guid planId)
{
    var stages = await _queries.GetPlanStagesAsync(planId);
    var totalStages = stages.Count;
    
    if (totalStages == 0) return 0;
    
    var completedStages = stages.Count(s => s.Status == CompanyUpdateStageStatus.COMPLETED);
    
    return (decimal)completedStages / totalStages * 100;
}
```

---

## 6. AGREGAÇÕES E CONTADORES

### 6.1 Dashboard da Empresa

Status derivados agregados para dashboard:

| Métrica | Cálculo | Query |
|---------|---------|-------|
| **Total de Agentes** | `COUNT(Agent WHERE CompanyId = X)` | Simples |
| **Agentes Online** | `COUNT(Agent WHERE CompanyId = X AND LastHeartbeatAt >= NOW() - 10min)` | Com threshold |
| **Agentes Offline** | `COUNT(Agent WHERE CompanyId = X AND LastHeartbeatAt < NOW() - 10min OR LastHeartbeatAt IS NULL)` | Com threshold |
| **Agentes Atualizando** | `COUNT(DISTINCT AgentId FROM AgentCommand WHERE Status = IN_PROGRESS AND Agent.CompanyId = X)` | Com JOIN |
| **Módulos Atualizados** | `COUNT(AgentModule WHERE ActiveVersion = DistributionVersion)` | Comparação de versões |
| **Módulos Pendentes** | `COUNT(AgentModule WHERE ActiveVersion < DistributionVersion)` | Comparação de versões |

**Implementação:**
```csharp
public async Task<CompanyDashboardDto> Handle(GetCompanyDashboardQuery query, CancellationToken ct)
{
    var company = await _queries.GetCompanyAsync(query.CompanyId);
    var agents = await _queries.GetCompanyAgentsAsync(query.CompanyId);
    var now = DateTime.UtcNow;
    var threshold = TimeSpan.FromMinutes(AgentPolicy.OfflineThreshold);
    
    var agentsOnline = agents.Count(a => 
        a.LastHeartbeatAt.HasValue && 
        (now - a.LastHeartbeatAt.Value) <= threshold);
    
    var agentsOffline = agents.Count - agentsOnline;
    
    var agentsUpdating = await _queries.CountAgentsWithActiveCommandsAsync(query.CompanyId);
    
    var activePlan = await _queries.GetActivePlanAsync(query.CompanyId);
    var lastPlan = await _queries.GetLastCompletedOrFailedPlanAsync(query.CompanyId);
    var activeVersion = await _queries.GetActiveSystemVersionAsync();
    
    var status = CalculateCompanyStatus(company, activePlan, lastPlan, activeVersion);
    
    return new CompanyDashboardDto
    {
        CompanyId = company.Id,
        CompanyName = company.NomeFantasia,
        Status = status,
        DistributionVersion = activeVersion?.Version,
        TotalAgents = agents.Count,
        AgentsOnline = agentsOnline,
        AgentsOffline = agentsOffline,
        AgentsUpdating = agentsUpdating,
        LastPlanStartedAt = lastPlan?.StartedAt,
        LastPlanFinishedAt = lastPlan?.FinishedAt
    };
}
```

---

## 7. PERFORMANCE E OTIMIZAÇÃO

### 7.1 Queries Eficientes

**Evitar:**
- N+1 queries (buscar agentes individualmente)
- Carregar entidades completas quando só precisa de status
- Cálculos em loop (use agregação SQL)

**Preferir:**
```sql
-- ✅ CORRETO: Agregação no banco
SELECT 
    COUNT(*) FILTER (WHERE LastHeartbeatAt >= NOW() - INTERVAL '10 minutes') AS online,
    COUNT(*) FILTER (WHERE LastHeartbeatAt < NOW() - INTERVAL '10 minutes' OR LastHeartbeatAt IS NULL) AS offline
FROM Agents
WHERE CompanyId = @companyId;

-- ❌ ERRADO: Buscar todos e calcular em memória
var agents = await _context.Agents.Where(a => a.CompanyId == companyId).ToListAsync();
var online = agents.Count(a => IsOnline(a));
```

### 7.2 Caching (Futuro)

Status derivados podem ser **cacheados** quando a atualização não precisa ser em tempo real:
- Dashboard geral (pode ter 30s-1min de delay)
- Listagens paginadas
- Relatórios

**Não cachear:**
- Status individual de agente (polling frequente)
- Status de comando (muda rapidamente)
- Progresso de plano ativo

---

## 8. TESTES E VALIDAÇÃO

### 8.1 Casos de Teste Obrigatórios

Para cada status derivado, criar testes que validem:

#### Status da Empresa
- [ ] Empresa com plano ativo retorna "Atualizando"
- [ ] Empresa IDLE com último plano FAILED retorna "Atualização Falhou"
- [ ] Empresa IDLE com versão global igual à ativa e plano COMPLETED sem falhas retorna "Atualizado"
- [ ] Empresa IDLE com versão global igual à ativa e plano COMPLETED com falhas retorna "Atualizado Parcialmente"
- [ ] Empresa IDLE com versão global < ativa retorna "Pendente Atualização"
- [ ] Empresa sem agentes retorna "Pendente Atualização"
- [ ] Empresa sem planos retorna "Pendente Atualização"

#### Status do Agente
- [ ] Agente com heartbeat recente e sem comando ativo retorna "Online"
- [ ] Agente com heartbeat antigo retorna "Offline"
- [ ] Agente com comando IN_PROGRESS retorna "Atualizando"
- [ ] Agente offline com comando IN_PROGRESS retorna "Offline" (prioridade)
- [ ] Agente sem heartbeat retorna "Offline"

#### Status do Módulo
- [ ] Módulo com comando IN_PROGRESS retorna "Atualizando"
- [ ] Módulo com último comando FAILED retorna "Falha na Atualização"
- [ ] Módulo com ActiveVersion == DistributionVersion retorna "Atualizado"
- [ ] Módulo com ActiveVersion < DistributionVersion retorna "Atualização Pendente"
- [ ] Módulo sem versão ativa retorna "Atualização Pendente"

### 8.2 Testes de Performance

- [ ] Query de dashboard completa em < 500ms (100 agentes)
- [ ] Query de dashboard completa em < 2s (1000 agentes)
- [ ] Listagem de agentes com status completa em < 1s (paginada)
- [ ] Cálculo de status não causa N+1 queries

---

## 9. CONVENÇÕES DE NOMENCLATURA

### 9.1 Status Derivados (Strings)

**Padrão:** PascalCase com espaços

| Contexto | Status Válidos |
|----------|----------------|
| **Empresa** | `"Atualizado"`, `"Pendente Atualização"`, `"Atualizando"`, `"Atualizado Parcialmente"`, `"Atualização Falhou"` |
| **Agente** | `"Online"`, `"Atualizando"`, `"Offline"` |
| **Módulo** | `"Atualizado"`, `"Atualização Pendente"`, `"Atualizando"`, `"Falha na Atualização"` |

**Observação:** Usar strings literais (não enums) para status derivados, pois não são persistidos.

### 9.2 Métodos de Cálculo

**Padrão:** `Calculate{Entity}Status`

```csharp
private string CalculateCompanyStatus(...)
private string CalculateAgentStatus(...)
private string CalculateModuleStatus(...)
```

### 9.3 DTOs de Resposta

**Padrão:** `{Entity}StatusDto` ou `{Entity}DashboardDto`

```csharp
public class CompanyStatusDto
{
    public Guid CompanyId { get; set; }
    public string CompanyName { get; set; }
    public string Status { get; set; }  // Status derivado
    public string? DistributionVersion { get; set; }
}

public class AgentStatusDto
{
    public Guid AgentId { get; set; }
    public string CnpjCliente { get; set; }
    public DateTime? LastHeartbeatAt { get; set; }
    public string Status { get; set; }  // Status derivado
}
```

---

## 10. EVOLUÇÃO E MANUTENÇÃO

### 10.1 Quando Adicionar Novo Status Derivado

1. Validar se é realmente necessário (não proliferar status desnecessários)
2. Documentar neste arquivo (adicionar nova seção)
3. Implementar na camada Application (Query Handler)
4. Criar testes unitários e de integração
5. Atualizar documentação de API (Swagger)

### 10.2 Quando Modificar Status Existente

1. Validar impacto no frontend (breaking change?)
2. Considerar versionamento de API se necessário
3. Atualizar este documento
4. Atualizar testes
5. Comunicar mudança ao time de frontend

### 10.3 Monitoramento

Adicionar métricas para:
- Tempo de execução de queries de status
- Taxa de cache hit/miss (quando implementado)
- Queries mais lentas (performance)

---

## RESUMO

| Status | Persistido? | Camada de Cálculo | Usa em Regras de Negócio? |
|--------|-------------|-------------------|---------------------------|
| `CompanyUpdatePlanStatus` (enum) | ✅ Sim | Domain | ✅ Sim |
| `AgentCommandStatus` (enum) | ✅ Sim | Domain | ✅ Sim |
| Status da Empresa (string) | ❌ Não | Application (Query) | ❌ Não |
| Status do Agente (string) | ❌ Não | Application (Query) | ❌ Não |
| Status do Módulo (string) | ❌ Não | Application (Query) | ❌ Não |

**Regra de ouro:** Se o status **dirige um fluxo de negócio**, ele deve ser **persistido (enum)**. Se é apenas **para exibição**, ele deve ser **derivado (string calculada)**.

---

## REFERÊNCIAS

- `prd.md` — Seções 3.6, 3.7 (regras de planos e stages)
- `design-rules.md` — Seção 12 (status derivados, visão geral)
- `flow-rules.md` — Seção 5 (estados de comando)
- `test-case.md` — TC-CO-004, TC-AG-003 (testes de status)
