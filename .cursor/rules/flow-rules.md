# 🔄 DIAGRAMAS DE FLUXO - ATUALIZADOR API

---

## 📊 VISÃO GERAL DO SISTEMA

```
┌──────────────────────────────────────────────────────────────────┐
│                         ECOSSISTEMA                              │
│                                                                  │
│  ┌─────────────┐         ┌──────────────┐                      │
│  │   Parceiro  │────────>│  Admin Web   │                      │
│  │  (Cliente)  │         │  (Interface) │                      │
│  └─────────────┘         └──────┬───────┘                      │
│                                  │                               │
│                                  │ HTTP/REST                     │
│                                  ▼                               │
│                         ┌─────────────────┐                     │
│                         │                 │                     │
│                         │  ATUALIZADOR    │                     │
│                         │      API        │                     │
│                         │                 │                     │
│                         └────────┬────────┘                     │
│                                  │                               │
│                    ┌─────────────┼─────────────┐               │
│                    │             │             │                │
│                    ▼             ▼             ▼                │
│            ┌──────────────┐ ┌─────────┐  ┌──────────┐         │
│            │  PostgreSQL  │ │ RabbitMQ│  │  Redis*  │         │
│            │   Database   │ │  Queue  │  │  Cache   │         │
│            └──────────────┘ └─────┬───┘  └──────────┘         │
│                                    │                             │
│                                    │ Wake-up message             │
│                                    │                             │
│                    ┌───────────────┴───────────────┐            │
│                    │                               │             │
│                    ▼                               ▼             │
│          ┌──────────────────┐          ┌──────────────────┐    │
│          │   Agent (Posto   │          │  Agent (Farmácia │    │
│          │   Shell BR-101)  │          │  Drogasil MG)    │    │
│          │                  │          │                  │    │
│          │  - MetaServer    │          │  - MetaServer    │    │
│          │  - PDV           │          │  - GerenciadorPDV│    │
│          │  - MetaPista     │          │  - PDV           │    │
│          └──────────────────┘          └──────────────────┘    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘

* Redis é opcional e não está implementado ainda
```

**Nota:** A API escuta em **porta 3000** (`0.0.0.0:3000`). Endpoints de parceiros exigem **JWT** (obtido via `POST /api/auth/partner/login`).

---

## 1️⃣ FLUXO COMPLETO: REGISTRO DE NOVO AGENTE

**Pré-requisito:** O parceiro deve estar autenticado com JWT (login em `POST /api/auth/partner/login`). Os endpoints `/api/partners/*` exigem header `Authorization: Bearer <token>`.

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│   Partner   │         │      API     │         │  PostgreSQL  │
│  (Cliente)  │         │              │         │              │
└──────┬──────┘         └───────┬──────┘         └──────┬───────┘
       │                        │                        │
       │                        │                        │
  ┌────┴────┐                   │                        │
  │ 1. Pede │                   │                        │
  │ API Key │                   │                        │
  │ (JWT)   │                   │                        │
  └────┬────┘                   │                        │
       │                        │                        │
       │ POST /api/partners/    │                        │
       │   {id}/apikey          │                        │
       │ Header: Authorization  │                        │
       │   Bearer <token>       │                        │
       ├───────────────────────>│                        │
       │                        │                        │
       │                        │ 1. Valida Partner      │
       │                        │ 2. Verifica se já      │
       │                        │    existe API Key      │
       │                        │ 3. Gera nova API Key   │
       │                        │    (48 bytes random)   │
       │                        │ 4. Hash com BCrypt     │
       │                        │                        │
       │                        │ INSERT PartnerCredential
       │                        ├───────────────────────>│
       │                        │                        │
       │                        │<───────────────────────┤
       │ 200 OK                 │                        │
       │ { ApiKey: "xxxx..." }  │                        │
       │<───────────────────────┤                        │
       │                        │                        │
       │ ⚠️ GUARDAR API KEY!    │                        │
       │ (só aparece 1 vez)     │                        │
       │                        │                        │
       │                        │                        │
