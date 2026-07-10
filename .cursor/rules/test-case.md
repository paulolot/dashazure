---
title: Guia de Casos de testes
description: Contém especificação de casos de testes 
author: Paulo Lot
version: 1.0
date: 2025-02-06
---

# Casos de Teste — Atualizador API

**Documento:** Especificação de casos de teste para QA  
**Produto:** API de orquestração de atualizações de agentes (Atualizador API)  
**Base:** [prd.md]  
**Versão:** 1.0  
**Última atualização:** 02/02/2025  

---

## 1. Escopo e objetivo

Este documento define **casos de teste** para validar funcionalidades, regras de negócio, segurança e tratamento de erros da Atualizador API, alinhados ao PRD e às User Stories. Os casos podem ser executados manualmente ou automatizados (ex.: testes de integração/API).

### 1.1 Convenções

| Campo | Descrição |
|-------|------------|
| **ID** | Identificador único do caso de teste (ex.: TC-AG-001). |
| **Título** | Nome curto do cenário. |
| **Prioridade** | Alta / Média / Baixa. |
| **Pré-condições** | Estado necessário antes da execução. |
| **Passos** | Ações e dados de entrada. |
| **Resultado esperado** | Comportamento e respostas esperadas. |
| **US/PRD** | User Story ou seção do PRD relacionada. |

### 1.2 Abreviações por área

- **TC-PA** — Parceiros
- **TC-CO** — Empresas (Companies)
- **TC-AG** — Agentes
- **TC-CM** — Comandos
- **TC-MD** — Módulos do agente
- **TC-SV** — Versão do sistema
- **TC-SG** — Segurança e autenticação
- **TC-ER** — Tratamento de erros
- **TC-BG** — Serviços em background

---

## 2. Parceiros

### TC-PA-001 — Listar empresas de um parceiro (sucesso)

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | Parceiro existente com pelo menos uma empresa cadastrada. |
| **Passos** | 1. Enviar GET `/api/partners/{partnerId}/companies`. |
| **Resultado esperado** | 200 OK; body com lista de empresas; cada item contém Id, CnpjCliente, NomeFantasia, PartnerId, PartnerNome, AgentsCount. |
| **US/PRD** | US-1.1 |

---

### TC-PA-002 — Listar empresas de parceiro inexistente

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | PartnerId que não existe no banco. |
| **Passos** | 1. Enviar GET `/api/partners/{partnerId}/companies` com GUID inválido ou não cadastrado. |
| **Resultado esperado** | 404 Not Found; body `application/problem+json` com title "Not Found". |
| **US/PRD** | US-1.1 |

---

### TC-PA-003 — Gerar API Key do parceiro (primeira vez)

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | Parceiro existente **sem** credencial ativa (API Key nunca gerada ou revogada). |
| **Passos** | 1. Enviar POST `/api/partners/{partnerId}/apikey`. |
| **Resultado esperado** | 200 OK; body contém `{ "ApiKey": "..." }`; valor não vazio; credencial persistida como hash BCrypt. |
| **US/PRD** | US-1.2, §3.2 PRD |

---

### TC-PA-004 — Gerar API Key quando já existe ativa

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | Parceiro com API Key já gerada e ativa (sem RevokedAt). |
| **Passos** | 1. Enviar POST `/api/partners/{partnerId}/apikey`. |
| **Resultado esperado** | 409 ou 422; mensagem indicando que API Key já foi gerada e não é possível regenerar. |
| **US/PRD** | US-1.2, §3.2 PRD |

---

### TC-PA-005 — Gerar API Key para parceiro inexistente

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Média |
| **Pré-condições** | PartnerId inexistente. |
| **Passos** | 1. Enviar POST `/api/partners/{partnerId}/apikey`. |
| **Resultado esperado** | 404 Not Found. |
| **US/PRD** | US-1.2 |

---

## 3. Empresas (Companies)

### TC-CO-001 — Listar todas as empresas

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | Banco com pelo menos uma empresa. |
| **Passos** | 1. Enviar GET `/api/companies`. |
| **Resultado esperado** | 200 OK; lista com Id, CnpjCliente, NomeFantasia, PartnerId, PartnerNome, AgentsCount. |
| **US/PRD** | US-2.1 |

---

