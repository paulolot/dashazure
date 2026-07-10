const fs = require('fs');

let appJs = fs.readFileSync('app.js', 'utf8');

// 1. Remove call to render productivity table in renderAlertsPageContents
appJs = appJs.replace(
  /const tbodyProd = document\.getElementById\('tbody-productivity-gaps'\);\s+if \(g_activeAlertTab === 'productivity'\) \{[\s\S]*?\} \/\/ fim do else \(g_productivityGaps\.length > 0\)\n\s+\}/g,
  ""
);

// 2. Remove gap calculation in processAlerts
appJs = appJs.replace(
  /\/\/ 3\. Clculo de Gaps de Produtividade[\s\S]*?productivity\.sort\(\(a, b\) => a\.person\.localeCompare\(b\.person, 'pt-BR'\)\);\n\s+g_productivityGaps = productivity;/g,
  "// Productivity gaps now calculated in renderDeliveries"
);
// In case of utf8 issues with the string "Cálculo" vs "Clculo", let's use a simpler regex
appJs = appJs.replace(
  /\/\/ 3\. C.lculo de Gaps de Produtividade[\s\S]*?productivity\.sort\(\(a, b\) => a\.person\.localeCompare\(b\.person, 'pt-BR'\)\);\n\s+g_productivityGaps = productivity;/g,
  "// Productivity gaps now calculated in renderDeliveries"
);


// 3. Remove kpi-productivity-gaps-count from renderAlertsPage
appJs = appJs.replace(
  /const prodGapCount = g_productivityGaps\.filter\(p => p\.gap < 0\)\.length;\n\n\s+document\.getElementById\('kpi-total-alerts'\).textContent = totalCount;/g,
  "document.getElementById('kpi-total-alerts').textContent = totalCount;"
);
appJs = appJs.replace(
  /document\.getElementById\('kpi-productivity-gaps-count'\)\.textContent = prodGapCount;/g,
  ""
);

appJs = appJs.replace(
  /document\.getElementById\('card-kpi-productivity-gaps'\)\.onclick = \(\) => \{\s+document\.getElementById\('btn-tab-alerts-productivity'\)\.click\(\);\s+\};/g,
  ""
);

// 4. Call renderCollaboratorTimesAndGaps from renderDeliveries
appJs = appJs.replace(
  /\/\/ 3\. Table: Master Deliveries List\n\s+renderDeliveriesList\(pageClosedWIs\);\n\}/g,
  "// 3. Table: Master Deliveries List\n  renderDeliveriesList(pageClosedWIs);\n\n  // 4. Productivity and Collaborator Times\n  renderCollaboratorTimesAndGaps(filteredWIs);\n}"
);