┌──────┴──────┐                 │                        │
│             │                 │                        │
│  2. Agente  │                 │                        │
│  instalado  │                 │                        │
│  em máquina │                 │                        │
│  do cliente │                 │                        │
│             │                 │                        │
└──────┬──────┘                 │                        │
       │                        │                        │
       │ POST /api/agents/      │                        │
       │   register             │                        │
       │                        │                        │
       │ Headers:               │                        │
       │   X-Partner-ApiKey     │                        │
       │                        │                        │
       │ Body: {                │                        │
       │   AgentId,             │                        │
       │   CnpjCliente,         │                        │
       │   CnpjParceiro,        │                        │
       │   Hostname,            │                        │
       │   IpAddress,           │                        │
       │   Modules: [...]       │                        │
       │ }                      │                        │
       ├───────────────────────>│                        │
       │                        │                        │
       │                        │ 1. Valida Partner      │
       │                        │    por Documento       │
       │                        │                        │
       │                        │ SELECT Partner         │
       │                        ├───────────────────────>│
       │                        │<───────────────────────┤
       │                        │                        │
       │                        │ 2. Valida API Key      │
       │                        │    (BCrypt.Verify)     │
       │                        │                        │
       │                        │ SELECT PartnerCredential
       │                        ├───────────────────────>│
       │                        │<───────────────────────┤
       │                        │                        │
       │                        │ 3. Busca/Cria Company  │
       │                        │                        │
       │                        │ SELECT Company         │
       │                        ├───────────────────────>│
       │                        │<─────── (null) ────────┤
       │                        │                        │
       │                        │ INSERT Company         │
       │                        ├───────────────────────>│
       │                        │<───────────────────────┤
       │                        │                        │
       │                        │ 4. Cria Agent          │
       │                        │    (via Factory)       │
       │                        │                        │
       │                        │ INSERT Agent           │
       │                        ├───────────────────────>│
       │                        │<───────────────────────┤
       │                        │                        │
       │                        │ 5. Gera AgentSecret    │
       │                        │    (48 bytes random)   │
       │                        │                        │
       │                        │ INSERT AgentCredential │
       │                        ├───────────────────────>│
       │                        │<───────────────────────┤
       │                        │                        │
       │                        │ 6. Insere Modules      │
       │                        │                        │
       │                        │ INSERT AgentModules    │
       │                        ├───────────────────────>│
       │                        │<───────────────────────┤
       │                        │                        │
       │ 200 OK                 │                        │
       │ {                      │                        │
       │   AgentId,             │                        │
       │   AgentSecret: "xxx"   │                        │
       │ }                      │                        │
       │<───────────────────────┤                        │
       │                        │                        │
       │ ⚠️ GUARDAR Secret!     │                        │
       │ (só aparece 1 vez)     │                        │
       │                        │                        │
```

---

## 2️⃣ FLUXO: HEARTBEAT (KEEP-ALIVE)

```
┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│    Agent     │         │     API      │         │  PostgreSQL  │
│   (Polling   │         │              │         │              │
│ a cada 10min)│         │              │         │              │
└──────┬───────┘         └──────┬───────┘         └──────┬───────┘
       │                        │                        │
       │                        │                        │
       │ POST /api/heartbeat    │                        │
       │                        │                        │
       │ Headers:               │                        │
       │   X-Agent-Id: <guid>   │                        │
       │   X-Agent-Secret: xxx  │                        │
       │                        │                        │
       │ Body: {                │                        │
       │   AgentId: <guid>      │                        │
       │ }                      │                        │
       ├───────────────────────>│                        │
       │                        │                        │
       │                        │ Middleware:            │
       │                        │ 1. Valida headers      │
       │                        │ 2. Busca Credential    │
       │                        │                        │
       │                        │ SELECT AgentCredential │
       │                        │   WHERE AgentId=...    │
       │                        │   AND RevokedAt IS NULL│
       │                        ├───────────────────────>│
       │                        │<───────────────────────┤
       │                        │                        │
       │                        │ 3. BCrypt.Verify       │
       │                        │    (secret vs hash)    │
       │                        │                        │
       │                        │ ✅ Autorizado          │
       │                        │                        │
       │                        │ 4. UPDATE Agent        │
       │                        │    SET LastHeartbeatAt │
       │                        │      = NOW()           │
       │                        ├───────────────────────>│
       │                        │<───────────────────────┤
       │                        │                        │
       │ 200 OK                 │                        │
       │<───────────────────────┤                        │
       │                        │                        │
       │                        │                        │
    [Aguarda 10 minutos]        │                        │
       │                        │                        │
       │ POST /api/heartbeat    │                        │
       ├───────────────────────>│                        │
       │ ...                    │                        │
       │                        │                        │
