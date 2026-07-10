## Checklist operacional do Tech Lead

**Versão:** BPMN *ProcessoDesenvolvimentoVersao20260508* (SVG de 08/05/2026).

**Uso:** referência para board e Wiki do Azure DevOps. Revisão automatizada de código no repositório: `.cursor/commands/codereview.md` e `.cursor/rules/` (ver secção *Alinhamento com code review*).

---

### Índice

1. Visão geral dos pools (Demandas e Escopo)
2. Obrigações do Tech Lead (Demandas)
3. Obrigações do Tech Lead (Escopo — code review)
4. Eixos de revisão
5. DoR e DoD
6. Referência rápida (perguntas sim/não)
7. Alinhamento com code review
8. Mapa de raias (quem faz o quê)
9. Histórico

---

### 1. Visão geral dos pools

**Pool Demandas** (de cima para baixo)

- **Product Owner (raia superior):** cadastro da demanda e priorização no backlog.
- **Tech Lead (raia inferior):** análise no board, validação com o PO quando necessário, cadastro das tasks-padrão.

Sem mudança estrutural deste pool na v20260508.

**Pool Escopo** (de cima para baixo)

1. **Scrum Master** — prioridades do backlog, alocação, pipeline, release.
2. **Desenvolvedor** — implementação, documentação/Wiki, rework e correções, disponibilizar para revisão.
3. **QA** — raia explícita: testes (roteiro/caso de teste), merge, aprovação de PR, disponibilizar para pipeline.
4. **Tech Lead** — code review, `CodeAdjustment`, liberar para teste.

Na v20260508, **testes integrados + merge + PR + pipeline** aparecem na raia **QA** (antes costumavam aparecer misturados com Dev no desenho anterior).

---

### 2. Obrigações do Tech Lead — pool Demandas

Ordem sugerida de execução no diagrama:

1. **Analisar Demanda no Board** — descrição, critérios de aceite, impacto técnico e riscos.
2. **Necessita Validar?** (gateway) — decidir se a regra exige validação explícita com o PO.
3. **Validar Regra PO** — só se o gateway anterior exigir; registrar conclusão no card.
4. **Cadastrar Task [Requirements]** — requisitos técnicos derivados da demanda.
5. **Cadastrar Task [Development]** — decomposição do trabalho de implementação.
6. **Cadastrar Task [TechnicalValidation]** — como o dev comprova a entrega tecnicamente.
7. **Cadastrar Task [CodeReview]** — slot formal de revisão.
8. **Cadastrar Task [Testing]** — escopo ou roteiro de testes (consumo principal na raia QA).

**Nota:** eventos *Aguardar Disponibilidade* indicam espera até o fluxo liberar o próximo passo.

---

### 3. Obrigações do Tech Lead — pool Escopo (raia inferior)

1. **Colocar em “Realizando Revisão de Código”** — sinalizar no board que o review começou.
2. **Revisar Código** — seguir a secção *Eixos de revisão* e o comando de code review do repositório.
3. **Ajustar?** (gateway) — **Sim:** abrir trabalho corretivo; **Não:** liberar para teste.
4. **Cadastrar Task [CodeAdjustment]** — quando houver ajustes obrigatórios após o review.
5. **Colocar para “Disponível para Teste”** — saída da sua raia quando não houver ressalvas bloqueantes.

---

### 4. Eixos de revisão (apoio para “Revisar Código”)

Base técnica: `.cursor/commands/codereview.md`. **Prioridade às regras** do repositório (índice em `.cursor/rules/prd.md`), incluindo quando couber: `design-rules.md`, `DBA_GATILHOS.md` + `DBA_EXEMPLOS.md` (legado: `DBA_RULES.md`), regras de domínio (fiscal, financeiro, vendas), `GERAL_RULES.md`, `security-guide.md` (se houver gatilho).

Verificação sugerida:

- [ ] Regra de negócio alinhada a `Requirements` e critérios de aceite
- [ ] Multiempresa: risco de vazamento de dados entre empresas (filtros, contexto, autorização)
- [ ] Segurança: entrada, SQL dinâmico, autorização, segredos (ver gatilhos no comando de code review)
- [ ] Concorrência e transações: estático arriscado, race, transações longas, lote em SQL
- [ ] Performance: consultas pesadas, paginação, LINQ, alocações
- [ ] Banco: se houver SQL, migração ou procedure → `DBA_GATILHOS.md` (scan G01–G25) e exemplos lazy PASS/FAIL
- [ ] Arquitetura: camadas, acoplamento, complexidade, duplicação
- [ ] Risco de produção: regressão e compatibilidade com o existente
- [ ] Testes: desejável e alinhado à task `Testing`; na revisão automatizada do repo não bloquear **somente** por falta de teste unitário no diff

**Ao registrar achados:** usar **CRÍTICO**, **ATENÇÃO** ou **SUGESTÃO** (mesma ideia do relatório do comando de code review).

