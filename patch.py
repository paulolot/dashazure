import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update task alerts creation
target_1 = """    // Task Closed sem horas informadas
    if (isClosed && completedWork === 0) {
      alerts.push({
        id: task.ParentId,
        title: taskTitle,
        type: 'Horas não informadas',
        severity: 'info',
        owner: task.Responsavel || 'NENHUM',
        details: `Task concluída sem horas registradas (CompletedWork = 0)`
      });
    }

    // Task sem atividade definida
    const activity = task.Activity ? task.Activity.trim() : '';
    if (!activity) {
      alerts.push({
        id: task.ParentId,
        title: taskTitle,
        type: 'Task com dados faltantes',
        severity: 'info',
        owner: task.Responsavel || 'NENHUM',
        details: `Task sem atividade (campo Activity) definida`
      });
    }

    // Task sem responsável definido
    const resp = task.Responsavel ? task.Responsavel.trim() : '';
    if (!resp || resp.toUpperCase() === 'NENHUM') {
      alerts.push({
        id: task.ParentId,
        title: taskTitle,
        type: 'Task com dados faltantes',
        severity: 'info',
        owner: 'NENHUM',
        details: `Task sem responsável definido`
      });
    }"""

# The file might be in windows-1252 so let's use a regex instead of exact match with accents.
# Or better, just read it with whatever encoding, and use regex.

with open('app.js', 'rb') as f:
    bcontent = f.read()
    
# Let's decode it with utf-8 replacing errors just in case
scontent = bcontent.decode('utf-8', errors='replace')

# 1. Update Task Alerts
p1 = re.compile(
    r"    // Task Closed sem horas informadas\s+if \(isClosed && completedWork === 0\) \{\s+alerts\.push\(\{\s+id: task\.ParentId,\s+title: taskTitle,\s+type: '[^']+',\s+severity: 'info',\s+owner: task\.Responsavel \|\| 'NENHUM',\s+details: `Task conclu[^`]+`\s+\}\);\s+\}\s+// Task sem atividade definida\s+const activity = task\.Activity \? task\.Activity\.trim\(\) : '';\s+if \(!activity\) \{\s+alerts\.push\(\{\s+id: task\.ParentId,\s+title: taskTitle,\s+type: 'Task com dados faltantes',\s+severity: 'info',\s+owner: task\.Responsavel \|\| 'NENHUM',\s+details: `Task sem atividade \(campo Activity\) definida`\s+\}\);\s+\}\s+// Task sem respons[^ ]+ definido\s+const resp = task\.Responsavel \? task\.Responsavel\.trim\(\) : '';\s+if \(!resp \|\| resp\.toUpperCase\(\) === 'NENHUM'\) \{\s+alerts\.push\(\{\s+id: task\.ParentId,\s+title: taskTitle,\s+type: 'Task com dados faltantes',\s+severity: 'info',\s+owner: 'NENHUM',\s+details: `Task sem respons[^`]+`\s+\}\);\s+\}",
    re.MULTILINE
)

rep1 = """    const taskTypeOrName = (task.Activity && task.Activity.trim()) ? task.Activity.trim() : (task.Titulo || 'Task');

    // Task Closed sem horas informadas
    if (isClosed && completedWork === 0) {
      alerts.push({
        id: task.TaskId,
        parentId: task.ParentId,
        title: taskTitle,
        type: 'Horas não informadas',
        severity: 'info',
        owner: task.Responsavel || 'NENHUM',
        details: `Task '${taskTypeOrName}' concluída sem horas registradas (CompletedWork = 0)`
      });
    }

    // Task sem atividade definida
    const activity = task.Activity ? task.Activity.trim() : '';
    if (!activity) {
      alerts.push({
        id: task.TaskId,
        parentId: task.ParentId,
        title: taskTitle,
        type: 'Task com dados faltantes',
        severity: 'info',
        owner: task.Responsavel || 'NENHUM',
        details: `Task '${task.Titulo || 'Task'}' sem atividade (campo Activity) definida`
      });
    }

    // Task sem responsável definido
    const resp = task.Responsavel ? task.Responsavel.trim() : '';
    if (!resp || resp.toUpperCase() === 'NENHUM') {
      alerts.push({
        id: task.TaskId,
        parentId: task.ParentId,
        title: taskTitle,
        type: 'Task com dados faltantes',
        severity: 'info',
        owner: 'NENHUM',
        details: `Task '${taskTypeOrName}' sem responsável definido`
      });
    }"""

scontent = p1.sub(rep1, scontent)

