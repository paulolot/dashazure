---
title: Guia de Segurança
description: Diretrizes de segurança, autenticação e auditoria
author: Arquitetura - Meta Atualizador
version: 1.0
date: 2025-02-06
---

# security-guide.md — Guia de Segurança do Meta Atualizador API

> Este documento define **políticas de segurança obrigatórias** para o Meta Atualizador API.
>
> **Escopo:**
> - Autenticação e autorização
> - Credenciais e secrets
> - Auditoria e rastreabilidade
> - Proteção de dados sensíveis
> - Tratamento de ataques e vulnerabilidades
>
> **Hierarquia de documentos:**
> - Este documento **complementa** `design-rules.md` (seções 4 e 7)
> - Baseado nas regras de negócio do `prd.md` (seção 3.2)

---

## 1. VISÃO GERAL DE SEGURANÇA

### 1.1 Princípios Fundamentais

| Princípio | Descrição |
|-----------|-----------|
| **Defense in Depth** | Múltiplas camadas de proteção (autenticação, autorização, validação, auditoria) |
| **Least Privilege** | Cada entidade (agente, parceiro, admin) tem apenas as permissões necessárias |
| **Zero Trust** | Toda requisição é validada, não há confiança implícita |
| **Auditability** | Todas as operações críticas são registradas para auditoria |
| **Fail Secure** | Em caso de erro, o sistema nega acesso (não libera por padrão) |

### 1.2 Atores do Sistema

| Ator | Identificação | Autenticação | Autorização |
|------|---------------|--------------|-------------|
| **Agente** | `AgentId` (GUID) | `X-Agent-Secret` (header) | Acesso apenas aos próprios comandos |
| **Parceiro** | `PartnerId` (GUID) | `X-Partner-ApiKey` (header) ou JWT | Acesso apenas às próprias empresas |
| **Admin** | `UserId` (futuro) | JWT (futuro) | Acesso total (gestão de parceiros, versões, sistema) |

---

## 2. AUTENTICAÇÃO DE AGENTES

### 2.1 Arquitetura de Credenciais

```
┌─────────────────────────────────────────────────────────┐
│                    REGISTRO DO AGENTE                    │
│                                                          │
│  1. Agente envia:                                        │
│     - X-Partner-ApiKey (header)                          │
│     - AgentId, CnpjCliente, CnpjParceiro (body)          │
│                                                          │
│  2. API valida:                                          │
│     - Parceiro existe (por documento)                    │
│     - API Key válida (BCrypt.Verify)                     │
│                                                          │
│  3. API gera (se novo agente):                           │
│     - AgentSecret (48 bytes aleatórios, Base64)          │
│     - Hash BCrypt do AgentSecret                         │
│                                                          │
│  4. API persiste:                                        │
│     - AgentCredential { SecretHash, GeneratedAt }        │
│                                                          │
│  5. API retorna:                                         │
│     - { AgentId, AgentSecret }                           │
│     ⚠️ AgentSecret NUNCA mais será exibido               │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Fluxo de Autenticação

#### 2.2.1 Endpoints Protegidos

**Lista de endpoints que exigem autenticação de agente:**
- `POST /api/heartbeat`
- `GET /api/agentcommands/commands` (polling)
- `POST /api/agentcommands/commands/result`
- `POST /api/agents/modules/state`

**Implementação:** `AgentAuthenticationMiddleware` (camada API)

#### 2.2.2 Validação de Credenciais

**Headers obrigatórios:**
```http
X-Agent-Id: <guid>
X-Agent-Secret: <base64-string>
```

**Fluxo de validação:**
```
1. Middleware extrai headers
   └─> Se ausentes → 401 "Missing agent credentials"

2. Busca Agent por AgentId
   └─> Se não encontrado → 401 "Invalid agent credentials"

3. Busca AgentCredential ativa (RevokedAt = null)
   └─> Se não encontrada → 401 "Invalid agent credentials"

4. Valida AgentSecret (BCrypt.Verify)
   └─> Se inválido → 401 "Invalid agent credentials"
   └─> Se revogado (RevokedAt != null) → 401 "Credential revoked"

5. Se válido → adiciona AgentId ao HttpContext
   └─> Controllers podem acessar via HttpContext.Items["AgentId"]
