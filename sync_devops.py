import sys
import os
import json
import csv
from datetime import datetime, timezone, timedelta
from concurrent.futures import ThreadPoolExecutor, as_completed

# Configura encoding UTF-8 e força desativação do buffer de stdout para acompanhar logs em tempo real
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
sys.stdout.reconfigure(line_buffering=True)

# Adiciona o diretório da skill Azure para permitir importar o ado_tool
sys.path.append(os.path.join(os.path.dirname(__file__), ".cursor", "skills", "Azure", "tools"))
import ado_tool

METADATA_FILE = os.path.join(os.path.dirname(__file__), ".sync_metadata.json")

# Lista de arquivos CSV gerados dinamicamente
DYNAMIC_CSVS = [
    "fiscal-workitems.csv",
    "fiscal-tasks.csv",
    "fiscal-transicoes.csv",
    "fiscal-tempo-coluna.csv",
    "fiscal-entregas.csv",
    "fiscal-bugs.csv",
    "fiscal-tags.csv",
    "fiscal-pessoa-papel.csv",
    "fiscal-paralizacoes.csv",
    "fiscal-paralizacao-resumo.csv",
    "fiscal-atendimentos-concluidos.csv",
    "fiscal-metricas-periodo.csv"
]

def parse_date(date_str):
    if not date_str:
        return None
    try:
        normalized = date_str.replace("Z", "+00:00")
        return datetime.fromisoformat(normalized)
    except Exception:
        return None

def format_date(dt):
    if not dt:
        return ""
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

def clean_html(html):
    if not html:
        return ""
    import re
    clean = re.compile('<.*?>')
    return re.sub(clean, '', html)

def load_csv(filename):
    filepath = os.path.join(os.path.dirname(__file__), filename)
    if not os.path.exists(filepath):
        return None
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            return list(reader)
    except Exception:
        return None

def build_field_history(field_name, current_value, created_dt, created_by_name, updates):
    changes = []
    for idx, upd in enumerate(updates):
        if idx == 0:
            change_date = created_dt
        else:
            prev_rev_date = parse_date(updates[idx-1].get("revisedDate"))
            change_date = prev_rev_date if prev_rev_date else created_dt
            
        fields_changed = upd.get("fields", {})
        if field_name in fields_changed:
            rev_by = upd.get("revisedBy", {})
            rev_by_name = rev_by.get("displayName", "") if isinstance(rev_by, dict) else ""
            
            val_obj = fields_changed[field_name]
            old_val = val_obj.get("oldValue")
            new_val = val_obj.get("newValue")
            
            if field_name == "System.AssignedTo":
                old_str = old_val.get("displayName", "NENHUM") if isinstance(old_val, dict) else "NENHUM"
                new_str = new_val.get("displayName", "NENHUM") if isinstance(new_val, dict) else "NENHUM"
            else:
                old_str = str(old_val) if old_val is not None else ""
                new_str = str(new_val) if new_val is not None else ""
                
            changes.append({
                "rev": upd.get("rev", 1),
                "old": old_str,
                "new": new_str,
                "data": change_date,
                "por": rev_by_name
            })
            
    history = []
    if not changes:
        if created_dt:
            history.append({"valor": current_value, "data": created_dt, "por": created_by_name})
    else:
        first_change = changes[0]
        if first_change["rev"] == 1:
            initial_val = first_change["new"]
        else:
            initial_val = first_change["old"]
            
        if not initial_val and current_value:
            initial_val = current_value
            
        if created_dt:
            history.append({"valor": initial_val, "data": created_dt, "por": created_by_name})
            
        for chg in changes:
            if chg["rev"] == 1:
                continue
            history.append({"valor": chg["new"], "data": chg["data"], "por": chg["por"]})
            
    history.sort(key=lambda x: x["data"])
    return history