### TC-CO-002 — Dashboard da empresa (sucesso)

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | Empresa existente. |
| **Passos** | 1. Enviar GET `/api/companies/{companyId}/dashboard`. |
| **Resultado esperado** | 200 OK; CompanyDashboardDto com CompanyId, CompanyName, Status, DistributionVersion, TotalAgents, AgentsOnline, AgentsOffline, AgentsUpdating, LastPlanStartedAt, LastPlanFinishedAt. |
| **US/PRD** | US-2.2 |

---

### TC-CO-003 — Dashboard da empresa inexistente

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Média |
| **Passos** | 1. GET `/api/companies/{companyId}/dashboard` com companyId inexistente. |
| **Resultado esperado** | 404 Not Found. |
| **US/PRD** | US-2.2 |

---

### TC-CO-004 — Status da empresa (Atualizado / Pendente / Atualizando)

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | Empresa existente. |
| **Passos** | 1. GET `/api/companies/{companyId}/status`. |
| **Resultado esperado** | 200 OK; CompanyStatusDto com CompanyId, CompanyName, DistributionVersion, Status (Atualizado, Pendente, Atualizando, Atualizado Parcialmente ou Atualização Falhou). |
| **US/PRD** | US-2.3 |

---

### TC-CO-005 — Timeline da empresa

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Média |
| **Pré-condições** | Empresa com eventos registrados. |
| **Passos** | 1. GET `/api/companies/{companyId}/timeline`. |
| **Resultado esperado** | 200 OK; lista de CompanyTimelineItemDto (At, Type, Description); ordenada por data; até 200 itens. |
| **US/PRD** | US-2.4 |

---

### TC-CO-006 — Listar agentes da empresa

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | Empresa com pelo menos um agente. |
| **Passos** | 1. GET `/api/companies/{companyId}/agents`. |
| **Resultado esperado** | 200 OK; lista de AgentStatusDto (AgentId, CnpjCliente, LastHeartbeatAt, Status: Operante, Atualizando ou Offline). |
| **US/PRD** | US-2.5 |

---

### TC-CO-007 — Listar agentes de empresa inexistente

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Média |
| **Passos** | 1. GET `/api/companies/{companyId}/agents` com companyId inexistente. |
| **Resultado esperado** | 404 Not Found. |
| **US/PRD** | US-2.5 |

---

### TC-CO-008 — Listar planos de atualização da empresa

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | Empresa existente. |
| **Passos** | 1. GET `/api/companies/{companyId}/plans`. |
| **Resultado esperado** | 200 OK; lista de CompanyUpdatePlanSummaryDto (PlanId, TargetVersion, Status, StartedAt, FinishedAt). |
| **US/PRD** | US-2.6 |

---

### TC-CO-009 — Iniciar atualização da empresa com TargetVersion

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | Empresa existente; agentes online; SystemVersion ou TargetVersion válida. |
| **Passos** | 1. POST `/api/companies/{companyId}/update` com body `{ "TargetVersion": "1.0.0" }`. |
| **Resultado esperado** | 202 Accepted; CompanyUpdatePlan criado; stages por módulo; comandos e wakeup disparados para agentes online. |
| **US/PRD** | US-2.7, §4.4 PRD |

---

### TC-CO-010 — Iniciar atualização da empresa sem TargetVersion (usa versão ativa)

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | Empresa existente; pelo menos uma SystemVersion com IsActive = true. |
| **Passos** | 1. POST `/api/companies/{companyId}/update` com body vazio ou sem TargetVersion. |
| **Resultado esperado** | 202 Accepted; plano criado usando versão ativa do sistema. |
| **US/PRD** | US-2.7, §3.6 PRD |

---

### TC-CO-011 — Iniciar atualização sem versão ativa e sem TargetVersion

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | Nenhuma SystemVersion com IsActive = true; body sem TargetVersion. |
| **Passos** | 1. POST `/api/companies/{companyId}/update` sem TargetVersion. |
| **Resultado esperado** | 400 Bad Request (ou 422); mensagem indicando necessidade de versão alvo. |
| **US/PRD** | US-2.7 |

---

### TC-CO-012 — Iniciar atualização apenas com agentes online

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Média |
| **Pré-condições** | Empresa com agentes online e offline; LastHeartbeatAt dos offline &gt; 10 min. |
| **Passos** | 1. POST `/api/companies/{companyId}/update`. 2. Verificar planos e comandos criados. |
| **Resultado esperado** | Apenas agentes online (LastHeartbeatAt dentro de 10 min) recebem comandos no plano. |
| **US/PRD** | US-2.7, §3.6 PRD |