```

**Implementação:**
```csharp
public class AgentAuthenticationMiddleware
{
    public async Task InvokeAsync(HttpContext context, ApplicationDbContext dbContext)
    {
        // Apenas endpoints protegidos
        if (!RequiresAuthentication(context.Request.Path))
        {
            await _next(context);
            return;
        }
        
        // 1. Extrair headers
        if (!context.Request.Headers.TryGetValue("X-Agent-Id", out var agentIdHeader) ||
            !context.Request.Headers.TryGetValue("X-Agent-Secret", out var secretHeader))
        {
            context.Response.StatusCode = 401;
            await context.Response.WriteAsync("Missing agent credentials");
            return;
        }
        
        if (!Guid.TryParse(agentIdHeader, out var agentId))
        {
            context.Response.StatusCode = 401;
            await context.Response.WriteAsync("Invalid agent credentials");
            return;
        }
        
        // 2. Buscar agente
        var agent = await dbContext.Agents.FindAsync(agentId);
        if (agent == null)
        {
            context.Response.StatusCode = 401;
            await context.Response.WriteAsync("Invalid agent credentials");
            return;
        }
        
        // 3. Buscar credencial ativa
        var credential = await dbContext.Set<AgentCredential>()
            .Where(c => c.AgentId == agentId && c.RevokedAt == null)
            .OrderByDescending(c => c.GeneratedAt)
            .FirstOrDefaultAsync();
        
        if (credential == null)
        {
            context.Response.StatusCode = 401;
            await context.Response.WriteAsync("Invalid agent credentials");
            return;
        }
        
        // 4. Validar secret
        var secret = secretHeader.ToString();
        if (!BCrypt.Net.BCrypt.Verify(secret, credential.SecretHash))
        {
            context.Response.StatusCode = 401;
            await context.Response.WriteAsync("Invalid agent credentials");
            return;
        }
        
        // 5. Adicionar ao contexto
        context.Items["AgentId"] = agentId;
        
        await _next(context);
    }
}
```

### 2.3 Geração de AgentSecret

**Requisitos:**
- 48 bytes aleatórios (criptograficamente seguros)
- Codificação Base64
- Hash com BCrypt (work factor 12)

**Implementação:**
```csharp
public class CredentialService
{
    private const int SecretSizeBytes = 48;
    
    public string GenerateSecret()
    {
        var bytes = RandomNumberGenerator.GetBytes(SecretSizeBytes);
        return Convert.ToBase64String(bytes);
    }
    
    public string HashSecret(string secret)
    {
        return BCrypt.Net.BCrypt.HashPassword(secret, workFactor: 12);
    }
    
