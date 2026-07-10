import json
import os
import re
import subprocess
import sys
from datetime import date
from typing import Any, Dict, List, Optional, Set
from urllib.parse import quote, unquote

import ado_tool


def gerar_nome_branch(tipo: str, numero_us_ou_bug: int, numero_so: str) -> str:
    tipo = tipo.lower()
    if tipo == "bug":
        return f"bugs/bug-{numero_us_ou_bug}_SO{numero_so}"
    if tipo in ("us", "feature", "implementacao", "implementação"):
        return f"features/us-{numero_us_ou_bug}_SO{numero_so}"
    raise ValueError("Tipo inválido. Use 'bug' ou 'us'.")


def gerar_prefixo_commit(tipo: str, numero_us_ou_bug: int, numero_so: str) -> str:
    tipo = tipo.lower()
    if tipo == "bug":
        return f"bug-{numero_us_ou_bug}_SO{numero_so}"
    if tipo in ("us", "feature", "implementacao", "implementação"):
        return f"us-{numero_us_ou_bug}_SO{numero_so}"
    raise ValueError("Tipo inválido. Use 'bug' ou 'us'.")


def _normalize_so(so: str) -> str:
    normalized = (so or "").strip().upper()
    if normalized.startswith("SO"):
        normalized = normalized[2:]
    normalized = normalized.strip()
    if not normalized.isdigit():
        raise ValueError("Número da SO inválido. Informe apenas dígitos, com ou sem prefixo SO.")
    return normalized


def _relacao_child(parent_id: int) -> Dict[str, Any]:
    return {
        "rel": "System.LinkTypes.Hierarchy-Reverse",
        "url": f"https://dev.azure.com/{ado_tool.organization}/{ado_tool.project}/_apis/wit/workItems/{parent_id}",
    }


def _work_item_url(work_item_id: int) -> str:
    return f"https://dev.azure.com/{ado_tool.organization}/{ado_tool.project}/_workitems/edit/{work_item_id}"


def _pr_web_url(repository_name: str, pr_id: int) -> str:
    return f"https://dev.azure.com/{ado_tool.organization}/{ado_tool.project}/_git/{repository_name}/pullrequest/{pr_id}"


def _parse_args(args: List[str]) -> Dict[str, Any]:
    options: Dict[str, Any] = {
        "squads": [],
        "columns": [],
        "from": None,
        "to": None,
        "work_item_types": ["User Story", "Bug"],
        "only_active": False,
    }
    i = 0
    while i < len(args):
        token = args[i]
        if token == "--squads":
            i += 1
            while i < len(args) and not args[i].startswith("--"):
                options["squads"].append(args[i])
                i += 1
            continue
        if token == "--columns":
            i += 1
            while i < len(args) and not args[i].startswith("--"):
                options["columns"].append(args[i])
                i += 1
            continue
        if token == "--from":
            i += 1
            options["from"] = args[i]
        elif token == "--to":
            i += 1
            options["to"] = args[i]
        elif token == "--types":
            options["work_item_types"] = []
            i += 1
            while i < len(args) and not args[i].startswith("--"):
                options["work_item_types"].append(args[i])
                i += 1
            continue
        elif token == "--only-active":
            options["only_active"] = True
        else:
            raise ValueError(f"Argumento desconhecido: {token}")
        i += 1
    return options


def _normalize_column(column: str) -> str:
    lowered = column.strip().lower()
    if lowered in {"pronto pra release", "pronto para release"}:
        return "Pronto pra Release"
    if lowered in {"concluído", "concluido"}:
        return "Concluído"
    return column.strip()


def _column_condition(column: str) -> str:
    normalized = _normalize_column(column)
    if normalized == "Concluído":
        return "[System.BoardColumn] In ('Concluído','Concluido')"
    return f"[System.BoardColumn] = '{normalized}'"


def _month_range() -> Dict[str, str]:
    today = date.today()
    start = today.replace(day=1)
    if start.month == 12:
        end = start.replace(year=start.year + 1, month=1)
    else:
        end = start.replace(month=start.month + 1)
    return {"from": start.isoformat(), "to": end.isoformat()}


def _build_wiql(squad: str, column: str, work_item_types: List[str], start_date: Optional[str], end_date: Optional[str]) -> str:
    type_filter = ",".join(f"'{item_type}'" for item_type in work_item_types)
    filters = [
        "[System.TeamProject] = 'Metanet'",
        f"[System.WorkItemType] In ({type_filter})",
        f"[System.AreaPath] UNDER 'Metanet\\{squad}'",
        _column_condition(column),
    ]
    if start_date:
        filters.append(f"[Microsoft.VSTS.Common.ClosedDate] >= '{start_date}'")
    if end_date:
        filters.append(f"[Microsoft.VSTS.Common.ClosedDate] < '{end_date}'")
    return "Select [System.Id] From WorkItems Where " + " And ".join(filters) + " Order By [System.Id]"


def _extract_related_id(rel_url: str) -> Optional[int]:
    tail = rel_url.rsplit("/", 1)[-1]
    return int(tail) if tail.isdigit() else None


def _parse_pr_artifact_url(artifact_url: str) -> Optional[Dict[str, Any]]:
    decoded = unquote(artifact_url)
    marker = "PullRequestId/"
    if marker not in decoded:
        return None
    parts = decoded.split(marker, 1)[1].split("/")
    if len(parts) < 3:
        return None
    repo_id = parts[-2]
    pr_token = parts[-1]
    if not pr_token.isdigit():
        return None
    return {"repository_id": repo_id, "pull_request_id": int(pr_token)}


def _get_item_title(item: Dict[str, Any]) -> str:
    return item.get("fields", {}).get("System.Title", "")


def _get_assigned_to(item: Dict[str, Any]) -> Optional[str]:
    assigned = item.get("fields", {}).get("System.AssignedTo")
    if isinstance(assigned, dict):
        return assigned.get("displayName")
    return assigned