**Branches:** `bugs/*` → base `origin/master`; `features/*` → `origin/developer`. Branch fora do padrão → registrar alerta de processo.

**PR grande:** se não der para revisar com profundidade em um passe, recomendar fatiar (`Small CLs`), como no comando de code review.

---

### 5. Definition of Ready e Definition of Done

**Demandas — DoR (pronto para o Tech Lead pegar o card)**

- [ ] Card priorizado pelo PO
- [ ] Tipo definido (Bug, Feature ou User Story)
- [ ] Descrição e critérios de aceite suficientes
- [ ] Evidências ou anexos quando aplicável
- [ ] Sem bloqueadores explícitos não tratados

**Demandas — DoD (pronto para enviar ao pool Escopo)**

- [ ] Demanda analisada no board
- [ ] Validação com o PO quando *Necessita Validar?* for Sim
- [ ] Tasks-padrão cadastradas: Requirements, Development, TechnicalValidation, CodeReview, Testing
- [ ] Cada task com título e descrição (e estimativa, se o time usar)

**Escopo — DoR (pronto para sua revisão técnica)**

- [ ] PR aberto e vinculado ao trabalho ou card
- [ ] Build ou pipeline esperado pelo time está verde antes de declarar “pronto para revisar”
- [ ] Task Development concluída conforme combinado no board
- [ ] TechnicalValidation atendida (evidências registradas)
- [ ] Wiki ou documentação quando o fluxo *Existe Documentação?* exigir
- [ ] Estado equivalente a *Disponibilizar para Revisão de Código*

**Escopo — DoD (pronto para sair do seu code review)**

- [ ] Comentários do review tratados ou justificados
- [ ] Nenhum CRÍTICO pendente (segurança, dados, regressão grave, FAIL em gatilho DBA aplicável)
- [ ] Pipeline após ajustes alinhado ao que QA e Dev precisam (*Verificar Pipeline* no fluxo)
- [ ] Sem CodeAdjustment pendente se o destino for *Disponível para Teste*
- [ ] Aprovação do PR alinhada com o time: no diagrama, *Aprovar PR* está na raia **QA**; definir se o Tech Lead exige **assinatura técnica** além da aprovação operacional da QA

---

### 6. Referência rápida

**Posso estruturar o card no pool Demandas?**  
Sim, se PO priorizou, tipo está definido e critérios de aceite estão ok.

**Posso liberar o card para o pool Escopo?**  
Sim, se as cinco tasks-padrão existem e a validação com o PO já foi feita quando necessário.

**Posso iniciar a revisão técnica no Escopo?**  
Sim, se há PR correlato, o card está em “para revisão” e build, docs e validações técnicas estão conforme o combinado.

**Posso mover para “Disponível para Teste”?**  
Sim, se não há pendências CRÍTICAS, a estratégia de teste está clara e não há CodeAdjustment obrigatório em aberto.

---

### 7. Alinhamento com `.cursor/commands/codereview.md`

**Regras do repositório**

- Tech Lead no board: aplicar conforme escopo mentalmente.
- Comando automatizado: listar rules aplicadas e não aplicadas no relatório.

**DBA**

- Tech Lead: atenção aos gatilhos quando houver SQL.
- Comando: checklist PASS/FAIL dos gatilhos G01–G25 (`DBA_GATILHOS.md`) quando o pacote DBA for aplicável.

**Testes automatizados**

- Processo humano: desejável; task Testing acompanha o fluxo.
- Comando: não abrir problema **apenas** por ausência de teste no diff.

**Escopo da análise automatizada**

- Comando foca linhas **adicionadas** no diff (+ contexto imediato), não arquivo inteiro antigo.

---

### 8. Mapa de raias — quem faz o quê (v20260508)

**Demandas**

- Product Owner — nova demanda, análise inicial, cadastro de bug/feature/user story, priorização no backlog.
- Tech Lead **(você)** — analisar no board, validar regra com PO quando preciso, cadastrar as cinco tasks.

**Escopo**

- Scrum Master — prioridades no backlog, alocação para dev, verificação de pipeline, preparar release quando couber no fluxo.
- Desenvolvedor — desenvolvimento, Wiki quando exigido, rework e correções, disponibilizar para revisão.
- QA — colocar em testando, roteiro de teste, merge, aprovar PR conforme papel do time, disponibilizar para pipeline.
- Tech Lead **(você)** — realizando revisão de código, revisar, CodeAdjustment quando necessário, disponível para teste.

---

### 9. Histórico

- **2026-05-08** — BPMN *ProcessoDesenvolvimentoVersao20260508*: raia QA explícita; merge/PR/pipeline/testes na raia QA; alinhamento com code review do repositório. Documento reformatado para Wiki do Azure DevOps (listas no lugar de tabelas largas, blocos curtos, índice).
- **2026-05-06** — Primeira versão do checklist com diagrama anterior (Escopo com três raias principais antes da QA dedicada).