    public bool VerifySecret(string secret, string hash)
    {
        return BCrypt.Net.BCrypt.Verify(secret, hash);
    }
}
```

### 2.4 Reset de AgentSecret

**Use Case:** `ResetAgentSecretUseCase`

**Autorização:**
- Requer `AgentId`, `CnpjCliente`, `PartnerId`
- Valida que o parceiro é dono da empresa do agente
- Revoga credencial atual (`RevokedAt = NOW()`)
- Gera nova credencial
- Retorna novo `AgentSecret`

**Implementação:**
```csharp
public class ResetAgentSecretUseCase
{
    public async Task<ResetAgentSecretResponse> Handle(ResetAgentSecretCommand command)
    {
        // 1. Validar autorização
        var agent = await _agentRepository.GetByIdAsync(command.AgentId);
        if (agent == null)
        {
            throw new EntityNotFoundException("Agent not found");
        }
        
        var company = await _companyRepository.GetByIdAsync(agent.CompanyId);
        if (company == null || company.PartnerId != command.PartnerId)
        {
            throw new UnauthorizedException("Partner not authorized to reset this agent's secret");
        }
        
        // 2. Revogar credencial atual
        var currentCredential = await _credentialRepository
            .GetActiveCredentialAsync(command.AgentId);
        
        if (currentCredential != null)
        {
            currentCredential.RevokedAt = DateTime.UtcNow;
            await _credentialRepository.UpdateAsync(currentCredential);
        }
        
        // 3. Gerar nova credencial
        var newSecret = _credentialService.GenerateSecret();
        var newHash = _credentialService.HashSecret(newSecret);
        
        var newCredential = new AgentCredential
        {
            AgentId = command.AgentId,
            SecretHash = newHash,
            GeneratedAt = DateTime.UtcNow,
            RevokedAt = null
        };
        
        await _credentialRepository.AddAsync(newCredential);
        await _unitOfWork.SaveChangesAsync();
        
        // 4. Registrar evento de auditoria
        var auditEvent = new AgentEvent
        {
            AgentId = command.AgentId,
            CompanyId = agent.CompanyId,
            EventType = "CREDENTIAL_RESET",
            Description = $"Agent secret reset by partner {command.PartnerId}",
            CreatedAt = DateTime.UtcNow
        };
        
        await _eventRepository.AddAsync(auditEvent);
        await _unitOfWork.SaveChangesAsync();
        
        return new ResetAgentSecretResponse
        {
            AgentId = command.AgentId,
            AgentSecret = newSecret
        };
    }
}
```

**Observação:** Endpoint para reset ainda não está exposto nos controllers. Implementar quando necessário.

---

## 3. AUTENTICAÇÃO DE PARCEIROS

### 3.1 API Key do Parceiro

**Propósito:** Autenticar agentes no registro inicial (não para login humano)

#### 3.1.1 Geração de API Key

**Endpoint:** `POST /api/partners/{partnerId}/apikey`

**Regras:**
- Só pode ser gerada **uma única vez** por parceiro
- Se já existir API Key ativa → retornar 409 Conflict
- Retornada **apenas no momento da criação** (não pode ser recuperada depois)

**Fluxo:**
```
1. Validar que parceiro existe
2. Verificar se já existe PartnerCredential ativa (RevokedAt = null)
   └─> Se sim → 409 "API Key already generated"
3. Gerar API Key (48 bytes aleatórios, Base64)
4. Hash com BCrypt (work factor 12)
5. Persistir PartnerCredential { ApiKeyHash, GeneratedAt }
6. Retornar { ApiKey: "<plaintext>" }
```

**Implementação:**
```csharp
public class GeneratePartnerApiKeyCommandHandler
{
    public async Task<GeneratePartnerApiKeyResponse> Handle(
        GeneratePartnerApiKeyCommand command, 
        CancellationToken ct)
    {
        // 1. Validar parceiro
        var partner = await _partnerRepository.GetByIdAsync(command.PartnerId);
        if (partner == null)
        {
            throw new EntityNotFoundException("Partner not found");
        }
        
        // 2. Verificar credencial ativa
        var existingCredential = await _credentialRepository
            .GetActivePartnerCredentialAsync(command.PartnerId);
        
        if (existingCredential != null)
        {
            throw new BusinessRuleException("API Key already generated for this partner");
        }
        
        // 3. Gerar API Key
        var apiKey = _credentialService.GenerateSecret();
        var apiKeyHash = _credentialService.HashSecret(apiKey);
        
        // 4. Persistir
        var credential = new PartnerCredential
        {
            PartnerId = command.PartnerId,
            ApiKeyHash = apiKeyHash,
            GeneratedAt = DateTime.UtcNow,
            RevokedAt = null
        };
        
        await _credentialRepository.AddAsync(credential);
        await _unitOfWork.SaveChangesAsync();
        
        // 5. Registrar evento de auditoria
        _logger.LogInformation(
            "API Key generated for partner {PartnerId}",
            command.PartnerId);
        
        // 6. Retornar (única vez)
        return new GeneratePartnerApiKeyResponse
        {
            ApiKey = apiKey
        };
    }
}
```

#### 3.1.2 Validação de API Key

**Usado em:** `POST /api/agents/register`

**Header obrigatório:**
```http
X-Partner-ApiKey: <base64-string>
```

**Fluxo:**
```
1. Extrair header X-Partner-ApiKey
2. Buscar parceiro por documento (CnpjParceiro do body)
3. Buscar PartnerCredential ativa
4. Validar API Key (BCrypt.Verify)
   └─> Se inválido → 401
   └─> Se revogado → 401