// 5. Append new function
const newFunc = `
function renderCollaboratorTimesAndGaps(filteredWIs) {
  const today = TODAY_ANCHOR;
  const dateRangeObj = document.getElementById('filter-date-range');
  const dateRange = dateRangeObj ? dateRangeObj.value : '30';
  let startDate, endDate;
  
  if (dateRange === 'all') {
    let minDateMs = today.getTime();
    g_raw.workItems.forEach(wi => {
      if (wi.DataCriacao) {
        const t = new Date(wi.DataCriacao).getTime();
        if (t < minDateMs) minDateMs = t;
      }
    });
    startDate = new Date(minDateMs);
    endDate = new Date(today);
  } else if (dateRange === 'this-year') {
    startDate = new Date(today.getFullYear(), 0, 1);
    endDate = new Date(today);
  } else if (dateRange === 'last-year') {
    startDate = new Date(today.getFullYear() - 1, 0, 1);
    endDate = new Date(today.getFullYear() - 1, 11, 31);
  } else {
    const days = parseInt(dateRange, 10);
    startDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
    endDate = new Date(today);
  }

  const workingDays = getWorkingDays(startDate, endDate);
  const availableHours = workingDays * g_rules.person_hours_per_day;

  const allowedParents = new Set(filteredWIs.map(wi => String(wi.Id).trim()));
  const personHours = {};
  const personReworkHours = {};
  const personTasksMap = {};

  g_raw.tasks.forEach(t => {
    const resp = t.Responsavel ? t.Responsavel.trim() : '';
    if (!resp || resp.toUpperCase() === 'NENHUM') return;
    if (!g_data.squadMemberNames.has(resp.toLowerCase())) return;

    const parentId = t.ParentId ? String(t.ParentId).trim() : '';
    if (!parentId || !allowedParents.has(parentId)) return;

    const cw = parseFloat(t.CompletedWork) || 0;

    if (!personHours[resp]) personHours[resp] = 0;
    if (!personReworkHours[resp]) personReworkHours[resp] = 0;
    if (!personTasksMap[resp]) personTasksMap[resp] = [];

    const titleUpper = (t.Titulo || '').toUpperCase();
    if (titleUpper.includes('CODE ADJUSTMENT') || titleUpper.includes('REWORK')) {
      personReworkHours[resp] += cw;
    } else {
      personHours[resp] += cw;
    }
    personTasksMap[resp].push(t);
  });

  const closedBugs = g_raw.bugs; 
  closedBugs.forEach(b => {
    const tags = g_data.tagsByWi.get(b.Id) || [];
    const hasGeradoPorUs = tags.some(tag => tag.toLowerCase() === 'geradoporus');
    if (hasGeradoPorUs || tags.some(tag => tag.toLowerCase() === 'bug de release')) {
      const cw = parseFloat(b.CompletedWork) || 0;
      if (cw > 0) {
        const resp = b.Responsavel ? b.Responsavel.trim() : '';
        if (resp && resp.toUpperCase() !== 'NENHUM' && g_data.squadMemberNames.has(resp.toLowerCase())) {
          if (!personReworkHours[resp]) personReworkHours[resp] = 0;
          personReworkHours[resp] += cw;
        }
      }
    }
  });

  const filteredAtendimentos = getFilteredAtendimentos();
  filteredAtendimentos.forEach(at => {
    const resp = at.Responsavel ? at.Responsavel.trim() : '';
    if (!resp || resp.toUpperCase() === 'NENHUM') return;
    if (!g_data.squadMemberNames.has(resp.toLowerCase())) return;
    if (!personHours[resp]) personHours[resp] = 0;
    personHours[resp] += parseFloat(at.CompletedWork) || 0;
  });

  window.g_productivityTasksMap = personTasksMap;
  window.g_productivityPeriod = { startDate, endDate };

  const productivity = [];
  const uniqueTeam = Array.from(new Set([...Object.keys(personHours), ...Object.keys(personReworkHours)]));
  
  uniqueTeam.forEach(person => {
    const activity = personHours[person] || 0;
    const rework = personReworkHours[person] || 0;
    const completed = activity + rework;
    let inactivity = availableHours - completed;
    if (inactivity < 0) inactivity = 0;

    const gap = completed - availableHours;
    const rate = availableHours > 0 ? (completed / availableHours) * 100 : 0;
    
    productivity.push({
      person,
      workingDays,
      availableHours,
      completedHours: completed,
      activity,
      rework,
      inactivity,
      gap,
      rate
    });
  });

  productivity.sort((a, b) => a.person.localeCompare(b.person, 'pt-BR'));
  g_productivityGaps = productivity;

  const tbodyProd = document.getElementById('tbody-productivity-gaps');
  if (tbodyProd) {
    tbodyProd.innerHTML = '';
    const periodTextObj = document.getElementById('filter-date-range');
    const periodText = periodTextObj ? periodTextObj.options[periodTextObj.selectedIndex].text : '30 Dias';
    
    const lblObj = document.getElementById('lbl-productivity-period');
    if (lblObj) lblObj.textContent = \`Período: \${periodText}\`;
    
    const kpiCountObj = document.getElementById('kpi-productivity-gaps-count');
    if (kpiCountObj) {
        kpiCountObj.textContent = g_productivityGaps.filter(p => p.gap < 0).length;
    }

    if (g_productivityGaps.length === 0) {
      tbodyProd.innerHTML = \`<tr><td colspan="6" class="text-center" style="padding: 16px 0; color: var(--text-muted);">Nenhum colaborador com dados no período.</td></tr>\`;
    } else {
      g_productivityGaps.forEach(p => {
        const tr = document.createElement('tr');
        const rateText = p.availableHours > 0 ? \`\${p.rate.toFixed(1)}%\` : '-';
        
        let gapClass = 'text-gap-neutral';
        let fillClass = 'prod-fill-green';
        
        if (p.gap < 0) {
          gapClass = 'text-gap-negative';
          fillClass = p.rate < 75 ? 'prod-fill-red' : 'prod-fill-yellow';
        } else if (p.gap > 0) {
          gapClass = 'text-gap-positive';
          fillClass = 'prod-fill-green';
        }
        
        const gapSign = p.gap > 0 ? '+' : '';
        const progressWidth = Math.min(100, p.rate);
        
        tr.innerHTML = \`
          <td style="font-weight: 600; color: var(--text-main); cursor: pointer; text-decoration: underline;" onclick="openProductivityDetailsModal('\${p.person}')" title="Ver detalhes de tarefas e horas concluídas">\${p.person}</td>
          <td>\${p.workingDays} dias</td>
          <td>\${p.availableHours.toFixed(1)}h</td>
          <td><span style="font-weight: 600;">\${p.completedHours.toFixed(1)}h</span></td>
          <td class="\${gapClass}" style="font-weight: bold;">\${gapSign}\${p.gap.toFixed(1)}h</td>
          <td style="min-width: 150px;">
            <div class="productivity-progress-wrapper">
              <div class="productivity-progress-text">
                <span style="font-weight: 600; font-size: 0.85rem;">\${rateText}</span>
              </div>
              <div class="productivity-progress-bar">
                <div class="productivity-progress-fill \${fillClass}" style="width: \${progressWidth}%;"></div>
              </div>
            </div>
          </td>
        \`;
        tbodyProd.appendChild(tr);
      });
    }
  }

  renderCollaboratorTimesChart(g_productivityGaps);
}

let chartCollaboratorTimesInstance = null;
function renderCollaboratorTimesChart(productivityData) {
  const ctx = document.getElementById('canvas-collaborator-times');
  if (!ctx) return;

  if (chartCollaboratorTimesInstance) {
    chartCollaboratorTimesInstance.destroy();
  }

  const labels = productivityData.map(p => p.person);
  const dataActivity = productivityData.map(p => p.activity);
  const dataRework = productivityData.map(p => p.rework);
  const dataInactivity = productivityData.map(p => p.inactivity);

  chartCollaboratorTimesInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Atividade (h)',
          data: dataActivity,
          backgroundColor: 'rgba(52, 152, 219, 0.8)', 
          borderColor: 'rgba(52, 152, 219, 1)',
          borderWidth: 1
        },
        {
          label: 'Retrabalho (h)',
          data: dataRework,
          backgroundColor: 'rgba(231, 76, 60, 0.8)', 
          borderColor: 'rgba(231, 76, 60, 1)',
          borderWidth: 1
        },
        {
          label: 'Inatividade (h)',
          data: dataInactivity,
          backgroundColor: 'rgba(149, 165, 166, 0.5)', 
          borderColor: 'rgba(149, 165, 166, 1)',
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
        },
        y: {
          stacked: true,
          title: {
            display: true,
            text: 'Horas'
          }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: { color: '#ccc' } // adapting to dark theme
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      }
    }
  });
}
`;

appJs += "\n" + newFunc;

fs.writeFileSync('app.js', appJs);
console.log("app.js patched.");
