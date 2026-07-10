import base64
import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote, unquote, urlencode


if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")


def resolve_config_path():
    """
    Ordem de resolução:
    1) Variável de ambiente ADO_CONFIG_PATH
    2) .ado_config.json ao lado deste arquivo (tools/)
    3) .ado_config.json na raiz da skill (pasta pai de tools)
    4) Fallback user-home AzureLocal: <USERPROFILE>/.cursor/skills/AzureLocal/.ado_config.json
       (compatibilidade com setup legado quando o dev mantém o PAT fora do workspace).
    """
    env_path = os.environ.get("ADO_CONFIG_PATH")
    if env_path:
        return env_path

    here = os.path.dirname(__file__)
    local_config = os.path.join(here, ".ado_config.json")
    if os.path.exists(local_config):
        return local_config

    skill_root_config = os.path.abspath(os.path.join(here, "..", ".ado_config.json"))
    if os.path.exists(skill_root_config):
        return skill_root_config

    user_profile = os.environ.get("USERPROFILE") or os.path.expanduser("~")
    user_home_config = os.path.join(
        user_profile, ".cursor", "skills", "AzureLocal", ".ado_config.json"
    )
    if os.path.exists(user_home_config):
        return user_home_config

    return skill_root_config


config_path = resolve_config_path()
try:
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
except FileNotFoundError:
    print(f"Error: {config_path} not found.")
    print("Crie o arquivo .ado_config.json a partir de .ado_config.example.json na pasta da skill.")
    sys.exit(1)

organization = config["organization"]
project = config["project"]
pat = config["pat"]


def is_pat_placeholder(value):
    if value is None:
        return True
    normalized = str(value).strip()
    if not normalized:
        return True

    placeholders = {
        "SUBSTITUA_PELO_SEU_PAT",
        "SEU_PAT_AQUI",
        "<SEU_PAT_AQUI>",
        "YOUR_PAT_HERE",
        "<YOUR_PAT_HERE>",
    }
    return normalized.upper() in placeholders


if is_pat_placeholder(pat):
    print("Error: PAT não configurado em .ado_config.json.")
    print("Copie .ado_config.example.json para .ado_config.json e preencha apenas o campo 'pat'.")
    print("organization e project já vêm padronizados para uso interno.")
    sys.exit(1)

auth = base64.b64encode(f":{pat}".encode()).decode()
headers = {
    "Authorization": f"Basic {auth}",
    "Content-Type": "application/json-patch+json",
}


def _auth_headers(content_type=None):
    req_headers = {"Authorization": f"Basic {auth}"}
    if content_type:
        req_headers["Content-Type"] = content_type
    return req_headers


def _build_url(path, query=None):
    """
    Project-scoped API: https://dev.azure.com/{org}/{project}/_apis/...
    """
    url = f"https://dev.azure.com/{organization}/{project}{path}"
    params: Dict[str, Any] = dict(query or {})
    params["api-version"] = "7.1"
    return f"{url}?{urlencode(params, doseq=True)}"


def _build_core_url(path, query=None):
    """
    Core / account-scoped API: https://dev.azure.com/{org}/_apis/...
    (ex.: teams, projects)
    """
    url = f"https://dev.azure.com/{organization}{path}"
    params: Dict[str, Any] = dict(query or {})
    params["api-version"] = "7.1"
    return f"{url}?{urlencode(params, doseq=True)}"


def _request_json(url, *, data=None, method="GET", content_type=None):
    result, _headers = _request_json_with_headers(url, data=data, method=method, content_type=content_type)
    return result


def _request_json_with_headers(
    url, *, data=None, method="GET", content_type=None
) -> Tuple[Optional[Any], Dict[str, str]]:
    req = urllib.request.Request(
        url,
        data=data,
        headers=_auth_headers(content_type),
        method=method,
    )
    try:
        with urllib.request.urlopen(req) as response:
            raw = response.read().decode()
            body: Optional[Any] = json.loads(raw) if raw else None
            headers = {k.lower(): v for k, v in response.headers.items()}
            return body, headers
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code}")
        print(e.read().decode())
        return None, {}
    except Exception as e:
        print(f"Error: {str(e)}")
        return None, {}


def get_work_item(wi_id, expand=None):
    query = {}
    if expand:
        query["$expand"] = expand
    url = _build_url(f"/_apis/wit/workitems/{wi_id}", query)
    return _request_json(url)