5. Se válido → prosseguir com registro
```

### 3.2 JWT (Futuro - Login Humano)

**Nota:** Autenticação JWT para portal web ainda não está implementada. Quando implementar, seguir:

**Fluxo:**
```
1. POST /api/auth/login
   - Email/Documento + Senha
2. Validar credenciais
3. Gerar JWT com claims:
   - PartnerId
   - Role (Partner, Admin)
   - Empresas associadas (opcional)
4. Retornar token + refresh token
5. Proteger endpoints de gestão com [Authorize]
```

**Claims sugeridas:**
```json
{
  "sub": "partner-guid",
  "role": "Partner",
  "email": "partner@example.com",
  "companies": ["company-guid-1", "company-guid-2"],
  "exp": 1234567890,
  "iat": 1234567890
}
```

---

## 4. AUTORIZAÇÃO

### 4.1 Níveis de Acesso

| Ator | Acesso | Recursos |
|------|--------|----------|
| **Agente** | Próprios comandos e módulos | `GET /commands?agentId={self}`, `POST /heartbeat`, `POST /commands/result` |
| **Parceiro** | Próprias empresas e agentes | `GET /partners/{partnerId}/companies`, `POST /companies/{companyId}/update` |
| **Admin** | Total | Gestão de parceiros, versões do sistema, configurações |

### 4.2 Validação de Propriedade

**Princípio:** Cada ator só pode acessar recursos que pertencem a ele.

**Exemplo 1: Agente acessando comandos**
```csharp
public async Task<IActionResult> GetCommands([FromQuery] Guid agentId)
{
    // 1. Extrair agentId autenticado do contexto
    var authenticatedAgentId = (Guid)HttpContext.Items["AgentId"]!;
    
    // 2. Validar propriedade
    if (agentId != authenticatedAgentId)
    {
        return Forbid(); // 403 Forbidden
    }
    
    // 3. Prosseguir
    var commands = await _commandService.GetPendingCommandsAsync(agentId);
    return Ok(commands);
}
```

**Exemplo 2: Parceiro acessando empresa**
```csharp
public async Task<IActionResult> TriggerCompanyUpdate(
    [FromRoute] Guid companyId,
    [FromBody] TriggerUpdateRequest request)
{
    // 1. Extrair partnerId do JWT (futuro)
    var partnerId = User.FindFirst("sub")?.Value;
    
    // 2. Validar propriedade
    var company = await _companyRepository.GetByIdAsync(companyId);
    if (company == null)
    {
        return NotFound();
    }
    
    if (company.PartnerId.ToString() != partnerId)
    {
        return Forbid(); // 403 Forbidden
    }
    
    // 3. Prosseguir
    await _updateOrchestrator.TriggerUpdateAsync(companyId, request.TargetVersion);
    return Accepted();
}
```

---

## 5. PROTEÇÃO DE DADOS SENSÍVEIS

### 5.1 Credenciais e Secrets

**Regras obrigatórias:**

| Tipo | Armazenamento | Transmissão | Exposição |
|------|---------------|-------------|-----------|
| **AgentSecret** | Hash BCrypt (nunca plaintext) | HTTPS | Apenas no registro inicial |
| **PartnerApiKey** | Hash BCrypt (nunca plaintext) | HTTPS | Apenas na geração |
| **Senhas** | Hash BCrypt ou Argon2 | HTTPS | Nunca |

**Proibido:**
```csharp
// ❌ NUNCA FAZER ISSO
_logger.LogInformation("Agent secret: {Secret}", agentSecret);
return Ok(new { Secret = agentSecret }); // Fora do registro inicial
```

**Correto:**
```csharp
// ✅ Log sem credenciais
_logger.LogInformation("Agent {AgentId} registered successfully", agentId);

// ✅ Retornar secret apenas no registro
if (isNewAgent)
{
    return Ok(new { AgentId = agentId, AgentSecret = agentSecret });
}
else
{
    return Ok(); // Sem body
}
```

### 5.2 Dados Pessoais (LGPD)

**Dados sensíveis no sistema:**
- CNPJ (empresa e parceiro)
- Email (parceiro)
- IP Address (agente)
- Hostname (agente)

**Proteções:**
- **Não logar CNPJ/Email em logs de aplicação** (usar IDs)
- **Anonimizar em relatórios** quando possível
- **Respeitar direito ao esquecimento** (soft delete ou hard delete conforme necessidade)

**Exemplo:**
```csharp
// ❌ ERRADO
_logger.LogInformation("Partner {Cnpj} logged in", cnpj);

