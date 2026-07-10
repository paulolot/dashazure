import argparse
import base64
import datetime as dt
import json
import os
import re
import sys
import urllib.error
import urllib.request
from html import escape, unescape
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlencode


if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")


def resolve_config_path() -> str:
    env_path = os.environ.get("ADO_CONFIG_PATH")
    if env_path:
        return env_path

    here = os.path.dirname(__file__)
    checks = [
        os.path.join(here, ".ado_config.json"),
        os.path.abspath(os.path.join(here, "..", ".ado_config.json")),
        os.path.abspath(os.path.join(here, "..", "..", "Azure", "tools", ".ado_config.json")),
        os.path.abspath(os.path.join(here, "..", "..", "Azure", ".ado_config.json")),
    ]
    for path in checks:
        if os.path.exists(path):
            return path

    user_profile = os.environ.get("USERPROFILE") or os.path.expanduser("~")
    legacy = os.path.join(user_profile, ".cursor", "skills", "AzureLocal", ".ado_config.json")
    if os.path.exists(legacy):
        return legacy

    return checks[1]


def load_config() -> Dict[str, str]:
    config_path = resolve_config_path()
    try:
        with open(config_path, "r", encoding="utf-8") as fh:
            cfg = json.load(fh)
    except FileNotFoundError:
        print(f"Erro: arquivo de configuracao nao encontrado em {config_path}")
        print("Crie o .ado_config.json com organization, project e pat.")
        sys.exit(1)

    for key in ("organization", "project", "pat"):
        if not str(cfg.get(key, "")).strip():
            print(f"Erro: campo obrigatorio ausente em configuracao: {key}")
            sys.exit(1)
    return cfg


class AzureClient:
    def __init__(self, organization: str, project: str, pat: str):
        self.organization = organization
        self.project = project
        auth = base64.b64encode(f":{pat}".encode()).decode()
        self._auth_headers = {"Authorization": f"Basic {auth}"}

    def _build_url(self, path: str, query: Optional[Dict[str, Any]] = None, api_version: str = "7.1") -> str:
        base = f"https://dev.azure.com/{self.organization}/{self.project}{path}"
        params: Dict[str, Any] = dict(query or {})
        params["api-version"] = api_version
        return f"{base}?{urlencode(params, doseq=True)}"

    def _request_json(
        self,
        method: str,
        path: str,
        *,
        query: Optional[Dict[str, Any]] = None,
        body: Optional[Dict[str, Any]] = None,
        content_type: Optional[str] = None,
        api_version: str = "7.1",
        absolute: bool = False,
    ) -> Optional[Dict[str, Any]]:
        data = None
        if body is not None:
            data = json.dumps(body).encode("utf-8")
        if absolute or path.startswith("http"):
            params: Dict[str, Any] = dict(query or {})
            params["api-version"] = api_version
            url = path if "api-version=" in path else f"{path}?{urlencode(params, doseq=True)}"
        else:
            url = self._build_url(path, query=query, api_version=api_version)
        headers = dict(self._auth_headers)
        if content_type:
            headers["Content-Type"] = content_type
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req) as resp:
                raw = resp.read().decode("utf-8")
                return json.loads(raw) if raw else {}
        except urllib.error.HTTPError as exc:
            payload = exc.read().decode("utf-8", errors="ignore")
            print(f"HTTP {exc.code} em {path}")
            if payload:
                print(payload)
            return None
        except Exception as exc:
            print(f"Erro em requisicao {path}: {exc}")
            return None

    def get_work_item(self, work_item_id: int, expand: Optional[str] = None) -> Optional[Dict[str, Any]]:
        q: Dict[str, Any] = {}
        if expand:
            q["$expand"] = expand
        return self._request_json("GET", f"/_apis/wit/workitems/{work_item_id}", query=q)

    def get_work_items_batch(self, ids: List[int]) -> Optional[List[Dict[str, Any]]]:
        if not ids:
            return []
        body = {"ids": ids}
        result = self._request_json(
            "POST",
            "/_apis/wit/workitemsbatch",
            body=body,
            content_type="application/json",
        )
        if result is None:
            return None
        return result.get("value", [])

    def get_comments(self, work_item_id: int) -> Optional[List[Dict[str, Any]]]:
        result = self._request_json(
            "GET",
            f"/_apis/wit/workItems/{work_item_id}/comments",
            query={"$expand": "mentions"},
            api_version="7.1-preview.4",
        )
        if result is None:
            return None
        return result.get("comments", [])

    def get_identity_display_name(self, identity_id: str) -> Optional[str]:
        base = f"https://vssps.dev.azure.com/{self.organization}/_apis/identities"
        result = self._request_json(
            "GET",
            base,
            query={"identityIds": identity_id},
            api_version="6.0",
            absolute=True,
        )
        if not result:
            return None
        identities = result.get("value") or []
        if not identities:
            return None
        identity = identities[0]
        return (
            identity.get("customDisplayName")
            or identity.get("providerDisplayName")
            or (identity.get("properties") or {}).get("Account", {}).get("$value")
        )

    def add_comment(
        self,
        work_item_id: int,
        text: str,
        *,
        comment_format: str = "html",
        mentions: Optional[List[Dict[str, Any]]] = None,
    ) -> Optional[Dict[str, Any]]:
        body: Dict[str, Any] = {"text": text}
        if mentions:
            body["mentions"] = mentions
        return self._request_json(
            "POST",
            f"/_apis/wit/workItems/{work_item_id}/comments",
            query={"format": comment_format},
            body=body,
            content_type="application/json",
            api_version="7.1-preview.4",
        )