def update_work_item(wi_id, patches):
    url = _build_url(f"/_apis/wit/workitems/{wi_id}")
    data = json.dumps(patches).encode("utf-8")
    return _request_json(url, data=data, method="PATCH", content_type="application/json-patch+json")


def query_work_items(wiql):
    url = _build_url("/_apis/wit/wiql")
    data = json.dumps({"query": wiql}).encode("utf-8")
    return _request_json(url, data=data, method="POST", content_type="application/json")


def get_wiki_page(wiki_id, page_id):
    url = _build_url(f"/_apis/wiki/wikis/{wiki_id}/pages/{page_id}", {"includeContent": "True"})
    return _request_json(url)


def create_work_item(wi_type, fields, relations=None):
    encoded_wi_type = quote(str(wi_type), safe="")
    url = _build_url(f"/_apis/wit/workitems/${encoded_wi_type}")
    patch = []
    for field, value in fields.items():
        patch.append({"op": "add", "path": f"/fields/{field}", "value": value})

    if relations:
        for rel in relations:
            patch.append({"op": "add", "path": "/relations/-", "value": rel})

    data = json.dumps(patch).encode("utf-8")
    return _request_json(url, data=data, method="POST", content_type="application/json-patch+json")


def create_pull_request(
    source,
    target,
    title,
    description,
    repository_id="projeto-metaposto-net.git",
    work_item_ids: Optional[List[int]] = None,
):
    url = _build_url(f"/_apis/git/repositories/{repository_id}/pullrequests")
    body: Dict[str, Any] = {
        "sourceRefName": f"refs/heads/{source}",
        "targetRefName": f"refs/heads/{target}",
        "title": title,
        "description": description,
    }
    if work_item_ids:
        wi_api = f"https://dev.azure.com/{organization}/{project}/_apis/wit/workItems"
        body["workItemRefs"] = [{"id": str(wi), "url": f"{wi_api}/{wi}"} for wi in work_item_ids]
    data = json.dumps(body).encode("utf-8")
    return _request_json(url, data=data, method="POST", content_type="application/json")


def get_pull_request(pr_id, repository_id="projeto-metaposto-net.git"):
    enc_repo = quote(str(repository_id), safe="")
    url = _build_url(f"/_apis/git/repositories/{enc_repo}/pullrequests/{pr_id}")
    return _request_json(url)


def update_pull_request(pr_id, payload, repository_id="projeto-metaposto-net.git"):
    url = _build_url(f"/_apis/git/repositories/{repository_id}/pullrequests/{pr_id}")
    data = json.dumps(payload).encode("utf-8")
    return _request_json(url, data=data, method="PATCH", content_type="application/json")


def set_pull_request_auto_complete(
    pr_id,
    auto_complete_user_id,
    delete_source_branch=True,
    repository_id="projeto-metaposto-net.git",
    merge_commit_message=None,
):
    completion_options = {
        "deleteSourceBranch": delete_source_branch,
        "mergeStrategy": "noFastForward",
    }
    if merge_commit_message:
        completion_options["mergeCommitMessage"] = merge_commit_message

    payload = {
        "autoCompleteSetBy": {"id": auto_complete_user_id},
        "completionOptions": completion_options,
    }
    return update_pull_request(pr_id, payload, repository_id=repository_id)


def list_project_teams() -> Optional[Dict[str, Any]]:
    """Lista times do projeto (Core API)."""
    enc = quote(str(project), safe="")
    url = _build_core_url(f"/_apis/projects/{enc}/teams", {"$top": 500})
    return _request_json(url)


def get_team_members(team_id_or_name: str, top: int = 500) -> Optional[Dict[str, Any]]:
    """
    Membros do time com propriedades estendidas.
    team_id_or_name: GUID ou nome do time (ex.: Squad Financeiro).
    """
    enc_project = quote(str(project), safe="")
    enc_team = quote(str(team_id_or_name), safe="")
    url = _build_core_url(
        f"/_apis/projects/{enc_project}/teams/{enc_team}/members",
        {"$top": top},
    )
    return _request_json(url)