// ✅ CORRETO
_logger.LogInformation("Partner {PartnerId} logged in", partnerId);
```

### 5.3 Configurações Sensíveis

**Variáveis de ambiente (nunca em código):**
- Connection strings
- Senhas de banco
- Chaves de API externas
- Configuração RabbitMQ

**Armazenamento:**
```bash
# docker-compose.yml ou .env
POSTGRES_PASSWORD=<senha-forte>
RABBITMQ_PASSWORD=<senha-forte>
JWT_SECRET=<chave-256-bits>
```

**Código:**
```csharp
// ✅ Ler de configuração
var connectionString = _configuration.GetConnectionString("DefaultConnection");

// ❌ NUNCA hard-code
var connectionString = "Host=localhost;Password=123456";
```

---

## 6. AUDITORIA E RASTREABILIDADE

### 6.1 Eventos de Auditoria

**Entidade:** `AgentEvent`

**Quando persistir:**
```
✅ SIM (eventos críticos):
- Registro de agente
- Reset de credencial
- Falha de autenticação (múltiplas tentativas)
- Mudanças de estado (comando SUCCESS/FAILED)
- Revogação de credenciais
- Início/conclusão de atualização

❌ NÃO (eventos rotineiros):
- Heartbeats regulares (poluem banco)
- Polling de comandos
- Leituras de status (GET)
```

**Implementação:**
```csharp
public class AgentEvent
{
    public Guid Id { get; set; }
    public Guid AgentId { get; set; }
    public Guid? CompanyId { get; set; }
    public string EventType { get; set; }  // AGENT_REGISTERED, CREDENTIAL_RESET, etc.
    public string Description { get; set; }
    public DateTime CreatedAt { get; set; }
}
```

**Exemplo de registro:**
```csharp
var auditEvent = new AgentEvent
{
    AgentId = agentId,
    CompanyId = companyId,
    EventType = "AGENT_REGISTERED",
    Description = "Agent registered successfully",
    CreatedAt = DateTime.UtcNow
};

await _eventRepository.AddAsync(auditEvent);
await _unitOfWork.SaveChangesAsync();
```

### 6.2 Logs Estruturados

**Obrigatório:** Usar logs estruturados com contexto.

**Correlação:** Sempre incluir identificadores para rastreamento.

```csharp
// ✅ CORRETO
_logger.LogInformation(
    "Command {CommandId} completed for agent {AgentId} with status {Status}",
    commandId, agentId, status);

// ❌ ERRADO
_logger.LogInformation($"Command {commandId} completed");
```

**Contextos importantes:**
- `AgentId`
- `CompanyId`
- `CommandId`
- `PlanId`
- `PartnerId`
- `trace_id` (OpenTelemetry)

### 6.3 Retenção de Eventos

**Política:** Manter eventos por **7 dias** (`EventPolicy.DaysRetain`)

**Job:** `EventCleanupService` (executa a cada 24h)

```csharp
public async Task CleanupOldEventsAsync()
{
    var cutoffDate = DateTime.UtcNow.AddDays(-EventPolicy.DaysRetain);
    
    var oldEvents = await _context.AgentEvents
        .Where(e => e.CreatedAt < cutoffDate)
        .ToListAsync();
    
    _context.AgentEvents.RemoveRange(oldEvents);
    await _context.SaveChangesAsync();
    
    _logger.LogInformation("Cleaned up {Count} old events", oldEvents.Count);
}
```

---

## 7. PROTEÇÃO CONTRA ATAQUES

### 7.1 Brute Force

**Proteção:**
- Rate limiting (futuro - Redis)
- Lockout após N tentativas falhas (futuro)
- Logs de tentativas de autenticação falhas

**Implementação futura:**
```csharp
// Exemplo de rate limiting (quando implementado)
[RateLimit(MaxRequests = 5, WindowSeconds = 60)]
public async Task<IActionResult> Register(...)
{
    // ...
}
```

### 7.2 Injection Attacks

**Proteção:**
- Entity Framework Core (parametrização automática)
- Validação de entrada (FluentValidation)
- Nunca usar `FromSqlRaw` com concatenação de strings

**Exemplo seguro:**
```csharp
// ✅ CORRETO (EF Core parametriza automaticamente)
var agents = await _context.Agents
    .Where(a => a.CompanyId == companyId)
    .ToListAsync();