def _strip_html(text: str) -> str:
    no_tags = re.sub(r"<[^>]+>", " ", text or "")
    collapsed = re.sub(r"\s+", " ", no_tags)
    return unescape(collapsed).strip()


_MENTION_ANCHOR = re.compile(
    r'<a\s+[^>]*data-vss-mention="([^"]+)"[^>]*>(.*?)</a>',
    re.IGNORECASE | re.DOTALL,
)
_MENTION_MARKDOWN = re.compile(
    r"@<([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})>"
)
_IMG_TAG = re.compile(r'<img\s+[^>]*src="([^"]+)"[^>]*/?>', re.IGNORECASE)


def _escape_html(text: str) -> str:
    return escape(text, quote=False)


def _mention_user_id(mention_token: str) -> str:
    token = (mention_token or "").strip()
    if "," in token:
        return token.split(",", 1)[1].strip()
    return token


def _mention_display_name(inner_html: str) -> str:
    inner = unescape(re.sub(r"<[^>]+>", "", inner_html or "")).strip()
    return inner.lstrip("@").strip() or inner


def _extract_mentions_from_html(html: str) -> Dict[str, Dict[str, str]]:
    found: Dict[str, Dict[str, str]] = {}
    for match in _MENTION_ANCHOR.finditer(html or ""):
        user_id = _mention_user_id(match.group(1))
        name = _mention_display_name(match.group(2))
        if not user_id:
            continue
        found[user_id] = {"id": user_id, "name": name}
    for match in _MENTION_MARKDOWN.finditer(html or ""):
        user_id = match.group(1)
        found[user_id] = {"id": user_id, "name": user_id}
    return found


def _merge_comment_mentions(entry: Dict[str, Any], html: str) -> Dict[str, Dict[str, str]]:
    merged = _extract_mentions_from_html(html)
    for mention in entry.get("mentions") or []:
        user_id = str(mention.get("targetId") or mention.get("artifactId") or "").strip()
        if not user_id:
            continue
        name = str(mention.get("displayName") or mention.get("name") or user_id).strip()
        existing = merged.get(user_id, {})
        merged[user_id] = {
            "id": user_id,
            "name": existing.get("name") or name,
            "url": mention.get("url") or existing.get("url", ""),
        }
    return merged


def _mention_anchor_html(user_id: str, display_name: str) -> str:
    label = display_name if display_name.startswith("@") else f"@{display_name}"
    return (
        f'<a href="#" data-vss-mention="version:2.0,{_escape_html(user_id)}">'
        f"{_escape_html(label)}</a>"
    )