---

## 4. Agentes

### TC-AG-001 — Registrar agente novo (primeiro registro)

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Crítica |
| **Pré-condições** | Parceiro existente com API Key ativa; AgentId nunca registrado. |
| **Passos** | 1. POST `/api/agents/register` com AgentRegistrationRequest (AgentId, CnpjCliente, CnpjParceiro, Hostname, IpAddress, Modules). 2. Header `X-Partner-ApiKey` com API Key válida. |
| **Resultado esperado** | 200 OK; body `{ "AgentId": "...", "AgentSecret": "..." }`; AgentSecret não vazio; credencial persistida como hash; Company/Agent criados ou obtidos; módulos em upsert por ModuleName. |
| **US/PRD** | US-3.1, §4.1 PRD |

---

### TC-AG-002 — Registrar agente já existente (atualização)

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Crítica |
| **Pré-condições** | Agente já registrado (com AgentSecret conhecido). |
| **Passos** | 1. POST `/api/agents/register` com mesmo AgentId, headers `X-Partner-ApiKey` e `X-Agent-Secret` válidos. |
| **Resultado esperado** | 200 OK; body vazio ou sem AgentSecret; dados do agente/módulos atualizados. |
| **US/PRD** | US-3.1 |

---

### TC-AG-003 — Registro sem X-Partner-ApiKey

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Passos** | 1. POST `/api/agents/register` sem header `X-Partner-ApiKey`. |
| **Resultado esperado** | 401 Unauthorized; mensagem indicando credencial de parceiro ausente ou inválida. |
| **US/PRD** | US-3.1, §3.1 PRD |

---

### TC-AG-004 — Registro com parceiro inexistente (documento)

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | CnpjParceiro que não existe no banco; API Key de outro parceiro ou inválida. |
| **Passos** | 1. POST `/api/agents/register` com CnpjParceiro não cadastrado e API Key válida de outro contexto, ou documento inexistente. |
| **Resultado esperado** | 422 Unprocessable Entity; BusinessRuleException "Parceiro não cadastrado" (ou equivalente). |
| **US/PRD** | US-3.1, §3.1 PRD |

---

### TC-AG-005 — Registro agente já existente sem X-Agent-Secret

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | AgentId já registrado. |
| **Passos** | 1. POST `/api/agents/register` com AgentId existente, header `X-Partner-ApiKey` válido, **sem** `X-Agent-Secret`. |
| **Resultado esperado** | 401 (ou 400); exigência de X-Agent-Secret para agente já registrado. |
| **US/PRD** | US-3.1 |

---

### TC-AG-006 — Heartbeat com credenciais válidas

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Crítica |
| **Pré-condições** | Agente registrado; AgentSecret válido. |
| **Passos** | 1. POST `/api/heartbeat` com body `{ "AgentId": "..." }`, headers `X-Agent-Id` e `X-Agent-Secret` corretos. |
| **Resultado esperado** | 204 No Content; LastHeartbeatAt do agente atualizado. |
| **US/PRD** | US-3.2, §4.2 PRD |

---

### TC-AG-007 — Heartbeat sem headers de agente

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Passos** | 1. POST `/api/heartbeat` com body `{ "AgentId": "..." }` sem `X-Agent-Id` e `X-Agent-Secret`. |
| **Resultado esperado** | 401 Unauthorized; corpo texto "Missing agent credentials" (ou equivalente). |
| **US/PRD** | US-3.2, US-S.1 |

---

### TC-AG-008 — Heartbeat com secret inválido

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | Agente existente. |
| **Passos** | 1. POST `/api/heartbeat` com `X-Agent-Id` correto e `X-Agent-Secret` incorreto. |
| **Resultado esperado** | 401 Unauthorized; "Invalid agent credentials" (ou equivalente). |
| **US/PRD** | US-S.1 |

---

### TC-AG-009 — Heartbeat para agente inexistente

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Média |
| **Passos** | 1. POST `/api/heartbeat` com AgentId inexistente e headers válidos (de outro agente) ou middleware retorna 404 quando agente não existe após validação. |
| **Resultado esperado** | 404 Not Found (se aplicável após validação de credenciais). |
| **US/PRD** | US-3.2 |

---