// ❌ ERRADO (SQL Injection)
var sql = $"SELECT * FROM Agents WHERE CompanyId = '{companyId}'";
var agents = await _context.Agents.FromSqlRaw(sql).ToListAsync();
```

### 7.3 Mass Assignment

**Proteção:** Usar DTOs específicos (nunca expor entidades diretamente)

**Exemplo:**
```csharp
// ✅ CORRETO
public async Task<IActionResult> UpdateAgent([FromBody] UpdateAgentRequest request)
{
    var command = new UpdateAgentCommand
    {
        AgentId = request.AgentId,
        Hostname = request.Hostname,
        IpAddress = request.IpAddress
        // Apenas campos permitidos
    };
    
    await _mediator.Send(command);
    return Ok();
}

// ❌ ERRADO (expõe entidade completa)
public async Task<IActionResult> UpdateAgent([FromBody] Agent agent)
{
    _context.Update(agent); // Permite alterar qualquer campo
    await _context.SaveChangesAsync();
    return Ok();
}
```

### 7.4 CSRF (Cross-Site Request Forgery)

**Proteção:**
- Usar tokens anti-CSRF para endpoints que mudam estado
- Validar header `Origin` ou `Referer`
- Para API REST: usar tokens em headers (não cookies)

**Implementação:**
```csharp
// Program.cs
builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
});

// Controller
[ValidateAntiForgeryToken]
public async Task<IActionResult> DeleteAgent(Guid id)
{
    // ...
}
```

### 7.5 CORS

**Política restritiva:**
```csharp
// Program.cs
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowedOrigins", policy =>
    {
        policy.WithOrigins(
            "https://admin.example.com",  // Portal do parceiro
            "https://internal.example.com" // Sistema interno
        )
        .AllowAnyMethod()
        .AllowAnyHeader()
        .AllowCredentials();
    });
});