def _replace_mentions_with_plain(html: str, mentions: Dict[str, Dict[str, str]]) -> str:
    def repl_anchor(match: re.Match[str]) -> str:
        user_id = _mention_user_id(match.group(1))
        meta = mentions.get(user_id, {})
        name = meta.get("name") or _mention_display_name(match.group(2))
        return f"@{name.lstrip('@')}"

    def repl_markdown(match: re.Match[str]) -> str:
        user_id = match.group(1)
        meta = mentions.get(user_id, {})
        name = meta.get("name") or user_id
        return f"@{name.lstrip('@')}"

    text = _MENTION_ANCHOR.sub(repl_anchor, html or "")
    return _MENTION_MARKDOWN.sub(repl_markdown, text)


def _replace_mentions_with_anchors(html: str, mentions: Dict[str, Dict[str, str]]) -> str:
    def repl_anchor(match: re.Match[str]) -> str:
        user_id = _mention_user_id(match.group(1))
        meta = mentions.get(user_id, {})
        name = meta.get("name") or _mention_display_name(match.group(2))
        return _mention_anchor_html(user_id, name)

    def repl_markdown(match: re.Match[str]) -> str:
        user_id = match.group(1)
        meta = mentions.get(user_id, {})
        name = meta.get("name") or user_id
        return _mention_anchor_html(user_id, name)

    text = _MENTION_ANCHOR.sub(repl_anchor, html or "")
    return _MENTION_MARKDOWN.sub(repl_markdown, text)


def _normalize_comment_text(text: str) -> str:
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")
    normalized = re.sub(r"<br\s*/?>", "\n", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"</p>\s*<p[^>]*>", "\n\n", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"</div>\s*<div[^>]*>", "\n", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"<[^>]+>", "", normalized)
    normalized = unescape(normalized)
    lines = [line.rstrip() for line in normalized.split("\n")]
    cleaned = "\n".join(lines).strip()
    return cleaned


def _html_to_plain_with_mentions(html: str, mentions: Dict[str, Dict[str, str]]) -> str:
    with_mentions = _replace_mentions_with_plain(html, mentions)
    return _normalize_comment_text(with_mentions)


def _html_to_published_html(html: str, mentions: Dict[str, Dict[str, str]]) -> str:
    content = _remove_tags(html or "")
    content = _replace_mentions_with_anchors(content, mentions)
    content = content.replace("\r\n", "\n").replace("\r", "\n")
    content = re.sub(r"<br\s*/?>", "<br>", content, flags=re.IGNORECASE)
    content = re.sub(r"</p>\s*<p[^>]*>", "<br><br>", content, flags=re.IGNORECASE)
    content = re.sub(r"</div>\s*<div[^>]*>", "<br>", content, flags=re.IGNORECASE)

    def img_repl(match: re.Match[str]) -> str:
        url = match.group(1)
        return (
            f'<p><img src="{_escape_html(url)}" alt="image" style="max-width:100%;" /></p>'
        )

    content = _IMG_TAG.sub(img_repl, content)
    content = re.sub(r"!\[([^\]]*)\]\(([^)]+)\)", r'<p><img src="\2" alt="\1" style="max-width:100%;" /></p>', content)
    content = re.sub(r"<(?!/?(?:a|br|img|p|div|hr|strong|em)\b)[^>]+>", "", content, flags=re.IGNORECASE)
    return content.strip()


def _resolve_mention_names(
    mentions: Dict[str, Dict[str, str]], client: Optional["AzureClient"] = None
) -> Dict[str, Dict[str, str]]:
    if not client:
        return mentions
    resolved: Dict[str, Dict[str, str]] = {}
    for user_id, meta in mentions.items():
        name = meta.get("name") or user_id
        if name == user_id:
            display = client.get_identity_display_name(user_id)
            if display:
                name = display
        resolved[user_id] = {"id": user_id, "name": name, "url": meta.get("url", "")}
    return resolved