### TC-AG-010 — Listar agentes com status (Operante / Atualizando / Offline)

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | Agentes cadastrados com diferentes LastHeartbeatAt e comandos IN_PROGRESS. |
| **Passos** | 1. GET `/api/agents/list`. |
| **Resultado esperado** | 200 OK; lista AgentStatusDto; Status = Operante (heartbeat &lt; 10 min, sem comando IN_PROGRESS), Atualizando (com IN_PROGRESS) ou Offline (heartbeat &gt; 10 min). |
| **US/PRD** | US-3.3, §3.3 PRD |

---

### TC-AG-011 — Visão geral de agentes com módulos

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Passos** | 1. GET `/api/agents/overview`. |
| **Resultado esperado** | 200 OK; AgentWithModulesDto com AgentId, Hostname, CnpjCliente, CnpjParceiro, Status, Modules (ModuleName, ActiveVersion, DownloadedVersion, CanDownload, CanUpdate, UpdateStatus). |
| **US/PRD** | US-3.4 |

---

### TC-AG-012 — Status de um agente específico

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Média |
| **Passos** | 1. GET `/api/agents/{agentId}/status`. |
| **Resultado esperado** | 200 OK; AgentStatusDto; 404 se agentId inexistente. |
| **US/PRD** | US-3.5 |

---

### TC-AG-013 — Timeline de um agente

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Média |
| **Passos** | 1. GET `/api/agents/{agentId}/timeline`. |
| **Resultado esperado** | 200 OK; lista AgentTimelineItemDto (At, Type, Description); limite 200. |
| **US/PRD** | US-3.6 |

---

## 5. Comandos

### TC-CM-001 — Criar comando UPDATE_MODULE

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Crítica |
| **Pré-condições** | Agente existente. |
| **Passos** | 1. POST `/api/agentcommands/update-module?agentId=...&moduleName=MetaServerGlobal&targetVersion=1.0.0`. |
| **Resultado esperado** | 202 Accepted; body com CommandId e Status; comando criado; evento UPDATE_STARTED; wakeup publicado. |
| **US/PRD** | US-4.1, §4.3 PRD |

---

### TC-CM-002 — Criar comando com parâmetros inválidos

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Passos** | 1. POST `/api/agentcommands/update-module` sem agentId ou com moduleName vazio ou targetVersion vazio. |
| **Resultado esperado** | 400 Bad Request. |
| **US/PRD** | US-4.1 |

---

### TC-CM-003 — Orquestrar atualização de um agente (update-modules)

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | Agente com módulos (CanDownload ou CanUpdate). |
| **Passos** | 1. POST `/api/agents/{agentId}/update-modules` com body `{ "TargetVersion": "1.0.0" }`. |
| **Resultado esperado** | 202 Accepted; comando(s) SYNC_MODULES criado(s) para módulos elegíveis; sem CompanyUpdatePlanId; 404 se agente não existir. |
| **US/PRD** | US-4.2 |

---

### TC-CM-004 — Polling de comandos (GET commands) com credenciais válidas

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Crítica |
| **Pré-condições** | Agente com comandos PENDING; headers X-Agent-Id e X-Agent-Secret válidos. |
| **Passos** | 1. GET `/api/agentcommands/commands?agentId=...` com headers de agente. |
| **Resultado esperado** | 200 com lista de comandos pendentes; comandos retornados marcados IN_PROGRESS e ExecutedAt preenchido; ou 204 se não houver pendentes. |
| **US/PRD** | US-4.3, §4.3 PRD |

---

### TC-CM-005 — Polling sem credenciais de agente

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Passos** | 1. GET `/api/agentcommands/commands?agentId=...` sem X-Agent-Id e X-Agent-Secret. |
| **Resultado esperado** | 401 Unauthorized. |
| **US/PRD** | US-4.3, US-S.1 |

---

### TC-CM-006 — Reportar resultado sucesso

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Crítica |
| **Pré-condições** | Comando existente em IN_PROGRESS; agente online. |
| **Passos** | 1. POST `/api/agentcommands/commands/result` com body `{ "CommandId": "...", "Success": true }`, headers X-Agent-Id e X-Agent-Secret. |
| **Resultado esperado** | 204 No Content; comando marcado SUCCESS; evento UPDATE_FINISHED; orquestração atualiza stage/plano se aplicável. |
| **US/PRD** | US-4.4, §3.4 PRD |

---