def list_git_refs(
    repository_id: str,
    *,
    filter_prefix: str = "heads/",
    page_size: int = 1000,
) -> List[Dict[str, Any]]:
    """
    Lista refs do repositório com paginação (continuationToken).
    """
    all_refs: List[Dict[str, Any]] = []
    continuation: Optional[str] = None

    while True:
        query: Dict[str, Any] = {
            "filter": f"{filter_prefix}",
            "$top": page_size,
        }
        if continuation:
            query["continuationToken"] = continuation

        url = _build_url(f"/_apis/git/repositories/{quote(str(repository_id), safe='')}/refs", query)
        body, headers = _request_json_with_headers(url)
        if not body:
            break

        chunk = body.get("value") or []
        all_refs.extend(chunk)

        continuation = (
            headers.get("x-ms-continuationtoken")
            or body.get("continuationToken")
            or None
        )
        if not continuation or not chunk:
            break

    return all_refs


def list_commits(repository_id: str, query: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """Commits do repositório (searchCriteria.* na query)."""
    q: Dict[str, Any] = dict(query or {})
    url = _build_url(f"/_apis/git/repositories/{quote(str(repository_id), safe='')}/commits", q)
    return _request_json(url)


def list_pull_requests_git(repository_id: str, query: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """Lista PRs do repositório (searchCriteria.* na query)."""
    q: Dict[str, Any] = dict(query or {})
    url = _build_url(f"/_apis/git/repositories/{quote(str(repository_id), safe='')}/pullrequests", q)
    return _request_json(url)


def get_branch_stats(repository_id: str, branch_name: str) -> Optional[Dict[str, Any]]:
    """Estatísticas da branch vs default (ahead/behind, lastCommit)."""
    enc_repo = quote(str(repository_id), safe="")
    url = _build_url(f"/_apis/git/repositories/{enc_repo}/stats/branches", {"name": branch_name})
    return _request_json(url)


def parse_pull_request_artifact_url(url: str) -> Optional[Tuple[str, int]]:
    """
    Extrai (repository_id, pull_request_id) de URL vstfs de ArtifactLink (PR vinculada ao work item).
    Ex.: vstfs:///Git/PullRequestId/{proj}%2f{repo}%2f{prId}
    """
    if not url or "PullRequestId" not in url:
        return None
    marker = "PullRequestId/"
    idx = url.find(marker)
    if idx < 0:
        return None
    tail = url[idx + len(marker) :]
    decoded = unquote(tail).strip("/")
    parts = [p for p in decoded.split("/") if p]
    if len(parts) < 3:
        return None
    try:
        pr_id = int(parts[-1])
    except ValueError:
        return None
    repo_id = parts[-2]
    return repo_id, pr_id


def _commit_id_from_pr(pr: Dict[str, Any], key: str) -> Optional[str]:
    block = pr.get(key)
    if isinstance(block, dict):
        cid = block.get("commitId")
        if cid:
            return str(cid)
    return None


def work_item_pull_request_context(wi_id: str) -> Optional[Dict[str, Any]]:
    """
    Work item com $expand=all + detalhes das PRs vinculadas por ArtifactLink.
    Acrescenta sugestão de refs Git (base/head) e SHAs de merge para diff sem checkout.
    """
    wi = get_work_item(wi_id, expand="all")
    if not wi:
        return None


def parse_pull_request_artifact_url(url: str) -> Optional[tuple]:
    """
    Extrai (repository_id, pull_request_id) de URL vstfs de ArtifactLink (PR vinculada ao work item).
    Ex.: vstfs:///Git/PullRequestId/{proj}%2f{repo}%2f{prId}
    """
    if not url or "PullRequestId" not in url:
        return None
    marker = "PullRequestId/"
    idx = url.find(marker)
    if idx < 0:
        return None
    tail = url[idx + len(marker) :]
    decoded = unquote(tail).strip("/")
    parts = [p for p in decoded.split("/") if p]
    if len(parts) < 3:
        return None
    try:
        pr_id = int(parts[-1])
    except ValueError:
        return None
    repo_id = parts[-2]
    return repo_id, pr_id


    relations = wi.get("relations") or []
    pr_details: List[Dict[str, Any]] = []
    seen = set()
    for rel in relations:
        parsed = parse_pull_request_artifact_url(rel.get("url") or "")
        if not parsed:
            continue
        repo_id, pr_num = parsed
        key = (repo_id, pr_num)
        if key in seen:
            continue
        seen.add(key)
        pr = get_pull_request(str(pr_num), repository_id=repo_id)
        if not pr:
            continue
        src = (pr.get("sourceRefName") or "").replace("refs/heads/", "")
        tgt = (pr.get("targetRefName") or "").replace("refs/heads/", "")
        web_href = None
        links = pr.get("_links") or {}
        if isinstance(links.get("web"), dict):
            web_href = links["web"].get("href")
        pr_details.append(
            {
                "pullRequestId": pr.get("pullRequestId"),
                "status": pr.get("status"),
                "repositoryName": (pr.get("repository") or {}).get("name"),
                "repositoryId": (pr.get("repository") or {}).get("id"),
                "sourceRefName": pr.get("sourceRefName"),
                "targetRefName": pr.get("targetRefName"),
                "sourceBranch": src,
                "targetBranch": tgt,
                "title": pr.get("title"),
                "url": web_href,
                "lastMergeSourceCommit": _commit_id_from_pr(pr, "lastMergeSourceCommit"),
                "lastMergeTargetCommit": _commit_id_from_pr(pr, "lastMergeTargetCommit"),
            }
        )

    fields = wi.get("fields") or {}
    html_link = None
    if isinstance(wi.get("_links"), dict) and isinstance(wi["_links"].get("html"), dict):
        html_link = wi["_links"]["html"].get("href")

    active = [p for p in pr_details if str(p.get("status") or "").lower() == "active"]
    pick = active[0] if active else (pr_details[0] if pr_details else None)

    suggested_base = None
    suggested_head = None
    branch_validation = None
    target_remote = None
    recommended_from_pr = None
    recommended_base_commit = None
    recommended_head_commit = None
    if pick:
        src_b = (pick.get("sourceBranch") or "").strip()
        tgt_b = (pick.get("targetBranch") or "").strip()
        lower = src_b.lower()
        if lower.startswith("bugs/"):
            suggested_base = "origin/master"
            branch_validation = "OK (bugs/ → origin/master)"
        elif lower.startswith("features/"):
            suggested_base = "origin/developer"
            branch_validation = "OK (features/ → origin/developer)"
        else:
            suggested_base = "origin/master"
            branch_validation = "ATENÇÃO: prefixo da branch não bugs/ nem features/; assumido origin/master para diff."
        suggested_head = f"origin/{src_b}" if src_b else None
        target_remote = f"origin/{tgt_b}" if tgt_b else None
        recommended_from_pr = target_remote
        recommended_base_commit = pick.get("lastMergeTargetCommit")
        recommended_head_commit = pick.get("lastMergeSourceCommit")

    diff_base_rules_conflict = None
    if pick and suggested_base and recommended_from_pr and recommended_from_pr != suggested_base:
        diff_base_rules_conflict = (
            f"Convenção interna sugere base {suggested_base} pelo prefixo da branch de origem, "
            f"mas a PR está configurada para merge em {recommended_from_pr}. "
            f"Para revisar o mesmo conjunto de commits da PR, use commits da PR ou "
            f"git diff {recommended_from_pr}...{suggested_head}"
        )

    out: Dict[str, Any] = {
        "workItemId": int(wi_id) if str(wi_id).isdigit() else wi_id,
        "workItemTitle": fields.get("System.Title"),
        "workItemState": fields.get("System.State"),
        "workItemUrl": html_link,
        "pullRequests": pr_details,
        "suggestedGitFetch": "git fetch origin",
        "suggestedGitDiffBase": suggested_base,
        "suggestedGitDiffHead": suggested_head,
        "pullRequestTargetRemote": target_remote,
        "recommendedGitDiffBaseFromPullRequest": recommended_from_pr,
        "recommendedGitDiffBaseCommit": recommended_base_commit,
        "recommendedGitDiffHeadCommit": recommended_head_commit,
        "branchNamingCheck": branch_validation,
        "pullRequestTargetVsSuggestedBase": (
            f"PR target no Azure: refs/heads/{pick.get('targetBranch')}; diff sugerido (convenção) usa base {suggested_base}."
            if pick and suggested_base
            else None
        ),
        "diffBaseRulesConflict": diff_base_rules_conflict,
    }
    if not pr_details:
        out["noteNoPullRequestLinked"] = (
            "Nenhum ArtifactLink PullRequestId nas relations deste work item. "
            "Vincule a PR ao card no Azure DevOps ou informe manualmente a branch remota para o diff."
        )
    return out


    active = [p for p in pr_details if str(p.get("status") or "").lower() == "active"]
    pick = active[0] if active else (pr_details[0] if pr_details else None)

    suggested_base = None
    suggested_head = None
    branch_validation = None
    if pick:
        src_b = (pick.get("sourceBranch") or "").strip()
        tgt_b = (pick.get("targetBranch") or "").strip()
        lower = src_b.lower()
        if lower.startswith("bugs/"):
            suggested_base = "origin/master"
            branch_validation = "OK (bugs/ → origin/master)"
        elif lower.startswith("features/"):
            suggested_base = "origin/developer"
            branch_validation = "OK (features/ → origin/developer)"
        else:
            suggested_base = "origin/master"
            branch_validation = "ATENÇÃO: prefixo da branch não bugs/ nem features/; assumido origin/master para diff."
        suggested_head = f"origin/{src_b}" if src_b else None
        target_remote = f"origin/{tgt_b}" if tgt_b else None
        recommended_from_pr = target_remote
    else:
        target_remote = None
        recommended_from_pr = None

    diff_base_rules_conflict = None
    if pick and suggested_base and recommended_from_pr and recommended_from_pr != suggested_base:
        diff_base_rules_conflict = (
            f"Convenção interna sugere base {suggested_base} pelo prefixo da branch de origem, "
            f"mas a PR está configurada para merge em {recommended_from_pr}. "
            f"Para revisar o mesmo conjunto de commits da PR, use: git diff {recommended_from_pr}...{suggested_head}"
        )

    out = {
        "workItemId": int(wi_id) if str(wi_id).isdigit() else wi_id,
        "workItemTitle": fields.get("System.Title"),
        "workItemState": fields.get("System.State"),
        "workItemUrl": html_link,
        "pullRequests": pr_details,
        "suggestedGitFetch": "git fetch origin",
        "suggestedGitDiffBase": suggested_base,
        "suggestedGitDiffHead": suggested_head,
        "pullRequestTargetRemote": target_remote,
        "recommendedGitDiffBaseFromPullRequest": recommended_from_pr,
        "branchNamingCheck": branch_validation,
        "pullRequestTargetVsSuggestedBase": (
            f"PR target no Azure: refs/heads/{pick.get('targetBranch')}; diff sugerido usa base {suggested_base}."
            if pick and suggested_base
            else None
        ),
        "diffBaseRulesConflict": diff_base_rules_conflict,
    }
    if not pr_details:
        out["noteNoPullRequestLinked"] = (
            "Nenhum ArtifactLink PullRequestId nas relations deste work item. "
            "Vincule a PR ao card no Azure DevOps ou informe manualmente a branch remota para o diff."
        )
    return out


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python ado_tool.py <command> <args...>")
        print(
            "Commands: get <id> [$expand], update <id> <patch_json>, query <wiql>, "
            "wiki <wiki_id> <page_id>, create <type> <fields_json> [relations_json], "
            "pr <source> <target> <title> <description> [work_item_ids_csv], pr-get <pr_id> [repository_id], "
            "wi-pr-context <work_item_id>, "
            "pr-auto-complete <pr_id> <user_id> [delete_source_branch], "
            "teams-list, teams-members <team_id_or_name>, "
            "git-refs <repository_id_or_name>, git-commits <repository_id_or_name> <query_json>, "
            "git-prs <repository_id_or_name> <query_json>, git-branch-stats <repository_id_or_name> <branch_name>"
        )
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "query":
        wiql = sys.argv[2]
        result = query_work_items(wiql)
        if result:
            print(json.dumps(result, indent=2, ensure_ascii=False))
    elif cmd == "get":
        wi_id = sys.argv[2]
        expand = sys.argv[3] if len(sys.argv) > 3 else None
        wi = get_work_item(wi_id, expand=expand)
        if wi:
            print(json.dumps(wi, indent=2, ensure_ascii=False))
    elif cmd == "update":
        wi_id = sys.argv[2]
        arg3 = sys.argv[3]
        if arg3.startswith("@"):
            with open(arg3[1:], "r", encoding="utf-8") as f:
                patches = json.load(f)
        else:
            patches = json.loads(arg3)

        result = update_work_item(wi_id, patches)
        if result:
            print("Successfully updated.")
            print(json.dumps(result, indent=2, ensure_ascii=False))
    elif cmd == "wiki":
        wiki_id = sys.argv[2]
        page_id = sys.argv[3]
        result = get_wiki_page(wiki_id, page_id)
        if result:
            print(result.get("content", "No content found."))
    elif cmd == "create":
        wi_type = sys.argv[2]
        arg3 = sys.argv[3]
        if arg3.startswith("@"):
            with open(arg3[1:], "r", encoding="utf-8") as f:
                fields = json.load(f)
        else:
            fields = json.loads(arg3)

        relations = None
        if len(sys.argv) > 4:
            arg4 = sys.argv[4]
            if arg4.startswith("@"):
                with open(arg4[1:], "r", encoding="utf-8") as f:
                    relations = json.load(f)
            else:
                relations = json.loads(arg4)

        result = create_work_item(wi_type, fields, relations)
        if result:
            print("Successfully created.")
            print(json.dumps(result, indent=2, ensure_ascii=False))
    elif cmd == "pr":
        source = sys.argv[2]
        target = sys.argv[3]
        title = sys.argv[4]
        description = sys.argv[5]
        work_item_ids: Optional[List[int]] = None
        if len(sys.argv) > 6 and sys.argv[6].strip():
            work_item_ids = [int(x.strip()) for x in sys.argv[6].split(",") if x.strip()]
        result = create_pull_request(source, target, title, description, work_item_ids=work_item_ids)
        if result:
            print("Successfully created PR.")
            print(json.dumps(result, indent=2, ensure_ascii=False))
    elif cmd == "pr-get":
        pr_id = sys.argv[2]
        repo_id = sys.argv[3] if len(sys.argv) > 3 else "projeto-metaposto-net.git"
        result = get_pull_request(pr_id, repository_id=repo_id)
        if result:
            print(json.dumps(result, indent=2, ensure_ascii=False))
    elif cmd == "wi-pr-context":
        if len(sys.argv) < 3:
            print("Usage: wi-pr-context <work_item_id>")
            sys.exit(1)
        wi_id = sys.argv[2]
        result = work_item_pull_request_context(wi_id)
        if result:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            sys.exit(1)
    elif cmd == "pr-auto-complete":
        pr_id = int(sys.argv[2])
        user_id = sys.argv[3]
        delete_source_branch = True
        if len(sys.argv) > 4:
            delete_source_branch = sys.argv[4].strip().lower() in {"1", "true", "yes", "sim"}
        result = set_pull_request_auto_complete(
            pr_id,
            user_id,
            delete_source_branch=delete_source_branch,
        )
        if result:
            print(json.dumps(result, indent=2, ensure_ascii=False))
    elif cmd == "teams-list":
        result = list_project_teams()
        if result:
            print(json.dumps(result, indent=2, ensure_ascii=False))
    elif cmd == "teams-members":
        if len(sys.argv) < 3:
            print("Usage: teams-members <team_id_or_name>")
            sys.exit(1)
        team = sys.argv[2]
        result = get_team_members(team)
        if result:
            print(json.dumps(result, indent=2, ensure_ascii=False))
    elif cmd == "git-refs":
        if len(sys.argv) < 3:
            print("Usage: git-refs <repository_id_or_name>")
            sys.exit(1)
        repo = sys.argv[2]
        refs = list_git_refs(repo)
        print(json.dumps({"count": len(refs), "value": refs}, indent=2, ensure_ascii=False))
    elif cmd == "git-commits":
        if len(sys.argv) < 3:
            print("Usage: git-commits <repository_id_or_name> <query_json>")
            sys.exit(1)
        repo = sys.argv[2]
        query_json = sys.argv[3] if len(sys.argv) > 3 else "{}"
        q = json.loads(query_json)
        result = list_commits(repo, q)
        if result:
            print(json.dumps(result, indent=2, ensure_ascii=False))
    elif cmd == "git-prs":
        if len(sys.argv) < 3:
            print("Usage: git-prs <repository_id_or_name> <query_json>")
            sys.exit(1)
        repo = sys.argv[2]
        query_json = sys.argv[3] if len(sys.argv) > 3 else "{}"
        q = json.loads(query_json)
        result = list_pull_requests_git(repo, q)
        if result:
            print(json.dumps(result, indent=2, ensure_ascii=False))
    elif cmd == "git-branch-stats":
        if len(sys.argv) < 4:
            print("Usage: git-branch-stats <repository_id_or_name> <branch_name>")
            sys.exit(1)
        repo = sys.argv[2]
        branch = sys.argv[3]
        result = get_branch_stats(repo, branch)
        if result:
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            sys.exit(1)
    else:
        wi_id = sys.argv[1]
        wi = get_work_item(wi_id)
        if wi:
            fields = wi.get("fields", {})
            for field, value in fields.items():
                print(f"{field}: {value}")