def _merge_mentions_dict(*dicts: Dict[str, Dict[str, str]]) -> Dict[str, Dict[str, str]]:
    merged: Dict[str, Dict[str, str]] = {}
    for data in dicts:
        for user_id, meta in data.items():
            if user_id not in merged:
                merged[user_id] = dict(meta)
                continue
            merged[user_id]["name"] = merged[user_id].get("name") or meta.get("name", "")
            merged[user_id]["url"] = merged[user_id].get("url") or meta.get("url", "")
    return merged


def _mentions_for_post(mentions: Dict[str, Dict[str, str]], organization: str) -> List[Dict[str, Any]]:
    payload: List[Dict[str, Any]] = []
    for user_id, meta in mentions.items():
        url = meta.get("url") or f"https://vssps.dev.azure.com/{organization}/_apis/Identities/{user_id}"
        payload.append(
            {
                "artifactId": user_id,
                "artifactType": "Person",
                "targetId": user_id,
                "url": url,
            }
        )
    return payload


def _extract_evidence_number(text: str) -> Optional[int]:
    match = re.search(r"\[EVIDENCIA\]\s*-\s*(\d+)", text, flags=re.IGNORECASE)
    if not match:
        return None
    return int(match.group(1))


def _has_obs_tag(text: str) -> bool:
    return re.search(r"\[OBS\]", text, flags=re.IGNORECASE) is not None


def _remove_tags(text: str) -> str:
    without_evidence = re.sub(r"\[EVIDENCIA\]\s*-\s*\d+", "", text, flags=re.IGNORECASE)
    without_obs = re.sub(r"\[OBS\]", "", without_evidence, flags=re.IGNORECASE)
    return without_obs


def _split_text_and_images(text: str) -> List[Tuple[str, str]]:
    parts: List[Tuple[str, str]] = []
    pattern = re.compile(r"!\[[^\]]*\]\([^)]+\)")
    position = 0
    for match in pattern.finditer(text):
        start, end = match.span()
        if start > position:
            chunk = text[position:start]
            if chunk.strip():
                parts.append(("text", chunk))
        parts.append(("image", match.group(0)))
        position = end
    if position < len(text):
        chunk = text[position:]
        if chunk.strip():
            parts.append(("text", chunk))
    return parts


def _indent_block(text: str, prefix: str = "   ") -> str:
    lines = text.split("\n")
    return "\n".join(prefix + line if line else "" for line in lines)


def _normalize_text_block(text: str) -> str:
    lines = [line.rstrip() for line in text.split("\n")]
    normalized_lines: List[str] = []
    blank_count = 0
    for line in lines:
        if not line.strip():
            blank_count += 1
            if blank_count <= 1:
                normalized_lines.append("")
            continue
        blank_count = 0
        normalized_lines.append(line)
    return "\n".join(normalized_lines).strip()


def _format_evidence_content(text: str) -> str:
    chunks = _split_text_and_images(text)
    rendered_lines: List[str] = []
    for kind, value in chunks:
        if kind == "image":
            if rendered_lines and rendered_lines[-1] != "":
                rendered_lines.append("")
            rendered_lines.append(value.strip())
            rendered_lines.append("")
            continue
        normalized = _normalize_text_block(value)
        if not normalized:
            continue
        for line in normalized.split("\n"):
            rendered_lines.append(line)

    while rendered_lines and rendered_lines[-1] == "":
        rendered_lines.pop()
    return "\n".join(rendered_lines)


def _format_obs_content(text: str) -> str:
    return _normalize_text_block(text)


_IMAGE_MD = re.compile(r"!\[([^\]]*)\]\(([^)]+)\)")


def _markdown_image_to_html(token: str) -> str:
    match = _IMAGE_MD.match(token.strip())
    if not match:
        return ""
    alt, url = match.group(1), match.group(2)
    return (
        f'<p><img src="{_escape_html(url)}" alt="{_escape_html(alt)}" '
        f'style="max-width:100%;" /></p>'
    )


def _wrap_html_step(html_body: str, indent_px: int = 24) -> str:
    if not html_body.strip():
        return ""
    return f'<div style="margin-left:{indent_px}px;margin-bottom:16px;">{html_body}</div>'