```

**Regra de Negócio:** 
- Agent é **ONLINE** se `LastHeartbeatAt` < 10 minutos atrás
- Agent é **OFFLINE** se `LastHeartbeatAt` >= 10 minutos atrás

---

## 3️⃣ FLUXO COMPLETO: ATUALIZAÇÃO DE EMPRESA

```
┌───────────┐   ┌─────────┐   ┌──────────┐   ┌────────┐   ┌──────────┐
│  Admin    │   │   API   │   │PostgreSQL│   │RabbitMQ│   │  Agent   │
│   Web     │   │         │   │          │   │        │   │          │
└─────┬─────┘   └────┬────┘   └────┬─────┘   └───┬────┘   └────┬─────┘
      │              │              │             │             │
      │              │              │             │             │
 ┌────┴─────┐        │              │             │             │
 │ 1. Admin │        │              │             │             │
 │ solicita │        │              │             │             │
 │ update   │        │              │             │             │
 │ empresa  │        │              │             │             │
 └────┬─────┘        │              │             │             │
      │              │              │             │             │
      │ POST /api/   │              │             │             │
      │ companies/   │              │             │             │
      │ {id}/update  │              │             │             │
      │              │              │             │             │
      │ Body: {      │              │             │             │
      │  TargetVer   │              │             │             │
      │ }            │              │             │             │
      ├─────────────>│              │             │             │
      │              │              │             │             │
      │              │ 1. Busca     │             │             │
      │              │    agentes   │             │             │
      │              │    ONLINE    │             │             │
      │              │              │             │             │
      │              │ SELECT Agent │             │             │
      │              │  WHERE       │             │             │
      │              │   CompanyId  │             │             │
      │              │   AND        │             │             │
      │              │  LastHB >    │             │             │
      │              │   NOW()-10min│             │             │
      │              ├─────────────>│             │             │
      │              │<─────────────┤             │             │
      │              │              │             │             │
      │              │ Agentes:     │             │             │
      │              │ - A1, A2, A3 │             │             │
      │              │              │             │             │
      │              │ 2. Lista     │             │             │
      │              │    módulos   │             │             │
      │              │    distintos │             │             │
      │              │              │             │             │
      │              │ Módulos:     │             │             │
      │              │ - MetaServer │             │             │
      │              │ - PDV        │             │             │
      │              │ - MetaPista  │             │             │
      │              │              │             │             │
      │              │ 3. Resolve   │             │             │
      │              │  dependências│             │             │
      │              │              │             │             │
      │              │ Graph:       │             │             │
      │              │ MetaServer→PDV             │             │
      │              │ PDV→MetaPista│             │             │
      │              │              │             │             │
      │              │ Waves:       │             │             │
      │              │ Wave 0:      │             │             │
      │              │  MetaServer  │             │             │
      │              │ Wave 1: PDV  │             │             │
      │              │ Wave 2:      │             │             │
      │              │  MetaPista   │             │             │
      │              │              │             │             │
      │              │ 4. Cria      │             │             │
      │              │    UpdatePlan│             │             │
      │              │              │             │             │
      │              │ INSERT       │             │             │
      │              │ CompanyUpdate│             │             │
      │              │ Plan         │             │             │
      │              ├─────────────>│             │             │
      │              │<─────────────┤             │             │
      │              │              │             │             │
      │              │ 5. Cria      │             │             │
      │              │    Stages    │             │             │
      │              │              │             │             │
      │              │ INSERT       │             │             │
      │              │ CompanyUpdate│             │             │
      │              │ Stage (x3)   │             │             │
      │              ├─────────────>│             │             │
      │              │<─────────────┤             │             │
      │              │              │             │             │
      │              │ 6. Inicia    │             │             │
      │              │    Wave 0    │             │             │
      │              │ (MetaServer) │             │             │
      │              │              │             │             │
      │              │ UPDATE Stage │             │             │
      │              │  SET Status= │             │             │
      │              │   RUNNING    │             │             │
      │              ├─────────────>│             │             │
      │              │<─────────────┤             │             │
      │              │              │             │             │
      │              │ 7. Cria      │             │             │
      │              │    comandos  │             │             │
      │              │    por agente│             │             │
      │              │              │             │             │
      │              │ Para A1, A2, │             │             │
      │              │ A3:          │             │             │
      │              │              │             │             │
      │              │ INSERT       │             │             │
      │              │ AgentCommand │             │             │
      │              │ (Status:     │             │             │
      │              │  PENDING)    │             │             │
      │              ├─────────────>│             │             │
      │              │<─────────────┤             │             │
      │              │              │             │             │
      │              │ 8. Publica   │             │             │
      │              │    mensagens │             │             │
      │              │              │             │             │
      │              │ Online:      │             │             │
      │              │ agent.wakeup.│             │             │
      │              │  v2 {cmdId}  │             │             │
      │              │ Offline*:    │             │             │
      │              │ agent.update │             │             │
      │              ├──────────────┼────────────>│             │
      │              │              │             │             │
      │ 200 OK       │              │             │             │
      │ { PlanId }   │              │             │             │
      │<─────────────┤              │             │             │
      │              │              │             │             │
      │              │              │             │ ┌───────────┤
      │              │              │             │ │ Recebe    │
      │              │              │             │ │ wake-up   │
      │              │              │             │ │ (commandId)│
      │              │              │             │ └───────────┤
      │              │              │             │             │
      │              │              │             │ GET /api/   │
      │              │              │             │ agentcommands
      │              │              │             │ /commands   │
      │              │              │             │ ou /command?commandId=
      │              │<─────────────┼─────────────┼─────────────┤
      │              │              │             │             │
      │              │ 1. Busca     │             │             │
      │              │    comandos  │             │             │
      │              │    PENDING   │             │             │
      │              │              │             │             │
      │              │ SELECT       │             │             │
      │              │ AgentCommand │             │             │
      │              │  WHERE       │             │             │
      │              │   AgentId=A1 │             │             │
      │              │   AND Status │             │             │
      │              │    =PENDING  │             │             │
      │              ├─────────────>│             │             │
      │              │<─────────────┤             │             │
      │              │              │             │             │
      │              │ 2. Marca     │             │             │
      │              │    IN_PROGRESS             │             │
      │              │              │             │             │
      │              │ UPDATE       │             │             │
      │              │ AgentCommand │             │             │
      │              │  SET Status= │             │             │
      │              │  IN_PROGRESS │             │             │
      │              ├─────────────>│             │             │
      │              │<─────────────┤             │             │
      │              │              │             │             │
      │              │ 200 OK       │             │             │
      │              │ [Commands]   │             │             │
      │              ├──────────────┼─────────────┼────────────>│
      │              │              │             │             │
      │              │              │             │     ┌───────┴──┐
      │              │              │             │     │ Executa  │
      │              │              │             │     │ update   │
      │              │              │             │     │ módulo   │
      │              │              │             │     └───────┬──┘
      │              │              │             │             │
      │              │              │             │ POST /api/  │
      │              │              │             │ agentcommands
      │              │              │             │ /commands/  │
      │              │              │             │ result      │
      │              │              │             │             │
      │              │              │             │ Body: {     │
      │              │              │             │  CommandId, │
      │              │              │             │  Success:   │
      │              │              │             │   true      │
      │              │              │             │ }           │
      │              │<─────────────┼─────────────┼─────────────┤
      │              │              │             │             │
      │              │ 1. Valida    │             │             │
      │              │    agente    │             │             │
      │              │    online    │             │             │
      │              │              │             │             │
      │              │ 2. Marca     │             │             │
      │              │    SUCCESS   │             │             │
      │              │              │             │             │
      │              │ UPDATE       │             │             │
      │              │ AgentCommand │             │             │
      │              │  SET Status= │             │             │
      │              │   SUCCESS    │             │             │
      │              ├─────────────>│             │             │
      │              │<─────────────┤             │             │
      │              │              │             │             │
      │              │ 3. Orquestra:│             │             │
      │              │  Verifica se │             │             │
      │              │  stage pode  │             │             │
      │              │  ser         │             │             │
      │              │  completado  │             │             │
      │              │              │             │             │
      │              │ SELECT COUNT │             │             │
      │              │  FROM        │             │             │
      │              │ AgentCommand │             │             │
      │              │  WHERE       │             │             │
      │              │  Status IN   │             │             │
      │              │  (PENDING,   │             │             │
      │              │   IN_PROGRESS│             │             │
      │              │  )           │             │             │
      │              ├─────────────>│             │             │
      │              │<─── (0) ─────┤             │             │
      │              │              │             │             │
      │              │ ✅ Todos     │             │             │
      │              │    agentes   │             │             │
      │              │    finalizaram             │             │
      │              │              │             │             │
      │              │ 4. Completa  │             │             │
      │              │    Stage     │             │             │
      │              │              │             │             │
      │              │ UPDATE Stage │             │             │
      │              │  SET Status= │             │             │
      │              │   COMPLETED  │             │             │
      │              ├─────────────>│             │             │
      │              │<─────────────┤             │             │
      │              │              │             │             │
      │              │ 5. Inicia    │             │             │
      │              │    próxima   │             │             │
      │              │    wave (PDV)│             │             │
      │              │              │             │             │
      │              │ [Repete      │             │             │
      │              │  processo    │             │             │
      │              │  para PDV]   │             │             │
      │              │              │             │             │
      │              │ 200 OK       │             │             │
      │              ├──────────────┼─────────────┼────────────>│
      │              │              │             │             │