def _git_command(repo_path: str, args: List[str]) -> Dict[str, Any]:
    completed = subprocess.run(
        ["git", "-C", repo_path, *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return {
        "ok": completed.returncode == 0,
        "stdout": completed.stdout,
        "stderr": completed.stderr,
        "returncode": completed.returncode,
    }


def _normalize_repo_path(repo_path: Optional[str]) -> str:
    candidate = repo_path or os.getcwd()
    return os.path.abspath(candidate)


def _parse_review_card_args(args: List[str]) -> Dict[str, Any]:
    if not args:
        raise ValueError("Informe o id do card. Exemplo: review-card 14850")

    options: Dict[str, Any] = {
        "card_id": int(args[0]),
        "repo_path": None,
        "include_patch": True,
    }
    i = 1
    while i < len(args):
        token = args[i]
        if token == "--repo-path":
            i += 1
            if i >= len(args):
                raise ValueError("Valor ausente para --repo-path.")
            options["repo_path"] = args[i]
        elif token == "--no-patch":
            options["include_patch"] = False
        else:
            raise ValueError(f"Argumento desconhecido: {token}")
        i += 1
    return options


def _load_related_items_with_hierarchy(root: Dict[str, Any]) -> List[Dict[str, Any]]:
    cache: Dict[int, Dict[str, Any]] = {}
    queue: List[int] = [int(root["id"])]
    visited: set[int] = set()

    while queue:
        work_item_id = queue.pop(0)
        if work_item_id in visited:
            continue
        visited.add(work_item_id)

        item = cache.get(work_item_id) or ado_tool.get_work_item(work_item_id, expand="relations")
        if not item:
            continue
        cache[work_item_id] = item

        for rel in item.get("relations", []):
            if rel.get("rel") not in {"System.LinkTypes.Hierarchy-Forward", "System.LinkTypes.Hierarchy-Reverse"}:
                continue
            related_id = _extract_related_id(rel.get("url", ""))
            if related_id and related_id not in visited:
                queue.append(related_id)

    return [cache[item_id] for item_id in sorted(cache.keys())]


def _collect_prs_for_work_items(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    pr_cache: Dict[str, Dict[str, Any]] = {}
    collected: List[Dict[str, Any]] = []

    for related_item in items:
        for rel in related_item.get("relations", []):
            if rel.get("rel") != "ArtifactLink":
                continue
            if rel.get("attributes", {}).get("name") != "Pull Request":
                continue

            parsed = _parse_pr_artifact_url(rel.get("url", ""))
            if not parsed:
                continue

            cache_key = f"{parsed['repository_id']}:{parsed['pull_request_id']}"
            if cache_key not in pr_cache:
                pr_cache[cache_key] = ado_tool.get_pull_request(
                    parsed["pull_request_id"],
                    repository_id=parsed["repository_id"],
                )
            pr = pr_cache.get(cache_key)
            if not pr:
                continue

            collected.append(
                {
                    "id": pr["pullRequestId"],
                    "status": pr.get("status"),
                    "title": pr.get("title"),
                    "repositoryId": pr["repository"]["id"],
                    "repository": pr["repository"]["name"],
                    "url": _pr_web_url(pr["repository"]["name"], pr["pullRequestId"]),
                    "sourceBranch": pr.get("sourceRefName"),
                    "targetBranch": pr.get("targetRefName"),
                    "sourceCommit": pr.get("lastMergeSourceCommit", {}).get("commitId"),
                    "targetCommit": pr.get("lastMergeTargetCommit", {}).get("commitId"),
                    "sourceWorkItemId": related_item["id"],
                    "sourceWorkItemType": related_item["fields"].get("System.WorkItemType"),
                }
            )

    unique = {f"{pr['repository']}:{pr['id']}": pr for pr in collected}
    return list(unique.values())


def _build_diff_for_pr(repo_path: str, pr: Dict[str, Any], include_patch: bool) -> Dict[str, Any]:
    source_commit = pr.get("sourceCommit")
    target_commit = pr.get("targetCommit")

    result: Dict[str, Any] = {
        "repositoryPath": repo_path,
        "range": f"{target_commit}...{source_commit}",
        "nameOnly": "",
        "patch": None,
        "errors": [],
    }

    if not source_commit or not target_commit:
        result["errors"].append("PR sem commits de source/target para comparar.")
        return result

    check_repo = _git_command(repo_path, ["rev-parse", "--is-inside-work-tree"])
    if not check_repo["ok"]:
        result["errors"].append(f"Caminho não é repositório git: {repo_path}")
        result["errors"].append(check_repo["stderr"].strip())
        return result

    source_exists = _git_command(repo_path, ["cat-file", "-e", f"{source_commit}^{{commit}}"])
    target_exists = _git_command(repo_path, ["cat-file", "-e", f"{target_commit}^{{commit}}"])
    if not source_exists["ok"] or not target_exists["ok"]:
        fetch_result = _git_command(repo_path, ["fetch", "origin", source_commit, target_commit])
        if not fetch_result["ok"]:
            result["errors"].append("Não foi possível baixar commits da PR no repositório local.")
            result["errors"].append(fetch_result["stderr"].strip())
            return result

    name_only = _git_command(repo_path, ["diff", "--name-only", f"{target_commit}...{source_commit}"])
    if not name_only["ok"]:
        result["errors"].append("Falha ao gerar diff --name-only.")
        result["errors"].append(name_only["stderr"].strip())
        return result
    result["nameOnly"] = name_only["stdout"]

    if include_patch:
        patch = _git_command(repo_path, ["diff", f"{target_commit}...{source_commit}"])
        if not patch["ok"]:
            result["errors"].append("Falha ao gerar patch completo.")
            result["errors"].append(patch["stderr"].strip())
            return result
        result["patch"] = patch["stdout"]

    return result


def _extract_script_object_name(path: str) -> Optional[str]:
    filename = os.path.basename(path)
    name, _ = os.path.splitext(filename)
    tokens = name.split("_")
    if not tokens:
        return None
    for token in tokens:
        upper = token.upper()
        if upper.startswith(("SP", "FN", "VW", "TR", "IDX", "UK", "CK", "FK")) and len(token) > 1:
            return token
    return tokens[-1] if len(tokens) > 2 else None


def _build_diff_metadata(name_only_stdout: str) -> Dict[str, Any]:
    raw_paths = [line.strip() for line in name_only_stdout.splitlines() if line.strip()]
    extension_counts: Dict[str, int] = {}
    folder_counts: Dict[str, int] = {}
    object_names: List[str] = []
    flags = {
        "hasSqlScripts": False,
        "hasXmlScripts": False,
        "hasCsharpFiles": False,
        "hasCsprojFiles": False,
    }

    for path in raw_paths:
        extension = os.path.splitext(path)[1].lower() or "<sem_extensao>"
        extension_counts[extension] = extension_counts.get(extension, 0) + 1

        top_folder = path.split("/", 1)[0].split("\\", 1)[0]
        folder_counts[top_folder] = folder_counts.get(top_folder, 0) + 1

        if extension == ".sql":
            flags["hasSqlScripts"] = True
        if extension == ".xml":
            flags["hasXmlScripts"] = True
        if extension == ".cs":
            flags["hasCsharpFiles"] = True
        if extension == ".csproj":
            flags["hasCsprojFiles"] = True

        if extension in {".sql", ".xml"}:
            object_name = _extract_script_object_name(path)
            if object_name and object_name not in object_names:
                object_names.append(object_name)

    return {
        "changedFiles": raw_paths,
        "fileCount": len(raw_paths),
        "extensionCounts": extension_counts,
        "topFolders": folder_counts,
        "inferredSqlObjects": object_names,
        "flags": flags,
    }


def review_card(args: List[str]) -> Dict[str, Any]:
    options = _parse_review_card_args(args)
    card_id = options["card_id"]
    repo_path = _normalize_repo_path(options["repo_path"])
    include_patch = options["include_patch"]

    root = ado_tool.get_work_item(card_id, expand="relations")
    if not root:
        raise ValueError(f"Card {card_id} não encontrado.")

    related_items = _load_related_items_with_hierarchy(root)
    prs = _collect_prs_for_work_items(related_items)

    for pr in prs:
        pr["diff"] = _build_diff_for_pr(repo_path, pr, include_patch)
        pr["metadata"] = _build_diff_metadata(pr["diff"].get("nameOnly", ""))

    return {
        "card": {
            "id": root["id"],
            "url": _work_item_url(root["id"]),
            "type": root["fields"].get("System.WorkItemType"),
            "title": _get_item_title(root),
            "state": root["fields"].get("System.State"),
            "boardColumn": root["fields"].get("System.BoardColumn"),
            "assignedTo": _get_assigned_to(root),
        },
        "scope": {
            "repositoryPath": repo_path,
            "includePatch": include_patch,
            "relatedItemsCount": len(related_items),
            "prCount": len(prs),
        },
        "pullRequests": prs,
    }


def _parse_encerrar_card_args(args: List[str]) -> Dict[str, Any]:
    if not args:
        raise ValueError("Informe o id do card. Exemplo: encerrar-card 15169 --so 669933 --repo-path C:\\repo --mensagem \"Ajuste\"")

    options: Dict[str, Any] = {
        "card_id": int(args[0]),
        "so": None,
        "repo_path": None,
        "mensagem": None,
        "target_branch": "master",
        "criar_pr": False,
        "dry_run": False,
        "fato": None,
        "causa": None,
        "acao": None,
    }

    i = 1
    while i < len(args):
        token = args[i]
        if token == "--so":
            i += 1
            options["so"] = args[i]
        elif token == "--repo-path":
            i += 1
            options["repo_path"] = args[i]
        elif token == "--mensagem":
            i += 1
            options["mensagem"] = args[i]
        elif token == "--target-branch":
            i += 1
            options["target_branch"] = args[i]
        elif token == "--fato":
            i += 1
            options["fato"] = args[i]
        elif token == "--causa":
            i += 1
            options["causa"] = args[i]
        elif token == "--acao":
            i += 1
            options["acao"] = args[i]
        elif token == "--criar-pr":
            options["criar_pr"] = True
        elif token == "--dry-run":
            options["dry_run"] = True
        else:
            raise ValueError(f"Argumento desconhecido: {token}")
        i += 1

    missing = [key for key in ("so", "repo_path", "mensagem") if not options[key]]
    if missing:
        raise ValueError(f"Parâmetros obrigatórios ausentes: {', '.join(missing)}")
    return options


def _resolve_parent_assigned_to(parent: Dict[str, Any]) -> Optional[str]:
    assigned = parent.get("fields", {}).get("System.AssignedTo")
    if isinstance(assigned, dict):
        return assigned.get("uniqueName") or assigned.get("displayName")
    if isinstance(assigned, str):
        return assigned
    return None


def _card_tipo_to_branch_tipo(work_item_type: str) -> str:
    lowered = (work_item_type or "").strip().lower()
    if lowered == "bug":
        return "bug"
    if lowered in {"user story", "us"}:
        return "us"
    raise ValueError(f"Tipo de card não suportado para encerramento: {work_item_type}")


def _build_fca_text(fato: Optional[str], causa: Optional[str], acao: Optional[str]) -> str:
    safe_fato = (fato or "Não informado.").strip()
    safe_causa = (causa or "Não informado.").strip()
    safe_acao = (acao or "Não informado.").strip()
    return f"Fato: {safe_fato}\nCausa: {safe_causa}\nAção: {safe_acao}"


def _build_fato_causa_text(fato: Optional[str], causa: Optional[str]) -> str:
    safe_fato = (fato or "Não informado.").strip()
    safe_causa = (causa or "Não informado.").strip()
    return f"Fato: {safe_fato}\nCausa: {safe_causa}"


def _build_parent_patches(parent_type: str, resumo_impl: str, fato: Optional[str], causa: Optional[str], acao: Optional[str]) -> List[Dict[str, Any]]:
    safe_resumo = (resumo_impl or "Não informado.").strip()
    safe_fato = (fato or "Não informado.").strip()
    safe_causa = (causa or "Não informado.").strip()
    safe_acao = (acao or "Não informado.").strip()

    fca_html = (
        "<h3>Fato, Causa e Ação</h3>"
        f"<p><strong>Fato</strong><br/>{safe_fato}</p>"
        f"<p><strong>Causa</strong><br/>{safe_causa}</p>"
        f"<p><strong>Ação</strong><br/>{safe_acao}</p>"
    )

    # Regra da equipe: no encerrar-card nunca alterar System.Description do card pai.
    if parent_type == "User Story":
        funcionalidade_html = (
            "<h3>Resumo Técnico</h3>"
            f"<p>{safe_resumo}</p>"
            f"{fca_html}"
        )
        return [
            {"op": "add", "path": "/fields/Custom.Funcionalidade", "value": funcionalidade_html},
        ]

    return [
        {"op": "add", "path": "/fields/Custom.5d2ff7c5-f7be-48db-aa96-24e2b6144230", "value": fca_html},
    ]


def _validate_branch_name(branch_name: str, tipo_branch: str, card_id: int, so: str) -> None:
    expected = gerar_nome_branch(tipo_branch, card_id, so)
    if branch_name != expected:
        raise ValueError(
            f"Nome de branch fora do padrão/case esperado. Esperado: '{expected}', recebido: '{branch_name}'."
        )
    if tipo_branch == "bug":
        pattern = r"^bugs/bug-\d+_SO\d+$"
    else:
        pattern = r"^features/us-\d+_SO\d+$"
    if not re.match(pattern, branch_name):
        raise ValueError(f"Nome de branch inválido: '{branch_name}'.")


def _safe_update_fields(work_item_id: int, field_values: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    for field, value in field_values.items():
        result = ado_tool.update_work_item(
            work_item_id,
            [{"op": "add", "path": f"/fields/{field}", "value": value}],
        )
        if not result:
            errors.append(field)
    return errors


def _create_child_item(
    card_id: int,
    title: str,
    work_item_type: str,
    assigned_to: str,
    relation: str = "child",
) -> Dict[str, Any]:
    if relation == "tested_by":
        relations = [
            {
                "rel": "Microsoft.VSTS.Common.TestedBy-Reverse",
                "url": f"https://dev.azure.com/{ado_tool.organization}/{ado_tool.project}/_apis/wit/workItems/{card_id}",
            }
        ]
    else:
        relations = [_relacao_child(card_id)]

    created = ado_tool.create_work_item(
        work_item_type,
        {
            "System.Title": title,
            "System.WorkItemType": work_item_type,
            "System.AssignedTo": assigned_to,
        },
        relations,
    )
    if not created:
        raise RuntimeError(f"Falha ao criar item filho: {title}")
    return created


def _close_work_item(work_item_id: int) -> bool:
    result = ado_tool.update_work_item(
        work_item_id,
        [{"op": "add", "path": "/fields/System.State", "value": "Closed"}],
    )
    return bool(result)


def _run_git_or_fail(repo_path: str, args: List[str], error_message: str) -> Dict[str, Any]:
    result = _git_command(repo_path, args)
    if not result["ok"]:
        stderr = (result["stderr"] or "").strip()
        base_message = error_message or "Falha ao executar comando git"
        raise RuntimeError(f"{base_message}. {stderr}".strip())
    return result


def encerrar_card(args: List[str]) -> Dict[str, Any]:
    options = _parse_encerrar_card_args(args)
    card_id = options["card_id"]
    so = _normalize_so(options["so"])
    repo_path = _normalize_repo_path(options["repo_path"])
    mensagem = options["mensagem"]
    target_branch = options["target_branch"]
    criar_pr = options["criar_pr"]
    dry_run = options["dry_run"]

    parent = ado_tool.get_work_item(card_id, expand="relations")
    if not parent:
        raise ValueError(f"Card {card_id} não encontrado.")

    parent_fields = parent.get("fields", {})
    parent_type = parent_fields.get("System.WorkItemType")
    parent_assigned_to = _resolve_parent_assigned_to(parent)
    if not parent_assigned_to:
        raise ValueError("Card pai sem System.AssignedTo. Defina responsável antes de continuar.")

    tipo_branch = _card_tipo_to_branch_tipo(parent_type)
    branch_name = gerar_nome_branch(tipo_branch, card_id, so)
    _validate_branch_name(branch_name, tipo_branch, card_id, so)
    commit_prefix = gerar_prefixo_commit(tipo_branch, card_id, so)
    commit_message = f"{commit_prefix} - {mensagem}"
    parent_patches = _build_parent_patches(parent_type, mensagem, options["fato"], options["causa"], options["acao"])

    _run_git_or_fail(repo_path, ["rev-parse", "--is-inside-work-tree"], "Caminho informado não é repositório git")

    created_children: List[Dict[str, Any]] = []
    closed_children: List[int] = []
    parent_update_ok = False
    parent_update_errors: List[str] = []

    if not dry_run:
        updated_parent = ado_tool.update_work_item(card_id, parent_patches)
        parent_update_ok = bool(updated_parent)
        if not parent_update_ok:
            parent_update_errors.append("Falha ao atualizar campos do card pai.")

        child_1 = _create_child_item(card_id, "1. Análise", "Task", parent_assigned_to)
        child_2 = _create_child_item(card_id, "2. Desenvolvimento", "Task", parent_assigned_to)
        child_3 = _create_child_item(card_id, "3. Teste", "Task", parent_assigned_to)
        child_4 = _create_child_item(card_id, "4. QA", "Test Case", parent_assigned_to, relation="tested_by")
        created_children = [child_1, child_2, child_3, child_4]

        changed_now = _git_command(repo_path, ["status", "--short"])
        changed_files = []
        if changed_now["ok"]:
            changed_files = [
                line[3:].strip()
                for line in changed_now["stdout"].splitlines()
                if line.strip() and len(line) > 3
            ]
        files_html = "".join(f"<li><code>{path}</code></li>" for path in changed_files[:20]) or "<li><em>Sem arquivos detectados.</em></li>"

        safe_fato = (options["fato"] or "Não informado.").strip()
        safe_causa = (options["causa"] or "Não informado.").strip()
        safe_acao = (options["acao"] or "Não informado.").strip()
        analise_html = (
            "<h3>1. Análise</h3>"
            "<p><strong>Fato</strong></p>"
            f"<p>{safe_fato}</p>"
            "<p><strong>Causa</strong></p>"
            f"<p>{safe_causa}</p>"
        )
        desenvolvimento_html = (
            "<h3>2. Desenvolvimento</h3>"
            "<p><strong>Ação executada</strong></p>"
            f"<p>{safe_acao}</p>"
            "<p><strong>Classes/Arquivos alterados</strong></p>"
            f"<ul>{files_html}</ul>"
        )

        errors_1 = _safe_update_fields(
            child_1["id"],
            {
                "System.Description": analise_html,
                "Custom.Funcionalidade": analise_html,
                "Custom.5d2ff7c5-f7be-48db-aa96-24e2b6144230": analise_html,
            },
        )
        errors_2 = _safe_update_fields(
            child_2["id"],
            {
                "System.Description": desenvolvimento_html,
                "Custom.Funcionalidade": desenvolvimento_html,
                "Custom.5d2ff7c5-f7be-48db-aa96-24e2b6144230": desenvolvimento_html,
            },
        )
        errors_3 = _safe_update_fields(
            child_3["id"],
            {
                "System.Description": "Teste DEV executado. Registrar cenários e evidências conforme processo.",
            },
        )
        if errors_1 or errors_2 or errors_3:
            parent_update_errors.extend(
                [f"Falha ao preencher campos adicionais dos filhos: {', '.join(sorted(set(errors_1 + errors_2 + errors_3)))}"]
            )

        for child in (child_1, child_2, child_3):
            if _close_work_item(child["id"]):
                closed_children.append(child["id"])

    git_result: Dict[str, Any] = {
        "repoPath": repo_path,
        "branchName": branch_name,
        "commitMessage": commit_message,
        "branchCreated": False,
        "commitCreated": False,
        "commitId": None,
        "stagedFiles": [],
        "warnings": [],
    }
    pr_result: Dict[str, Any] = {
        "requested": criar_pr,
        "created": False,
        "id": None,
        "url": None,
        "status": None,
        "autoCompleteConfigured": False,
        "deleteSourceBranch": False,
    }

    branch_exists_local = _git_command(repo_path, ["show-ref", "--verify", f"refs/heads/{branch_name}"])["ok"]
    if dry_run:
        git_result["warnings"].append("Dry-run ativo: branch/commit/PR não foram executados.")
        if branch_exists_local:
            git_result["warnings"].append(f"Branch já existe localmente: {branch_name}")
    else:
        try:
            if branch_exists_local:
                git_result["warnings"].append(f"Branch já existe localmente: {branch_name}")
                _run_git_or_fail(repo_path, ["checkout", branch_name], "Falha ao trocar para branch existente")
            else:
                _run_git_or_fail(repo_path, ["checkout", "-b", branch_name], "Falha ao criar branch")
                git_result["branchCreated"] = True
            _run_git_or_fail(repo_path, ["add", "-A"], "Falha no git add")
            staged = _run_git_or_fail(repo_path, ["diff", "--cached", "--name-only"], "Falha ao listar arquivos staged")
            staged_files = [line.strip() for line in staged["stdout"].splitlines() if line.strip()]
            git_result["stagedFiles"] = staged_files
            if staged_files:
                _run_git_or_fail(repo_path, ["commit", "-m", commit_message], "Falha ao criar commit")
                git_result["commitCreated"] = True
                commit_id = _run_git_or_fail(repo_path, ["rev-parse", "HEAD"], "Falha ao obter hash do commit")
                git_result["commitId"] = commit_id["stdout"].strip()
            else:
                git_result["warnings"].append("Nenhuma alteração local para commit.")
        except RuntimeError as git_error:
            git_result["warnings"].append(str(git_error))

    if not dry_run:
        try:
            if criar_pr and git_result["commitCreated"]:
                _run_git_or_fail(repo_path, ["push", "-u", "origin", branch_name], "Falha ao subir branch para origem")
                pr_title = commit_message
                pr_description = f"Card {card_id}: {parent_fields.get('System.Title', '')}"
                pr = ado_tool.create_pull_request(branch_name, target_branch, pr_title, pr_description)
                if pr:
                    pr_result["created"] = True
                    pr_result["id"] = pr.get("pullRequestId")
                    pr_result["status"] = pr.get("status")
                    repo_name = pr.get("repository", {}).get("name", "projeto-metaposto-net.git")
                    pr_result["url"] = _pr_web_url(repo_name, pr_result["id"]) if pr_result["id"] else None
                    created_by_id = pr.get("createdBy", {}).get("id")
                    repo_id = pr.get("repository", {}).get("id", "projeto-metaposto-net.git")
                    if created_by_id and pr_result["id"]:
                        completion = ado_tool.set_pull_request_auto_complete(
                            pr_result["id"],
                            created_by_id,
                            delete_source_branch=True,
                            repository_id=repo_id,
                        )
                        if completion:
                            pr_result["autoCompleteConfigured"] = True
                            pr_result["deleteSourceBranch"] = True
            elif criar_pr and not git_result["commitCreated"]:
                pr_result["requested"] = True
        except RuntimeError as pr_error:
            git_result["warnings"].append(str(pr_error))

    child_items_payload = [
        {
            "id": item.get("id"),
            "title": item.get("fields", {}).get("System.Title"),
            "type": item.get("fields", {}).get("System.WorkItemType"),
            "url": _work_item_url(item.get("id")),
        }
        for item in created_children
    ]

    return {
        "scope": {
            "cardId": card_id,
            "so": so,
            "repoPath": repo_path,
            "targetBranch": target_branch,
            "dryRun": dry_run,
            "criarPr": criar_pr,
        },
        "parentCard": {
            "id": parent.get("id"),
            "type": parent_type,
            "title": parent_fields.get("System.Title"),
            "state": parent_fields.get("System.State"),
            "boardColumn": parent_fields.get("System.BoardColumn"),
            "assignedTo": parent_assigned_to,
            "url": _work_item_url(parent.get("id")),
        },
        "parentUpdates": {
            "applied": parent_update_ok,
            "errors": parent_update_errors,
            "fieldsChanged": [patch["path"].replace("/fields/", "") for patch in parent_patches],
        },
        "children": {
            "created": child_items_payload,
            "closedIds": closed_children,
            "qaLeftOpen": True,
        },
        "git": git_result,
        "pr": pr_result,
        "bloqueioAplicado": "Card pai mantido no status/coluna originais. Somente filhos 1/2/3 são encerrados automaticamente.",
        "checklistConformidade": {
            "parentStatusColunaMantidos": True,
            "parentCamposObrigatoriosPreenchidos": (
                ["Custom.Funcionalidade"] if parent_type == "User Story" else ["Custom.5d2ff7c5-f7be-48db-aa96-24e2b6144230"]
            ),
            "filhosCriadosComMesmoResponsavelDoPai": bool(created_children) if not dry_run else True,
            "filhos123EncerradosAutomaticamente": (len(closed_children) == 3) if not dry_run else True,
            "qaMantidoAberto": True,
            "prComAutoCompleteEAutoDelete": bool(
                not criar_pr or dry_run or (pr_result["autoCompleteConfigured"] and pr_result["deleteSourceBranch"])
            ),
        },
    }


def auditar_cards_com_pr_aberta(args: List[str]) -> Dict[str, Any]:
    options = _parse_args(args)
    squads = options["squads"]
    columns = [_normalize_column(column) for column in options["columns"]]
    if not squads:
        raise ValueError("Informe ao menos um squad em --squads.")
    if not columns:
        raise ValueError("Informe ao menos uma coluna em --columns.")

    start_date = options["from"]
    end_date = options["to"]
    if "Concluído" in columns and not start_date and not end_date:
        month = _month_range()
        start_date = month["from"]
        end_date = month["to"]

    cache: Dict[int, Dict[str, Any]] = {}
    pr_cache: Dict[str, Dict[str, Any]] = {}
    total_scanned = 0

    def load_work_item(work_item_id: int) -> Dict[str, Any]:
        if work_item_id not in cache:
            cache[work_item_id] = ado_tool.get_work_item(work_item_id, expand="relations")
        return cache[work_item_id]

    def load_pr(repository_id: str, pull_request_id: int) -> Optional[Dict[str, Any]]:
        key = f"{repository_id}:{pull_request_id}"
        if key not in pr_cache:
            pr_cache[key] = ado_tool.get_pull_request(pull_request_id, repository_id=repository_id)
        return pr_cache[key]

    results = []
    for squad in squads:
        for column in columns:
            wiql = _build_wiql(squad, column, options["work_item_types"], start_date if column == "Concluído" else None, end_date if column == "Concluído" else None)
            query_result = ado_tool.query_work_items(wiql) or {}
            for item_ref in query_result.get("workItems", []):
                root = load_work_item(int(item_ref["id"]))
                related_ids = {int(root["id"])}
                for rel in root.get("relations", []):
                    if rel.get("rel") in {"System.LinkTypes.Hierarchy-Forward", "System.LinkTypes.Hierarchy-Reverse"}:
                        related_id = _extract_related_id(rel.get("url", ""))
                        if related_id:
                            related_ids.add(related_id)

                related_items = [load_work_item(related_id) for related_id in sorted(related_ids)]
                prs = []
                for related_item in related_items:
                    for rel in related_item.get("relations", []):
                        if rel.get("rel") != "ArtifactLink":
                            continue
                        if rel.get("attributes", {}).get("name") != "Pull Request":
                            continue
                        parsed = _parse_pr_artifact_url(rel.get("url", ""))
                        if not parsed:
                            continue
                        pr = load_pr(parsed["repository_id"], parsed["pull_request_id"])
                        if not pr:
                            continue
                        prs.append(
                            {
                                "id": pr["pullRequestId"],
                                "status": pr["status"],
                                "title": pr["title"],
                                "repository": pr["repository"]["name"],
                                "url": _pr_web_url(pr["repository"]["name"], pr["pullRequestId"]),
                                "sourceWorkItemId": related_item["id"],
                                "sourceWorkItemType": related_item["fields"].get("System.WorkItemType"),
                            }
                        )

                unique_prs = {f"{pr['repository']}:{pr['id']}": pr for pr in prs}
                ordered_prs = list(unique_prs.values())
                active_prs = [pr for pr in ordered_prs if pr["status"] == "active"]
                total_scanned += 1

                if options["only_active"] and not active_prs:
                    continue

                results.append(
                    {
                        "squad": squad,
                        "column": column,
                        "id": root["id"],
                        "url": _work_item_url(root["id"]),
                        "type": root["fields"].get("System.WorkItemType"),
                        "title": _get_item_title(root),
                        "assignedTo": _get_assigned_to(root),
                        "closedDate": root["fields"].get("Microsoft.VSTS.Common.ClosedDate"),
                        "changedDate": root["fields"].get("System.ChangedDate"),
                        "hasActivePr": bool(active_prs),
                        "activePrs": active_prs,
                        "allPrs": ordered_prs,
                    }
                )

    results.sort(key=lambda item: (item["squad"], item["column"], item["id"]))
    return {
        "scope": {
            "squads": squads,
            "columns": columns,
            "from": start_date,
            "to": end_date,
            "workItemTypes": options["work_item_types"],
            "onlyActive": options["only_active"],
        },
        "totals": {
            "found": len(results),
            "scanned": total_scanned,
            "withActivePr": sum(1 for item in results if item["hasActivePr"]),
            "withoutPr": sum(1 for item in results if not item["allPrs"]),
        },
        "items": results,
    }


def _parse_branches_sem_pr_args(args: List[str]) -> Dict[str, Any]:
    options: Dict[str, Any] = {
        "team": "Squad Financeiro",
        "repository": "projeto-metaposto-net.git",
        "compare_branch": "master",
        "max_branches": None,
        "include_active": False,
    }
    i = 0
    while i < len(args):
        token = args[i]
        if token == "--team":
            i += 1
            options["team"] = args[i]
        elif token == "--repository":
            i += 1
            options["repository"] = args[i]
        elif token == "--compare-branch":
            i += 1
            options["compare_branch"] = args[i]
        elif token == "--max-branches":
            i += 1
            options["max_branches"] = int(args[i])
        elif token == "--include-active":
            options["include_active"] = True
        else:
            raise ValueError(f"Argumento desconhecido: {token}")
        i += 1
    return options


def _normalize_key(value: Optional[str]) -> str:
    return (value or "").strip().lower()


def _resolve_team_members(team_query: str) -> Dict[str, Any]:
    """
    Resolve membros do time via API Core; se falhar, lista times e casa por nome.
    """
    raw = ado_tool.get_team_members(team_query)
    team_resolved = team_query
    resolution_note = "direto"

    if not raw or not raw.get("value"):
        teams_response = ado_tool.list_project_teams()
        if not teams_response or not teams_response.get("value"):
            raise ValueError("Não foi possível listar times do projeto.")

        found = None
        tq_lower = team_query.strip().lower()
        for team in teams_response.get("value") or []:
            name = (team.get("name") or "").strip()
            if name.lower() == tq_lower:
                found = team
                break

        if not found:
            for team in teams_response.get("value") or []:
                name_l = (team.get("name") or "").strip().lower()
                if "financeiro" in name_l and "squad" in name_l:
                    found = team
                    break

        if not found:
            available = ", ".join(sorted((t.get("name") or "") for t in teams_response.get("value") or []))
            raise ValueError(f'Time "{team_query}" não encontrado. Times disponíveis: {available}')

        team_resolved = str(found.get("id") or found.get("name") or "")
        raw = ado_tool.get_team_members(team_resolved)
        resolution_note = "via listagem de times"

    members = raw.get("value") if raw else []
    if not members:
        raise ValueError(f'Sem membros para o time "{team_resolved}".')

    squad_emails: Set[str] = set()
    squad_display_names: Set[str] = set()
    squad_unique_names: Set[str] = set()
    member_summaries: List[Dict[str, Any]] = []

    for row in members:
        identity = row.get("identity") or {}
        unique_name = _normalize_key(identity.get("uniqueName"))
        display_name = (identity.get("displayName") or "").strip()
        display_key = _normalize_key(display_name)

        if unique_name:
            squad_unique_names.add(unique_name)
        if "@" in unique_name:
            squad_emails.add(unique_name)
        if display_key:
            squad_display_names.add(display_key)

        member_summaries.append(
            {
                "displayName": display_name,
                "uniqueName": identity.get("uniqueName"),
                "id": identity.get("id"),
            }
        )

    return {
        "team_query": team_query,
        "team_resolved": team_resolved,
        "resolution_note": resolution_note,
        "members": member_summaries,
        "squad_emails": squad_emails,
        "squad_display_names": squad_display_names,
        "squad_unique_names": squad_unique_names,
    }


def _branch_browser_url(repository_name: str, branch_name: str) -> str:
    repo_segment = repository_name[:-4] if repository_name.endswith(".git") else repository_name
    enc_branch = quote(branch_name, safe="")
    return (
        f"https://dev.azure.com/{ado_tool.organization}/{ado_tool.project}/_git/{repo_segment}"
        f"?version=GB{enc_branch}"
    )


def _author_matches_squad(
    author: Optional[Dict[str, Any]],
    squad_emails: Set[str],
    squad_display_names: Set[str],
    squad_unique_names: Set[str],
) -> bool:
    if not author:
        return False
    email = _normalize_key(author.get("email"))
    name = _normalize_key(author.get("name"))
    if email and email in squad_emails:
        return True
    if email and email in squad_unique_names:
        return True
    if name and name in squad_display_names:
        return True
    return False


def _first_commit_divergent_from_base(
    repository_id: str,
    branch_name: str,
    compare_branch: str,
) -> Dict[str, Any]:
    """
    Autor do primeiro commit exclusivo da branch em relação à branch base (ex.: master).
    Usa aheadCount + skip; fallback para stats.commit.
    """
    stats = ado_tool.get_branch_stats(repository_id, branch_name)
    result: Dict[str, Any] = {
        "stats": stats,
        "ahead_count": None,
        "first_commit": None,
        "author": None,
        "resolution": None,
    }

    if not stats:
        result["resolution"] = "sem_stats"
        return result

    ahead = stats.get("aheadCount")
    result["ahead_count"] = ahead

    if ahead is not None and ahead > 0:
        skip = max(ahead - 1, 0)
        query = {
            "searchCriteria.itemVersion.version": branch_name,
            "searchCriteria.itemVersion.versionType": "branch",
            "searchCriteria.compareVersion.version": compare_branch,
            "searchCriteria.compareVersion.versionType": "branch",
            "$top": 1,
            "$skip": skip,
        }
        commits_payload = ado_tool.list_commits(repository_id, query)
        commits = (commits_payload or {}).get("value") or []
        if commits:
            commit = commits[0]
            result["first_commit"] = commit
            result["author"] = (commit.get("author") or commit.get("committer") or {})
            result["resolution"] = "primeiro_commit_divergente"
            return result

    tip = stats.get("commit") or {}
    result["first_commit"] = tip if tip else None
    result["author"] = (tip.get("author") or tip.get("committer") or {}) if tip else {}
    result["resolution"] = "fallback_stats_commit"
    return result


def _classify_pull_requests(pull_requests: List[Dict[str, Any]]) -> str:
    """
    Retorna: skip_active | sem_pr | apenas_fechadas | outros_status
    """
    if not pull_requests:
        return "sem_pr"

    statuses = [str(pr.get("status") or "").lower() for pr in pull_requests]
    if any(status == "active" for status in statuses):
        return "skip_active"

    if all(status in {"completed", "abandoned"} for status in statuses):
        return "apenas_fechadas"

    return "outros_status"


def branches_sem_pr(args: List[str]) -> Dict[str, Any]:
    options = _parse_branches_sem_pr_args(args)
    team_context = _resolve_team_members(options["team"])
    repository_id = options["repository"]
    compare_branch = options["compare_branch"]

    refs = ado_tool.list_git_refs(repository_id)
    branch_names: List[str] = []
    for ref in refs:
        name = ref.get("name") or ""
        if not name.startswith("refs/heads/"):
            continue
        branch_names.append(name[len("refs/heads/") :])

    branch_names.sort()
    if options["max_branches"] is not None:
        branch_names = branch_names[: options["max_branches"]]

    categoria_a: List[Dict[str, Any]] = []
    categoria_b: List[Dict[str, Any]] = []
    ignoradas_ativas: List[Dict[str, Any]] = []
    ignoradas_fora_do_squad: int = 0

    for branch_name in branch_names:
        divergent = _first_commit_divergent_from_base(repository_id, branch_name, compare_branch)
        author = divergent.get("author") or {}

        if not _author_matches_squad(
            author if isinstance(author, dict) else None,
            team_context["squad_emails"],
            team_context["squad_display_names"],
            team_context["squad_unique_names"],
        ):
            ignoradas_fora_do_squad += 1
            continue

        pr_query = {
            "searchCriteria.sourceRefName": f"refs/heads/{branch_name}",
            "$top": 100,
        }
        pr_payload = ado_tool.list_pull_requests_git(repository_id, pr_query)
        prs = (pr_payload or {}).get("value") or []

        bucket = _classify_pull_requests(prs)
        if bucket == "skip_active":
            active_summary = []
            for pr in prs:
                if str(pr.get("status") or "").lower() != "active":
                    continue
                repo_name = pr.get("repository", {}).get("name") or repository_id
                pr_id = pr.get("pullRequestId")
                active_summary.append(
                    {
                        "id": pr_id,
                        "status": pr.get("status"),
                        "title": pr.get("title"),
                        "url": _pr_web_url(repo_name, pr_id) if pr_id is not None else None,
                    }
                )

            ignoradas_ativas.append(
                {
                    "branch": branch_name,
                    "branchUrl": _branch_browser_url(repository_id, branch_name),
                    "ownerHint": author.get("name") or author.get("email"),
                    "includeActiveFlag": options["include_active"],
                    "pullRequestsAtivas": active_summary,
                }
            )
            continue

        pr_summaries = []
        for pr in prs:
            repo_name = pr.get("repository", {}).get("name") or repository_id
            pr_id = pr.get("pullRequestId")
            pr_summaries.append(
                {
                    "id": pr_id,
                    "status": pr.get("status"),
                    "title": pr.get("title"),
                    "url": _pr_web_url(repo_name, pr_id) if pr_id is not None else None,
                }
            )

        stats_blob = divergent.get("stats") or {}
        stats_commit = stats_blob.get("commit") or {}
        first_commit_blob = divergent.get("first_commit") or {}
        ultima = (
            stats_commit.get("author", {}).get("date")
            or stats_commit.get("committer", {}).get("date")
            or first_commit_blob.get("author", {}).get("date")
            or first_commit_blob.get("committer", {}).get("date")
        )

        base_entry = {
            "branch": branch_name,
            "branchUrl": _branch_browser_url(repository_id, branch_name),
            "ownerAuthorName": author.get("name"),
            "ownerAuthorEmail": author.get("email"),
            "primeiroCommitId": first_commit_blob.get("commitId") or stats_commit.get("commitId"),
            "aheadCount": divergent.get("ahead_count"),
            "autorResolucao": divergent.get("resolution"),
            "ultimaAtualizacao": ultima,
        }

        if bucket == "sem_pr":
            categoria_a.append(base_entry)
        elif bucket == "apenas_fechadas":
            categoria_b.append({**base_entry, "prs": pr_summaries})
        else:
            categoria_b.append(
                {
                    **base_entry,
                    "prs": pr_summaries,
                    "observacao": "Statuses mistos fora de active/completed/abandoned",
                }
            )

    def _agrupar_por_owner(items: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        grupos: Dict[str, List[Dict[str, Any]]] = {}
        for item in items:
            owner_key = item.get("ownerAuthorEmail") or item.get("ownerAuthorName") or "desconhecido"
            grupos.setdefault(str(owner_key), []).append(item)
        return grupos

    return {
        "scope": {
            "team": options["team"],
            "team_resolvido": team_context["team_resolved"],
            "nota_resolucao_time": team_context["resolution_note"],
            "repository": repository_id,
            "compare_branch": compare_branch,
            "total_refs_heads": len(branch_names),
            "include_active": options["include_active"],
        },
        "membros": team_context["members"],
        "totals": {
            "branches_escaneadas": len(branch_names),
            "branches_ignoradas_fora_do_squad": ignoradas_fora_do_squad,
            "categoria_a_sem_pr": len(categoria_a),
            "categoria_b_apenas_pr_fechada": len(categoria_b),
            "ignoradas_com_pr_ativa": len(ignoradas_ativas),
        },
        "porMembro": {
            "categoria_a_sem_pr_alguma": _agrupar_por_owner(categoria_a),
            "categoria_b_apenas_pr_fechada": _agrupar_por_owner(categoria_b),
        },
        "categoriaA_semPRalguma": sorted(categoria_a, key=lambda item: (item.get("ownerAuthorEmail") or "", item["branch"])),
        "categoriaB_apenasPRfechada": sorted(categoria_b, key=lambda item: (item.get("ownerAuthorEmail") or "", item["branch"])),
        "ignoradasComPRAtiva": ignoradas_ativas,
        "bloqueioAplicado": "Somente leitura: nenhum work item, branch ou PR foi alterado.",
    }


def criar_tasks_documentacao_para_card(card_id: int) -> Dict[str, List[int]]:
    criados: Dict[str, int] = {}

    analise = ado_tool.create_work_item(
        "Task",
        {"System.Title": "1. Análise", "System.WorkItemType": "Task"},
        [_relacao_child(card_id)],
    )
    criados["analise"] = analise["id"]

    dev = ado_tool.create_work_item(
        "Task",
        {"System.Title": "2. Desenvolvimento", "System.WorkItemType": "Task"},
        [_relacao_child(card_id)],
    )
    criados["desenvolvimento"] = dev["id"]

    teste = ado_tool.create_work_item(
        "Task",
        {"System.Title": "3. Teste", "System.WorkItemType": "Task"},
        [_relacao_child(card_id)],
    )
    criados["teste"] = teste["id"]

    qa = ado_tool.create_work_item(
        "Test Case",
        {"System.Title": "4. QA (Testecas)", "System.WorkItemType": "Test Case"},
        [
            {
                "rel": "Microsoft.VSTS.Common.TestedBy-Reverse",
                "url": f"https://dev.azure.com/{ado_tool.organization}/{ado_tool.project}/_apis/wit/workItems/{card_id}",
            }
        ],
    )
    criados["qa"] = qa["id"]

    return {"ids": list(criados.values())}


def main():
    if len(sys.argv) < 2:
        print("Uso: python card_manager.py <comando> <args...>")
        print("Comandos:")
        print("  branch <bug|us> <numero_us_ou_bug> <numero_so>")
        print("  commit-prefix <bug|us> <numero_us_ou_bug> <numero_so>")
        print("  criar-tasks <card_id>")
        print("  auditar-prs --squads <Squad...> --columns <Coluna...> [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--only-active]")
        print("  branches-sem-pr [--team <nome>] [--repository <repo>] [--compare-branch master] [--max-branches N] [--include-active]")
        print("  review-card <card_id> [--repo-path <caminho_do_repo>] [--no-patch]")
        print("  encerrar-card <card_id> --so <numero_so> --repo-path <caminho_repo> --mensagem <resumo> [--target-branch master] [--criar-pr] [--dry-run] [--fato <texto>] [--causa <texto>] [--acao <texto>]")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "branch":
        tipo = sys.argv[2]
        numero = int(sys.argv[3])
        so = sys.argv[4]
        print(gerar_nome_branch(tipo, numero, so))
    elif cmd == "commit-prefix":
        tipo = sys.argv[2]
        numero = int(sys.argv[3])
        so = sys.argv[4]
        print(gerar_prefixo_commit(tipo, numero, so))
    elif cmd == "criar-tasks":
        card_id = int(sys.argv[2])
        resultado = criar_tasks_documentacao_para_card(card_id)
        print(json.dumps(resultado, indent=2, ensure_ascii=False))
    elif cmd == "auditar-prs":
        resultado = auditar_cards_com_pr_aberta(sys.argv[2:])
        print(json.dumps(resultado, indent=2, ensure_ascii=False))
    elif cmd == "branches-sem-pr":
        resultado = branches_sem_pr(sys.argv[2:])
        print(json.dumps(resultado, indent=2, ensure_ascii=False))
    elif cmd == "review-card":
        resultado = review_card(sys.argv[2:])
        print(json.dumps(resultado, indent=2, ensure_ascii=False))
    elif cmd == "encerrar-card":
        resultado = encerrar_card(sys.argv[2:])
        print(json.dumps(resultado, indent=2, ensure_ascii=False))
    else:
        print(f"Comando desconhecido: {cmd}")
        sys.exit(1)


if __name__ == "__main__":
    main()