def _content_parts_to_html(text: str, indent_px: int = 24) -> str:
    chunks = _split_text_and_images(text)
    blocks: List[str] = []
    for kind, value in chunks:
        if kind == "image":
            img_html = _markdown_image_to_html(value)
            if img_html:
                blocks.append(img_html)
            continue
        normalized = _normalize_text_block(value)
        if not normalized:
            continue
        lines = [_escape_html(line) for line in normalized.split("\n")]
        blocks.append("<br>".join(lines))
    if not blocks:
        return ""
    inner = "".join(f'<div style="margin-bottom:8px;">{block}</div>' for block in blocks)
    return f'<div style="margin-left:{indent_px}px;">{inner}</div>'


def _render_comment_html(summary_data: Dict[str, Any]) -> str:
    parts: List[str] = []
    parts.append("<p><strong>[MOVIDESK]</strong></p>")
    parts.append("<p><strong>🧪 Evidência de Teste</strong></p>")
    parts.append(
        "<p><strong>🔹 Executor</strong><br>"
        f"Responsável: {_escape_html(summary_data['executor'])}<br>"
        f"Data: {_escape_html(summary_data['data_execucao'])}</p>"
    )
    parts.append("<hr>")
    parts.append(
        "<p><strong>🔹 Observação sobre branch do teste:</strong><br>"
        f"{_escape_html(summary_data['observacao_branch'])}</p>"
    )
    parts.append("<hr>")
    parts.append("<p><strong>🔹 Passos Executados</strong></p>")

    for step in summary_data.get("evidence_steps", []):
        number = step["number"]
        body_html = step.get("body_html") or _content_parts_to_html(step.get("body", ""), indent_px=24)
        parts.append(f"<p><strong>{number}. Cenario validado:</strong></p>")
        parts.append(_wrap_html_step(body_html, indent_px=24))

    parts.append("<hr>")
    parts.append(
        f"<p><strong>🔹 Resultado do Teste</strong><br>"
        f"{_escape_html(summary_data['resultado_teste'])}</p>"
    )

    observations = summary_data.get("observations", [])
    if observations:
        parts.append("<hr>")
        parts.append("<p><strong>🔹 Observacoes</strong></p>")
        for obs in observations:
            parts.append("<p><strong>- Observacao:</strong></p>")
            obs_html = obs.get("body_html") or _content_parts_to_html(obs.get("body", ""), indent_px=16)
            parts.append(_wrap_html_step(obs_html, indent_px=16))

    return "\n".join(parts)


def _contains_testing_title(title: str) -> bool:
    return "testing" in (title or "").lower()


def _parse_date(iso_value: str) -> str:
    if not iso_value:
        return dt.datetime.now().strftime("%d/%m/%Y")
    try:
        parsed = dt.datetime.fromisoformat(iso_value.replace("Z", "+00:00"))
        return parsed.strftime("%d/%m/%Y")
    except ValueError:
        return dt.datetime.now().strftime("%d/%m/%Y")


