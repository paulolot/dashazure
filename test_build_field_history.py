def build_field_history(field_name, current_value, created_dt, created_by_name, updates):
    changes = []
    for idx, upd in enumerate(updates):
        if idx == 0:
            change_date = created_dt
        else:
            prev_rev_date = upd.get("revisedDate", created_dt) # Mocked
            change_date = prev_rev_date if prev_rev_date else created_dt
            
        fields_changed = upd.get("fields", {})
        if field_name in fields_changed:
            rev_by = upd.get("revisedBy", {})
            rev_by_name = rev_by.get("displayName", "") if isinstance(rev_by, dict) else ""
            
            val_obj = fields_changed[field_name]
            old_val = val_obj.get("oldValue")
            new_val = val_obj.get("newValue")
            
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
            # For Custom.Status, if there are no changes, but it's populated now?
            # Wait, if there are no changes in 'updates', it means it never changed from its initial value.
            history.append({"valor": current_value, "data": created_dt, "por": created_by_name})
    else:
        first_change = changes[0]
        if first_change["rev"] == 1:
            initial_val = first_change["new"]
        else:
            initial_val = first_change["old"]
            
        # THE BUG IS HERE
        # if not initial_val and current_value:
        #     initial_val = current_value
            
        if created_dt:
            history.append({"valor": initial_val, "data": created_dt, "por": created_by_name})
            
        for chg in changes:
            if chg["rev"] == 1:
                continue
            history.append({"valor": chg["new"], "data": chg["data"], "por": chg["por"]})
            
    history.sort(key=lambda x: x["data"])
    return history

print(build_field_history("Custom.Status", "Aguardando Conclusão de outro Card", "2026-05-20", "Diogo", [
    {"rev": 2, "revisedDate": "2026-07-14", "fields": {"Custom.Status": {"oldValue": None, "newValue": "Aguardando Conclusão de outro Card"}}, "revisedBy": {"displayName": "Ivan"}}
]))
