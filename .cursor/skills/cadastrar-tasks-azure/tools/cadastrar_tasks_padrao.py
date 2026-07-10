# -*- coding: utf-8 -*-
"""
Cria as sete tasks-padrão (CadastrarTasks) como filhas de um work item pai no Azure DevOps
e um Test Case de QA como filho da task «7. Testing» (sem Steps por enquanto).
Config: ADO_CONFIG_PATH → cadastrar-tasks-azure (tools/ e raiz) → Azure versionada no repo → fallback AzureLocal no user profile.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote, urlencode

if sys.stdout.encoding != "utf-8":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

TESTING_TASK_TITLE = "7. Testing"

def _descriptions_json_path() -> str:
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "descriptions_padrao.json")


def load_task_description_html() -> Tuple[str, str, str]:
    """
    Carrega HTML de System.Description para as tasks 3, 4 e 5 a partir de descriptions_padrao.json.
    Retorna (development_tests, technical_validation, documentation).
    """
    path = _descriptions_json_path()
    if not os.path.exists(path):
        print(f"Erro: não encontrado {path}.", file=sys.stderr)
        sys.exit(1)
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    try:
        dev_tests = data["developmentTests"]
        tech = data["technicalValidation"]
        doc = data["documentation"]
    except (TypeError, KeyError) as e:
        print(f"Erro: JSON inválido em {path} ({e}).", file=sys.stderr)
        sys.exit(1)
    for key, value in (
        ("developmentTests", dev_tests),
        ("technicalValidation", tech),
        ("documentation", doc),
    ):
        if not isinstance(value, str) or not value.strip():
            print(f"Erro: chave {key} deve ser string não vazia.", file=sys.stderr)
            sys.exit(1)
    return dev_tests, tech, doc


def build_standard_rows() -> List[Dict[str, Any]]:
    """Tabela fixa (deve coincidir com SKILL.md). duplicate_prefix na linha 5."""
    dev_tests_desc, tech_desc, doc_desc = load_task_description_html()
    return [
        {"title": "1. Requirements", "activity": "Requirements", "assign_to_caller": True},
        {"title": "2. Development", "activity": "Development"},
        {
            "title": "3. DevelopmentTests",
            "activity": "DevelopmentTest",
            "description": dev_tests_desc,
        },
        {
            "title": "4. TechnicalValidation",
            "activity": "TechnicalValidation",
            "description": tech_desc,
        },
        {
            "title": "5. Documentation - Documentação de implementações na Wiki",
            "activity": "Documentation",
            "duplicate_prefix": "5. Documentation",
            "description": doc_desc,
        },
        {"title": "6. CodeReview", "activity": "CodeReview", "assign_to_caller": True},
        {"title": TESTING_TASK_TITLE, "activity": "Testing"},
    ]


PLACEHOLDER_DESCRIPTION = "<p>Preencher descrição.</p>"

# Test Case de QA: filho da task «7. Testing» (título fixo para detecção de duplicata).
QA_TEST_CASE_TITLE = "QA — Test Case"
QA_TEST_CASE_DESCRIPTION = (
    f"<p>Test Case de QA vinculado à task <strong>{TESTING_TASK_TITLE}</strong>. "
    "Passos de teste (Steps) serão preenchidos posteriormente.</p>"
)


def resolve_config_path() -> str:
    env_path = os.environ.get("ADO_CONFIG_PATH")
    if env_path and os.path.exists(env_path):
        return env_path

    here = os.path.dirname(os.path.abspath(__file__))
    local = os.path.join(here, ".ado_config.json")
    if os.path.exists(local):
        return local

    skill_root = os.path.abspath(os.path.join(here, "..", ".ado_config.json"))
    if os.path.exists(skill_root):
        return skill_root

    # Repositório: skill Azure versionada (.cursor/skills/Azure/), alinhado ao ado_tool.py
    azure_tools = os.path.abspath(os.path.join(here, "..", "..", "Azure", "tools", ".ado_config.json"))
    if os.path.exists(azure_tools):
        return azure_tools
    azure_skill_root = os.path.abspath(os.path.join(here, "..", "..", "Azure", ".ado_config.json"))
    if os.path.exists(azure_skill_root):
        return azure_skill_root

    # Fallback legado fora do repo (Windows)
    profile = os.environ.get("USERPROFILE") or os.environ.get("HOME")
    if profile:
        user_azure = os.path.join(profile, ".cursor", "skills", "AzureLocal", ".ado_config.json")
        if os.path.exists(user_azure):
            return user_azure

    return azure_skill_root


def load_config() -> Dict[str, str]:
    path = resolve_config_path()
    if not os.path.exists(path):
        print(f"Erro: não encontrado .ado_config.json (tentado: {path}).", file=sys.stderr)
        print("Configure ADO_CONFIG_PATH ou copie .ado_config.json da skill Azure (.cursor/skills/Azure/).", file=sys.stderr)
        sys.exit(1)
    with open(path, "r", encoding="utf-8") as f:
        cfg = json.load(f)
    pat = cfg.get("pat", "")
    if not pat or str(pat).strip().upper() in {"SUBSTITUA_PELO_SEU_PAT", "SEU_PAT_AQUI", "<SEU_PAT_AQUI>"}:
        print("Erro: PAT não configurado.", file=sys.stderr)
        sys.exit(1)
    return cfg


def _build_url(organization: str, project: str, path: str, query: Optional[Dict[str, Any]] = None) -> str:
    url = f"https://dev.azure.com/{organization}/{project}{path}"
    params: Dict[str, Any] = dict(query or {})
    params["api-version"] = "7.1"
    return f"{url}?{urlencode(params, doseq=True)}"


def _request(
    organization: str,
    project: str,
    pat: str,
    path: str,
    *,
    method: str = "GET",
    data: Optional[bytes] = None,
    content_type: Optional[str] = None,
) -> Tuple[Optional[Any], int]:
    url = _build_url(organization, project, path)
    headers = {"Authorization": "Basic " + base64.b64encode(f":{pat}".encode()).decode()}
    if content_type:
        headers["Content-Type"] = content_type
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            raw = resp.read().decode()
            body = json.loads(raw) if raw else None
            return body, resp.status
    except urllib.error.HTTPError as e:
        err_body = e.read().decode(errors="replace")
        print(f"HTTP {e.code}: {err_body[:2000]}", file=sys.stderr)
        return None, e.code
    except Exception as e:
        print(f"Erro: {e}", file=sys.stderr)
        return None, 0


def get_authenticated_user_unique_name(organization: str, pat: str) -> Optional[str]:
    """Resolve o e-mail (uniqueName) do usuário autenticado pelo PAT."""
    url = f"https://dev.azure.com/{organization}/_apis/connectionData?api-version=7.1-preview"
    headers = {"Authorization": "Basic " + base64.b64encode(f":{pat}".encode()).decode()}
    req = urllib.request.Request(url, headers=headers, method="GET")
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(e.read().decode(errors="replace"), file=sys.stderr)
        return None
    except Exception as e:
        print(f"Erro ao obter usuário do PAT: {e}", file=sys.stderr)
        return None

    user = data.get("authenticatedUser") or {}
    props = user.get("properties") or {}
    account = props.get("Account") or {}
    unique_name = account.get("$value") or user.get("providerDisplayName")
    if unique_name and "@" in str(unique_name):
        return str(unique_name).strip()
    return None


def resolve_caller_assignee(organization: str, pat: str, override: Optional[str]) -> Optional[str]:
    if override and override.strip():
        return override.strip()
    return get_authenticated_user_unique_name(organization, pat)


def get_work_item(organization: str, project: str, pat: str, wi_id: int) -> Optional[Dict[str, Any]]:
    body, status = _request(
        organization,
        project,
        pat,
        f"/_apis/wit/workitems/{wi_id}",
        method="GET",
    )
    if status != 200 or not body:
        return None
    return body


def query_wiql(organization: str, project: str, pat: str, wiql: str) -> Optional[Dict[str, Any]]:
    path = "/_apis/wit/wiql"
    url = _build_url(organization, project, path)
    payload = json.dumps({"query": wiql}).encode("utf-8")
    headers = {"Authorization": "Basic " + base64.b64encode(f":{pat}".encode()).decode(), "Content-Type": "application/json"}
    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(e.read().decode(errors="replace"), file=sys.stderr)
        return None


def workitems_batch(
    organization: str, project: str, pat: str, ids: List[int], fields: List[str]
) -> List[Dict[str, Any]]:
    if not ids:
        return []
    path = "/_apis/wit/workitemsbatch"
    url = _build_url(organization, project, path)
    body_obj = {"ids": ids, "fields": fields}
    payload = json.dumps(body_obj).encode("utf-8")
    headers = {"Authorization": "Basic " + base64.b64encode(f":{pat}".encode()).decode(), "Content-Type": "application/json"}
    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            return data.get("value") or []
    except urllib.error.HTTPError as e:
        print(e.read().decode(errors="replace"), file=sys.stderr)
        return []


def parent_relation_url(parent: Dict[str, Any], organization: str, project: str, parent_id: int) -> str:
    links = parent.get("_links") or {}
    self_link = (links.get("self") or {}).get("href")
    if self_link:
        return self_link
    return f"https://dev.azure.com/{organization}/{project}/_apis/wit/workitems/{parent_id}"


def create_test_case(
    organization: str,
    project: str,
    pat: str,
    fields: Dict[str, Any],
    parent_task_url: str,
) -> Optional[Dict[str, Any]]:
    """Cria Test Case com ligação Child para a task pai (URL da task 7. Testing)."""
    encoded = quote("Test Case", safe="")
    url = _build_url(organization, project, f"/_apis/wit/workitems/${encoded}")
    patch: List[Dict[str, Any]] = []
    for k, v in fields.items():
        patch.append({"op": "add", "path": f"/fields/{k}", "value": v})
    patch.append(
        {
            "op": "add",
            "path": "/relations/-",
            "value": {"rel": "System.LinkTypes.Hierarchy-Reverse", "url": parent_task_url},
        }
    )
    payload = json.dumps(patch).encode("utf-8")
    headers = {
        "Authorization": "Basic " + base64.b64encode(f":{pat}".encode()).decode(),
        "Content-Type": "application/json-patch+json",
    }
    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(e.read().decode(errors="replace"), file=sys.stderr)
        return None


def create_task(
    organization: str,
    project: str,
    pat: str,
    fields: Dict[str, Any],
    parent_url: str,
) -> Optional[Dict[str, Any]]:
    encoded = quote("Task", safe="")
    url = _build_url(organization, project, f"/_apis/wit/workitems/${encoded}")
    patch: List[Dict[str, Any]] = []
    for k, v in fields.items():
        patch.append({"op": "add", "path": f"/fields/{k}", "value": v})
    patch.append(
        {
            "op": "add",
            "path": "/relations/-",
            "value": {"rel": "System.LinkTypes.Hierarchy-Reverse", "url": parent_url},
        }
    )
    payload = json.dumps(patch).encode("utf-8")
    headers = {
        "Authorization": "Basic " + base64.b64encode(f":{pat}".encode()).decode(),
        "Content-Type": "application/json-patch+json",
    }
    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(e.read().decode(errors="replace"), file=sys.stderr)
        return None


def find_duplicate_id(existing: Dict[str, int], row: Dict[str, Any]) -> Optional[int]:
    title = row["title"]
    if title in existing:
        return existing[title]
    prefix = row.get("duplicate_prefix")
    if prefix:
        for ex_title, eid in existing.items():
            if ex_title.strip().startswith(prefix):
                return eid
    return None


def existing_qa_test_case_under_task(
    organization: str, project: str, pat: str, testing_task_id: int
) -> Optional[int]:
    """Retorna o ID do Test Case filho com título QA_TEST_CASE_TITLE, se existir."""
    safe_title = QA_TEST_CASE_TITLE.replace("'", "''")
    wiql = (
        f"SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '{project}' "
        f"AND [System.Parent] = {testing_task_id} AND [System.WorkItemType] = 'Test Case' "
        f"AND [System.Title] = '{safe_title}'"
    )
    result = query_wiql(organization, project, pat, wiql)
    if not result or not result.get("workItems"):
        return None
    return int(result["workItems"][0]["id"])


def existing_titles_by_parent(
    organization: str, project: str, pat: str, parent_id: int
) -> Dict[str, int]:
    wiql = (
        f"SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = '{project}' "
        f"AND [System.Parent] = {parent_id}"
    )
    result = query_wiql(organization, project, pat, wiql)
    if not result or not result.get("workItems"):
        return {}
    ids = [int(w["id"]) for w in result["workItems"]]
    rows = workitems_batch(organization, project, pat, ids, ["System.Title"])
    out: Dict[str, int] = {}
    for row in rows:
        tid = row.get("id")
        title = (row.get("fields") or {}).get("System.Title")
        if title and tid:
            out[str(title).strip()] = int(tid)
    return out


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Cadastra as 7 tasks-padrão como filhas do pai e um Test Case de QA "
            f"filho da task {TESTING_TASK_TITLE}."
        )
    )
    parser.add_argument("parent_id", type=int, help="ID do card pai (Bug, User Story ou Feature)")
    parser.add_argument("--dry-run", action="store_true", help="Não cria itens; só valida e lista ações")
    parser.add_argument(
        "--assignee",
        metavar="EMAIL",
        help="E-mail do responsável para tasks 1 e 6 (padrão: usuário autenticado pelo PAT)",
    )
    args = parser.parse_args()

    cfg = load_config()
    organization = cfg["organization"]
    project = cfg["project"]
    pat = cfg["pat"]

    parent = get_work_item(organization, project, pat, args.parent_id)
    if not parent:
        print("Erro: não foi possível obter o work item pai.", file=sys.stderr)
        sys.exit(1)

    fields_parent = parent.get("fields") or {}
    area_path = fields_parent.get("System.AreaPath")
    iteration_path = fields_parent.get("System.IterationPath")
    if not area_path:
        print("Erro: pai sem System.AreaPath.", file=sys.stderr)
        sys.exit(1)

    parent_url = parent_relation_url(parent, organization, project, args.parent_id)
    existing = existing_titles_by_parent(organization, project, pat, args.parent_id)
    standard_rows = build_standard_rows()
    caller_assignee = resolve_caller_assignee(organization, pat, args.assignee)
    if caller_assignee:
        print(f"Responsável (tasks 1 e 6): {caller_assignee}")
    else:
        print(
            "Aviso: não foi possível resolver o usuário do PAT; tasks 1 e 6 serão criadas sem responsável.",
            file=sys.stderr,
        )

    created: List[int] = []
    skipped: List[Tuple[str, int]] = []
    testing_task_id: Optional[int] = existing.get(TESTING_TASK_TITLE)

    for row in standard_rows:
        dup_id = find_duplicate_id(existing, row)
        if dup_id is not None:
            skipped.append((row["title"], dup_id))
            if row["title"] == TESTING_TASK_TITLE:
                testing_task_id = dup_id
            continue
        title = row["title"]
        activity = row["activity"]
        desc = row.get("description") or PLACEHOLDER_DESCRIPTION
        task_fields: Dict[str, Any] = {
            "System.Title": title,
            "Microsoft.VSTS.Common.Activity": activity,
            "System.AreaPath": area_path,
            "System.Description": desc,
        }
        if iteration_path:
            task_fields["System.IterationPath"] = iteration_path
        if row.get("assign_to_caller") and caller_assignee:
            task_fields["System.AssignedTo"] = caller_assignee

        if args.dry_run:
            assign_info = caller_assignee if row.get("assign_to_caller") and caller_assignee else "(sem responsável)"
            print(f"[dry-run] criaria: {title} | Activity={activity} | AssignedTo={assign_info}")
            continue

        result = create_task(organization, project, pat, task_fields, parent_url)
        if not result:
            print(f"Erro ao criar: {title}", file=sys.stderr)
            sys.exit(3)
        new_id = result.get("id")
        if new_id:
            nid = int(new_id)
            created.append(nid)
            print(f"Criado #{new_id} — {title}")
            if title == TESTING_TASK_TITLE:
                testing_task_id = nid

    for title, eid in skipped:
        print(f"Pulado (já existe): {title} → #{eid}")

    if args.dry_run:
        print("Dry-run concluído. Nenhum item foi criado.")
        if testing_task_id is not None:
            qa_dup = existing_qa_test_case_under_task(organization, project, pat, testing_task_id)
            if qa_dup is None:
                print(
                    f"[dry-run] criaria Test Case «{QA_TEST_CASE_TITLE}» como filho da task "
                    f"#{testing_task_id} ({TESTING_TASK_TITLE}), sem Steps, sem responsável (QA a definir)."
                )
            else:
                print(
                    f"[dry-run] Test Case «{QA_TEST_CASE_TITLE}» já existe → #{qa_dup} "
                    f"(filho de #{testing_task_id})."
                )
        else:
            print(
                f"[dry-run] Test Case «{QA_TEST_CASE_TITLE}» seria criado como filho de "
                f"«{TESTING_TASK_TITLE}» após esta task existir (sem Steps, sem responsável — QA a definir)."
            )
        print(
            "\nSugestão: remova --dry-run após confirmar que os títulos exatos da tabela ainda não existem "
            "como filhos do pai."
        )
        return

    qa_created_id: Optional[int] = None
    qa_skipped_existing = False
    if testing_task_id is None:
        print(
            f"Aviso: task «{TESTING_TASK_TITLE}» não encontrada como filha do pai; Test Case de QA não foi criado.",
            file=sys.stderr,
        )
    else:
        existing_qa = existing_qa_test_case_under_task(organization, project, pat, testing_task_id)
        if existing_qa is not None:
            print(f"Pulado (já existe): {QA_TEST_CASE_TITLE} → #{existing_qa} (filho de #{testing_task_id})")
            qa_skipped_existing = True
        else:
            testing_wi = get_work_item(organization, project, pat, testing_task_id)
            if not testing_wi:
                print(f"Erro: não foi possível obter a task {TESTING_TASK_TITLE} para vincular o Test Case.", file=sys.stderr)
                sys.exit(4)
            task_url = parent_relation_url(testing_wi, organization, project, testing_task_id)
            tf = testing_wi.get("fields") or {}
            tc_fields: Dict[str, Any] = {
                "System.Title": QA_TEST_CASE_TITLE,
                "System.AreaPath": tf.get("System.AreaPath") or area_path,
                "System.Description": QA_TEST_CASE_DESCRIPTION,
            }
            it = tf.get("System.IterationPath") or iteration_path
            if it:
                tc_fields["System.IterationPath"] = it
            res = create_test_case(organization, project, pat, tc_fields, task_url)
            if not res:
                print(f"Erro ao criar Test Case «{QA_TEST_CASE_TITLE}».", file=sys.stderr)
                sys.exit(4)
            qid = res.get("id")
            if qid:
                qa_created_id = int(qid)
                print(
                    f"Criado #{qa_created_id} — {QA_TEST_CASE_TITLE} "
                    f"(filho de #{testing_task_id} – {TESTING_TASK_TITLE}, sem Steps, sem responsável)"
                )

    base = f"https://dev.azure.com/{organization}/{project}/_workitems/edit"
    for cid in created:
        print(f"Link: {base}/{cid}")
    if qa_created_id:
        print(f"Link: {base}/{qa_created_id}")

    # Uma sugestão curta de evolução (requisito da skill)
    if skipped and not created and qa_skipped_existing:
        print(
            "\nSugestão: backlog completo (7 tasks + Test Case QA); preencher os Steps do Test Case "
            "quando o plano de testes estiver definido."
        )
    elif skipped and not created and qa_created_id is None:
        print(
            "\nSugestão: todas as tasks da tabela já existiam; considere WIQL com [System.Title] "
            "CONTAINS para detectar títulos equivalentes fora do texto exato."
        )
    elif created:
        print(
            "\nSugestão: após preencher descrições, alinhar Original Estimate / Remaining no board "
            "se o time exigir estimativa nas tasks."
        )
    elif qa_created_id:
        print(
            "\nSugestão: quando o roteiro de QA estiver fechado, preencher os Steps do Test Case "
            "e vincular ao card pai via «Tested By», se o processo do time exigir."
        )


if __name__ == "__main__":
    main()