### TC-CM-007 — Reportar resultado falha (TRANSIENT) e retry

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | Comando IN_PROGRESS; RetryCount &lt; MaxRetries. |
| **Passos** | 1. POST `/api/agentcommands/commands/result` com Success: false, FailureType: TRANSIENT. |
| **Resultado esperado** | 204; comando marcado para retry (NextRetryAt preenchido conforme backoff); evento UPDATE_FAILED. |
| **US/PRD** | US-4.4, §3.5 PRD |

---

### TC-CM-008 — Reportar resultado falha FATAL

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Passos** | 1. POST `/api/agentcommands/commands/result` com Success: false, FailureType: FATAL. |
| **Resultado esperado** | 204; comando marcado FAILED; sem novo retry. |
| **US/PRD** | US-4.4, §3.5 PRD |

---

### TC-CM-009 — Idempotência ao reportar resultado (comando já SUCCESS/FAILED/EXPIRED)

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Média |
| **Pré-condições** | Comando já em status SUCCESS, FAILED ou EXPIRED. |
| **Passos** | 1. POST `/api/agentcommands/commands/result` para esse comando com Success: true ou false. |
| **Resultado esperado** | 204; processamento ignorado (idempotente); status do comando não alterado. |
| **US/PRD** | US-4.4, §3.4 PRD |

---

### TC-CM-010 — Reportar resultado com agente offline

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | Agente com LastHeartbeatAt &gt; 10 min (offline). |
| **Passos** | 1. POST `/api/agentcommands/commands/result` com headers do agente offline. |
| **Resultado esperado** | 204; comando marcado EXPIRED (FailureType OFFLINE); evento COMMAND_EXPIRED. |
| **US/PRD** | US-4.4, §3.4 PRD |

---

### TC-CM-011 — Não criar comando duplicado (update-modules idempotente)

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Média |
| **Pré-condições** | Agente com comando SYNC_MODULES já PENDING ou IN_PROGRESS para mesma versão. |
| **Passos** | 1. POST `/api/agents/{agentId}/update-modules` novamente com mesmo TargetVersion. |
| **Resultado esperado** | 202 sem criar novo comando duplicado (comportamento idempotente conforme US-4.2). |
| **US/PRD** | US-4.2 |

---

## 6. Módulos do agente

### TC-MD-001 — Atualizar estado dos módulos (POST modules/state)

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | Agente registrado com módulos; credenciais válidas. |
| **Passos** | 1. POST `/api/agents/modules/state` com AgentId e lista Modules (ModuleName, DownloadedVersion, ActiveVersion); headers X-Agent-Id e X-Agent-Secret. |
| **Resultado esperado** | 204 No Content; apenas módulos já existentes no agente atualizados; módulos não cadastrados ignorados. |
| **US/PRD** | US-5.1 |

---

### TC-MD-002 — POST modules/state sem credenciais

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Passos** | 1. POST `/api/agents/modules/state` sem X-Agent-Id e X-Agent-Secret. |
| **Resultado esperado** | 401 Unauthorized. |
| **US/PRD** | US-5.1, US-S.1 |

---

### TC-MD-003 — Status dos módulos de um agente

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Média |
| **Passos** | 1. GET `/api/agents/modules/{agentId}/modules/status`. |
| **Resultado esperado** | 200 OK; lista ModuleStatusDto (ModuleName, ActiveVersion, TargetVersion, Status) em relação ao último plano da empresa. |
| **US/PRD** | US-5.2 |

---

## 7. Versão do sistema

### TC-SV-001 — Consultar versão ativa

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | Uma SystemVersion com IsActive = true. |
| **Passos** | 1. GET `/api/system-version`. |
| **Resultado esperado** | 200 OK; SystemVersionDto (Version, Tipo, Descricao, datas); ou 204 se não houver versão ativa. |
| **US/PRD** | US-6.1 |

---

### TC-SV-002 — Definir nova versão ativa

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Passos** | 1. POST `/api/system-version` com SetSystemVersionDto (Version, Tipo, Descricao, etc.). |
| **Resultado esperado** | 204 No Content; todas as versões desativadas; nova versão criada com IsActive = true. |
| **US/PRD** | US-6.2, §3.8 PRD |

---

### TC-SV-003 — Definir versão com Version vazio

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Média |
| **Passos** | 1. POST `/api/system-version` com Version vazio ou nulo. |
| **Resultado esperado** | 400 Bad Request. |
| **US/PRD** | US-6.2 |

