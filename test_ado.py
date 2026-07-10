import sys
import os
import json
sys.path.append(os.path.join(os.path.dirname(__file__), ".cursor", "skills", "Azure", "tools"))
import ado_tool

url = ado_tool._build_url("/_apis/wit/workitemsbatch")
fields_to_get = [
    "System.Id", "System.WorkItemType", "System.Title", "System.State",
    "Microsoft.VSTS.Common.ClosedDate", "Microsoft.VSTS.Common.ResolvedDate", "Microsoft.VSTS.Common.StateChangeDate"
]
body = {"ids": [13925], "fields": fields_to_get}
batch_data = ado_tool._request_json(url, data=json.dumps(body).encode("utf-8"), method="POST", content_type="application/json")

print(json.dumps(batch_data, indent=2))