```

**Dispatch (passo 8):** Agente **online** → exchange `agent.wakeup.v2` (direct, payload `{ commandId }`). Agente **offline** e módulo com `SupportsAsyncCompletion` (PDV, MetaPosto) → exchange `agent.update` (mensagem persistente, TTL ex.: 12 h). Demais casos: só comando PENDING (polling quando voltar).

---

## 4️⃣ FLUXO: RETRY DE COMANDO FALHADO

```
┌────────────────┐     ┌──────────────┐     ┌──────────────┐
│ RetryHosted    │     │     API      │     │  PostgreSQL  │
│   Service      │     │   (Service)  │     │              │
│ (Background    │     │              │     │              │
│  Job - 1min)   │     │              │     │              │
└───────┬────────┘     └──────┬───────┘     └──────┬───────┘
        │                     │                     │
        │                     │                     │
    [Timer: 1 minuto]         │                     │
        │                     │                     │
        │ Trigger             │                     │
        ├────────────────────>│                     │
        │                     │                     │
        │                     │ 1. Busca comandos   │
        │                     │    para retry       │
        │                     │                     │
        │                     │ SELECT AgentCommand │
        │                     │  WHERE              │
        │                     │   NextRetryAt <=NOW │
        │                     │   AND RetryCount<3  │
        │                     │   AND Status IN     │
        │                     │    (FAILED, PENDING)│
        │                     ├────────────────────>│
        │                     │<────────────────────┤
        │                     │                     │
        │                     │ Comandos: [C1, C2]  │
        │                     │                     │
        │                     │ 2. Para cada comando│
        │                     │                     │
        │                     │ Para C1:            │
        │                     │                     │
        │                     │ 3. Busca Agent      │
        │                     │                     │
        │                     │ SELECT Agent        │
        │                     │  WHERE              │
        │                     │   AgentId=...       │
        │                     ├────────────────────>│
        │                     │<────────────────────┤
        │                     │                     │
        │                     │ 4. Verifica se      │
        │                     │    agent está       │
        │                     │    ONLINE           │
        │                     │                     │
        │                     │ IF LastHeartbeatAt  │
        │                     │  < NOW() - 10min    │
        │                     │  THEN OFFLINE       │
        │                     │                     │
        │                     │ ❌ Agent OFFLINE    │
        │                     │                     │
        │                     │ 5. Expira comando   │
        │                     │                     │
        │                     │ UPDATE AgentCommand │
        │                     │  SET Status=EXPIRED │
        │                     │    FailureType=     │
        │                     │     OFFLINE         │
        │                     ├────────────────────>│
        │                     │<────────────────────┤
        │                     │                     │
        │                     │ Para C2:            │
        │                     │                     │
        │                     │ SELECT Agent        │
        │                     ├────────────────────>│
        │                     │<────────────────────┤
        │                     │                     │
        │                     │ ✅ Agent ONLINE     │
        │                     │                     │
        │                     │ 6. Prepara retry    │
        │                     │                     │
        │                     │ RetryCount++        │
        │                     │ NextRetryAt =       │
        │                     │  NOW() +            │
        │                     │  Backoff[count]     │
        │                     │                     │
        │                     │ Backoff:            │
        │                     │ [0]: 5 min          │
        │                     │ [1]: 15 min         │
        │                     │ [2]: 30 min         │
        │                     │                     │
        │                     │ UPDATE AgentCommand │
        │                     │  SET                │
        │                     │   Status=PENDING    │
        │                     │   RetryCount=       │
        │                     │    RetryCount+1     │
        │                     │   NextRetryAt=...   │
        │                     ├────────────────────>│
        │                     │<────────────────────┤
        │                     │                     │
        │                     │ 7. Publica wake-up  │
        │                     │                     │
        │                     │ [RabbitMQ publish]  │
        │                     │                     │
        │ Completed           │                     │
        │<────────────────────┤                     │
        │                     │                     │
    [Aguarda 1 minuto]        │                     │
        │                     │                     │
