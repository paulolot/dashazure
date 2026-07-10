# GERAL_RULES

## Objetivo

Centralizar **boas práticas transversais** do código (C#/.NET) que não pertencem a um domínio de negócio (Fiscal/Financeiro/Vendas), nem a banco de dados (`DBA_RULES.md`), nem à arquitetura do monorepo (`design-rules.md`).

Este arquivo evita pulverizar muitos `*_RULES.md` específicos. Antes de criar novo arquivo de regra, avaliar se a regra cabe aqui.

---

## Escopo de aplicabilidade

Aplicar quando o diff tocar padrões transversais de implementação .NET que não sejam exclusivamente SQL e não tenham domínio próprio. Exemplos típicos:

- Tratamento e materialização de retorno dinâmico (Dapper, dynamic, object).
- Uso de operadores LINQ que afetam robustez ou performance (`Cast<T>` vs `OfType<T>`, materialização repetida).
- Padrões de codificação que reduzem exceções de runtime ou overhead desnecessário.
- Uso de `System.Drawing` (`Image`, `Bitmap`, `Metafile`), `MemoryStream` com `Image.FromStream`, e controles WinForms (`PictureBox.Image`) — ciclo de vida e `Dispose` (vazamento de memória nativa GDI+ / objetos vivos impedindo GC).
- **WinForms / thread UI (STA):** espera cooperativa na thread da UI (`while` sem `await`) com trabalho em background (`ThreadPool`, `Task.Run`) e retorno à UI via `Control.Invoke` / `ExtensionsCrossThread.Execute` — risco de **deadlock** se a fila de mensagens não for bombeada.

Se a alteração for puramente SQL, persistência, fiscal, financeira, de venda ou arquitetural, **não** aplicar este arquivo: usar o documento específico.

---

## Classificação de severidade

- **CRÍTICO:** risco de falha grave em runtime, regressão funcional clara ou impacto sistêmico.
- **ATENÇÃO:** risco moderado de qualidade, performance ou manutenibilidade.
- **SUGESTÃO:** melhoria recomendada sem bloqueio imediato.

---

## Gatilhos de detecção rápida

Padrões que o revisor deve marcar imediatamente ao encontrar no diff:

* **`Cast<T>()` em retorno dinâmico:** uso de `Cast<T>()` sobre coleções vindas de chamadas dinâmicas (`dynamic`, `object`, `IDictionary<string, object>`) onde não há garantia de que cada item seja exatamente `T`.
* **`Cast<T>()` em coleção potencialmente heterogênea:** uso de `Cast<T>()` em vez de `OfType<T>()` quando a coleção pode conter tipos mistos.
* **Cast redundante:** cast aplicado sobre um retorno já fortemente tipado.
* **Materialização dinâmica para DTO sem desserialização tipada:** `Cast<Dto>().ToList()` sobre retorno dinâmico em vez de método de materialização tipada (ex.: `...DapperJson<T>()`).
* **`Image.FromStream` sem cópia (`Bitmap`) e/ou `using` que dispõe o stream enquanto o `Image` ainda está em uso** (ex.: `PictureBox`); **reatribuição de `PictureBox.Image` sem `Dispose` da imagem anterior** — risco de crescimento de memória (incl. cenários de geração de DANFE, relatórios, pré-visualizações).
* **UI deadlock — espera cooperativa (`ui-deadlock-espera-cooperativa`):** ver critério composto na seção **§3** abaixo. **Severidade:** **CRÍTICO** quando `FAIL`.

**Severidade padrão dos gatilhos:** ATENÇÃO (não bloqueante neste momento), exceto:
- vazamento GDI+ recorrente em loop sem `Dispose` de `Image`/`Graphics` → **CRÍTICO** conforme impacto;
- gatilho **`ui-deadlock-espera-cooperativa`** em `FAIL` → **CRÍTICO** (bloqueante no Code Review).

**Code Review — custo baixo:** avaliar **somente** arquivos do diff em `ControllerView/`, `View/`, `PMetaNet/` (ou equivalentes WinForms) onde o patch mencione `DoEvents`, `ThreadPool`, `QueueUserWorkItem`, `Task.Run` ou `while (` no mesmo arquivo. **Não** varrer o repositório nem exigir checklist numérico (diferente de `DBA_RULES.md`); reportar apenas `FAIL` do gatilho composto.

---

## Regras obrigatórias de validação

### 1) CAST e materialização dinâmica (Dapper)

- **Não usar `Cast<T>()` em retornos dinâmicos** (`dynamic`, `object`, `IDictionary<string, object>`). `Cast<T>()` é apenas conversão LINQ em runtime: lança `InvalidCastException` se algum item não for exatamente `T`.
- **Para materializar DTO a partir de retorno dinâmico**, preferir método de materialização fortemente tipada (ex.: `ListarDinamico...DapperJson<IEnumerable<Dto>>()`), que serializa o resultado e desserializa para o tipo alvo, criando objetos reais do tipo correto.
- **Em coleções potencialmente heterogêneas**, preferir `OfType<T>()` a `Cast<T>()`. `OfType<T>()` filtra apenas os itens compatíveis em vez de quebrar a execução.
- **Remover cast redundante** quando o retorno já é fortemente tipado em compile-time.

**Severidade padrão:** ATENÇÃO

**Justificativas:**

- `Cast<T>()` não transforma objetos: apenas tenta converter cada item; falha → exceção.
- Materialização tipada via JSON desacopla o consumidor do shape interno do retorno dinâmico.
- `OfType<T>()` torna o código resiliente a coleções dinâmicas/mistas.
- Cast redundante adiciona overhead e ruído sem benefício.

**Quadro rápido (qual usar quando):**

| Cenário | Abordagem correta |
|---------|-------------------|
| Resultado dinâmico → DTO | Desserialização JSON tipada |
| Coleção pode conter tipos mistos | `OfType<T>()` |
| Coleção garantidamente homogênea | `Cast<T>()` (raros casos) |

**Exemplos:**

Ruim (`Cast<T>().ToList()` em retorno dinâmico — risco de `InvalidCastException`):

```csharp
return FactoryList.ListarDinamicoLeituraNaoConfirmadaDapper(parametro)
    .Cast<DadosDocumentoConsultaDto>()
    .ToList();
```

Bom (materialização tipada via método com desserialização JSON):

```csharp
return FactoryList
    .ListarDinamicoLeituraNaoConfirmadaDapperJson<IEnumerable<DadosDocumentoConsultaDto>>(parametro)
    .Select(x => (DadosDocumentoConsultaDto)x)
    .ToList();
```

Ruim (`Cast<T>` em coleção heterogênea — quebra se houver item que não seja `ICaixa`):

```csharp
caixaRetorno = FactoryList.ListarDinamicoDapper(parametro)
    .Cast<ICaixa>()
    .FirstOrDefault();
```

Bom (`OfType<T>` filtra apenas itens compatíveis):

```csharp
caixaRetorno = FactoryList.ListarDinamicoDapper(parametro)
    .OfType<ICaixa>()
    .FirstOrDefault();
```

Ruim (cast redundante após retorno já tipado):

```csharp
IEnumerable<DadosDocumentoConsultaDto> dados = ObterDadosTipados(parametro);
return dados.Cast<DadosDocumentoConsultaDto>().ToList();
```

Bom (sem cast redundante):

```csharp
return ObterDadosTipados(parametro).ToList();
```

### 2) `System.Drawing`, `MemoryStream` e `Dispose` (WinForms, DANFE, imagens)

**Contexto para Code Review:** objetos GDI+ (`Image`, `Bitmap`, `Metafile`, `Graphics`, fontes e brushes não gerenciados) utilizam **memória nativa**. O GC do .NET **não** libera isso de forma previsível só porque não há mais referências gerenciadas: sem `Dispose()`, o consumo pode subir até pressionar o processo (sintoma já observado em produção: memória alta quando documentos como **DANFE** ou imagens geradas permanecem referenciadas ou acumulam sem descarte).

**Contrato importante:** `Image.FromStream(Stream, ...)` exige que o stream permaneça válido **enquanto o `Image` retornado depende dele**. Por isso **não** basta dar `Dispose()` no `MemoryStream` logo após `FromStream` se o mesmo `Image` for guardado em controle ou campo — ou a imagem quebra, ou o stream precisa continuar aberto (segurando buffer).

**Severidade padrão:** **ATENÇÃO** (padrão ruim sem `Dispose` de imagem substituída); pode escalar a **CRÍTICO** em laços ou telas longas que recriam imagens sem liberar as anteriores.

**Recomendações:**

1. **Copiar para `Bitmap` autossuficiente** quando o stream puder ser fechado em seguida: dentro de `using` no stream e num `Image` temporário, atribuir `new Bitmap(imagemOrigem)` ao destino (`PictureBox`, variável de instância, etc.).
2. **Sempre dar `Dispose()` na imagem anterior** ao reatribuir `PictureBox.Image` (ou limpar com `null` e depois `Dispose` na referência antiga). O controle **não** descarta a imagem antiga automaticamente.
3. **`MemoryStream` sobre `byte[]`:** `Dispose` é boa prática (determinístico); o problema de “memória que não cai” costuma ser **imagem GDI+** ou **stream ainda referenciado pelo `Image`**, não só o `MemoryStream`.
4. **Relatórios / exportação (ex.: DANFE):** garantir `Dispose` em `Image`/`Metafile`/`Graphics` criados no fluxo, inclusive em ramos de erro (`try/finally` ou `using`).

**Code Review (`/codereview`):** ao ver diff em behaviors/forms que carregam assinatura, logo, PDF rasterizado ou fluxo de documento fiscal visual, **verificar** cadeia stream → `Image` → controle e substituições repetidas.

**Exemplos:**

Ruim (`Image` ligado ao stream; ao descartar o stream a imagem no controle pode invalidar; ou stream fica preso enquanto `Image` vive):

```csharp
using (var ms = new MemoryStream(bytes))
{
    pctImagem.Image = Image.FromStream(ms, true);
} // stream disposed → risco de falha GDI+ ao desenhar
```

Ruim (nova imagem sem liberar a anterior — acúmulo de bitmaps nativos ao recarregar tela / gerar DANFE várias vezes):

```csharp
pctImagem.Image = Image.FromStream(new MemoryStream(bytes), true);
```

Ruim (`using` só no `MemoryStream` sem clonar — fecha o stream e quebra o `Image` ainda exibido):

```csharp
using (var ms = new MemoryStream(bytes))
{
    var img = Image.FromStream(ms, true);
    pctImagem.Image = img;
}
```

Bom (cópia independente + descarte do stream e da imagem temporária; descarte da imagem anterior do controle):

```csharp
var anterior = pctImagem.Image;
using (var ms = new MemoryStream(bytes, 0, bytes.Length))
using (Image origem = Image.FromStream(ms, true))
{
    pctImagem.Image = new Bitmap(origem);
}
anterior?.Dispose();
```

Bom (ramo sem imagem — limpar controle e liberar nativo):

```csharp
var anterior = pctImagem.Image;
pctImagem.Image = null;
anterior?.Dispose();
```

### 3) WinForms — `ThreadPool` + espera na UI sem bombeamento de mensagens

**Problema (ex.: PR 6883 / `BotaoBehaviorLogon`):** a thread da UI entra em `while (...)` aguardando flag setada por `ThreadPool.QueueUserWorkItem`. O worker chama `control.Execute(...)` / `control.Invoke(...)` (ex.: `ValidarProtecaoRetaguarda`, `ProtecaoFaturamentoBehavior`). Sem `Application.DoEvents()` (ou `await` que retome na UI), a fila WinForms **não processa** o `Invoke` → **deadlock** (tela “Não responde”).

#### Gatilho composto `ui-deadlock-espera-cooperativa`

Avaliar **por arquivo** presente no diff. **`FAIL (CRÍTICO)`** somente se **todas** as condições forem verdadeiras no método alterado (ou no hunk ± ~50 linhas de contexto):

| # | Condição |
|---|----------|
| 1 | Há disparo de trabalho em background: `ThreadPool.QueueUserWorkItem`, `Task.Run(` ou `new Thread(`. |
| 2 | Na mesma unidade lógica, a thread da UI faz espera ativa: `while (` **sem** `await` no loop (ex.: `while (true)`, `while (!executouProcesso)`). |
| 3 | **E** pelo menos um: **(a)** o diff **remove** linha com `Application.DoEvents()` desse loop (`-Application.DoEvents`); **(b)** o loop **não** contém `Application.DoEvents()` e o worker (ou método chamado por ele no mesmo fluxo) usa marshaling síncrono para UI: `.Execute(`, `.Invoke(`, `MessageBox.Show`, `MensagemMeta.Show` passando `Form`/`Control`/`FrmFormularioControlado`. |

**`PASS` (não reportar como CRÍTICO):**

- Loop de espera mantém `Application.DoEvents()` (pode abrir **SUGESTÃO** de refatorar para `async/await`, sem bloquear por deadlock imediato).
- Fluxo migrado para `async`/`await` com continuação na UI, `BackgroundWorker` com `ReportProgress`, ou `BeginInvoke` + continuação sem `Invoke` bloqueante a partir do worker.
- Background **não** recebe nem toca `Form`/`Control` e não chama `Invoke`/`Execute` em controle de UI.

**Não disparar (evitar ruído):**

- `Application.DoEvents()` em outro contexto sem `ThreadPool` + `while` no mesmo método.
- Apenas `await Task.Run(...)` seguido de código na UI **após** o `await`.
- Arquivos fora de UI WinForms (serviços, NHibernate, SQL).

**Severidade:** **CRÍTICO** em `FAIL`; refatoração recomendada como **SUGESTÃO** quando `DoEvents` ainda existe no padrão legado.

**Exemplo ruim (remoção que causou travamento):**

```csharp
ThreadPool.QueueUserWorkItem(_ => { ValidarProtecao(..., frm); /* Invoke dentro */ });
while (true)
{
    // Application.DoEvents();  ← removido
    if (executouProcesso) break;
}
```

**Direção de correção (preferir em novos trechos):**

```csharp
// Preferir: não bloquear a UI; não usar while + DoEvents
await Task.Run(() => { /* sem tocar UI */ }).ConfigureAwait(true);
// ou manter DoEvents até refatorar; nunca remover sem substituir o pump
```

**Referência no monorepo:** `ControllerView/.../BotaoBehaviorLogon.cs`, `Utilitarios/Meta/Extensions/ExtensionsCrossThread.cs` (`control.Invoke`).

---

## Evidências mínimas no parecer

Para cada apontamento registrado a partir deste documento:

- Severidade (CRÍTICO, ATENÇÃO, SUGESTÃO)
- Arquivo/objeto impactado
- Trecho do diff analisado
- Descrição do risco e impacto potencial
- Correção recomendada

---

## Relação com outros documentos

- **`DBA_RULES.md`:** SQL/persistência. Quando a regra for puramente SQL, mover/criar lá. Não duplicar aqui.
- **`design-rules.md`:** arquitetura/camadas/stack do monorepo. Decisões estruturais.
- **`FISCAL_RULES.md` / `FINANCEIRO_RULES.md` / `VENDAS_RULES.md`:** regras de domínio. Quando o impacto for de negócio específico, usar o arquivo do domínio.
- Antes de criar novo `*_RULES.md`, avaliar se a regra cabe aqui (evita fragmentação e custo de contexto no review).