app.UseCors("AllowedOrigins");
```

---

## 8. COMUNICAÇÃO SEGURA

### 8.1 HTTPS Obrigatório

**Produção:** Apenas HTTPS

**Desenvolvimento:** HTTP permitido apenas em localhost

```csharp
// Program.cs
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
    app.UseHsts();
}
```

### 8.2 Headers de Segurança

**Adicionar headers de proteção:**
```csharp
// Middleware customizado
app.Use(async (context, next) =>
{
    context.Response.Headers.Add("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Add("X-Frame-Options", "DENY");
    context.Response.Headers.Add("X-XSS-Protection", "1; mode=block");
    context.Response.Headers.Add("Referrer-Policy", "strict-origin-when-cross-origin");
    
    await next();
});
```

### 8.3 RabbitMQ

**Proteção:**
- Usar autenticação (usuário/senha)
- Não expor porta 15672 publicamente
- TLS em produção

```yaml
# docker-compose.yml
rabbitmq:
  environment:
    RABBITMQ_DEFAULT_USER: admin
    RABBITMQ_DEFAULT_PASS: ${RABBITMQ_PASSWORD}
  ports:
    - "127.0.0.1:15672:15672"  # Bind apenas localhost
```

---

## 9. GESTÃO DE SECRETS

### 9.1 Rotação de Credenciais

**API Key do Parceiro:**
- Não possui rotação automática (design)
- Revogação manual via endpoint (futuro)

**AgentSecret:**
- Rotação via `ResetAgentSecretUseCase`
- Requer autorização do parceiro

**Senhas de infraestrutura:**
- Rotacionar a cada 90 dias (banco, RabbitMQ)
- Usar secrets manager em produção (AWS Secrets Manager, Azure Key Vault)

### 9.2 Revogação de Credenciais

**Processo:**
```csharp
public async Task RevokeCredentialAsync(Guid agentId)
{
    var credential = await _credentialRepository.GetActiveCredentialAsync(agentId);
    
    if (credential != null)
    {
        credential.RevokedAt = DateTime.UtcNow;
        await _credentialRepository.UpdateAsync(credential);
        await _unitOfWork.SaveChangesAsync();
    }
    
    // Registrar evento de auditoria
    var auditEvent = new AgentEvent
    {
        AgentId = agentId,
        EventType = "CREDENTIAL_REVOKED",
        Description = "Agent credential revoked",
        CreatedAt = DateTime.UtcNow
    };
    
    await _eventRepository.AddAsync(auditEvent);
    await _unitOfWork.SaveChangesAsync();
}
```

**Quando revogar:**
- Suspeita de comprometimento
- Agente desativado permanentemente
- Mudança de propriedade da empresa

---

## 10. MONITORAMENTO DE SEGURANÇA

### 10.1 Métricas de Segurança

**Instrumentar:**
- Taxa de falhas de autenticação (por agente, por parceiro)
- Tentativas de acesso não autorizado (403)
- Credenciais revogadas
- Tempo entre geração e primeiro uso de credencial

```csharp
_metrics.RecordAuthenticationFailure(agentId, reason);
_metrics.RecordUnauthorizedAccess(partnerId, resource);
_metrics.RecordCredentialRevoked(agentId);
```

### 10.2 Alertas

**Configurar alertas para:**
- Múltiplas falhas de autenticação do mesmo agente (>5 em 10 min)
- Acessos de IPs não esperados
- Credenciais antigas (>365 dias sem rotação)
- Uso de API Key após revogação (anomalia)

### 10.3 Logs de Segurança

**Sempre logar:**
```
- Autenticação bem-sucedida (INFO)
- Falha de autenticação (WARNING)
- Acesso negado (WARNING)
- Revogação de credencial (WARNING)
- Reset de credencial (WARNING)
- Geração de API Key (INFO)
```

**Exemplo:**
```csharp
// Sucesso
_logger.LogInformation(
    "Agent {AgentId} authenticated successfully from IP {IpAddress}",
    agentId, ipAddress);

// Falha
_logger.LogWarning(
    "Authentication failed for agent {AgentId} from IP {IpAddress}: {Reason}",
    agentId, ipAddress, reason);

// Revogação
_logger.LogWarning(
    "Credential revoked for agent {AgentId} by partner {PartnerId}",
    agentId, partnerId);
```

---

## 11. COMPLIANCE E REGULAMENTAÇÕES

### 11.1 LGPD (Lei Geral de Proteção de Dados)

**Dados pessoais tratados:**
- CNPJ (empresa e parceiro)
- Email (parceiro)
- IP Address (agente)
- Hostname (agente)

**Obrigações:**
- **Consentimento:** Parceiro consente ao se cadastrar
- **Finalidade:** Gestão de atualizações de software
- **Minimização:** Coletar apenas dados necessários
- **Segurança:** Proteções descritas neste documento
- **Retenção:** Eventos por 7 dias, credenciais enquanto ativo
- **Direito ao esquecimento:** Implementar endpoint de exclusão (futuro)

### 11.2 Auditoria Externa

**Preparação:**
- Manter logs estruturados por 90 dias (mínimo)
- Documentar fluxos de autenticação (este documento)
- Manter histórico de acesso (AgentEvent)
- Registrar mudanças em configurações de segurança

---

## 12. CHECKLIST DE SEGURANÇA

### 12.1 Desenvolvimento

- [ ] Nunca commitar secrets em código
- [ ] Usar variáveis de ambiente para credenciais
- [ ] Validar entrada de usuário (FluentValidation)
- [ ] Usar DTOs específicos (não expor entidades)
- [ ] Hash de credenciais com BCrypt (work factor 12)
- [ ] Logs estruturados sem dados sensíveis
- [ ] HTTPS obrigatório em produção

### 12.2 Deploy

- [ ] Revisar secrets em docker-compose.yml
- [ ] Configurar CORS restritivo
- [ ] Habilitar HTTPS e HSTS
- [ ] Configurar rate limiting (futuro)
- [ ] Verificar permissões de banco de dados
- [ ] Configurar backup de banco de dados
- [ ] Habilitar logs de auditoria

### 12.3 Operação

- [ ] Monitorar métricas de segurança
- [ ] Revisar logs de autenticação semanalmente
- [ ] Rotacionar senhas de infraestrutura (90 dias)
- [ ] Aplicar patches de segurança mensalmente
- [ ] Testar backup e restore trimestralmente
- [ ] Revisar acessos e permissões trimestralmente

---

## 13. INCIDENTES DE SEGURANÇA

### 13.1 Resposta a Incidentes

**Fluxo:**
```
1. DETECÇÃO
   └─> Alerta de anomalia ou notificação de usuário

2. CONTENÇÃO
   └─> Revogar credenciais comprometidas
   └─> Bloquear IPs suspeitos
   └─> Isolar sistema afetado

3. INVESTIGAÇÃO
   └─> Analisar logs (AgentEvent, application logs)
   └─> Identificar escopo (quantos agentes/parceiros afetados)
   └─> Determinar causa raiz

4. REMEDIAÇÃO
   └─> Corrigir vulnerabilidade
   └─> Aplicar patch
   └─> Testar correção

5. RECUPERAÇÃO
   └─> Gerar novas credenciais para afetados
   └─> Notificar parceiros/agentes
   └─> Restaurar serviço

6. DOCUMENTAÇÃO
   └─> Registrar incidente (post-mortem)
   └─> Atualizar runbooks
   └─> Aplicar lições aprendidas
```

### 13.2 Comunicação

**Canais:**
- Email para parceiros afetados
- Dashboard de status (futuro)
- Logs estruturados (interno)

**Conteúdo:**
- Descrição do incidente (sem detalhes técnicos sensíveis)
- Impacto (quantos agentes/empresas afetados)
- Ações tomadas
- Ações requeridas do parceiro (ex: gerar nova API Key)
- Timeline

---

## 14. EVOLUÇÃO E MELHORIAS

### 14.1 Roadmap de Segurança

| Prioridade | Item | Descrição |
|-----------|------|-----------|
| **Alta** | Rate limiting | Prevenir brute force |
| **Alta** | Endpoint de revogação de API Key | Permitir revogação manual |
| **Média** | JWT para portal web | Autenticação de parceiros humanos |
| **Média** | Lockout de conta | Após N tentativas falhas |
| **Baixa** | Two-Factor Authentication | Para parceiros (portal) |
| **Baixa** | Secrets rotation automática | Rotacionar AgentSecret periodicamente |

### 14.2 Testes de Segurança

**Testes obrigatórios:**
- [ ] Tentar autenticar com credencial inválida (deve retornar 401)
- [ ] Tentar autenticar com credencial revogada (deve retornar 401)
- [ ] Tentar acessar comandos de outro agente (deve retornar 403)
- [ ] Tentar gerar API Key duplicada (deve retornar 409)
- [ ] Verificar que secrets nunca são logados
- [ ] Verificar que hash é usado (nunca plaintext no banco)
- [ ] Tentar SQL injection via parâmetros (deve ser bloqueado)

---

## RESUMO

| Aspecto | Status | Observação |
|---------|--------|------------|
| **Autenticação de Agentes** | ✅ Implementado | AgentSecret via headers |
| **Autenticação de Parceiros** | ⚠️ Parcial | API Key implementado, JWT futuro |
| **Autorização** | ✅ Implementado | Validação de propriedade |
| **Auditoria** | ✅ Implementado | AgentEvent + logs estruturados |
| **Proteção de Credenciais** | ✅ Implementado | BCrypt, nunca plaintext |
| **Rate Limiting** | ❌ Futuro | Planejado |
| **HTTPS** | ✅ Implementado | Obrigatório em produção |
| **CORS** | ✅ Implementado | Política restritiva |

---

## REFERÊNCIAS

- `prd.md` — Seção 3.2 (segurança e autenticação)
- `design-rules.md` — Seção 7 (autenticação e segurança)
- `flow-rules.md` — Seção 1 (fluxo de registro com credenciais)
- OWASP Top 10 — Melhores práticas de segurança web
- BCrypt.Net Documentation — Uso de hash de senhas