# 2. Add parentId to groupArray
p2 = re.compile(
    r"      return \{\s+id: id,\s+idNum: id === '-' \? -1 : parseInt\(id, 10\),\s+title: alerts\[0\]\.title,\s+owner: alerts\[0\]\.owner,\s+maxSeverity: maxSev,\s+alerts: alerts\s+\};",
    re.MULTILINE
)
rep2 = """      return {
        id: id,
        idNum: id === '-' ? -1 : parseInt(id, 10),
        parentId: alerts[0].parentId,
        title: alerts[0].title,
        owner: alerts[0].owner,
        maxSeverity: maxSev,
        alerts: alerts
      };"""
scontent = p2.sub(rep2, scontent)

# 3. Change idCell and click handler in alerts page
p3 = re.compile(
    r"      pageGroups\.forEach\(group => \{\s+const rowCount = group\.alerts\.length;\s+const idCell = group\.id !== '-' \s+\? `<a href=\"#\" class=\"wi-drill-link\" data-id=\"\$\{group\.id\}\">#\$\{group\.id\}</a>` \s+: '<span style=\"color: var\(--text-muted\); font-weight:600;\">-</span>';",
    re.MULTILINE
)
rep3 = """      pageGroups.forEach(group => {
        const rowCount = group.alerts.length;
        const linkId = group.parentId || group.id;
        const idCell = group.id !== '-' 
          ? `<a href="#" class="wi-drill-link" data-id="${linkId}">#${group.id}</a>` 
          : '<span style="color: var(--text-muted); font-weight:600;">-</span>';"""
scontent = p3.sub(rep3, scontent)

p4 = re.compile(
    r"          if \(idx === 0 && group\.id !== '-'\) \{\s+tr\.querySelector\('\.wi-drill-link'\)\.addEventListener\('click', \(e\) => \{\s+e\.preventDefault\(\);\s+g_selectedDrillDownId = String\(group\.id\);\s+navigateToPage\('drilldown'\);\s+\}\);\s+\}",
    re.MULTILINE
)
rep4 = """          if (idx === 0 && group.id !== '-') {
            tr.querySelector('.wi-drill-link').addEventListener('click', (e) => {
              e.preventDefault();
              g_selectedDrillDownId = String(group.parentId || group.id);
              navigateToPage('drilldown');
            });
          }"""
scontent = p4.sub(rep4, scontent)

# 4. Change Overview Alerts
p5 = re.compile(
    r"    const idCell = a\.id !== '-' \s+\? `<a href=\"#\" class=\"wi-drill-link\" data-id=\"\$\{a\.id\}\">#\$\{a\.id\}</a>` \s+: '<span style=\"color: var\(--text-muted\); font-weight:600;\">-</span>';\s+tr\.innerHTML = `\s+<td style=\"width: 80px;\">\$\{idCell\}</td>\s+<td style=\"font-weight: 600; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;\" title=\"\$\{a\.title\}\">\$\{a\.title\}</td>\s+<td style=\"font-weight: 500;\">\$\{a\.type\}</td>\s+<td><span class=\"\$\{badgeClass\}\">\$\{badgeText\}</span></td>\s+<td>\$\{a\.owner\}</td>\s+<td style=\"color: var\(--text-muted\); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;\" title=\"\$\{a\.details\}\">\$\{a\.details\}</td>\s+`;\s+if \(a\.id !== '-'\) \{\s+tr\.querySelector\('\.wi-drill-link'\)\.addEventListener\('click', \(e\) => \{\s+e\.preventDefault\(\);\s+e\.stopPropagation\(\);\s+g_selectedDrillDownId = String\(a\.id\);\s+navigateToPage\('drilldown'\);\s+\}\);\s+\}",
    re.MULTILINE
)
rep5 = """    const linkId = a.parentId || a.id;
    const idCell = a.id !== '-' 
      ? `<a href="#" class="wi-drill-link" data-id="${linkId}">#${a.id}</a>` 
      : '<span style="color: var(--text-muted); font-weight:600;">-</span>';
    
    tr.innerHTML = `
      <td style="width: 80px;">${idCell}</td>
      <td style="font-weight: 600; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${a.title}">${a.title}</td>
      <td style="font-weight: 500;">${a.type}</td>
      <td><span class="${badgeClass}">${badgeText}</span></td>
      <td>${a.owner}</td>
      <td style="color: var(--text-muted); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${a.details}">${a.details}</td>
    `;
    
    if (a.id !== '-') {
      tr.querySelector('.wi-drill-link').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        g_selectedDrillDownId = String(linkId);
        navigateToPage('drilldown');
      });
    }"""
scontent = p5.sub(rep5, scontent)

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(scontent)

print("Done")
