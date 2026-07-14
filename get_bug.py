import sys, json
sys.path.insert(0, r'.cursor\skills\Azure\tools')
import ado_tool
url = ado_tool._build_url('/_apis/wit/workitems/22508') + '&$expand=all'
res = ado_tool._request_json(url)
if res:
    fields = res.get('fields', {})
    for k in fields.keys():
        if 'classi' in k.lower() or 'sever' in k.lower() or 'prior' in k.lower() or 'custom' in k.lower():
            print(f"{k}: {fields[k]}")
else:
    print("No response")