def main():
    # Check arguments
    force_full = "--full" in sys.argv
    force_sync = "--force" in sys.argv
    
    # Verificação de arquivos existentes
    missing_csv = False
    for csv_file in DYNAMIC_CSVS:
        if not os.path.exists(os.path.join(os.path.dirname(__file__), csv_file)):
            missing_csv = True
            break

    # Determinar a data da última sincronização
    last_sync_str = None
    if os.path.exists(METADATA_FILE) and not missing_csv:
        try:
            with open(METADATA_FILE, "r", encoding="utf-8") as f:
                metadata = json.load(f)
                last_sync_str = metadata.get("last_sync")
        except Exception:
            pass

    today = datetime.now(timezone.utc)
    
    # Valida se a sincronização foi feita a menos de 4 horas
    if last_sync_str and not force_full and not force_sync and not missing_csv:
        last_sync_dt = parse_date(last_sync_str)
        if last_sync_dt:
            elapsed = today - last_sync_dt
            elapsed_hours = elapsed.total_seconds() / 3600.0
            if elapsed_hours < 4.0:
                local_time_str = last_sync_dt.astimezone().strftime("%d/%m/%Y %H:%M:%S")
                print(f"A última sincronização foi realizada em {local_time_str} (há {elapsed_hours:.1f} horas).")
                try:
                    ans = input("Deseja sincronizar com o Azure DevOps novamente agora? [s/N]: ").strip().lower()
                except (KeyboardInterrupt, EOFError):
                    ans = "n"
                if ans not in ("s", "sim"):
                    print("Sincronização pulada. Iniciando o servidor local...")
                    sys.exit(0)

    print("Iniciando sincronização com o Azure DevOps...")
    is_delta = False
    last_sync_dt = None

    if last_sync_str and not force_full and not force_sync and not missing_csv:
        last_sync_dt = parse_date(last_sync_str)
        if last_sync_dt:
            is_delta = True
            # Azure DevOps exige precisão apenas de data (YYYY-MM-DD) para buscas temporais de ChangedDate por padrão.
            # Portanto, extraímos apenas a parte da data. Como margem, subtraímos 1 dia da data da última sincronização
            # para garantir que qualquer item alterado recentemente seja reprocessado e mesclado sem perdas.
            last_sync_margin_dt = last_sync_dt - timedelta(days=1)
            last_sync_query = last_sync_margin_dt.strftime("%Y-%m-%d")
            print(f"Modo: SINCRONIZAÇÃO DELTA.")
            print(f"Última execução registrada: {last_sync_str}")
            print(f"Buscando itens modificados desde: {last_sync_query} (margem de 1 dia aplicada)")

    
    if not is_delta:
        print("Modo: SINCRONIZAÇÃO COMPLETA.")
        # Janela padrão de 45 dias para a sincronização completa
        margin_days = 45
        date_limit = today - timedelta(days=margin_days)
        last_sync_query = date_limit.strftime("%Y-%m-%d")
        print(f"Buscando itens ativos ou fechados desde: {last_sync_query}")

    # 1. Consultar IDs de Cards adicionados/modificados no período
    if is_delta:
        parent_wiql = f"""
        SELECT [System.Id]
        FROM WorkItems
        WHERE [System.TeamProject] = 'Metanet'
          AND [System.AreaPath] UNDER 'Metanet\\Squad Fiscal'
          AND [System.WorkItemType] IN ('User Story', 'Bug', 'Atendimento')
          AND [System.ChangedDate] >= '{last_sync_query}'
        ORDER BY [System.Id]
        """
    else:
        parent_wiql = f"""
        SELECT [System.Id]
        FROM WorkItems
        WHERE [System.TeamProject] = 'Metanet'
          AND [System.AreaPath] UNDER 'Metanet\\Squad Fiscal'
          AND [System.WorkItemType] IN ('User Story', 'Bug', 'Atendimento')
          AND (
            [System.State] <> 'Closed'
            OR [Microsoft.VSTS.Common.ResolvedDate] >= '{last_sync_query}'
          )
        ORDER BY [System.Id]
        """

    print("Consultando cards no Azure DevOps...")
    query_result = ado_tool.query_work_items(parent_wiql)
    if not query_result:
        print("Erro ao consultar Azure DevOps ou nenhum item retornado.")
        sys.exit(1)
        
    witems = query_result.get("workItems", [])
    ids = [item["id"] for item in witems]
    
    if is_delta:
        print(f"Cards novos ou modificados encontrados: {len(ids)}")
    else:
        print(f"Cards totais encontrados para histórico inicial: {len(ids)}")

    # Carrega dados antigos caso estejamos em modo delta
    old_data = {}
    if is_delta:
        for csv_file in DYNAMIC_CSVS:
            data = load_csv(csv_file)
            if data is None:
                print(f"Erro ao ler {csv_file}. Forçando sincronização completa.")
                is_delta = False
                break
            old_data[csv_file] = data

    # Se ao tentar ler os arquivos antigos ou algo falhar, revertemos para completo
    if not is_delta:
        # Reprocessa a busca inicial se for necessário
        if force_full or missing_csv:
            margin_days = 45
            date_limit = today - timedelta(days=margin_days)
            last_sync_query = date_limit.strftime("%Y-%m-%d")
            parent_wiql = f"""
            SELECT [System.Id]
            FROM WorkItems
            WHERE [System.TeamProject] = 'Metanet'
              AND [System.AreaPath] UNDER 'Metanet\\Squad Fiscal'
              AND [System.WorkItemType] IN ('User Story', 'Bug', 'Atendimento')
              AND (
                [System.State] <> 'Closed'
                OR [Microsoft.VSTS.Common.ResolvedDate] >= '{last_sync_query}'
                OR [Microsoft.VSTS.Common.ClosedDate] >= '{last_sync_query}'
              )
            ORDER BY [System.Id]
            """
            query_result = ado_tool.query_work_items(parent_wiql)
            witems = query_result.get("workItems", [])
            ids = [item["id"] for item in witems]
            print(f"Cards totais recarregados para modo completo: {len(ids)}")

    deleted_active_ids = set()
    if is_delta and old_data and "fiscal-workitems.csv" in old_data:
        try:
            print("Verificando itens deletados ou movidos...")
            csv_active_ids = {str(r["Id"]) for r in old_data["fiscal-workitems.csv"] if r.get("State") not in ("Closed", "Removed")}
            if csv_active_ids:
                active_wiql = """
                SELECT [System.Id]
                FROM WorkItems
                WHERE [System.TeamProject] = 'Metanet'
                  AND [System.AreaPath] UNDER 'Metanet\\Squad Fiscal'
                  AND [System.WorkItemType] IN ('User Story', 'Bug', 'Atendimento')
                  AND [System.State] <> 'Closed'
                  AND [System.State] <> 'Removed'
                """
                active_result = ado_tool.query_work_items(active_wiql)
                if active_result and "workItems" in active_result:
                    current_active_ids = {str(item["id"]) for item in active_result["workItems"]}
                    deleted_active_ids = csv_active_ids - current_active_ids
                    if deleted_active_ids:
                        print(f"Detectados {len(deleted_active_ids)} itens ativos que foram deletados ou movidos. Eles serão removidos do dashboard.")
        except Exception as e:
            print(f"Aviso: Não foi possível verificar itens deletados ({e})")

    if not ids and not deleted_active_ids and is_delta:
        print("Nenhuma alteração detectada. Dashboard está atualizado.")
        # Atualiza a data de última execução mesmo assim
        with open(METADATA_FILE, "w", encoding="utf-8") as f:
            json.dump({"last_sync": format_date(today)}, f, indent=2, ensure_ascii=False)
        sys.exit(0)

    # 2. Consultar detalhes dos cards modificados/novos em lote
    fields_to_get = [
        "System.Id", "System.WorkItemType", "System.Title", "System.AreaPath", "System.IterationPath",
        "System.State", "System.BoardColumn", "System.AssignedTo", "System.CreatedBy", "System.CreatedDate",
        "System.ChangedDate", "Microsoft.VSTS.Common.ClosedDate", "Microsoft.VSTS.Common.ResolvedDate", "Microsoft.VSTS.Common.Priority",
        "Microsoft.VSTS.Common.Severity", "System.Tags", "System.Parent", "Custom.AnalistaQA",
        "Custom.Status", "Custom.a2f3a34e-63a9-4c1e-a465-0b97571cf26e", "System.Description",
        "Microsoft.VSTS.Scheduling.CompletedWork", "Custom.94603fbe-76de-42e6-837e-fa72005de734"
    ]
    
    print("Baixando detalhes dos cards...")
    all_wi_details = []
    chunk_size = 200
    for idx in range(0, len(ids), chunk_size):
        chunk = ids[idx:idx+chunk_size]
        url = ado_tool._build_url("/_apis/wit/workitemsbatch")
        body = {"ids": chunk, "fields": fields_to_get}
        batch_data = ado_tool._request_json(url, data=json.dumps(body).encode("utf-8"), method="POST", content_type="application/json")
        if batch_data and "value" in batch_data:
            all_wi_details.extend(batch_data["value"])
            
    print(f"Detalhes obtidos para {len(all_wi_details)} cards.")

    # 3. Obter base total de User Stories (recalculado sempre para Bug Rate correto)
    us_base_wiql = """
    SELECT [System.Id]
    FROM WorkItems
    WHERE [System.TeamProject] = 'Metanet'
      AND [System.AreaPath] UNDER 'Metanet\\Squad Fiscal'
      AND [System.WorkItemType] = 'User Story'
    """
    us_base_result = ado_tool.query_work_items(us_base_wiql)
    total_us_base = len(us_base_result.get("workItems", [])) if us_base_result else 0

    # 4. Consultar Tasks modificadas/novas
    print("Buscando Tasks associadas...")
    all_tasks = []
    
    if is_delta:
        # Em delta, buscamos:
        # A) Tasks alteradas desde a última execução
        # B) Tasks filhas dos cards que mudaram
        tasks_delta_wiql = f"""
        SELECT [System.Id]
        FROM WorkItems
        WHERE [System.TeamProject] = 'Metanet'
          AND [System.WorkItemType] = 'Task'
          AND [System.ChangedDate] >= '{last_sync_query}'
        """
        t_delta_res = ado_tool.query_work_items(tasks_delta_wiql)
        delta_t_ids = [item["id"] for item in t_delta_res.get("workItems", [])] if t_delta_res else []
        
        # Também busca filhas dos cards modificados
        child_t_ids = []
        if ids:
            parent_ids_str_list = [str(pid) for pid in ids]
            for idx in range(0, len(parent_ids_str_list), 400):
                chunk_parents = parent_ids_str_list[idx:idx+400]
                parents_condition = ",".join(chunk_parents)
                tasks_child_wiql = f"""
                SELECT [System.Id]
                FROM WorkItems
                WHERE [System.TeamProject] = 'Metanet'
                  AND [System.WorkItemType] = 'Task'
                  AND [System.Parent] IN ({parents_condition})
                """
                t_child_res = ado_tool.query_work_items(tasks_child_wiql)
                if t_child_res and "workItems" in t_child_res:
                    child_t_ids.extend([item["id"] for item in t_child_res["workItems"]])
                    
        # União única das Tasks que sofreram alteração ou são filhas de pais alterados
        task_ids_to_fetch = list(set(delta_t_ids + child_t_ids))
        print(f"Tasks modificadas ou associadas a reprocessar: {len(task_ids_to_fetch)}")
        
        if task_ids_to_fetch:
            tasks_batch_url = ado_tool._build_url("/_apis/wit/workitemsbatch")
            tasks_fields = [
                "System.Id", "System.Parent", "System.Title", "System.State", "System.AssignedTo",
                "Microsoft.VSTS.Common.Activity", "Microsoft.VSTS.Scheduling.OriginalEstimate",
                "Microsoft.VSTS.Scheduling.CompletedWork", "System.CreatedDate", "System.ChangedDate"
            ]
            for t_idx in range(0, len(task_ids_to_fetch), chunk_size):
                t_chunk = task_ids_to_fetch[t_idx:t_idx+chunk_size]
                t_body = {"ids": t_chunk, "fields": tasks_fields}
                t_batch = ado_tool._request_json(tasks_batch_url, data=json.dumps(t_body).encode("utf-8"), method="POST", content_type="application/json")
                if t_batch and "value" in t_batch:
                    all_tasks.extend(t_batch["value"])
    else:
        # Em completo, buscamos filhas de todos os cards
        parent_ids_str_list = [str(pid) for pid in ids]
        for idx in range(0, len(parent_ids_str_list), 400):
            chunk_parents = parent_ids_str_list[idx:idx+400]
            parents_condition = ",".join(chunk_parents)
            tasks_wiql = f"""
            SELECT [System.Id]
            FROM WorkItems
            WHERE [System.TeamProject] = 'Metanet'
              AND [System.WorkItemType] = 'Task'
              AND [System.Parent] IN ({parents_condition})
            """
            tasks_query = ado_tool.query_work_items(tasks_wiql)
            if tasks_query and "workItems" in tasks_query:
                task_ids = [item["id"] for item in tasks_query["workItems"]]
                if task_ids:
                    tasks_batch_url = ado_tool._build_url("/_apis/wit/workitemsbatch")
                    tasks_fields = [
                        "System.Id", "System.Parent", "System.Title", "System.State", "System.AssignedTo",
                        "Microsoft.VSTS.Common.Activity", "Microsoft.VSTS.Scheduling.OriginalEstimate",
                        "Microsoft.VSTS.Scheduling.CompletedWork", "System.CreatedDate", "System.ChangedDate"
                    ]
                    for t_idx in range(0, len(task_ids), chunk_size):
                        t_chunk = task_ids[t_idx:t_idx+chunk_size]
                        t_body = {"ids": t_chunk, "fields": tasks_fields}
                        t_batch = ado_tool._request_json(tasks_batch_url, data=json.dumps(t_body).encode("utf-8"), method="POST", content_type="application/json")
                        if t_batch and "value" in t_batch:
                            all_tasks.extend(t_batch["value"])
                            
    print(f"Total de Tasks a processar: {len(all_tasks)}")

    # 5. Consultar histórico de atualizações (Updates) para itens modificados/novos
    ids_to_fetch_updates = []
    for wi in all_wi_details:
        fields = wi.get("fields", {})
        wi_id = wi["id"]
        created_date = fields.get("System.CreatedDate", "")
        changed_date = fields.get("System.ChangedDate", "")
        board_column = fields.get("System.BoardColumn", "")
        state = fields.get("System.State", "")
        
        # Otimização básica
        if state == "Removed":
            continue
        if state == "New" and board_column == "Ideias" and created_date == changed_date:
            continue
            
        ids_to_fetch_updates.append(wi_id)
        
    print(f"Buscando histórico para {len(ids_to_fetch_updates)} cards...")
    work_item_updates = {}
    
    def fetch_updates(wi_id):
        url = ado_tool._build_url(f"/_apis/wit/workitems/{wi_id}/updates")
        updates_data = ado_tool._request_json(url)
        if updates_data and "value" in updates_data:
            return wi_id, updates_data["value"]
        return wi_id, []

    if ids_to_fetch_updates:
        print(f"Iniciando download paralelo de históricos com 20 threads...")
        fetched_count = 0
        with ThreadPoolExecutor(max_workers=20) as executor:
            futures = {executor.submit(fetch_updates, wi_id): wi_id for wi_id in ids_to_fetch_updates}
            for future in as_completed(futures):
                wi_id, val = future.result()
                if val:
                    work_item_updates[wi_id] = val
                fetched_count += 1
                if fetched_count % 50 == 0 or fetched_count == len(ids_to_fetch_updates):
                    print(f"  Históricos baixados: {fetched_count}/{len(ids_to_fetch_updates)}")

    # Carrega mapeamento de colunas
    column_map = {}
    col_map_file = os.path.join(os.path.dirname(__file__), "fiscal-column-map.csv")
    if os.path.exists(col_map_file):
        with open(col_map_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                column_map[row["BoardColumn"].strip()] = row
                
    def get_tipo_fluxo(col_name):
        if not col_name:
            return ""
        mapped = column_map.get(col_name.strip())
        return mapped["TipoFluxo"] if mapped else ""
        
    def conta_cycle_time(col_name):
        if not col_name:
            return False
        mapped = column_map.get(col_name.strip())
        return mapped and mapped["ContaCycleTime"] == "Sim"

    # 6. PROCESSAMENTO DOS DADOS NOVOS/MODIFICADOS
    new_workitems = []
    new_tasks = []
    new_transicoes = []
    new_tempo_coluna = []
    new_entregas = []
    new_bugs = []
    new_tags = []
    new_pessoa_papel = []
    new_paralizacoes = []
    new_atendimentos = []

    bugs_fechados_30d = 0
    bugs_abertos_total = 0

    for wi in all_wi_details:
        fields = wi.get("fields", {})
        wi_id = wi["id"]
        wi_type = fields.get("System.WorkItemType", "")
        title = fields.get("System.Title", "")
        area_path = fields.get("System.AreaPath", "")
        iteration_path = fields.get("System.IterationPath", "")
        state = fields.get("System.State", "")
        board_column = fields.get("System.BoardColumn", "")
        
        if state == "Removed":
            continue

        
        assigned_to = fields.get("System.AssignedTo", {})
        assigned_name = assigned_to.get("displayName", "NENHUM") if isinstance(assigned_to, dict) else "NENHUM"
        
        qa_to = fields.get("Custom.AnalistaQA", {})
        qa_name = qa_to.get("displayName", "NENHUM") if isinstance(qa_to, dict) else "NENHUM"
        
        created_by = fields.get("System.CreatedBy", {})
        created_by_name = created_by.get("displayName", "") if isinstance(created_by, dict) else ""
        
        tags_str = fields.get("System.Tags", "")
        created_date_raw = fields.get("System.CreatedDate", "")
        changed_date_raw = fields.get("System.ChangedDate", "")
        # Adapt to ADO: Use ResolvedDate primarily, fallback to ClosedDate
        closed_date_raw = fields.get("Microsoft.VSTS.Common.ResolvedDate", "")
        if not closed_date_raw:
            closed_date_raw = fields.get("Microsoft.VSTS.Common.ClosedDate", "")
        
        priority = fields.get("Microsoft.VSTS.Common.Priority", "")
        severity = fields.get("Custom.94603fbe-76de-42e6-837e-fa72005de734") or fields.get("Microsoft.VSTS.Common.Severity") or ""
        parent_id = fields.get("System.Parent", "")
        
        created_dt = parse_date(created_date_raw)
        changed_dt = parse_date(changed_date_raw)
        closed_dt = parse_date(closed_date_raw)

        if closed_dt and created_dt:
            dias_aberto = (closed_dt - created_dt).days
        elif created_dt:
            dias_aberto = (today - created_dt).days
        else:
            dias_aberto = ""

        tipo_fluxo = get_tipo_fluxo(board_column)

        # A) Workitems
        new_workitems.append({
            "Id": str(wi_id), "Tipo": wi_type, "Titulo": title, "AreaPath": area_path,
            "IterationPath": iteration_path, "State": state, "BoardColumn": board_column,
            "StateColuna": state, "TipoFluxo": tipo_fluxo, "Responsavel": assigned_name,
            "QA": qa_name, "CriadoPor": created_by_name, "Tags": tags_str,
            "DataCriacao": created_date_raw, "DataAlteracao": changed_date_raw, "DataFechamento": closed_date_raw,
            "DiasAberto": str(dias_aberto), "Prioridade": str(priority), "Severity": severity, "ParentId": str(parent_id)
        })

        # B) Tags
        if tags_str:
            for tag in [t.strip() for t in tags_str.replace(";", ",").split(",") if t.strip()]:
                new_tags.append({"Id": str(wi_id), "Tag": tag})

        # C) Pessoa Papel
        if assigned_name and assigned_name != "NENHUM":
            new_pessoa_papel.append({"Id": str(wi_id), "Pessoa": assigned_name, "Papel": "Dev"})
        if qa_name and qa_name != "NENHUM":
            new_pessoa_papel.append({"Id": str(wi_id), "Pessoa": qa_name, "Papel": "QA"})

        # D) Transições
        updates = work_item_updates.get(wi_id, [])
        hist_colunas = build_field_history("System.BoardColumn", board_column or "Ideias", created_dt, created_by_name, updates)
        hist_responsaveis = build_field_history("System.AssignedTo", assigned_name, created_dt, created_by_name, updates)
        hist_estados = build_field_history("System.State", state, created_dt, created_by_name, updates)
        status_inicial = fields.get("Custom.Status", "")
        hist_paralisados = build_field_history("Custom.Status", status_inicial, created_dt, created_by_name, updates)

        # Processa as transições no formato CSV
        for i in range(1, len(hist_colunas)):
            prev, curr = hist_colunas[i-1], hist_colunas[i]
            dur_seconds = (curr["data"] - prev["data"]).total_seconds()
            new_transicoes.append({
                "Id": str(wi_id), "Campo": "BoardColumn", "De": prev["valor"], "Para": curr["valor"],
                "Por": curr["por"], "DataMudanca": format_date(curr["data"]),
                "DuracaoHoras": str(round(dur_seconds / 3600.0, 2)), "DuracaoDias": str(round(dur_seconds / 86400.0, 2))
            })
        for i in range(1, len(hist_responsaveis)):
            prev, curr = hist_responsaveis[i-1], hist_responsaveis[i]
            dur_seconds = (curr["data"] - prev["data"]).total_seconds()
            new_transicoes.append({
                "Id": str(wi_id), "Campo": "AssignedTo", "De": prev["valor"], "Para": curr["valor"],
                "Por": curr["por"], "DataMudanca": format_date(curr["data"]),
                "DuracaoHoras": str(round(dur_seconds / 3600.0, 2)), "DuracaoDias": str(round(dur_seconds / 86400.0, 2))
            })
        for i in range(1, len(hist_estados)):
            prev, curr = hist_estados[i-1], hist_estados[i]
            dur_seconds = (curr["data"] - prev["data"]).total_seconds()
            new_transicoes.append({
                "Id": str(wi_id), "Campo": "State", "De": prev["valor"], "Para": curr["valor"],
                "Por": curr["por"], "DataMudanca": format_date(curr["data"]),
                "DuracaoHoras": str(round(dur_seconds / 3600.0, 2)), "DuracaoDias": str(round(dur_seconds / 86400.0, 2))
            })

        # E) Tempo em coluna
        col_times = {}
        for i in range(len(hist_colunas)):
            curr_col = hist_colunas[i]["valor"]
            entry_date = hist_colunas[i]["data"]
            if curr_col not in col_times:
                col_times[curr_col] = {"total_seconds": 0, "last_entry": None, "last_exit": None}
            col_times[curr_col]["last_entry"] = entry_date
            if i < len(hist_colunas) - 1:
                exit_date = hist_colunas[i+1]["data"]
                col_times[curr_col]["last_exit"] = exit_date
                col_times[curr_col]["total_seconds"] += (exit_date - entry_date).total_seconds()
            else:
                col_times[curr_col]["last_exit"] = None
                if state != "Closed":
                    col_times[curr_col]["total_seconds"] += (today - entry_date).total_seconds()
                elif closed_dt:
                    col_times[curr_col]["total_seconds"] += (closed_dt - entry_date).total_seconds()
                    col_times[curr_col]["last_exit"] = closed_dt

        for col_name, info in col_times.items():
            total_hours = round(info["total_seconds"] / 3600.0, 2)
            total_days = round(info["total_seconds"] / 86400.0, 2)
            is_current = "Sim" if info["last_exit"] is None and state != "Closed" else "Nao"
            tempo_atual = ""
            if is_current == "Sim" and info["last_entry"]:
                tempo_atual = str(round((today - info["last_entry"]).total_seconds() / 3600.0, 2))
            new_tempo_coluna.append({
                "Id": str(wi_id), "BoardColumn": col_name, "State": state, "TipoFluxo": get_tipo_fluxo(col_name),
                "TempoTotalHoras": str(total_hours), "TempoTotalDias": str(total_days),
                "UltimaEntrada": format_date(info["last_entry"]), "UltimaSaida": format_date(info["last_exit"]),
                "ColunaAtual": is_current, "TempoAtualHoras": tempo_atual
            })

        # F) Paralisações
        paralizacao_periodos = []
        par_ativo = None
        for i in range(len(hist_paralisados)):
            curr_val = hist_paralisados[i]["valor"]
            curr_date = hist_paralisados[i]["data"]
            curr_by = hist_paralisados[i]["por"]
            
            if curr_val and not par_ativo:
                par_ativo = {
                    "Id": str(wi_id), "Tipo": wi_type, "Status": curr_val, "DataInicio": format_date(curr_date),
                    "DataFim": "", "DuracaoHoras": "0", "DuracaoDias": "0", "DuracaoExibicao": "",
                    "Ativo": "Sim", "MarcadoPor": curr_by, "LiberadoPor": "", "_start_dt": curr_date
                }
            elif not curr_val and par_ativo:
                par_ativo["DataFim"] = format_date(curr_date)
                par_ativo["LiberadoPor"] = curr_by
                par_ativo["Ativo"] = "Nao"
                dur_sec = (curr_date - par_ativo["_start_dt"]).total_seconds()
                dur_h = round(dur_sec / 3600.0, 2)
                dur_d = round(dur_sec / 86400.0, 2)
                par_ativo["DuracaoHoras"] = "{:05.2f}".format(dur_h) if dur_h < 10 else "{:.2f}".format(dur_h)
                par_ativo["DuracaoDias"] = "{:05.2f}".format(dur_d) if dur_d < 10 else "{:.2f}".format(dur_d)
                par_ativo["DuracaoExibicao"] = "{:.2f} d".format(dur_d) if dur_d >= 1.0 else "{:.2f} h".format(dur_h)
                del par_ativo["_start_dt"]
                paralizacao_periodos.append(par_ativo)
                par_ativo = None
            elif curr_val and par_ativo and curr_val != par_ativo["Status"]:
                par_ativo["DataFim"] = format_date(curr_date)
                par_ativo["LiberadoPor"] = curr_by
                par_ativo["Ativo"] = "Nao"
                dur_sec = (curr_date - par_ativo["_start_dt"]).total_seconds()
                dur_h = round(dur_sec / 3600.0, 2)
                dur_d = round(dur_sec / 86400.0, 2)
                par_ativo["DuracaoHoras"] = "{:05.2f}".format(dur_h) if dur_h < 10 else "{:.2f}".format(dur_h)
                par_ativo["DuracaoDias"] = "{:05.2f}".format(dur_d) if dur_d < 10 else "{:.2f}".format(dur_d)
                par_ativo["DuracaoExibicao"] = "{:.2f} d".format(dur_d) if dur_d >= 1.0 else "{:.2f} h".format(dur_h)
                del par_ativo["_start_dt"]
                paralizacao_periodos.append(par_ativo)
                
                par_ativo = {
                    "Id": str(wi_id), "Tipo": wi_type, "Status": curr_val, "DataInicio": format_date(curr_date),
                    "DataFim": "", "DuracaoHoras": "0", "DuracaoDias": "0", "DuracaoExibicao": "",
                    "Ativo": "Sim", "MarcadoPor": curr_by, "LiberadoPor": "", "_start_dt": curr_date
                }

        if par_ativo:
            dur_sec = (today - par_ativo["_start_dt"]).total_seconds()
            dur_h = round(dur_sec / 3600.0, 2)
            dur_d = round(dur_sec / 86400.0, 2)
            par_ativo["DuracaoHoras"] = "{:05.2f}".format(dur_h) if dur_h < 10 else "{:.2f}".format(dur_h)
            par_ativo["DuracaoDias"] = "{:05.2f}".format(dur_d) if dur_d < 10 else "{:.2f}".format(dur_d)
            par_ativo["DuracaoExibicao"] = "{:.2f} d".format(dur_d) if dur_d >= 1.0 else "{:.2f} h".format(dur_h)
            del par_ativo["_start_dt"]
            paralizacao_periodos.append(par_ativo)

        new_paralizacoes.extend(paralizacao_periodos)

        # G) Entregas
        if state == "Closed" and closed_dt:
            first_active_dt = None
            for col in hist_colunas:
                if conta_cycle_time(col["valor"]):
                    first_active_dt = col["data"]
                    break
            lead_time_d = str(round((closed_dt - created_dt).total_seconds() / 86400.0, 2)) if created_dt else ""
            cycle_time_d = str(round((closed_dt - first_active_dt).total_seconds() / 86400.0, 2)) if first_active_dt else ""
            new_entregas.append({
                "Id": str(wi_id), "Tipo": wi_type, "Titulo": title, "DataFechamento": format_date(closed_dt),
                "ResponsavelNoFechamento": assigned_name, "LeadTimeDias": lead_time_d,
                "CycleTimeDias": cycle_time_d, "DataPrimeiroActive": format_date(first_active_dt)
            })

        # H) Bugs
        if wi_type == "Bug":
            bug_is_concluido = state in ["Closed", "Resolved"] or board_column == "Pronto pra Release"
            is_open = "Nao" if bug_is_concluido else "Sim"
            closed_in_period = "Nao"
            
            bug_closed_dt = closed_dt if closed_dt else changed_dt
            bug_closed_date_raw = closed_date_raw if closed_date_raw else changed_date_raw
            
            if bug_is_concluido and bug_closed_dt:
                if (today - bug_closed_dt).days <= 30:
                    closed_in_period = "Sim"
            new_bugs.append({
                "Id": str(wi_id), "Titulo": title, "State": state, "BoardColumn": board_column,
                "Responsavel": assigned_name, "DataCriacao": created_date_raw, "DataFechamento": bug_closed_date_raw if bug_is_concluido else "",
                "Prioridade": str(priority), "Severidade": severity, "Aberto": is_open, "FechadoNoPeriodo": closed_in_period
            })

        # I) Atendimentos
        if wi_type == "Atendimento" and state == "Closed":
            ticket_num = fields.get("Custom.a2f3a34e-63a9-4c1e-a465-0b97571cf26e", "")
            completed_work = fields.get("Microsoft.VSTS.Scheduling.CompletedWork", "")
            description = fields.get("System.Description", "")
            new_atendimentos.append({
                "Id": str(wi_id), "Responsavel": assigned_name, "Descricao": clean_html(description),
                "Numero": str(ticket_num), "CompletedWork": str(completed_work), "ClosedDate": closed_date_raw
            })

    # J) Tasks
    for task in all_tasks:
        t_fields = task.get("fields", {})
        t_id = task["id"]
        t_parent = t_fields.get("System.Parent")
        t_title = t_fields.get("System.Title", "")
        t_state = t_fields.get("System.State", "")
        t_assignee = t_fields.get("System.AssignedTo", {})
        t_assignee_name = t_assignee.get("displayName", "") if isinstance(t_assignee, dict) else ""
        
        if t_state == "Removed":
            continue

        activity = t_fields.get("Microsoft.VSTS.Common.Activity", "")
        orig_est = t_fields.get("Microsoft.VSTS.Scheduling.OriginalEstimate", "")
        comp_work = t_fields.get("Microsoft.VSTS.Scheduling.CompletedWork", "")
        t_created = t_fields.get("System.CreatedDate", "")
        t_changed = t_fields.get("System.ChangedDate", "")
        
        new_tasks.append({
            "ParentId": str(t_parent), "TaskId": str(t_id), "Titulo": t_title, "State": t_state,
            "Responsavel": t_assignee_name, "Activity": activity,
            "OriginalEstimate": str(orig_est), "CompletedWork": str(comp_work),
            "DataCriacao": t_created, "DataAlteracao": t_changed
        })

    # 7. MESCLAGEM DOS DADOS (DELTA)
    # Se estivermos no modo Delta, removemos os registros das chaves modificadas e mesclamos.
    # Caso contrário, usamos diretamente os novos arrays.

    def merge_datasets(filename, new_records, key_fields, old_records):
        if not is_delta or old_records is None:
            return new_records
            
        # Constrói chaves para exclusão nos registros antigos
        def make_key(rec, keys):
            return tuple(str(rec.get(k, "")).strip() for k in keys)
            
        new_keys = {make_key(r, key_fields) for r in new_records}
        
        # Filtra os antigos removendo as chaves que foram atualizadas
        merged = [r for r in old_records if make_key(r, key_fields) not in new_keys]
        merged.extend(new_records)
        return merged

    # Identificadores modificados de pais e de tasks
    modified_parent_ids = {str(wi_id) for wi_id in ids}
    if is_delta:
        modified_parent_ids.update(deleted_active_ids)
    modified_task_ids = {str(task["id"]) for task in all_tasks}

    # Mescla cada tabela
    if is_delta:
        print("Mesclando dados incrementais com o histórico local...")
        
        # Filtra por ID de card pai para remoção antes de mesclar
        def filter_out_parents(records):
            return [r for r in records if str(r.get("Id", "")).strip() not in modified_parent_ids]

        workitems_merged = filter_out_parents(old_data["fiscal-workitems.csv"])
        workitems_merged.extend(new_workitems)
        
        # Tasks: Remove tasks cujos IDs foram modificados ou cujos pais foram modificados (para reassociar do zero)
        tasks_merged = [r for r in old_data["fiscal-tasks.csv"] 
                        if str(r.get("TaskId", "")).strip() not in modified_task_ids 
                        and str(r.get("ParentId", "")).strip() not in modified_parent_ids]
        tasks_merged.extend(new_tasks)
        
        transicoes_merged = filter_out_parents(old_data["fiscal-transicoes.csv"])
        transicoes_merged.extend(new_transicoes)
        
        tempo_coluna_merged = filter_out_parents(old_data["fiscal-tempo-coluna.csv"])
        tempo_coluna_merged.extend(new_tempo_coluna)
        
        entregas_merged = filter_out_parents(old_data["fiscal-entregas.csv"])
        entregas_merged.extend(new_entregas)
        
        bugs_merged = filter_out_parents(old_data["fiscal-bugs.csv"])
        bugs_merged.extend(new_bugs)
        
        tags_merged = filter_out_parents(old_data["fiscal-tags.csv"])
        tags_merged.extend(new_tags)
        
        pessoa_papel_merged = filter_out_parents(old_data["fiscal-pessoa-papel.csv"])
        pessoa_papel_merged.extend(new_pessoa_papel)
        
        paralizacoes_merged = filter_out_parents(old_data["fiscal-paralizacoes.csv"])
        paralizacoes_merged.extend(new_paralizacoes)
        
        atendimentos_merged = filter_out_parents(old_data["fiscal-atendimentos-concluidos.csv"])
        atendimentos_merged.extend(new_atendimentos)
    else:
        workitems_merged = new_workitems
        tasks_merged = new_tasks
        transicoes_merged = new_transicoes
        tempo_coluna_merged = new_tempo_coluna
        entregas_merged = new_entregas
        bugs_merged = new_bugs
        tags_merged = new_tags
        pessoa_papel_merged = new_pessoa_papel
        paralizacoes_merged = new_paralizacoes
        atendimentos_merged = new_atendimentos

    # Recalcula tabelas dependentes globais (Paralizações Resumo e Métricas)
    print("Recalculando métricas e resumos agregados...")
    
    # 1. Paralização Resumo
    csv_paralizacao_resumo = []
    par_by_id = {}
    for par in paralizacoes_merged:
        pid = par["Id"]
        if pid not in par_by_id:
            par_by_id[pid] = []
        par_by_id[pid].append(par)
        
    for pid, p_list in par_by_id.items():
        tipo = p_list[0]["Tipo"]
        qtd = len(p_list)
        total_hours = 0.0
        total_days = 0.0
        parado_agora = "Nao"
        status_atual = ""
        
        for par in p_list:
            total_hours += float(par.get("DuracaoHoras") or 0.0)
            total_days += float(par.get("DuracaoDias") or 0.0)
            if par.get("Ativo") == "Sim":
                parado_agora = "Sim"
                status_atual = par.get("Status", "")
                
        dur_exibicao = "{:.2f} d".format(total_days) if total_days >= 1.0 else "{:.2f} h".format(total_hours)
        csv_paralizacao_resumo.append({
            "Id": pid, "Tipo": tipo, "QtdPeriodosParado": qtd,
            "TotalHorasParado": round(total_hours, 2), "TotalDiasParado": round(total_days, 2),
            "TempoParadoExibicao": dur_exibicao, "ParadoAgora": parado_agora, "StatusAtual": status_atual
        })

    # 2. Métricas (Bugs Abertos e Fechados no Período de 30 dias)
    for bug in bugs_merged:
        is_open = bug.get("Aberto") == "Sim"
        is_closed_30d = bug.get("FechadoNoPeriodo") == "Sim"
        
        # Se estiver em delta, precisamos reavaliar o "FechadoNoPeriodo" dinamicamente baseado na data de hoje
        if is_delta and (bug.get("State") in ["Closed", "Resolved"] or bug.get("BoardColumn") == "Pronto pra Release"):
            c_dt = parse_date(bug.get("DataFechamento"))
            if c_dt and (today - c_dt).days <= 30:
                is_closed_30d = True
                bug["FechadoNoPeriodo"] = "Sim"
            else:
                is_closed_30d = False
                bug["FechadoNoPeriodo"] = "Nao"

        if is_open:
            bugs_abertos_total += 1
        if is_closed_30d:
            bugs_fechados_30d += 1

    num_bug_rate = bugs_fechados_30d + bugs_abertos_total
    bug_rate = round(num_bug_rate / total_us_base, 4) if total_us_base > 0 else 0.0
    
    csv_metricas = [{
        "DataExecucao": format_date(today), "JanelaDias": 30, "BugsFechados30d": bugs_fechados_30d,
        "BugsAbertosTotal": bugs_abertos_total, "UserStoriesBase": total_us_base,
        "NumeradorBugRate": num_bug_rate, "BugRate": bug_rate
    }]

    # 8. ESCREVER ARQUIVOS CSV
    def write_csv(filename, data, fieldnames):
        filepath = os.path.join(os.path.dirname(__file__), filename)
        print(f"Escrevendo arquivo: {filename} ({len(data)} registros)...")
        with open(filepath, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for row in data:
                filtered_row = {k: row.get(k, "") for k in fieldnames}
                writer.writerow(filtered_row)

    write_csv("fiscal-workitems.csv", workitems_merged, [
        "Id", "Tipo", "Titulo", "AreaPath", "IterationPath", "State", "BoardColumn", 
        "StateColuna", "TipoFluxo", "Responsavel", "QA", "CriadoPor", "Tags", 
        "DataCriacao", "DataAlteracao", "DataFechamento", "DiasAberto", "Prioridade", "Severity", "ParentId"
    ])
    
    write_csv("fiscal-tasks.csv", tasks_merged, [
        "ParentId", "TaskId", "Titulo", "State", "Responsavel", "Activity", 
        "OriginalEstimate", "CompletedWork", "DataCriacao", "DataAlteracao"
    ])
    
    write_csv("fiscal-transicoes.csv", transicoes_merged, [
        "Id", "Campo", "De", "Para", "Por", "DataMudanca", "DuracaoHoras", "DuracaoDias"
    ])
    
    write_csv("fiscal-tempo-coluna.csv", tempo_coluna_merged, [
        "Id", "BoardColumn", "State", "TipoFluxo", "TempoTotalHoras", "TempoTotalDias", 
        "UltimaEntrada", "UltimaSaida", "ColunaAtual", "TempoAtualHoras"
    ])
    
    write_csv("fiscal-entregas.csv", entregas_merged, [
        "Id", "Tipo", "Titulo", "DataFechamento", "ResponsavelNoFechamento", 
        "LeadTimeDias", "CycleTimeDias", "DataPrimeiroActive"
    ])
    
    write_csv("fiscal-bugs.csv", bugs_merged, [
        "Id", "Titulo", "State", "BoardColumn", "Responsavel", "DataCriacao", 
        "DataFechamento", "Prioridade", "Severidade", "Aberto", "FechadoNoPeriodo"
    ])
    
    write_csv("fiscal-tags.csv", tags_merged, ["Id", "Tag"])
    
    write_csv("fiscal-pessoa-papel.csv", pessoa_papel_merged, ["Id", "Pessoa", "Papel"])
    
    write_csv("fiscal-paralizacoes.csv", paralizacoes_merged, [
        "Id", "Tipo", "Status", "DataInicio", "DataFim", "DuracaoHoras", 
        "DuracaoDias", "DuracaoExibicao", "Ativo", "MarcadoPor", "LiberadoPor"
    ])
    
    write_csv("fiscal-paralizacao-resumo.csv", csv_paralizacao_resumo, [
        "Id", "Tipo", "QtdPeriodosParado", "TotalHorasParado", "TotalDiasParado", 
        "TempoParadoExibicao", "ParadoAgora", "StatusAtual"
    ])
    
    write_csv("fiscal-atendimentos-concluidos.csv", atendimentos_merged, [
        "Id", "Responsavel", "Descricao", "Numero", "CompletedWork", "ClosedDate"
    ])
    
    write_csv("fiscal-metricas-periodo.csv", csv_metricas, [
        "DataExecucao", "JanelaDias", "BugsFechados30d", "BugsAbertosTotal", 
        "UserStoriesBase", "NumeradorBugRate", "BugRate"
    ])

    # Gravar a data desta sincronização
    with open(METADATA_FILE, "w", encoding="utf-8") as f:
        json.dump({"last_sync": format_date(today)}, f, indent=2, ensure_ascii=False)

    print("\nSincronização concluída com sucesso! Todos os arquivos foram mesclados e atualizados.")

if __name__ == "__main__":
    main()