def extract_testing_candidates(parent: Dict[str, Any], children: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    children_by_id = {item["id"]: item for item in children}
    candidates: List[Dict[str, Any]] = []
    for rel in parent.get("relations", []) or []:
        if rel.get("rel") != "System.LinkTypes.Hierarchy-Forward":
            continue
        url = rel.get("url", "")
        if not url.endswith(tuple(str(k) for k in children_by_id.keys())):
            pass
        try:
            child_id = int(url.rstrip("/").split("/")[-1])
        except ValueError:
            continue
        child = children_by_id.get(child_id)
        if not child:
            continue
        fields = child.get("fields", {})
        if fields.get("System.WorkItemType") != "Task":
            continue
        title = str(fields.get("System.Title", ""))
        activity = str(fields.get("Microsoft.VSTS.Common.Activity", ""))
        if activity.lower() == "testing" or _contains_testing_title(title):
            candidates.append(child)
    return candidates


def select_testing_task(candidates: List[Dict[str, Any]], comments_map: Dict[int, List[Dict[str, Any]]]) -> Optional[Dict[str, Any]]:
    if not candidates:
        return None

    with_activity = [
        c for c in candidates if str(c.get("fields", {}).get("Microsoft.VSTS.Common.Activity", "")).lower() == "testing"
    ]
    pool = with_activity if with_activity else candidates

    def score(item: Dict[str, Any]) -> Tuple[int, int, int]:
        wi_id = int(item["id"])
        comments_count = len(comments_map.get(wi_id, []))
        title_contains = 1 if _contains_testing_title(str(item.get("fields", {}).get("System.Title", ""))) else 0
        return (comments_count, title_contains, wi_id)

    return max(pool, key=score)


def summarize_comments(comments: List[Dict[str, Any]], client: Optional[AzureClient] = None) -> Dict[str, Any]:
    if not comments:
        return {}

    evidence_items: List[Dict[str, Any]] = []
    obs_items: List[Dict[str, Any]] = []
    all_mentions: Dict[str, Dict[str, str]] = {}
    for entry in comments:
        raw_text = str(entry.get("text", ""))
        evidence_number = _extract_evidence_number(raw_text)
        entry_mentions = _merge_comment_mentions(entry, raw_text)
        all_mentions = _merge_mentions_dict(all_mentions, entry_mentions)
        scrubbed = _remove_tags(raw_text)
        if not scrubbed.strip():
            continue
        if evidence_number is not None:
            evidence_items.append(
                {
                    "number": evidence_number,
                    "scrubbed": scrubbed,
                    "createdDate": str(entry.get("createdDate", "")),
                }
            )
            continue
        if _has_obs_tag(raw_text):
            obs_items.append(
                {
                    "scrubbed": scrubbed,
                    "createdDate": str(entry.get("createdDate", "")),
                }
            )

    if not evidence_items:
        return {}

    all_mentions = _resolve_mention_names(all_mentions, client)

    for item in evidence_items:
        item["text"] = _html_to_plain_with_mentions(item["scrubbed"], all_mentions)
        item["body_html"] = _html_to_published_html(item["scrubbed"], all_mentions)
    for item in obs_items:
        item["text"] = _html_to_plain_with_mentions(item["scrubbed"], all_mentions)
        item["body_html"] = _html_to_published_html(item["scrubbed"], all_mentions)

    first = comments[0]
    author = (first.get("createdBy") or {}).get("displayName") or "Nao identificado"
    date = _parse_date(str(first.get("createdDate", "")))

    evidence_items.sort(key=lambda item: (item["number"], item["createdDate"]))
    obs_items.sort(key=lambda item: item["createdDate"])

    deduped_evidence: List[Dict[str, Any]] = []
    seen = set()
    for item in evidence_items:
        key = f"{item['number']}::{item.get('text', '').lower()}"
        if key in seen:
            continue
        seen.add(key)
        deduped_evidence.append(item)

    evidence_steps: List[Dict[str, Any]] = []
    steps_lines: List[str] = []
    for item in deduped_evidence:
        step_desc = _format_evidence_content(item["text"])
        evidence_steps.append(
            {
                "number": item["number"],
                "body": step_desc,
                "body_html": item.get("body_html", ""),
            }
        )
        indented_step = _indent_block(step_desc, prefix="   ")
        steps_lines.append(f"{item['number']}. Cenario validado:\n{indented_step}")

    observations: List[Dict[str, str]] = []
    obs_lines: List[str] = []
    for obs in obs_items:
        obs_text = _format_obs_content(obs["text"])
        observations.append({"body": obs_text, "body_html": obs.get("body_html", "")})
        indented_obs = _indent_block(obs_text, prefix="  ")
        obs_lines.append(f"- Observacao:\n{indented_obs}")

    observacao_bloco = ""
    if obs_lines:
        observacao_bloco = (
            "\n---\n\n"
            "🔹 Observacoes\n"
            + "\n".join(obs_lines)
        )

    return {
        "executor": author,
        "data_execucao": date,
        "observacao_branch": "Testado em branch master com merge da correcao;",
        "passos_executados": "\n\n".join(steps_lines),
        "resultado_teste": "✅✅ SUCESSO ✅✅",
        "observacao_bloco": observacao_bloco,
        "evidence_steps": evidence_steps,
        "observations": observations,
        "all_mentions": all_mentions,
    }


def load_template(template_path: str) -> str:
    with open(template_path, "r", encoding="utf-8") as fh:
        return fh.read()


def render_template(raw_template: str, data: Dict[str, Any]) -> str:
    output = raw_template
    for key, value in data.items():
        output = output.replace(f"{{{{{key}}}}}", str(value))
    return output


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Resume discussion da task de Testing e comenta na US/Bug pai."
    )
    parser.add_argument("work_item_id", type=int, help="ID da US/Bug pai")
    parser.add_argument("--dry-run", action="store_true", help="Somente gera preview sem comentar")
    parser.add_argument("--auto-post", action="store_true", help="Publica comentario automaticamente")
    parser.add_argument(
        "--template",
        default=os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "templates", "movidesk_template.md")),
        help="Caminho para template markdown",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.dry_run and not args.auto_post:
        print("Informe --dry-run para preview ou --auto-post para publicar.")
        return 1

    cfg = load_config()
    client = AzureClient(cfg["organization"], cfg["project"], cfg["pat"])

    parent = client.get_work_item(args.work_item_id, expand="relations")
    if not parent:
        print("Erro: nao foi possivel carregar a US/Bug informada.")
        return 1

    work_item_type = str(parent.get("fields", {}).get("System.WorkItemType", ""))
    if work_item_type not in {"User Story", "Bug"}:
        print(f"Erro: item {args.work_item_id} e do tipo '{work_item_type}'. Use US/Bug.")
        return 1

    child_ids: List[int] = []
    for rel in parent.get("relations", []) or []:
        if rel.get("rel") == "System.LinkTypes.Hierarchy-Forward":
            try:
                child_ids.append(int((rel.get("url") or "").rstrip("/").split("/")[-1]))
            except ValueError:
                continue
    children = client.get_work_items_batch(child_ids) or []

    candidates = extract_testing_candidates(parent, children)
    if not candidates:
        print("Erro: nenhuma task filha de Testing encontrada (Activity=Testing ou titulo contendo Testing).")
        return 1

    comments_map: Dict[int, List[Dict[str, Any]]] = {}
    for item in candidates:
        wi_id = int(item["id"])
        comments_map[wi_id] = client.get_comments(wi_id) or []

    selected = select_testing_task(candidates, comments_map)
    if not selected:
        print("Erro: nao foi possivel selecionar task de Testing.")
        return 1

    selected_id = int(selected["id"])
    selected_comments = comments_map.get(selected_id, [])
    if not selected_comments:
        print(f"Erro: a task de Testing selecionada ({selected_id}) nao possui discussion para resumir.")
        return 1

    summary_data = summarize_comments(selected_comments, client=client)
    if not summary_data:
        print(
            f"Erro: comentarios da task {selected_id} nao possuem evidencias validas. "
            "Use a tag [EVIDENCIA]-N nos comentarios de teste."
        )
        return 1

    template = load_template(args.template)
    comment_plain = render_template(template, summary_data)
    comment_html = _render_comment_html(summary_data)

    print(f"Task de Testing selecionada: {selected_id} - {selected.get('fields', {}).get('System.Title', '')}")
    print(f"Total de comentarios usados: {len(selected_comments)}")
    print("\n--- PREVIEW DO COMENTARIO (texto) ---\n")
    print(comment_plain)
    print("\n--- FIM PREVIEW TEXTO ---\n")
    print("\n--- PREVIEW HTML (sera publicado no Azure) ---\n")
    print(comment_html)
    print("\n--- FIM PREVIEW HTML ---\n")

    if args.dry_run:
        print("Dry-run finalizado sem publicar comentario.")
        return 0

    mentions_payload = _mentions_for_post(summary_data.get("all_mentions", {}), cfg["organization"])
    posted = client.add_comment(
        args.work_item_id,
        comment_html,
        comment_format="html",
        mentions=mentions_payload or None,
    )
    if not posted:
        print("Erro ao publicar comentario na US/Bug.")
        return 1

    print(f"Comentario publicado com sucesso na US/Bug {args.work_item_id}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