---

### TC-SV-004 — Histórico de versões

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Média |
| **Passos** | 1. GET `/api/system-version/history`. |
| **Resultado esperado** | 200 OK; lista de todas as versões (SystemVersionDto). |
| **US/PRD** | US-6.3 |

---

## 8. Segurança e autenticação

### TC-SG-001 — Middleware aplicado em rotas protegidas

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Passos** | 1. Chamar GET `/api/agentcommands/commands`, POST `/api/agentcommands/commands/result`, POST `/api/heartbeat`, POST `/api/agents/modules/state` sem headers X-Agent-Id e X-Agent-Secret. |
| **Resultado esperado** | 401 em todas; corpo texto para credenciais ausentes/inválidas. |
| **US/PRD** | US-S.1, §3.2 PRD |

---

### TC-SG-002 — Credencial de agente revogada

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | Agente com credencial revogada (RevokedAt preenchido). |
| **Passos** | 1. POST `/api/heartbeat` com X-Agent-Id e X-Agent-Secret do agente com credencial revogada. |
| **Resultado esperado** | 401 Unauthorized. |
| **US/PRD** | US-S.1 |

---

### TC-SG-003 — AgentSecret retornado apenas no primeiro registro

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | Agente já registrado. |
| **Passos** | 1. Chamar novamente POST `/api/agents/register` com mesmo AgentId (atualização) com X-Agent-Secret válido. |
| **Resultado esperado** | 200 sem body contendo AgentSecret (secret não é reexposto). |
| **US/PRD** | US-S.3 |

---

### TC-SG-004 — API Key armazenada como hash (nunca em texto)

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Média |
| **Pré-condições** | API Key gerada para um parceiro. |
| **Passos** | 1. Inspecionar banco (PartnerCredential): ApiKeyHash deve existir; não deve existir campo com valor em texto puro da API Key. |
| **Resultado esperado** | Apenas hash BCrypt armazenado. |
| **US/PRD** | US-S.5, §3.2 PRD |

---

## 9. Tratamento de erros

### TC-ER-001 — EntityNotFoundException retorna 404

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Passos** | 1. GET `/api/agents/{agentId}/status` com agentId inexistente. 2. GET `/api/companies/{companyId}/dashboard` com companyId inexistente. |
| **Resultado esperado** | 404 Not Found; Content-Type `application/problem+json`; title "Not Found"; detail preenchido. |
| **US/PRD** | US-8.1, §3.10 PRD |

---

### TC-ER-002 — BusinessRuleException retorna 422

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Passos** | 1. Disparar ação que viola regra de negócio (ex.: parceiro não cadastrado no registro de agente). |
| **Resultado esperado** | 422 Unprocessable Entity; `application/problem+json`; title "Business rule violation". |
| **US/PRD** | US-8.1, §3.10 PRD |

---

### TC-ER-003 — 401 com corpo texto (credenciais)

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Média |
| **Passos** | 1. Chamar endpoint protegido por AgentAuthenticationMiddleware sem credenciais. |
| **Resultado esperado** | 401; corpo em texto (não problem+json); mensagem "Missing agent credentials" ou similar. |
| **US/PRD** | §3.10 PRD |

---

### TC-ER-004 — Exceção não mapeada retorna 500

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Média |
| **Passos** | 1. Provocar erro interno (ex.: dependência indisponível ou dado que gera exceção não tratada). |
| **Resultado esperado** | 500 Internal Server Error; `application/problem+json`; title "Internal Server Error". |
| **US/PRD** | US-8.1, §3.10 PRD |

---

## 10. Serviços em background

### TC-BG-001 — Retry de comandos (NextRetryAt)

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | Comando com NextRetryAt &lt;= now e status elegível para retry; agente online. |
| **Passos** | 1. Aguardar execução do RetryHostedService (intervalo 1 min). 2. Verificar que comando foi reprocessado (retry aplicado, wakeup publicado). |
| **Resultado esperado** | RetryHostedService processa comandos; novo retry agendado ou comando expirado se agente offline; backoff 5/15/30 min respeitado. |
| **US/PRD** | US-7.1, §4.5 PRD |

---

### TC-BG-002 — Comando expirado quando agente offline no retry

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | Comando com NextRetryAt &lt;= now; agente com LastHeartbeatAt &gt; 10 min. |
| **Passos** | 1. Executar ciclo do RetryHostedService. |
| **Resultado esperado** | Comando marcado EXPIRED; nenhum novo retry agendado. |
| **US/PRD** | US-7.1, §3.5 PRD |