```

**Regras de Retry:**
- **TRANSIENT** → Agenda retry com backoff
- **FATAL** → Marca FAILED, sem retry
- **Offline** → Marca EXPIRED
- **Max 3 retries** → Após isso, marca FAILED

---

## 5️⃣ ESTADOS DE UM COMANDO

```
                     ┌─────────────┐
                     │   PENDING   │ ← Comando criado
                     └──────┬──────┘
                            │
                            │ Agent faz polling
                            ▼
                     ┌─────────────┐
                     │IN_PROGRESS  │ ← Agent pegou comando
                     └──────┬──────┘
                            │
                ┌───────────┼───────────┐
                │           │           │
                ▼           ▼           ▼
         ┌──────────┐ ┌─────────┐ ┌─────────┐
         │ SUCCESS  │ │ FAILED  │ │ EXPIRED │
         └──────────┘ └────┬────┘ └─────────┘
                            │
                   ┌────────┴────────┐
                   │                 │
                   ▼                 ▼
            ┌────────────┐    ┌───────────┐
            │  FATAL     │    │ TRANSIENT │
            │  (fim)     │    │ (retry)   │
            └────────────┘    └─────┬─────┘
                                    │
                                    │ RetryHostedService
                                    ▼
                             ┌─────────────┐
                             │   PENDING   │ (novamente)
                             └─────────────┘