---

### TC-BG-003 — Limpeza de eventos antigos (7 dias)

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Média |
| **Pré-condições** | AgentEvents com CreatedAt &gt; 7 dias no banco. |
| **Passos** | 1. Aguardar execução do EventCleanupService (intervalo 24h) ou disparar manualmente em teste. 2. Verificar que eventos com mais de 7 dias foram removidos. |
| **Resultado esperado** | Eventos com CreatedAt anterior a 7 dias removidos. |
| **US/PRD** | US-7.2, §3.9 PRD |

---

## 11. Planos de atualização e dependências

### TC-PL-001 — Stages respeitam ModuleDependencyGraph

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | Empresa com agentes online; módulos com dependências (ex.: MetaPista depende de GerenciadorPDV). |
| **Passos** | 1. POST `/api/companies/{companyId}/update`. 2. Verificar ordem dos stages e comandos. |
| **Resultado esperado** | Stage de um módulo só inicia (RUNNING) quando dependências estão COMPLETED; comandos disparados na ordem correta. |
| **US/PRD** | §3.6, §3.7 PRD |

---

### TC-PL-002 — Falha de MetaServerGlobal marca plano como FAILED

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | Plano de atualização em execução; estágio MetaServerGlobal em RUNNING. |
| **Passos** | 1. Reportar resultado de comando MetaServerGlobal com Success: false (POST commands/result). |
| **Resultado esperado** | Plano marcado FAILED; atualização interrompida; evento COMPANY_UPDATE_FAILED. |
| **US/PRD** | §3.6 PRD |

---

### TC-PL-003 — Conclusão do plano (todos os stages COMPLETED)

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Pré-condições** | Plano com múltiplos stages; todos os comandos dos stages reportados com sucesso. |
| **Passos** | 1. Reportar sucesso do último comando do último stage. |
| **Resultado esperado** | Todos os stages COMPLETED; plano COMPLETED; evento COMPANY_UPDATE_FINISHED. |
| **US/PRD** | §3.6 PRD |

---

### TC-PL-004 — Expiração de comandos por SLA (2 horas)

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Média |
| **Pré-condições** | Comando criado há mais de 2 horas sem execução (ou simulação). |
| **Passos** | 1. Durante processamento de resultado ou job de orquestração, comandos antigos devem ser expirados. |
| **Resultado esperado** | Comandos não executados dentro de 2 horas marcados EXPIRED na orquestração. |
| **US/PRD** | §3.4, §6 PRD |

---

## 12. Infraestrutura e API (smoke)

### TC-IF-001 — Swagger disponível

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Média |
| **Passos** | 1. GET `http://localhost:8080/swagger/index.html` (ou URL configurada). |
| **Resultado esperado** | 200 OK; documentação Swagger "Atualizador API" exibida. |
| **US/PRD** | US-T.1 |

---

### TC-IF-002 — API escuta na porta 8080

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Alta |
| **Passos** | 1. Requisição GET para `/api/companies` ou `/api/system-version` em `http://0.0.0.0:8080`. |
| **Resultado esperado** | Resposta 200 (ou 204) da API; não connection refused. |
| **US/PRD** | US-T.1, PRD §1.3 |

---

### TC-IF-003 — Content-Type problem+json em erros 404/422/500

| Atributo | Descrição |
|----------|-----------|
| **Prioridade** | Média |
| **Passos** | 1. Provocar 404 e 422 (e opcionalmente 500). 2. Verificar header Content-Type da resposta. |
| **Resultado esperado** | `application/problem+json`; body com `title` e `detail`. |
| **US/PRD** | US-T.9, §3.10 PRD |

---

## 13. Resumo e cobertura

| Área | Quantidade | Prioridade crítica/alta |
|------|------------|--------------------------|
| Parceiros | 5 | 4 |
| Empresas | 12 | 8 |
| Agentes | 13 | 8 |
| Comandos | 11 | 7 |
| Módulos | 3 | 2 |
| Versão do sistema | 4 | 2 |
| Segurança | 4 | 3 |
| Erros | 4 | 2 |
| Background | 3 | 2 |
| Planos e dependências | 4 | 3 |
| Infraestrutura | 3 | 1 |
| **Total** | **66** | **42** |

---