```

---

## 📊 RESUMO DE TEMPOS E THRESHOLDS

| Conceito | Valor | Onde está definido |
|----------|-------|-------------------|
| **Heartbeat intervalo** | 10 minutos | Agent (cliente) |
| **Agent offline threshold** | 10 minutos | `AgentPolicy.OfflineThreshold` |
| **Command SLA** | 3 horas | `CommandPolicy.CommandSLAHours` |
| **Retry backoff[0]** | 5 minutos | `RetryPolicy.GetBackoff(0)` |
| **Retry backoff[1]** | 15 minutos | `RetryPolicy.GetBackoff(1)` |
| **Retry backoff[2]** | 30 minutos | `RetryPolicy.GetBackoff(2)` |
| **Max retries** | 3 | `RetryPolicy.MaxRetries` |
| **RetryHostedService intervalo** | 1 minuto | `RetryHostedService` |

---

## 🎯 DECISÕES IMPORTANTES DO SISTEMA

### Quando um Agent é considerado OFFLINE?
```
LastHeartbeatAt < (NOW() - 10 minutos)
```

### Quando um Comando expira?
```
1. Agent está OFFLINE ao tentar retry
2. Comando ficou PENDING por > 3 horas (SLA)
```

### Quando um Stage pode ser completado?
```
COUNT(AgentCommand WHERE Status IN (PENDING, IN_PROGRESS)) = 0
```

### Quando a próxima Wave inicia?
```
1. Stage anterior está COMPLETED
2. Não há dependências pendentes
```

### Quando um UpdatePlan falha?
```
CASO ESPECIAL: MetaServerGlobal falha → Todo plano falha imediatamente
```

---

**Este documento deve ser atualizado conforme o sistema evolui!**
