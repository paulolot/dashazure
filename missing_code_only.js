function renderHoursByPersonAndActivity(filteredWIs) {
  const legendContainer = document.getElementById('capacity-hours-legend');
  const gridContainer = document.getElementById('capacity-hours-grid');
  
  if (!legendContainer || !gridContainer) return;
  
  legendContainer.innerHTML = '';
  gridContainer.innerHTML = '';
  
  const NORMALIZE_ACTIVITY = {
    'Requirements': 'Requisitos',
    'Development': 'Desenvolvimento',
    'DevelopmentTest': 'Desenvolvimento',
    'TechnicalValidation': 'Validação Técnica',
    'Documentation': 'Documentação',
    'CodeReview': 'Revisão de Código',
    'Testing': 'Testes',
    'CodeAdjustment': 'CodeAdjustment',
    'Rework': 'Rework',
    'Deployment': 'Deployment'
  };
  
  const ACTIVITY_COLORS = {
    'Requisitos': 'var(--color-flow-fila)',
    'Revisão de Código': 'var(--color-flow-handoff)',
    'Desenvolvimento': 'hsl(215, 90%, 55%)',
    'Documentação': 'hsl(275, 75%, 60%)',
    'Validação Técnica': 'var(--color-flow-trabalho)',
    'Testes': 'var(--color-flow-prerelease)',
    'CodeAdjustment': 'hsl(190, 85%, 45%)',
    'Rework': 'var(--color-danger)',
    'Deployment': 'hsl(142, 40%, 45%)',
    'Outros/Indefinido': 'var(--color-flow-done)'
  };
  
  const getNormalizedActivity = (act) => {
    if (!act || act.trim() === '') return 'Outros/Indefinido';
    const trimmed = act.trim();
    return NORMALIZE_ACTIVITY[trimmed] || trimmed;
  };
  
  const getActivityColor = (act) => {
    return ACTIVITY_COLORS[act] || 'var(--color-flow-done)';
  };
  
  const personData = {};
  const activeActivitiesSet = new Set();
  
  filteredWIs.forEach(wi => {
    const tasks = g_data.tasksByParent.get(wi.Id) || [];
    const isParentClosed = wi.State === 'Closed' || wi.BoardColumn === 'Concluído';
    
    tasks.forEach(t => {
      const resp = t.Responsavel ? t.Responsavel.trim() : '';
      if (!resp || resp === 'NENHUM') return;
      
      if (!personData[resp]) {
        personData[resp] = {
          name: resp,
          tasks: [],
          totalCompleted: 0,
          totalEstimated: 0,
          divergences: 0,
          warnings: 0,
          activities: {}
        };
      }
      
      const p = personData[resp];
      p.tasks.push(t);
      p.totalCompleted += t.CompletedWork;
      p.totalEstimated += t.OriginalEstimate;
      
      // Calculate divergence & warning for this task
      const est = t.OriginalEstimate || 0;
      const comp = t.CompletedWork || 0;
      const act = getNormalizedActivity(t.Activity);
      
      let isTaskDivergent = false;
      let isTaskWarning = false;
      
      // Scenario A: Development task without estimate but with work done
      if (act === 'Desenvolvimento' && est === 0 && comp > 0) {
        isTaskDivergent = true;
      }
      
      // Scenario B: Closed task without completed work hours
      if (t.State === 'Closed' && comp === 0) {
        isTaskDivergent = true;
      }
      
      // Scenario C: Open task under closed parent card
      if (t.State !== 'Closed' && isParentClosed) {
        isTaskDivergent = true;
      }
      
      // Scenario D: Estimate vs actual hours deviation (warning) - not counted as divergence
      if (est > 0 && comp > 0 && est !== comp) {
        isTaskWarning = true;
      }
      
      if (isTaskDivergent) {
        p.divergences++;
      } else if (isTaskWarning) {
        p.warnings++;
      }
      
      activeActivitiesSet.add(act);
      
      if (!p.activities[act]) {
        p.activities[act] = {
          name: act,
          completed: 0,
          estimated: 0,
          taskCount: 0,
          divergences: 0,
          warnings: 0
        };
      }
      
      const a = p.activities[act];
      a.completed += t.CompletedWork;
      a.estimated += t.OriginalEstimate;
      a.taskCount++;
      if (isTaskDivergent) {
        a.divergences++;
      } else if (isTaskWarning) {
        a.warnings++;
      }
    });
  });
  
  const personsList = Object.values(personData);
  
  if (personsList.length === 0) {
    legendContainer.style.display = 'none';
    gridContainer.innerHTML = `<span class="placeholder-text" style="grid-column: 1 / -1; text-align: center;">Nenhum dado de subtasks disponível nos filtros atuais</span>`;
    return;
  }
  
  legendContainer.style.display = 'flex';
  
  // Render Legend
  const activeActivities = Array.from(activeActivitiesSet).sort();
  activeActivities.forEach(act => {
    const color = getActivityColor(act);
    const legendItem = document.createElement('div');
    legendItem.style.display = 'flex';
    legendItem.style.alignItems = 'center';
    legendItem.style.gap = '6px';
    legendItem.innerHTML = `
      <span style="width: 12px; height: 12px; background-color: ${color}; border-radius: 3px; display: inline-block;"></span>
      <span style="font-weight: 500; color: var(--text-main);">${act}</span>
    `;
    legendContainer.appendChild(legendItem);
  });
  
  // Sort persons by totalCompleted descending
  personsList.sort((a, b) => b.totalCompleted - a.totalCompleted);
  
  // Render Cards
  personsList.forEach(p => {
    const card = document.createElement('div');
    card.className = 'capacity-person-card';
    if (p.divergences > 0) {
      card.classList.add('divergent');
    }
    
    // Sort person's activities by completed hours descending
    const actList = Object.values(p.activities).sort((a, b) => b.completed - a.completed);
    
    let activitiesHtml = '';
    actList.forEach(act => {
      const color = getActivityColor(act.name);
      const pct = p.totalCompleted > 0 ? (act.completed / p.totalCompleted) * 100 : 0;
      
      let statusIcons = '';
      if (act.divergences > 0) {
        statusIcons += `<span title="${act.divergences} tarefa(s) com divergência nesta atividade" style="margin-left: 5px; cursor: help;">🛑</span>`;
      }
      if (act.warnings > 0) {
        statusIcons += `<span title="${act.warnings} tarefa(s) com aviso de desvio de horas nesta atividade" style="margin-left: 5px; cursor: help;">⚠️</span>`;
      }
      
      activitiesHtml += `
        <div class="activity-row">
          <div class="activity-row-header">
            <div class="activity-label">
              <span class="activity-dot" style="background-color: ${color};"></span>
              <span class="activity-name" title="${act.name}">${act.name}</span>
              ${statusIcons}
            </div>
            <div class="activity-stats">
              <strong>${act.completed.toFixed(1)}h</strong> (${pct.toFixed(1)}%)
              <span style="margin: 0 4px; opacity: 0.3;">·</span>
              ${act.estimated.toFixed(1)}h est.
              <span style="margin: 0 4px; opacity: 0.3;">·</span>
              ${act.taskCount} tasks
            </div>
          </div>
          <div class="activity-progress-container">
            <div class="activity-progress-bar" style="width: ${pct}%; background-color: ${color};"></div>
          </div>
        </div>
      `;
    });
    
    card.innerHTML = `
      <div>
        <h4 style="margin: 0 0 8px 0; font-size: 1.15rem; font-weight: 700; color: #fff;">${p.name}</h4>
        <div style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5;">
          <div style="display: flex; gap: 15px; flex-wrap: wrap;">
            <span><strong style="color: var(--text-main);">${p.tasks.length}</strong> tasks</span>
            <span><strong style="color: var(--text-main);">${p.totalCompleted.toFixed(1)}h</strong> total no período (100%)</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; gap: 10px; flex-wrap: wrap;">
            <span><strong style="color: var(--text-main);">${p.totalEstimated.toFixed(1)}h</strong> est.</span>
            <div style="display: flex; gap: 6px; align-items: center;">
              ${p.divergences > 0 ? `<span style="background-color: hsla(350, 89%, 60%, 0.12); color: var(--color-danger); border: 1px solid hsla(350, 89%, 60%, 0.25); font-size: 0.72rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; white-space: nowrap;">${p.divergences} divergência(s)</span>` : ''}
              ${p.warnings > 0 ? `<span style="background-color: hsla(38, 92%, 50%, 0.12); color: var(--color-warning); border: 1px solid hsla(38, 92%, 50%, 0.25); font-size: 0.72rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; white-space: nowrap;">${p.warnings} aviso(s)</span>` : ''}
            </div>
          </div>
        </div>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 12px; border-top: 1px solid hsla(0,0%,100%,0.05); padding-top: 14px;">
        ${activitiesHtml}
      </div>
    `;
    
    gridContainer.appendChild(card);
  });
}

// ---- NEXT ---- 

    let activitiesHtml = '';
    actList.forEach(act => {
      const color = getActivityColor(act.name);
      const pct = p.totalCompleted > 0 ? (act.completed / p.totalCompleted) * 100 : 0;
      
      activitiesHtml += `
        <div class="activity-row">
          <div class="activity-row-header">
            <div class="activity-label">
              <span class="activity-dot" style="background-color: ${color};"></span>
              <span class="activity-name" title="${act.name}">${act.name}</span>
            </div>

// ---- NEXT ---- 

function renderHoursByPersonAndActivity(filteredWIs) {
  const legendContainer = document.getElementById('capacity-hours-legend');
  const gridContainer = document.getElementById('capacity-hours-grid');
  
  if (!legendContainer || !gridContainer) return;
  
  legendContainer.innerHTML = '';
  gridContainer.innerHTML = '';
  
  const personData = {};
  const activeActivitiesSet = new Set();
  
  filteredWIs.forEach(wi => {
    const tasks = g_data.tasksByParent.get(wi.Id) || [];
    const isParentClosed = wi.State === 'Closed' || wi.BoardColumn === 'Concluído';
    
    tasks.forEach(t => {
      const resp = t.Responsavel ? t.Responsavel.trim() : '';
      if (!resp || resp === 'NENHUM') return;
      
      // Filter by active person filter if applicable
      if (g_capacityActivePersonFilter && resp !== g_capacityActivePersonFilter) return;
      
      const act = getNormalizedActivity(t.Activity);
      
      // Filter by active activity filter if applicable
      if (g_capacityActiveActivityFilter && act !== g_capacityActiveActivityFilter) return;
      
      if (!personData[resp]) {
        personData[resp] = {
          name: resp,
          tasks: [],
          totalCompleted: 0,
          totalEstimated: 0,
          divergences: 0,
          warnings: 0,
          activities: {}
        };
      }
      
      const p = personData[resp];
      p.tasks.push(t);
      p.totalCompleted += t.CompletedWork;
      p.totalEstimated += t.OriginalEstimate;
      
      // Calculate divergence & warning for this task
      const est = t.OriginalEstimate || 0;
      const comp = t.CompletedWork || 0;
      
      let isTaskDivergent = false;
      let isTaskWarning = false;
      
      // Scenario A: Development task without estimate but with work done
      if (act === 'Desenvolvimento' && est === 0 && comp > 0) {
        isTaskDivergent = true;
      }
      
      // Scenario B: Closed task without completed work hours
      if (t.State === 'Closed' && comp === 0) {
        isTaskDivergent = true;
      }
      
      // Scenario C: Open task under closed parent card
      if (t.State !== 'Closed' && isParentClosed) {
        isTaskDivergent = true;
      }
      
      // Scenario D: Estimate vs actual hours deviation (warning) - not counted as divergence
      if (est > 0 && comp > 0 && est !== comp) {
        isTaskWarning = true;
      }
      
      if (isTaskDivergent) {
        p.divergences++;
      } else if (isTaskWarning) {
        p.warnings++;
      }
      
      activeActivitiesSet.add(act);
      
      if (!p.activities[act]) {
        p.activities[act] = {
          name: act,
          completed: 0,
          estimated: 0,
          taskCount: 0,
          divergences: 0,
          warnings: 0
        };
      }
      
      const a = p.activities[act];
      a.completed += t.CompletedWork;
      a.estimated += t.OriginalEstimate;
      a.taskCount++;
      if (isTaskDivergent) {
        a.divergences++;
      } else if (isTaskWarning) {
        a.warnings++;
      }
    });
  });
  
  const personsList = Object.values(personData);
  
  if (personsList.length === 0) {
    legendContainer.style.display = 'none';
    gridContainer.innerHTML = `<span class="placeholder-text" style="grid-column: 1 / -1; text-align: center;">Nenhum dado de subtasks disponível nos filtros atuais</span>`;
    return;
  }
  
  legendContainer.style.display = 'flex';
  
  // Render Legend
  const activeActivities = Array.from(activeActivitiesSet).sort();
  activeActivities.forEach(act => {
    const color = getActivityColor(act);
    const legendItem = document.createElement('div');
    legendItem.style.display = 'flex';
    legendItem.style.alignItems = 'center';
    legendItem.style.gap = '6px';
    legendItem.style.cursor = 'pointer';
    legendItem.style.padding = '4px 8px';
    legendItem.style.borderRadius = '4px';
    legendItem.style.transition = 'all var(--transition-smooth)';
    
    const isSelected = g_capacityActiveActivityFilter === act;
    const isDimmed = g_capacityActiveActivityFilter && g_capacityActiveActivityFilter !== act;
    legendItem.style.opacity = isDimmed ? '0.35' : '1';
    if (isSelected) {
      legendItem.style.backgroundColor = 'hsla(252, 31%, 25%, 0.6)';
      legendItem.style.border = '1px solid var(--color-primary)';
    } else {
      legendItem.style.border = '1px solid transparent';
    }
    
    legendItem.innerHTML = `
      <span style="width: 12px; height: 12px; background-color: ${color}; border-radius: 3px; display: inline-block;"></span>
      <span style="font-weight: 500; color: var(--text-main);">${act}</span>
    `;
    
    legendItem.addEventListener('click', () => {
      g_capacityActiveActivityFilter = (g_capacityActiveActivityFilter === act) ? null : act;
      renderActivePage();
    });
    
    legendContainer.appendChild(legendItem);
  });
  
  // Sort persons by totalCompleted descending
  personsList.sort((a, b) => b.totalCompleted - a.totalCompleted);
  
  // Render Cards
  personsList.forEach(p => {
    const card = document.createElement('div');
    card.className = 'capacity-person-card';
    if (p.divergences > 0) {
      card.classList.add('divergent');
    }
    
    const isPersonSelected = g_capacityActivePersonFilter === p.name;
    const cardHeaderBg = isPersonSelected ? 'background-color: hsla(252, 31%, 15%, 0.6);' : '';
    
    // Sort person's activities by completed hours descending
    const actList = Object.values(p.activities).sort((a, b) => b.completed - a.completed);
    
    let activitiesHtml = '';
    actList.forEach(act => {
      const color = getActivityColor(act.name);
      const pct = p.totalCompleted > 0 ? (act.completed / p.totalCompleted) * 100 : 0;
      
      const isActSelected = g_capacityActiveActivityFilter === act.name;
      const actRowBg = isActSelected ? 'background-color: hsla(252, 31%, 15%, 0.6); border-radius: 4px; padding: 4px;' : 'padding: 4px;';
      
      activitiesHtml += `
        <div class="activity-row capacity-card-activity-row" data-activity="${act.name}" style="cursor: pointer; transition: all var(--transition-smooth); ${actRowBg}">
          <div class="activity-row-header">
            <div class="activity-label">
              <span class="activity-dot" style="background-color: ${color};"></span>
              <span class="activity-name" title="${act.name}">${act.name}</span>
            </div>
            <div class="activity-stats">
              <strong>${act.completed.toFixed(1)}h</strong> (${pct.toFixed(1)}%)
              <span style="margin: 0 4px; opacity: 0.3;">·</span>
              ${act.estimated.toFixed(1)}h est.
              <span style="margin: 0 4px; opacity: 0.3;">·</span>
              ${act.taskCount} tasks
            </div>
          </div>
          <div class="activity-progress-container">
            <div class="activity-progress-bar" style="width: ${pct}%; background-color: ${color};"></div>
          </div>
        </div>
      `;
    });
    
    card.innerHTML = `
      <div class="capacity-card-header" style="cursor: pointer; transition: all var(--transition-smooth); padding: 8px; border-radius: 6px; ${cardHeaderBg}">
        <h4 style="margin: 0 0 8px 0; font-size: 1.15rem; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
          ${p.name}
          ${isPersonSelected ? `<span class="badge badge-purple" style="font-size: 0.65rem;">Filtro Ativo</span>` : ''}
        </h4>
        <div style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5;">
          <div style="display: flex; gap: 15px; flex-wrap: wrap;">
            <span><strong style="color: var(--text-main);">${p.tasks.length}</strong> tasks</span>
            <span><strong style="color: var(--text-main);">${p.totalCompleted.toFixed(1)}h</strong> total no período (100%)</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; gap: 10px; flex-wrap: wrap;">
            <span><strong style="color: var(--text-main);">${p.totalEstimated.toFixed(1)}h</strong> est.</span>
            <div style="display: flex; gap: 6px; align-items: center;">
              ${p.divergences > 0 ? `<span style="background-color: hsla(350, 89%, 60%, 0.12); color: var(--color-danger); border: 1px solid hsla(350, 89%, 60%, 0.25); font-size: 0.72rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; white-space: nowrap;">${p.divergences} divergência(s)</span>` : ''}
              ${p.warnings > 0 ? `<span style="background-color: hsla(38, 92%, 50%, 0.12); color: var(--color-warning); border: 1px solid hsla(38, 92%, 50%, 0.25); font-size: 0.72rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; white-space: nowrap;">${p.warnings} aviso(s)</span>` : ''}
            </div>
          </div>
        </div>
      </div>
      
      <div style="display: flex; flex-direction: column; gap: 12px; border-top: 1px solid hsla(0,0%,100%,0.05); padding-top: 14px;">
        ${activitiesHtml}
      </div>
    `;
    
    card.querySelector('.capacity-card-header').addEventListener('click', () => {
      g_capacityActivePersonFilter = (g_capacityActivePersonFilter === p.name) ? null : p.name;
      renderActivePage();
    });
    
    card.querySelectorAll('.capacity-card-activity-row').forEach(row => {
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        const actName = row.getAttribute('data-activity');
        g_capacityActiveActivityFilter = (g_capacityActiveActivityFilter === actName) ? null : actName;
        renderActivePage();
      });
    });
    
    gridContainer.appendChild(card);
  });
}

// ---- NEXT ---- 

    const cardHeaderBg = isPersonSelected ? 'background-color: var(--selected-card-header-bg);' : '';

// ---- NEXT ---- 

    card.innerHTML = `
      <div class="capacity-card-header" style="cursor: pointer; transition: all var(--transition-smooth); padding: 8px; border-radius: 6px; ${cardHeaderBg}">
        <h4 style="margin: 0 0 8px 0; font-size: 1.15rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
          ${p.name}
          ${isPersonSelected ? `<span class="badge badge-purple" style="font-size: 0.65rem;">Filtro Ativo</span>` : ''}

// ---- NEXT ---- 

        processAndRenderGridGeneric(tableId, gridKey, mappedRows, renderRowFn, onCountChange);
      });
    }
  }
}

// 8. SPA ROUTER

// ---- NEXT ---- 

  // Calculate MTTR (Mean Time To Resolution) for locally filtered closed bugs!
  const pageBugsClosed = pageBugs.filter(b => b.State === 'Closed' || b.BoardColumn === 'Concluído');
  const resolutionTimes = [];
  let minBug = null;
  let maxBug = null;
  
  pageBugsClosed.forEach(b => {
    if (b.DataCriacao && b.DataFechamento) {
      const cDate = new Date(b.DataCriacao);
      const fDate = new Date(b.DataFechamento);
      const resTime = (fDate.getTime() - cDate.getTime()) / (1000 * 3600 * 24);
      resolutionTimes.push(resTime);
      
      if (!minBug || resTime < minBug.time) minBug = { id: b.Id, time: resTime };
      if (!maxBug || resTime > maxBug.time) maxBug = { id: b.Id, time: resTime };
    }
  });
  
  const mttr = resolutionTimes.length > 0 ? (resolutionTimes.reduce((s, v) => s + v, 0) / resolutionTimes.length) : 0;
  const mttrLbl = document.getElementById('lbl-quality-mttr');
  if (mttrLbl) {
    mttrLbl.textContent = resolutionTimes.length > 0 ? `${mttr.toFixed(1)} dias` : '-';
  }
  const mttrMinLbl = document.getElementById('lbl-quality-mttr-min');
  if (mttrMinLbl) {
    mttrMinLbl.innerHTML = minBug ? `Menor: <a href="#" onclick="g_selectedDrillDownId='${minBug.id}'; navigateToPage('drilldown'); event.preventDefault();">${minBug.id}</a> (${minBug.time.toFixed(1)}d)` : 'Menor: -';
  }
  const mttrMaxLbl = document.getElementById('lbl-quality-mttr-max');
  if (mttrMaxLbl) {
    mttrMaxLbl.innerHTML = maxBug ? `Maior: <a href="#" onclick="g_selectedDrillDownId='${maxBug.id}'; navigateToPage('drilldown'); event.preventDefault();">${maxBug.id}</a> (${maxBug.time.toFixed(1)}d)` : 'Maior: -';
  }

// ---- NEXT ---- 

// Function renderBugsPRRMetrics removed

// ---- NEXT ---- 

function renderDeliveriesByCollaboratorTasks(filteredWIs) {
  const container = document.getElementById('chart-deliveries-by-person');
  if (!container) return;
  container.innerHTML = '';
  
  // Create a fast lookup for filteredWIs parents
  const allowedParents = new Set(filteredWIs.map(wi => wi.Id));
  
  // Get date range from filters
  const dateRangeVal = document.getElementById('filter-date-range') ? document.getElementById('filter-date-range').value : '30';
  const today = new Date(TODAY_ANCHOR);
  let startDateMs = 0;
  let endDateMs = today.getTime();
  
  if (dateRangeVal !== 'all') {
    if (dateRangeVal === 'today') {
      startDateMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    } else if (dateRangeVal === 'this-year') {
      startDateMs = new Date(today.getFullYear(), 0, 1).getTime();
    } else if (dateRangeVal === 'last-year') {
      startDateMs = new Date(today.getFullYear() - 1, 0, 1).getTime();
      endDateMs = new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59).getTime();
    } else {
      const days = parseInt(dateRangeVal.replace('last-', ''), 10) || 30;
      startDateMs = today.getTime() - (days * 24 * 60 * 60 * 1000);
    }
  }

  // Filter valid closed tasks
  const validTasks = g_raw.tasks.filter(t => {
    if (t.State !== 'Closed') return false;
    if (!allowedParents.has(t.ParentId)) return false;
    
    // Check if task closure (DataAlteracao) falls within window
    if (dateRangeVal !== 'all') {
      if (!t.DataAlteracao) return false;
      const closedTime = new Date(t.DataAlteracao).getTime();
      if (closedTime < startDateMs || closedTime > endDateMs) return false;
    }
    return true;
  });

  // Group by Collaborator -> Activity
  const personStats = {};
  const activityColors = {
    'Development': 'hsl(210, 85%, 60%)',
    'Requirements': 'hsl(140, 75%, 55%)',
    'Testing': 'hsl(350, 85%, 60%)',
    'TechnicalValidation': 'hsl(280, 70%, 65%)',
    'Review': 'hsl(30, 90%, 60%)',
    'Outros': 'hsl(0, 0%, 50%)'
  };
  
  const knownActivities = new Set(Object.keys(activityColors));

  validTasks.forEach(t => {
    const person = t.Responsavel && t.Responsavel.trim() !== '' ? t.Responsavel : 'Indefinido';
    let act = t.Activity || 'Outros';
    if (!knownActivities.has(act)) act = 'Outros';
    
    if (!personStats[person]) personStats[person] = { total: 0, activities: {} };
    if (!personStats[person].activities[act]) personStats[person].activities[act] = 0;
    
    personStats[person].activities[act]++;
    personStats[person].total++;
  });
  
  const data = Object.keys(personStats).map(name => ({
    name,
    total: personStats[name].total,
    activities: personStats[name].activities
  })).sort((a, b) => b.total - a.total);
                     
  if (data.length === 0) {
    container.innerHTML = `<span class="placeholder-text">Sem subtasks fechadas no período selecionado</span>`;
    return;
  }
  
  const maxVal = Math.max(...data.map(d => d.total), 4);
  
  // Render SVG horizontal stacked bars
  const width = 500;
  const height = Math.max(250, data.length * 35 + 40);
  const paddingLeft = 140;
  const paddingRight = 30;
  const paddingTop = 20;
  const paddingBottom = 40;
  
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;
  
  let axisHtml = '';
  const xTicks = 5;
  for (let i = 0; i <= xTicks; i++) {
    const val = Math.round((i / xTicks) * maxVal);
    const x = paddingLeft + (val / maxVal) * chartW;
    axisHtml += `<line x1="${x}" y1="${paddingTop}" x2="${x}" y2="${paddingTop + chartH}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="4,4"></line>`;
    axisHtml += `<text x="${x}" y="${paddingTop + chartH + 15}" fill="var(--text-muted)" font-size="10" text-anchor="middle">${val}</text>`;
  }
  
  const barHeight = 20;
  let barsHtml = '';
  
  data.forEach((d, i) => {
    const y = paddingTop + (i * (chartH / data.length)) + (chartH / data.length - barHeight) / 2;
    
    // Label
    const displayName = d.name.split(' ').slice(0, 2).join(' ');
    barsHtml += `<text x="${paddingLeft - 10}" y="${y + barHeight/2 + 4}" fill="var(--text-main)" font-size="11" text-anchor="end">${displayName}</text>`;
    
    let currentX = paddingLeft;
    let tooltipHtml = `<strong>${d.name} (${d.total} subtasks)</strong><br>`;
    
    Object.keys(d.activities).forEach(act => {
      const count = d.activities[act];
      if (count > 0) {
        const barWidth = (count / maxVal) * chartW;
        const color = activityColors[act] || activityColors['Outros'];
        barsHtml += `<rect x="${currentX}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" stroke="var(--bg-panel)" stroke-width="1" rx="2" style="cursor: pointer;">
          <title>${act}: ${count} tasks</title>
        </rect>`;
        currentX += barWidth;
        tooltipHtml += `<span style="color:${color}">■</span> ${act}: ${count}<br>`;
      }
    });
    
    // Total label at the end of the stacked bar
    barsHtml += `<text x="${currentX + 5}" y="${y + barHeight/2 + 4}" fill="var(--text-main)" font-size="11" font-weight="bold">${d.total}</text>`;
    
    // Add transparent rect over the entire bar for full row tooltip
    barsHtml += `<rect x="${paddingLeft}" y="${y}" width="${chartW}" height="${barHeight}" fill="transparent" class="chart-tooltip-trigger" data-tooltip="${encodeURIComponent(tooltipHtml)}"></rect>`;
  });
  
  // Render Legend
  let legendHtml = `<div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin-top: 15px; font-size: 0.8rem;">`;
  Object.keys(activityColors).forEach(act => {
    legendHtml += `<div style="display: flex; align-items: center; gap: 4px;">
      <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background-color: ${activityColors[act]};"></span>
      <span style="color: var(--text-muted);">${act}</span>
    </div>`;
  });
  legendHtml += `</div>`;
  
  container.innerHTML = `
    <div style="position: relative; width: 100%; display: flex; flex-direction: column; align-items: center;">
      <svg width="100%" viewBox="0 0 ${width} ${height}" style="overflow: visible; max-width: 600px;">
        ${axisHtml}
        ${barsHtml}
      </svg>
      ${legendHtml}
    </div>
  `;
  
  // Attach tooltip logic
  const tooltip = document.getElementById('global-tooltip') || createGlobalTooltip();
  container.querySelectorAll('.chart-tooltip-trigger').forEach(el => {
    el.addEventListener('mousemove', e => {
      tooltip.innerHTML = decodeURIComponent(el.getAttribute('data-tooltip'));
      tooltip.style.display = 'block';
      tooltip.style.left = e.pageX + 10 + 'px';
      tooltip.style.top = e.pageY + 10 + 'px';
    });
    el.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  });
}

// ---- NEXT ---- 

  if (data.length === 0) {
    container.innerHTML = `<span class="placeholder-text">Sem subtasks fechadas no período selecionado</span>`;
    return;
  }
  
  const maxVal = Math.max(...data.map(d => d.total), 4);
  
  // Render SVG horizontal stacked bars
  const width = 500;
  const height = Math.max(250, data.length * 35 + 40);
  const paddingLeft = 140;
  const paddingRight = 30;
  const paddingTop = 20;
  const paddingBottom = 40;
  
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;
  
  let axisHtml = '';
  const xTicks = 5;
  for (let i = 0; i <= xTicks; i++) {
    const val = Math.round((i / xTicks) * maxVal);
    const x = paddingLeft + (val / maxVal) * chartW;
    axisHtml += `<line x1="${x}" y1="${paddingTop}" x2="${x}" y2="${paddingTop + chartH}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="4,4"></line>`;
    axisHtml += `<text x="${x}" y="${paddingTop + chartH + 15}" fill="var(--text-muted)" font-size="10" text-anchor="middle">${val}</text>`;
  }
  
  const barHeight = 20;
  let barsHtml = '';
  
  data.forEach((d, i) => {
    const y = paddingTop + (i * (chartH / data.length)) + (chartH / data.length - barHeight) / 2;
    
    // Label
    const displayName = d.name.split(' ').slice(0, 2).join(' ');
    barsHtml += `<text x="${paddingLeft - 10}" y="${y + barHeight/2 + 4}" fill="var(--text-main)" font-size="11" text-anchor="end">${displayName}</text>`;
    
    let currentX = paddingLeft;
    let tooltipHtml = `<strong>${d.name} (${d.total} subtasks)</strong><br>`;
    
    Object.keys(d.activities).forEach(act => {
      const count = d.activities[act];
      if (count > 0) {
        const barWidth = (count / maxVal) * chartW;
        const color = activityColors[act] || activityColors['Outros'];
        barsHtml += `<rect x="${currentX}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" stroke="var(--bg-panel)" stroke-width="1" rx="2" style="cursor: pointer;">
          <title>${act}: ${count} tasks</title>
        </rect>`;
        currentX += barWidth;
        tooltipHtml += `<span style="color:${color}">■</span> ${act}: ${count}<br>`;
      }
    });
    
    // Total label at the end of the stacked bar
    barsHtml += `<text x="${currentX + 5}" y="${y + barHeight/2 + 4}" fill="var(--text-main)" font-size="11" font-weight="bold">${d.total}</text>`;
    
    // Add transparent rect over the entire bar for full row tooltip
    barsHtml += `<rect x="${paddingLeft}" y="${y}" width="${chartW}" height="${barHeight}" fill="transparent" class="chart-tooltip-trigger" data-tooltip="${encodeURIComponent(tooltipHtml)}"></rect>`;
  });
  
  // Render Legend
  let legendHtml = `<div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin-top: 15px; font-size: 0.8rem;">`;
  Object.keys(activityColors).forEach(act => {
    legendHtml += `<div style="display: flex; align-items: center; gap: 4px;">
      <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background-color: ${activityColors[act]};"></span>
      <span style="color: var(--text-muted);">${act}</span>
    </div>`;
  });
  legendHtml += `</div>`;
  
  container.innerHTML = `
    <div style="position: relative; width: 100%; display: flex; flex-direction: column; align-items: center;">
      <svg width="100%" viewBox="0 0 ${width} ${height}" style="overflow: visible; max-width: 600px;">
        ${axisHtml}
        ${barsHtml}
      </svg>
      ${legendHtml}
    </div>
  `;
  
  // Attach tooltip logic
  const tooltip = document.getElementById('global-tooltip') || createGlobalTooltip();
  container.querySelectorAll('.chart-tooltip-trigger').forEach(el => {
    el.addEventListener('mousemove', e => {
      tooltip.innerHTML = decodeURIComponent(el.getAttribute('data-tooltip'));
      tooltip.style.display = 'block';
      tooltip.style.left = e.pageX + 10 + 'px';
      tooltip.style.top = e.pageY + 10 + 'px';
    });
    el.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  });
}

function renderDeliveriesDistribution

// ---- NEXT ---- 

  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function getPercentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function renderDeliveriesByCollaboratorTasks(filteredWIs) {

// ---- NEXT ---- 

  // Attach tooltip logic
  let tooltip = document.getElementById('global-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'global-tooltip';
    tooltip.style.position = 'absolute';
    tooltip.style.display = 'none';
    tooltip.style.backgroundColor = 'var(--bg-panel)';
    tooltip.style.color = 'var(--text-main)';
    tooltip.style.border = '1px solid var(--border-color)';
    tooltip.style.padding = '8px 12px';
    tooltip.style.borderRadius = '6px';
    tooltip.style.fontSize = '0.85rem';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.zIndex = '9999';
    tooltip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    document.body.appendChild(tooltip);
  }
  
  container.querySelectorAll('.chart-tooltip-trigger').forEach(el => {
    el.addEventListener('mousemove', e => {
      tooltip.innerHTML = decodeURIComponent(el.getAttribute('data-tooltip'));
      tooltip.style.display = 'block';
      tooltip.style.left = e.pageX + 10 + 'px';
      tooltip.style.top = e.pageY + 10 + 'px';
    });
    el.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  });
}

// ---- NEXT ---- 

  // Render SVG horizontal stacked bars
  const width = 600;
  const paddingLeft = 160;
  const paddingRight = 40;
  const paddingTop = 40;
  const paddingBottom = 40;
  const barHeight = 24;
  
  const height = Math.max(250, data.length * (barHeight + 16) + paddingTop + paddingBottom);
  
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

// ---- NEXT ---- 

    <div style="position: relative; width: 100%; display: flex; flex-direction: column; align-items: center; overflow: hidden; padding-top: 10px;">
      <svg width="100%" viewBox="0 0 ${width} ${height}" style="max-width: 650px;">

// ---- NEXT ---- 



// ---- NEXT ---- 

function getPercentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

function renderDeliveriesByPersonChart(closedWIs) {
  const container = document.getElementById('chart-deliveries-by-person');
  if (!container) return;
  container.innerHTML = '';
  
  const personCounts = {};
  closedWIs.forEach(wi => {
    const delivery = g_data.entregasMap.get(wi.Id);
    const person = delivery ? delivery.ResponsavelNoFechamento : wi.Responsavel;
    const name = person && person !== 'NENHUM' && person.trim() !== '' ? person : 'Indefinido';
    personCounts[name] = (personCounts[name] || 0) + 1;
  });
  
  const data = Object.keys(personCounts).map(name => ({ name, count: personCounts[name] }))
                     .sort((a, b) => b.count - a.count);
                     
  if (data.length === 0) {
    container.innerHTML = `<span class="placeholder-text">Sem entregas no período selecionado</span>`;
    return;
  }
  
  const maxVal = Math.max(...data.map(d => d.count), 4);
  
  // Render dynamic SVG vertical bars
  const width = 500;
  const height = 220;
  const paddingLeft = 35;
  const paddingRight = 15;
  const paddingTop = 25;
  const paddingBottom = 40;
  
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;
  const barStep = chartW / data.length;
  
  let gridLines = '';
  for (let i = 0; i <= 4; i++) {
    const yVal = Math.round((maxVal / 4) * i);
    const y = paddingTop + chartH - (yVal / maxVal) * chartH;
    gridLines += `
      <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="hsla(162, 76%, 45%, 0.08)" stroke-width="1" stroke-dasharray="4,4"/>
      <text x="${paddingLeft - 8}" y="${y + 4}" fill="var(--text-muted)" font-size="9" text-anchor="end">${yVal}</text>
    `;
  }
  
  let bars = '';
  data.forEach((d, idx) => {
    const barH = (d.count / maxVal) * chartH;
    const x = paddingLeft + idx * barStep + barStep * 0.15;
    const y = paddingTop + chartH - barH;
    const barW = barStep * 0.7;
    
    // Truncate name for display
    const label = d.name.split(' ')[0]; // Use first name
    
    bars += `
      <g class="svg-bar-group" data-person="${d.name}" data-count="${d.count}">
        <rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="url(#emeraldGrad)" rx="3" ry="3" class="svg-bar"/>
        <text x="${x + barW / 2}" y="${y - 5}" fill="var(--text-main)" font-size="9.5" font-weight="600" text-anchor="middle">${d.count}</text>
        <text x="${x + barW / 2}" y="${height - paddingBottom + 16}" fill="var(--text-muted)" font-size="8.5" font-weight="500" text-anchor="middle" transform="rotate(-15, ${x + barW / 2}, ${height - paddingBottom + 16})">${label}</text>
      </g>
    `;
  });
  
  container.innerHTML = `
    <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="emeraldGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--color-flow-prerelease)"/>
          <stop offset="100%" stop-color="hsl(165, 80%, 30%)"/>
        </linearGradient>
      </defs>
      ${gridLines}
      ${bars}
      <line x1="${paddingLeft}" y1="${paddingTop + chartH}" x2="${width - paddingRight}" y2="${paddingTop + chartH}" stroke="var(--border-color)" stroke-width="1.5"/>
    </svg>
  `;
  
  // Attach click listeners to SVG bar groups for modal drill-down
  container.querySelectorAll('.svg-bar-group').forEach(group => {
    const count = parseInt(group.getAttribute('data-count'), 10);
    if (count > 0) {
      group.style.cursor = 'pointer';
      group.addEventListener('click', () => {
        const personName = group.getAttribute('data-person');
        const filtered = closedWIs.filter(wi => {
          const delivery = g_data.entregasMap.get(wi.Id);
          const person = delivery ? delivery.ResponsavelNoFechamento : wi.Responsavel;
          const name = person && person !== 'NENHUM' && person.trim() !== '' ? person : 'Indefinido';
          return name === personName;
        });
        showWorkItemsModal(`Entregas por: ${personName}`, filtered);
      });
    }
  });
}

function renderDeliveriesByCollaboratorTasks(filteredWIs) {
  const container = document.getElementById('chart-deliveries-by-person-tasks');

// ---- NEXT ---- 

  // Render SVG horizontal stacked bars
  const width = 1000;
  const paddingLeft = 160;
  const paddingRight = 40;
  const paddingTop = 40;
  const paddingBottom = 40;
  const barHeight = 24;
  
  const height = Math.max(250, data.length * (barHeight + 16) + paddingTop + paddingBottom);
  
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;
  
  let axisHtml = '';
  const xTicks = 10;
  for (let i = 0; i <= xTicks; i++) {
    const val = Math.round((i / xTicks) * maxVal);
    const x = paddingLeft + (val / maxVal) * chartW;
    axisHtml += `<line x1="${x}" y1="${paddingTop}" x2="${x}" y2="${paddingTop + chartH}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="4,4"></line>`;
    axisHtml += `<text x="${x}" y="${paddingTop + chartH + 15}" fill="var(--text-muted)" font-size="10" text-anchor="middle">${val}</text>`;
  }
  
  let barsHtml = '';
  
  data.forEach((d, i) => {
    const y = paddingTop + (i * (chartH / data.length)) + (chartH / data.length - barHeight) / 2;
    
    // Label
    const displayName = d.name.split(' ').slice(0, 2).join(' ');
    barsHtml += `<text x="${paddingLeft - 10}" y="${y + barHeight/2 + 4}" fill="var(--text-main)" font-size="11" text-anchor="end">${displayName}</text>`;
    
    let currentX = paddingLeft;
    let tooltipHtml = `<strong>${d.name} (${d.total} subtasks)</strong><br>`;
    
    Object.keys(d.activities).forEach(act => {
      const count = d.activities[act];
      if (count > 0) {
        const barWidth = (count / maxVal) * chartW;
        const color = activityColors[act] || activityColors['Outros'];
        barsHtml += `<rect x="${currentX}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" stroke="var(--bg-panel)" stroke-width="1" rx="2" style="cursor: pointer;">
          <title>${act}: ${count} tasks</title>
        </rect>`;
        currentX += barWidth;
        tooltipHtml += `<span style="color:${color}">■</span> ${act}: ${count}<br>`;
      }
    });
    
    // Total label at the end of the stacked bar
    barsHtml += `<text x="${currentX + 5}" y="${y + barHeight/2 + 4}" fill="var(--text-main)" font-size="11" font-weight="bold">${d.total}</text>`;
    
    // Add transparent rect over the entire bar for full row tooltip
    barsHtml += `<rect x="${paddingLeft}" y="${y}" width="${chartW}" height="${barHeight}" fill="transparent" class="chart-tooltip-trigger" data-tooltip="${encodeURIComponent(tooltipHtml)}"></rect>`;
  });
  
  // Render Legend
  let legendHtml = `<div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin-top: 15px; font-size: 0.8rem;">`;
  Object.keys(activityColors).forEach(act => {
    legendHtml += `<div style="display: flex; align-items: center; gap: 4px;">
      <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background-color: ${activityColors[act]};"></span>
      <span style="color: var(--text-muted);">${act}</span>
    </div>`;
  });
  legendHtml += `</div>`;
  
  container.innerHTML = `
    <div style="position: relative; width: 100%; display: flex; flex-direction: column; align-items: center; overflow: hidden; padding-top: 10px;">
      <svg width="100%" viewBox="0 0 ${width} ${height}" style="max-width: 1000px;">

// ---- NEXT ---- 

  container.innerHTML = `
    <div style="position: relative; width: 100%; display: flex; flex-direction: column; align-items: center; overflow: hidden; padding-top: 10px;">
      <svg width="100%" viewBox="0 0 ${width} ${height}" style="max-width: 1000px;">

// ---- NEXT ---- 

  const data = Object.keys(personStats).map(name => ({
    name,
    total: personStats[name].total,
    activities: personStats[name].activities
  })).sort((a, b) => b.total - a.total);
  
  if (data.length === 0) {
    container.innerHTML = `<span class="placeholder-text">Sem subtasks fechadas no período selecionado</span>`;
    return;
  }
  
  const maxVal = Math.max(...data.map(d => d.total), 4);

  // Render SVG horizontal stacked bars
  const width = 1000;

// ---- NEXT ---- 

  // Render Legend
  let legendHtml = `<div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: flex-start; margin-top: 15px; padding-left: ${paddingLeft}px; font-size: 0.8rem; margin-bottom: 20px;">`;
  Object.keys(activityColors).forEach(act => {
    legendHtml += `<div style="display: flex; align-items: center; gap: 4px;">
      <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background-color: ${activityColors[act]};"></span>
      <span style="color: var(--text-muted);">${act}</span>
    </div>`;
  });
  legendHtml += `</div>`;
  
  container.innerHTML = `
    <div style="position: relative; width: 100%; display: flex; flex-direction: column; align-items: flex-start; padding-top: 20px;">
      <svg width="100%" viewBox="0 0 ${width} ${height}" style="max-width: 1200px; overflow: visible;">
        ${axisHtml}
        ${barsHtml}
      </svg>
      ${legendHtml}
    </div>
  `;

// ---- NEXT ---- 

  // Render SVG vertical stacked bars
  const width = 800;
  const height = 300;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 40;
  const paddingBottom = 60;
  
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;
  const step = chartW / data.length;
  
  let axisHtml = '';
  for (let i = 0; i <= 4; i++) {
    const yVal = Math.round((maxVal / 4) * i);
    const y = paddingTop + chartH - (yVal / maxVal) * chartH;
    axisHtml += `<line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="4,4"></line>`;
    axisHtml += `<text x="${paddingLeft - 8}" y="${y + 4}" fill="var(--text-muted)" font-size="10" text-anchor="end">${yVal}</text>`;
  }
  
  let barsHtml = '';
  
  data.forEach((d, i) => {
    const x = paddingLeft + i * step + step * 0.15;
    const barW = step * 0.7;
    const displayName = d.name.split(' ').slice(0, 2).join(' ');
    
    // Label at the bottom
    barsHtml += `<text x="${x + barW/2}" y="${paddingTop + chartH + 18}" fill="var(--text-muted)" font-size="10" text-anchor="middle" transform="rotate(-20, ${x + barW/2}, ${paddingTop + chartH + 18})">${displayName}</text>`;
    
    let yOffset = 0;
    let tooltipHtml = `<strong>${d.name} (${d.total} subtasks)</strong><br>`;
    
    Object.keys(d.activities).forEach(act => {
      const count = d.activities[act];
      if (count > 0) {
        const barH = (count / maxVal) * chartH;
        const y = paddingTop + chartH - yOffset - barH;
        const color = activityColors[act] || activityColors['Outros'];
        barsHtml += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${color}" stroke="var(--bg-panel)" stroke-width="1" rx="2" ry="2" style="cursor: pointer;">
          <title>${act}: ${count} tasks</title>
        </rect>`;
        yOffset += barH;
        tooltipHtml += `<span style="color:${color}">■</span> ${act}: ${count}<br>`;
      }
    });
    
    // Total label at the top of the stacked bar
    barsHtml += `<text x="${x + barW/2}" y="${paddingTop + chartH - yOffset - 8}" fill="var(--text-main)" font-size="11" font-weight="bold" text-anchor="middle">${d.total}</text>`;
    
    // Add transparent rect over the entire bar column for tooltip
    barsHtml += `<rect x="${x}" y="${paddingTop}" width="${barW}" height="${chartH}" fill="transparent" class="chart-tooltip-trigger" data-tooltip="${encodeURIComponent(tooltipHtml)}"></rect>`;
  });
  
  // Render Legend
  let legendHtml = `<div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin-top: 5px; font-size: 0.8rem; margin-bottom: 5px;">`;
  Object.keys(activityColors).forEach(act => {
    legendHtml += `<div style="display: flex; align-items: center; gap: 4px;">
      <span style="display: inline-block; width: 10px; height: 10px; border-radius: 2px; background-color: ${activityColors[act]};"></span>
      <span style="color: var(--text-muted);">${act}</span>
    </div>`;
  });
  legendHtml += `</div>`;
  
  container.innerHTML = `
    <div style="position: relative; width: 100%; display: flex; flex-direction: column; align-items: center;">
      <svg width="100%" viewBox="0 0 ${width} ${height}" style="max-width: 800px;">
        ${axisHtml}
        ${barsHtml}
      </svg>
      ${legendHtml}
    </div>
  `;

// ---- NEXT ---- 

function showTasksModal(title, tasks) {
  const existing = document.getElementById('work-items-modal');
  if (existing) existing.remove();
  
  const backdrop = document.createElement('div');
  backdrop.id = 'work-items-modal';
  backdrop.className = 'modal-backdrop';
  
  let rowsHtml = '';
  if (tasks.length === 0) {
    rowsHtml = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px 0;">Nenhum item encontrado.</td></tr>`;
  } else {
    tasks.forEach(t => {
      let closeDtStr = t.DataAlteracao ? new Date(t.DataAlteracao).toLocaleDateString('pt-BR') : '-';
      let url = t.Url || '#';
      rowsHtml += `
        <tr>
          <td><a href="${url}" target="_blank" style="color: var(--color-primary); text-decoration: none; font-weight: 500;">${t.Id}</a></td>
          <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${(t.Title || '').replace(/"/g, '&quot;')}">${t.Title || ''}</td>
          <td><span class="wi-type-badge">${t.Activity || 'Outros'}</span></td>
          <td>${closeDtStr}</td>
          <td>${t.State || ''}</td>
        </tr>
      `;
    });
  }
  
  const modalHtml = `
    <div class="modal-content" style="max-width: 900px; width: 90%;">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" id="work-items-modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
          <span><strong>${tasks.length}</strong> subtasks listadas</span>
        </div>
        <div class="table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>TÍTULO</th>
                <th>ATIVIDADE</th>
                <th>DATA DE FECHAMENTO</th>
                <th>ESTADO</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
  
  backdrop.innerHTML = modalHtml;
  document.body.appendChild(backdrop);
  
  document.getElementById('work-items-modal-close').addEventListener('click', () => {
    backdrop.remove();
  });
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) backdrop.remove();
  });
}

function renderDeliveriesByCollaboratorTasks(filteredWIs) {

// ---- NEXT ---- 

    barsHtml += `<g class="svg-bar-group" data-person="${d.name}" style="cursor: pointer;">`;
    
    Object.keys(d.activities).forEach(act => {
      const count = d.activities[act];
      if (count > 0) {
        const barH = (count / maxVal) * chartH;
        const y = paddingTop + chartH - yOffset - barH;
        const color = activityColors[act] || activityColors['Outros'];
        barsHtml += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${color}" stroke="var(--bg-panel)" stroke-width="1" rx="2" ry="2">
          <title>${act}: ${count} tasks</title>
        </rect>`;
        yOffset += barH;
        tooltipHtml += `<span style="color:${color}">■</span> ${act}: ${count}<br>`;
      }
    });
    
    // Total label at the top of the stacked bar
    barsHtml += `<text x="${x + barW/2}" y="${paddingTop + chartH - yOffset - 8}" fill="var(--text-main)" font-size="11" font-weight="bold" text-anchor="middle">${d.total}</text>`;
    
    // Add transparent rect over the entire bar column for tooltip
    barsHtml += `<rect x="${x}" y="${paddingTop}" width="${barW}" height="${chartH}" fill="transparent" class="chart-tooltip-trigger" data-tooltip="${encodeURIComponent(tooltipHtml)}"></rect>`;
    
    barsHtml += `</g>`;
  });

// ---- NEXT ---- 

  // Render Legend
  let legendHtml = `<div style="display: flex; flex-direction: column; gap: 8px; justify-content: center; font-size: 0.8rem; padding-left: 20px;">`;
  Object.keys(activityColors).forEach(act => {
    legendHtml += `<div style="display: flex; align-items: center; gap: 6px;">
      <span style="display: inline-block; width: 12px; height: 12px; border-radius: 2px; background-color: ${activityColors[act]};"></span>
      <span style="color: var(--text-muted);">${act}</span>
    </div>`;
  });
  legendHtml += `</div>`;
  
  container.innerHTML = `
    <div style="position: relative; width: 100%; display: flex; flex-direction: row; align-items: center; justify-content: center;">
      <svg width="100%" viewBox="0 0 ${width} ${height}" style="max-width: 800px;">
        ${axisHtml}
        ${barsHtml}
      </svg>
      <div style="flex-shrink: 0; min-width: 140px;">
        ${legendHtml}
      </div>
    </div>
  `;
  
  // Attach tooltip logic
  let tooltip = document.getElementById('global-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.id = 'global-tooltip';
    tooltip.style.position = 'absolute';
    tooltip.style.display = 'none';
    tooltip.style.backgroundColor = 'var(--bg-panel)';
    tooltip.style.color = 'var(--text-main)';
    tooltip.style.border = '1px solid var(--border-color)';
    tooltip.style.padding = '8px 12px';
    tooltip.style.borderRadius = '6px';
    tooltip.style.fontSize = '0.85rem';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.zIndex = '9999';
    tooltip.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
    document.body.appendChild(tooltip);
  }
  
  container.querySelectorAll('.chart-tooltip-trigger').forEach(el => {
    el.addEventListener('mousemove', e => {
      tooltip.innerHTML = decodeURIComponent(el.getAttribute('data-tooltip'));
      tooltip.style.display = 'block';
      tooltip.style.left = e.pageX + 10 + 'px';
      tooltip.style.top = e.pageY + 10 + 'px';
    });
    el.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  });

  // Attach click listeners to SVG bar groups for modal drill-down
  container.querySelectorAll('.svg-bar-group').forEach(group => {
    group.addEventListener('click', () => {
      const personName = group.getAttribute('data-person');
      const filtered = validTasks.filter(t => {
        const p = t.Responsavel && t.Responsavel.trim() !== '' ? t.Responsavel : 'Indefinido';
        return p === personName;
      });
      showTasksModal(`Subtasks concluídas por: ${personName}`, filtered);
    });
  });
}

// ---- NEXT ---- 

  try {
    backdrop.innerHTML = modalHtml;
    document.body.appendChild(backdrop);
    
    document.getElementById('work-items-modal-close').addEventListener('click', () => {
      backdrop.remove();
    });
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) backdrop.remove();
    });
  } catch (err) {
    console.error("Error showing tasks modal:", err);
    alert("Error showing tasks modal: " + err.message);
  }
}

// ---- NEXT ---- 

  // Attach click listeners to SVG bar groups for modal drill-down
  container.querySelectorAll('.svg-bar-group').forEach(group => {
    group.addEventListener('click', () => {
      try {
        const personName = group.getAttribute('data-person');
        const filtered = validTasks.filter(t => {
          const p = t.Responsavel && t.Responsavel.trim() !== '' ? t.Responsavel : 'Indefinido';
          return p === personName;
        });
        showTasksModal(`Subtasks concluídas por: ${personName}`, filtered);
      } catch (err) {
        console.error("Click event error:", err);
        alert("Erro no click: " + err.message);
      }
    });
  });

// ---- NEXT ---- 

  try {
    backdrop.innerHTML = modalHtml;
    document.body.appendChild(backdrop);
    
    // Force reflow and show transition
    setTimeout(() => backdrop.classList.add('show'), 10);
    
    const closeModal = () => {
      backdrop.classList.remove('show');
      setTimeout(() => backdrop.remove(), 250);
    };
    
    document.getElementById('work-items-modal-close').addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
  } catch (err) {
    console.error("Error showing tasks modal:", err);
    alert("Error showing tasks modal: " + err.message);
  }
}

// ---- NEXT ---- 

function showTasksModal(title, tasks) {
  const existing = document.getElementById('work-items-modal');
  if (existing) existing.remove();
  
  const backdrop = document.createElement('div');
  backdrop.id = 'work-items-modal';
  backdrop.className = 'modal-backdrop';
  
  let currentPage = 1;
  const itemsPerPage = 20;
  let sortCol = 'DataAlteracao';
  let sortAsc = false;
  
  // Clone tasks so we can sort them safely
  let currentTasks = [...tasks];
  
  const renderTable = () => {
    // Sort
    currentTasks.sort((a, b) => {
      let valA = a[sortCol] || '';
      let valB = b[sortCol] || '';
      if (sortCol === 'TaskId') {
        valA = parseInt(valA) || 0;
        valB = parseInt(valB) || 0;
      }
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });
    
    // Paginate
    const totalPages = Math.ceil(currentTasks.length / itemsPerPage) || 1;
    if (currentPage > totalPages) currentPage = totalPages;
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const pageTasks = currentTasks.slice(startIdx, endIdx);
    
    let rowsHtml = '';
    if (pageTasks.length === 0) {
      rowsHtml = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px 0;">Nenhum item encontrado.</td></tr>`;
    } else {
      pageTasks.forEach(t => {
        let closeDtStr = t.DataAlteracao ? new Date(t.DataAlteracao).toLocaleDateString('pt-BR') : '-';
        let activity = t.Activity && t.Activity.trim() !== '' ? t.Activity : 'INDEFINIDO';
        rowsHtml += `
          <tr>
            <td><a href="#" class="wi-drill-link" data-wi-id="${t.TaskId}" style="color: var(--color-primary); font-weight: 500;">${t.TaskId}</a></td>
            <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${(t.Titulo || '').replace(/"/g, '&quot;')}">${t.Titulo || ''}</td>
            <td><span class="wi-type-badge">${activity}</span></td>
            <td>${closeDtStr}</td>
            <td>${t.State || ''}</td>
          </tr>
        `;
      });
    }
    
    const sortIcon = (col) => sortCol === col ? (sortAsc ? ' ↑' : ' ↓') : '';
    
    let paginationHtml = '';
    if (totalPages > 1) {
      paginationHtml = `
        <div style="display: flex; justify-content: flex-end; align-items: center; gap: 10px; margin-top: 10px;">
          <button id="modal-btn-prev" style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-panel); color: var(--text-main); cursor: pointer;" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>
          <span style="font-size: 0.85rem; color: var(--text-muted);">Página ${currentPage} de ${totalPages}</span>
          <button id="modal-btn-next" style="padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-panel); color: var(--text-main); cursor: pointer;" ${currentPage === totalPages ? 'disabled' : ''}>Próxima</button>
        </div>
      `;
    }
    
    const modalHtml = `
      <div class="modal-content" style="max-width: 900px; width: 90%;">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" id="work-items-modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
            <span><strong>${currentTasks.length}</strong> subtasks listadas</span>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="cursor: pointer;" data-sort="TaskId">ID${sortIcon('TaskId')}</th>
                  <th style="cursor: pointer;" data-sort="Titulo">TÍTULO${sortIcon('Titulo')}</th>
                  <th style="cursor: pointer;" data-sort="Activity">ATIVIDADE${sortIcon('Activity')}</th>
                  <th style="cursor: pointer;" data-sort="DataAlteracao">DATA DE FECHAMENTO${sortIcon('DataAlteracao')}</th>
                  <th style="cursor: pointer;" data-sort="State">ESTADO${sortIcon('State')}</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
          ${paginationHtml}
        </div>
      </div>
    `;
    
    backdrop.innerHTML = modalHtml;
    
    // Attach events for this render
    document.getElementById('work-items-modal-close').addEventListener('click', closeModal);
    
    backdrop.querySelectorAll('th[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-sort');
        if (sortCol === col) {
          sortAsc = !sortAsc;
        } else {
          sortCol = col;
          sortAsc = true;
        }
        renderTable();
      });
    });
    
    if (totalPages > 1) {
      document.getElementById('modal-btn-prev').addEventListener('click', () => {
        if (currentPage > 1) { currentPage--; renderTable(); }
      });
      document.getElementById('modal-btn-next').addEventListener('click', () => {
        if (currentPage < totalPages) { currentPage++; renderTable(); }
      });
    }
  };
  
  const closeModal = () => {
    backdrop.classList.remove('show');
    setTimeout(() => backdrop.remove(), 250);
  };
  
  try {
    document.body.appendChild(backdrop);
    renderTable();
    
    // Force reflow and show transition
    setTimeout(() => backdrop.classList.add('show'), 10);
    
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });
  } catch (err) {
    console.error("Error showing tasks modal:", err);
    alert("Error showing tasks modal: " + err.message);
  }
}

// ---- NEXT ---- 

  const personStats = {};
  
  validTasks.forEach(t => {
    const person = t.Responsavel && t.Responsavel.trim() !== '' ? t.Responsavel : 'Indefinido';
    let act = t.Activity && t.Activity.trim() !== '' ? t.Activity : 'INDEFINIDO';
    
    if (!personStats[person]) personStats[person] = { total: 0, activities: {} };
    if (!personStats[person].activities[act]) personStats[person].activities[act] = 0;
    
    personStats[person].activities[act]++;
    personStats[person].total++;
  });
  
  const data = Object.keys(personStats).map(name => ({
    name,
    total: personStats[name].total,
    activities: personStats[name].activities
  })).sort((a, b) => b.total - a.total);
  
  if (data.length === 0) {
    container.innerHTML = `<span class="placeholder-text">Sem subtasks fechadas no período selecionado</span>`;
    return;
  }
  
  // Helper for dynamic colors
  const getColorForActivity = (act) => {
    if (activityColors[act]) return activityColors[act];
    if (act === 'INDEFINIDO') return '#8e8e93';
    let hash = 0;
    for (let i = 0; i < act.length; i++) hash = act.charCodeAt(i) + ((hash << 5) - hash);
    const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
  };
  
  // Collect all activities present
  const presentActivities = new Set();
  data.forEach(d => Object.keys(d.activities).forEach(act => presentActivities.add(act)));

// ---- NEXT ---- 

        const barH = (count / maxVal) * chartH;
        const y = paddingTop + chartH - yOffset - barH;
        const color = getColorForActivity(act);
        barsHtml += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${color}" stroke="var(--bg-panel)" stroke-width="1" rx="2" ry="2">

// ---- NEXT ---- 

  // Render Legend
  let legendHtml = `<div style="display: flex; flex-direction: column; gap: 8px; justify-content: center; font-size: 0.8rem; padding-left: 20px;">`;
  Array.from(presentActivities).sort().forEach(act => {
    legendHtml += `<div style="display: flex; align-items: center; gap: 6px;">
      <span style="display: inline-block; width: 12px; height: 12px; border-radius: 2px; background-color: ${getColorForActivity(act)};"></span>
      <span style="color: var(--text-muted);">${act}</span>
    </div>`;
  });
  legendHtml += `</div>`;

// ---- NEXT ---- 

let g_currentRetransitions = [];
let g_retransitionsPage = 0;

function renderRetransitionsTimeline(filteredWIs) {
  // Normal workflow order
  const colOrder = [
    'Ideias', 'Backlog', 'Fazendo Análise', 'Disponível para Dev', 'Dev implementando',
    'Disponível Revisão de Código', 'Realizando Revisão de Código', 'Disponível para Teste',
    'Testando', 'Aguardando pipeline', 'Pronto pra Release', 'Concluído'
  ];
  
  // Normalize strings by removing accents and making them lowercase alphanumeric
  const cleanStr = (s) => s ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').toLowerCase() : '';
  
  const colIndex = {};
  colOrder.forEach((c, idx) => colIndex[cleanStr(c)] = idx);
  
  const retransitions = [];
  
  filteredWIs.forEach(wi => {
    const trans = g_data.transicoesByWi.get(wi.Id) || [];
    trans.forEach(t => {
      if (t.Campo === 'BoardColumn') {
        const fromIdx = colIndex[cleanStr(t.De)];
        const toIdx = colIndex[cleanStr(t.Para)];
        
        // If moving backwards in index order, it is a rework transition!
        if (fromIdx !== undefined && toIdx !== undefined && toIdx < fromIdx) {
          retransitions.push({
            wiId: wi.Id,
            wiTitle: wi.Titulo,
            wiType: wi.Tipo,
            from: t.De,
            to: t.Para,
            by: t.Por,
            date: t.DataMudanca,
            days: t.DuracaoDias
          });
        }
      }
    });
  });
  
  g_currentRetransitions = retransitions.sort((a, b) => new Date(b.date) - new Date(a.date));
  g_retransitionsPage = 0;
  
  renderRetransitionsPage();
}

function renderRetransitionsPage() {
  const container = document.getElementById('flow-transition-timeline');
  container.innerHTML = '';
  
  if (g_currentRetransitions.length === 0) {
    container.innerHTML = `<div class="placeholder-text" style="color: var(--text-muted); font-size: 0.85rem; padding: 20px 0; text-align: center;">Nenhuma movimentação de retrabalho (retransição para trás) identificada no período.</div>`;
    return;
  }
  
  const itemsPerPage = 6;
  const totalPages = Math.ceil(g_currentRetransitions.length / itemsPerPage);
  const startIdx = g_retransitionsPage * itemsPerPage;
  const pageItems = g_currentRetransitions.slice(startIdx, startIdx + itemsPerPage);
  
  let html = '';
  pageItems.forEach(rt => {
    const dt = new Date(rt.date);
    const typeBadge = rt.wiType === 'Bug' ? 'badge-rose' : 'badge-purple';
    
    html += `
      <div style="padding: 12px; background-color: hsla(252, 31%, 6%, 0.3); border-radius: 8px; border-left: 4px solid var(--color-danger); margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 4px;">
            <a href="#" class="drill-link" data-wi-id="${rt.wiId}">#${rt.wiId}</a>
            <span class="badge ${typeBadge}" style="font-size: 0.65rem; padding: 1px 4px; margin-left: 6px;">${rt.wiType}</span>
            <strong style="margin-left: 8px; color: var(--text-main);">${rt.wiTitle}</strong>
          </div>
          <div style="font-size: 0.85rem;">
            Retornou de <span style="color: var(--color-flow-handoff); font-weight: 500;">${rt.from}</span> 
            para <span style="color: var(--color-flow-trabalho); font-weight: 500;">${rt.to}</span>
          </div>
        </div>
        <div style="text-align: right; font-size: 0.75rem; color: var(--text-muted);">
          <div>Por: <strong>${rt.by}</strong></div>
          <div>${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>
    `;
  });
  
  let paginationHtml = '';
  if (totalPages > 1) {
    paginationHtml = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; padding-top: 10px; border-top: 1px solid var(--border-light);">
        <button id="btn-retrans-prev" class="btn btn-sm btn-secondary" ${g_retransitionsPage === 0 ? 'disabled' : ''}>Anterior</button>
        <span style="font-size: 0.8rem; color: var(--text-muted);">Página ${g_retransitionsPage + 1} de ${totalPages} (${g_currentRetransitions.length} itens no período)</span>
        <button id="btn-retrans-next" class="btn btn-sm btn-secondary" ${g_retransitionsPage === totalPages - 1 ? 'disabled' : ''}>Próxima</button>
      </div>
    `;
  }
  
  container.innerHTML = `
    <div style="text-align: left; padding: 10px 0;">
      <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px;">Identificação de atritos no fluxo (itens que voltaram etapas no board):</p>
      ${html}
      ${paginationHtml}
    </div>
  `;
  
  // Attach links
  container.querySelectorAll('.drill-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const id = link.getAttribute('data-wi-id');
      navigateToPage('drilldown', () => { g_selectedDrillDownId = id; });
    });
  });
  
  if (totalPages > 1) {
    const btnPrev = document.getElementById('btn-retrans-prev');
    const btnNext = document.getElementById('btn-retrans-next');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (g_retransitionsPage > 0) {
          g_retransitionsPage--;
          renderRetransitionsPage();
        }
      });
    }
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (g_retransitionsPage < totalPages - 1) {
          g_retransitionsPage++;
          renderRetransitionsPage();
        }
      });
    }
  }
}

// ---- NEXT ---- 

  // Attach links
  container.querySelectorAll('.drill-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const id = link.getAttribute('data-wi-id');
      navigateToPage('drilldown', () => { g_selectedDrillDownId = id; });
    });
  });
  
  if (totalPages > 1) {
    const btnPrev = document.getElementById('btn-retrans-prev');
    const btnNext = document.getElementById('btn-retrans-next');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (g_retransitionsPage > 0) {
          g_retransitionsPage--;
          renderRetransitionsPage();
        }
      });
    }
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (g_retransitionsPage < totalPages - 1) {
          g_retransitionsPage++;
          renderRetransitionsPage();
        }
      });
    }
  }
}

// 10.5 COMPOSITION CHART RENDERER (BUGS VS USER STORIES DONUT)

// ---- NEXT ---- 

      <td><strong style="color: var(--color-warning);">${row.HoursInCol.toFixed(0)}h</strong></td>
      <td>${row.DiasAberto}d</td>
    `;
    
    tr.querySelector('.wi-drill-link').addEventListener('click', (e) => {
      e.preventDefault();
      const id = e.target.getAttribute('data-wi-id');
      navigateToPage('drilldown', () => { g_selectedDrillDownId = id; });
    });
    
    tbody.appendChild(tr);
  }, (count) => {
    document.getElementById('lbl-flow-wip-count').textContent = `${count} itens ativos`;
  });
}

let g_currentRetransitions = [];
let g_retransitionsPage = 0;

// ---- NEXT ---- 

    if (colInfo.TipoFluxo === 'fila') barColor = 'var(--color-flow-fila)';
    else if (colInfo.TipoFluxo === 'trabalho') barColor = 'var(--color-flow-trabalho)';
    else if (colInfo.TipoFluxo === 'aguardando') barColor = 'var(--color-flow-aguardando)';
    else if (colInfo.TipoFluxo === 'handoff') barColor = 'var(--color-flow-handoff)';

// ---- NEXT ---- 

let g_currentRetransitions = [];
let g_retransitionsPage = 0;

let g_currentSkippedFlows = [];
let g_skippedFlowsPage = 0;

// ---- NEXT ---- 

    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (g_retransitionsPage < totalPages - 1) {
          g_retransitionsPage++;
          renderRetransitionsPage();
        }
      });
    }
  }
}

function renderSkippedFlowsTimeline(filteredWIs) {
  // Normal workflow order
  const colOrder = [
    'Ideias', 'Backlog', 'Fazendo Análise', 'Disponível para Dev', 'Dev implementando',
    'Disponível Revisão de Código', 'Realizando Revisão de Código', 'Disponível para Teste',
    'Testando', 'Aguardando pipeline', 'Pronto pra Release', 'Concluído'
  ];
  
  const cleanStr = (s) => s ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').toLowerCase() : '';
  
  const colIndex = {};
  colOrder.forEach((c, idx) => colIndex[cleanStr(c)] = idx);
  
  const skippedFlows = [];
  
  filteredWIs.forEach(wi => {
    const trans = g_data.transicoesByWi.get(wi.Id) || [];
    trans.forEach(t => {
      if (t.Campo === 'BoardColumn') {
        const fromIdx = colIndex[cleanStr(t.De)];
        const toIdx = colIndex[cleanStr(t.Para)];
        
        if (fromIdx !== undefined && toIdx !== undefined && toIdx > fromIdx + 1) {
          // Check for allowed skip: from (Backlog or Fazendo Análise) to Concluído
          const isAllowedSkip = (t.De === 'Backlog' || t.De === 'Fazendo Análise') && t.Para === 'Concluído';
          
          if (!isAllowedSkip) {
            skippedFlows.push({
              wiId: wi.Id,
              wiTitle: wi.Titulo,
              wiType: wi.Tipo,
              from: t.De,
              to: t.Para,
              by: t.Por,
              date: t.DataMudanca
            });
          }
        }
      }
    });
  });
  
  g_currentSkippedFlows = skippedFlows.sort((a, b) => new Date(b.date) - new Date(a.date));
  g_skippedFlowsPage = 0;
  
  renderSkippedFlowsPage();
}

function renderSkippedFlowsPage() {
  const container = document.getElementById('flow-skipped-timeline');
  if (!container) return;
  container.innerHTML = '';
  
  if (g_currentSkippedFlows.length === 0) {
    container.innerHTML = `<div class="placeholder-text" style="color: var(--text-muted); font-size: 0.85rem; padding: 20px 0; text-align: center;">Nenhum fluxo anormal (salto de etapas) identificado no período.</div>`;
    return;
  }
  
  const itemsPerPage = 6;
  const totalPages = Math.ceil(g_currentSkippedFlows.length / itemsPerPage);
  const startIdx = g_skippedFlowsPage * itemsPerPage;
  const pageItems = g_currentSkippedFlows.slice(startIdx, startIdx + itemsPerPage);
  
  let html = '';
  pageItems.forEach(rt => {
    const dt = new Date(rt.date);
    const typeBadge = rt.wiType === 'Bug' ? 'badge-rose' : 'badge-purple';
    
    html += `
      <div style="padding: 12px; background-color: hsla(30, 100%, 50%, 0.1); border-radius: 8px; border-left: 4px solid var(--color-warning); margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 4px;">
            <a href="#" class="drill-link" data-wi-id="${rt.wiId}">#${rt.wiId}</a>
            <span class="badge ${typeBadge}" style="font-size: 0.65rem; padding: 1px 4px; margin-left: 6px;">${rt.wiType}</span>
            <strong style="margin-left: 8px; color: var(--text-main);">${rt.wiTitle}</strong>
          </div>
          <div style="font-size: 0.85rem;">
            Pulou etapas! De <span style="color: var(--color-flow-handoff); font-weight: 500;">${rt.from}</span> 
            para <span style="color: var(--color-flow-trabalho); font-weight: 500;">${rt.to}</span>
          </div>
        </div>
        <div style="text-align: right; font-size: 0.75rem; color: var(--text-muted);">
          <div>Por: <strong>${rt.by}</strong></div>
          <div>${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
        </div>
      </div>
    `;
  });
  
  let paginationHtml = '';
  if (totalPages > 1) {
    paginationHtml = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; padding-top: 10px; border-top: 1px solid var(--border-light);">
        <button id="btn-skip-prev" class="btn btn-sm btn-secondary" ${g_skippedFlowsPage === 0 ? 'disabled' : ''}>Anterior</button>
        <span style="font-size: 0.8rem; color: var(--text-muted);">Página ${g_skippedFlowsPage + 1} de ${totalPages} (${g_currentSkippedFlows.length} itens no período)</span>
        <button id="btn-skip-next" class="btn btn-sm btn-secondary" ${g_skippedFlowsPage === totalPages - 1 ? 'disabled' : ''}>Próxima</button>
      </div>
    `;
  }
  
  container.innerHTML = `
    <div style="text-align: left; padding: 10px 0;">
      <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px;">Identificação de cartões que pularam colunas sequenciais (com exceção de Backlog/Análise -> Concluído):</p>
      ${html}
      ${paginationHtml}
    </div>
  `;
  
  // Attach links
  container.querySelectorAll('.drill-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const id = link.getAttribute('data-wi-id');
      navigateToPage('drilldown', () => { g_selectedDrillDownId = id; });
    });
  });
  
  if (totalPages > 1) {
    const btnPrev = document.getElementById('btn-skip-prev');
    const btnNext = document.getElementById('btn-skip-next');
    if (btnPrev) {
      btnPrev.addEventListener('click', () => {
        if (g_skippedFlowsPage > 0) {
          g_skippedFlowsPage--;
          renderSkippedFlowsPage();
        }
      });
    }
    if (btnNext) {
      btnNext.addEventListener('click', () => {
        if (g_skippedFlowsPage < totalPages - 1) {
          g_skippedFlowsPage++;
          renderSkippedFlowsPage();
        }
      });
    }
  }
}

// ---- NEXT ---- 

function renderRetransitionsTimeline(filteredWIs) {
  // Normal workflow order
  const colOrder = [
    'Ideias', 'Backlog', 'Fazendo Análise', 'Disponível para Dev', 'Dev implementando',
    'Disponível Revisão de Código', 'Realizando Revisão de Código', 'Disponível para Teste',
    'Testando', 'Aguardando pipeline', 'Pronto pra Release', 'Concluído'
  ];
  
  // Normalize strings by removing accents and making them lowercase alphanumeric
  const cleanStr = (s) => s ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').toLowerCase() : '';
  
  const colIndex = {};
  colOrder.forEach((c, idx) => colIndex[cleanStr(c)] = idx);

  // Calcular janela de datas do filtro ativo
  const dateRange = document.getElementById('filter-date-range').value;
  const today = new Date(TODAY_ANCHOR);
  let startDateMs = 0;
  let endDateMs = today.getTime();
  if (dateRange !== 'all') {
    if (dateRange === 'this-month') {
      startDateMs = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
    } else if (dateRange === 'last-month') {
      startDateMs = new Date(today.getFullYear(), today.getMonth() - 1, 1).getTime();
      endDateMs = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59).getTime();
    } else if (dateRange === 'this-year') {
      startDateMs = new Date(today.getFullYear(), 0, 1).getTime();
    } else if (dateRange === 'last-year') {
      startDateMs = new Date(today.getFullYear() - 1, 0, 1).getTime();
      endDateMs = new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59).getTime();
    } else {
      const days = parseInt(dateRange, 10);
      startDateMs = today.getTime() - days * 24 * 60 * 60 * 1000;
    }
  }
  
  const retransitions = [];
  
  filteredWIs.forEach(wi => {
    const trans = g_data.transicoesByWi.get(wi.Id) || [];
    trans.forEach(t => {
      if (t.Campo === 'BoardColumn') {
        const fromIdx = colIndex[cleanStr(t.De)];
        const toIdx = colIndex[cleanStr(t.Para)];
        
        // If moving backwards in index order, it is a rework transition!
        if (fromIdx !== undefined && toIdx !== undefined && toIdx < fromIdx) {
          // Filtrar pela data da transição dentro do período analisado
          const transDateMs = t.DataMudanca ? new Date(t.DataMudanca).getTime() : 0;
          if (transDateMs < startDateMs || transDateMs > endDateMs) return;

          retransitions.push({
            wiId: wi.Id,
            wiTitle: wi.Titulo,
            wiType: wi.Tipo,
            from: t.De,
            to: t.Para,
            by: t.Por,
            date: t.DataMudanca,
            days: t.DuracaoDias
          });
        }
      }
    });
  });
  
  g_currentRetransitions = retransitions.sort((a, b) => new Date(b.date) - new Date(a.date));
  g_retransitionsPage = 0;
  
  renderRetransitionsPage();
}


// ---- NEXT ---- 

function renderSkippedFlowsTimeline(filteredWIs) {
  // Normal workflow order
  const colOrder = [
    'Ideias', 'Backlog', 'Fazendo Análise', 'Disponível para Dev', 'Dev implementando',
    'Disponível Revisão de Código', 'Realizando Revisão de Código', 'Disponível para Teste',
    'Testando', 'Aguardando pipeline', 'Pronto pra Release', 'Concluído'
  ];
  
  const cleanStr = (s) => s ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]/gi, '').toLowerCase() : '';
  
  const colIndex = {};
  colOrder.forEach((c, idx) => colIndex[cleanStr(c)] = idx);

  // Calcular janela de datas do filtro ativo
  const dateRange = document.getElementById('filter-date-range').value;
  const today = new Date(TODAY_ANCHOR);
  let startDateMs = 0;
  let endDateMs = today.getTime();
  if (dateRange !== 'all') {
    if (dateRange === 'this-month') {
      startDateMs = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
    } else if (dateRange === 'last-month') {
      startDateMs = new Date(today.getFullYear(), today.getMonth() - 1, 1).getTime();
      endDateMs = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59).getTime();
    } else if (dateRange === 'this-year') {
      startDateMs = new Date(today.getFullYear(), 0, 1).getTime();
    } else if (dateRange === 'last-year') {
      startDateMs = new Date(today.getFullYear() - 1, 0, 1).getTime();
      endDateMs = new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59).getTime();
    } else {
      const days = parseInt(dateRange, 10);
      startDateMs = today.getTime() - days * 24 * 60 * 60 * 1000;
    }
  }
  
  const skippedFlows = [];
  
  filteredWIs.forEach(wi => {
    const trans = g_data.transicoesByWi.get(wi.Id) || [];
    trans.forEach(t => {
      if (t.Campo === 'BoardColumn') {
        const fromIdx = colIndex[cleanStr(t.De)];
        const toIdx = colIndex[cleanStr(t.Para)];
        
        if (fromIdx !== undefined && toIdx !== undefined && toIdx > fromIdx + 1) {
          // Check for allowed skip: from (Backlog or Fazendo Análise) to Concluído
          const isAllowedSkip = (t.De === 'Backlog' || t.De === 'Fazendo Análise') && t.Para === 'Concluído';
          
          if (!isAllowedSkip) {
            // Filtrar pela data da transição dentro do período analisado
            const transDateMs = t.DataMudanca ? new Date(t.DataMudanca).getTime() : 0;
            if (transDateMs < startDateMs || transDateMs > endDateMs) return;

            skippedFlows.push({
              wiId: wi.Id,
              wiTitle: wi.Titulo,
              wiType: wi.Tipo,
              from: t.De,
              to: t.Para,
              by: t.Por,
              date: t.DataMudanca
            });
          }
        }
      }
    });
  });
  
  g_currentSkippedFlows = skippedFlows.sort((a, b) => new Date(b.date) - new Date(a.date));
  g_skippedFlowsPage = 0;
  
  renderSkippedFlowsPage();
}


// ---- NEXT ---- 

    // Sort
    currentTasks.sort((a, b) => {
      let valA = a[sortCol] || '';
      let valB = b[sortCol] || '';
      if (sortCol === 'TaskId') {
        valA = parseInt(valA) || 0;
        valB = parseInt(valB) || 0;
      } else if (sortCol === 'CompletedWork') {
        valA = parseFloat(valA) || 0;
        valB = parseFloat(valB) || 0;
      }
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

// ---- NEXT ---- 

            <td><a href="#" class="wi-drill-link" data-wi-id="${t.TaskId}" style="color: var(--color-primary); font-weight: 500;">${t.TaskId}</a></td>
            <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${(t.Titulo || '').replace(/"/g, '&quot;')}">${t.Titulo || ''}</td>
            <td><span class="wi-type-badge">${activity}</span></td>
            <td>${closeDtStr}</td>
            <td>${(t.CompletedWork || 0).toFixed(1)}h</td>
          </tr>

// ---- NEXT ---- 

                  <th style="cursor: pointer;" data-sort="TaskId">ID${sortIcon('TaskId')}</th>
                  <th style="cursor: pointer;" data-sort="Titulo">TÍTULO${sortIcon('Titulo')}</th>
                  <th style="cursor: pointer;" data-sort="Activity">ATIVIDADE${sortIcon('Activity')}</th>
                  <th style="cursor: pointer;" data-sort="DataAlteracao">DATA DE FECHAMENTO${sortIcon('DataAlteracao')}</th>
                  <th style="cursor: pointer;" data-sort="CompletedWork">HORAS CONCLUÍDAS${sortIcon('CompletedWork')}</th>
                </tr>

// ---- NEXT ---- 

            <td><a href="#" class="wi-drill-link" data-wi-id="${t.TaskId}" style="color: var(--color-primary); font-weight: 500;">${t.TaskId}</a></td>
            <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${(t.Titulo || '').replace(/"/g, '&quot;')}">${t.Titulo || ''}</td>
            <td><span class="wi-type-badge">${activity}</span></td>
            <td>${closeDtStr}</td>
            <td>${(parseFloat(t.CompletedWork) || 0).toFixed(1)}h</td>
          </tr>

// ---- NEXT ---- 

      tr.querySelector('.wi-drill-link').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        g_selectedDrillDownId = String(a.id);
        navigateToPage('drilldown');
      });
    }
    
    tbody.appendChild(tr);
  });
  
  if (panel) {
    panel.onclick = () => {
      navigateToPage('alerts');
    };
  }
}


// ============================================================================
// Produtividade: Modal de Detalhes de Tarefas e Atendimentos
// ============================================================================
let g_productivityDetailsData = [];
let g_productivityDetailsPage = 1;
let g_productivityDetailsSort = { column: 'date', direction: 'desc' };
const PRODUCTIVITY_PAGE_SIZE = 10;

function openProductivityDetailsModal(person) {
  g_productivityDetailsData = [];
  g_productivityDetailsPage = 1;

  // Extrair tasks
  const filteredWIs = getFilteredWorkItems();
  filteredWIs.forEach(wi => {
    const tasks = g_data.tasksByParent.get(wi.Id) || [];
    tasks.forEach(t => {
      const resp = t.Responsavel ? t.Responsavel.trim() : '';
      if (resp === person && (t.CompletedWork || 0) > 0) {
        const d = new Date(t.DataAlteracao || t.DataCriacao || 0);
        g_productivityDetailsData.push({
          id: t.TaskId || '-',
          type: 'Task (' + (wi.Tipo || '-') + ')',
          title: t.Titulo || '-',
          hours: t.CompletedWork || 0,
          date: d,
          dateStr: isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR')
        });
      }
    });
  });

  // Extrair atendimentos
  const filteredAtendimentos = getFilteredAtendimentos();
  filteredAtendimentos.forEach(at => {
    const resp = at.Responsavel ? at.Responsavel.trim() : '';
    if (resp === person && (at.CompletedWork || 0) > 0) {
      const d = new Date(at.ClosedDate || at.DataAlteracao || 0);
      g_productivityDetailsData.push({
        id: at.Id || '-',
        type: 'Atendimento',
        title: at.Titulo || '-',
        hours: at.CompletedWork || 0,
        date: d,
        dateStr: isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR')
      });
    }
  });

  document.getElementById('productivity-modal-title').textContent = 'Detalhes de Produtividade: ' + person;
  document.getElementById('productivity-details-modal').classList.remove('hidden');

  const btnClose = document.getElementById('btn-close-productivity-modal');
  if (btnClose && !btnClose.dataset.bound) {
    btnClose.dataset.bound = "true";
    btnClose.addEventListener('click', closeProductivityDetailsModal);
  }
  
  const modalOverlay = document.getElementById('productivity-details-modal');
  if (modalOverlay && !modalOverlay.dataset.bound) {
    modalOverlay.dataset.bound = "true";
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeProductivityDetailsModal();
    });
  }

  sortAndRenderProductivityDetails();
}

function closeProductivityDetailsModal() {
  document.getElementById('productivity-details-modal').classList.add('hidden');
}

function sortProductivityDetailsModal(column) {
  if (g_productivityDetailsSort.column === column) {
    g_productivityDetailsSort.direction = g_productivityDetailsSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    g_productivityDetailsSort.column = column;
    g_productivityDetailsSort.direction = 'asc';
  }

  // Atualiza ícones
  const headers = ['id', 'type', 'title', 'hours', 'date'];
  headers.forEach(h => {
    const icon = document.getElementById('sort-prod-icon-' + h);
    if (icon) icon.innerHTML = '';
  });
  const activeIcon = document.getElementById('sort-prod-icon-' + column);
  if (activeIcon) {
    activeIcon.innerHTML = g_productivityDetailsSort.direction === 'asc' ? '&#9652;' : '&#9662;';
  }

  sortAndRenderProductivityDetails();
}

function changeProductivityDetailsPage(delta) {
  const maxPage = Math.ceil(g_productivityDetailsData.length / PRODUCTIVITY_PAGE_SIZE) || 1;
  let newPage = g_productivityDetailsPage + delta;
  if (newPage < 1) newPage = 1;
  if (newPage > maxPage) newPage = maxPage;
  
  if (newPage !== g_productivityDetailsPage) {
    g_productivityDetailsPage = newPage;
    renderProductivityDetailsModal();
  }
}

function sortAndRenderProductivityDetails() {
  const col = g_productivityDetailsSort.column;
  const dir = g_productivityDetailsSort.direction === 'asc' ? 1 : -1;

  g_productivityDetailsData.sort((a, b) => {
    if (col === 'id') return (String(a.id).localeCompare(String(b.id))) * dir;
    if (col === 'type') return (a.type.localeCompare(b.type)) * dir;
    if (col === 'title') return (a.title.localeCompare(b.title)) * dir;
    if (col === 'hours') return (a.hours - b.hours) * dir;
    if (col === 'date') return (a.date.getTime() - b.date.getTime()) * dir;
    return 0;
  });

  g_productivityDetailsPage = 1;
  renderProductivityDetailsModal();
}

function renderProductivityDetailsModal() {
  const tbody = document.getElementById('productivity-modal-tbody');
  tbody.innerHTML = '';

  const total = g_productivityDetailsData.length;
  if (total === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">Nenhum registro encontrado no período filtrado.</td></tr>';
    document.getElementById('productivity-modal-info').textContent = 'Mostrando 0 de 0';
    document.getElementById('productivity-modal-page').textContent = 'Pág 1';
    return;
  }

  const maxPage = Math.ceil(total / PRODUCTIVITY_PAGE_SIZE);
  if (g_productivityDetailsPage > maxPage) g_productivityDetailsPage = maxPage;
  
  const startIdx = (g_productivityDetailsPage - 1) * PRODUCTIVITY_PAGE_SIZE;
  const endIdx = Math.min(startIdx + PRODUCTIVITY_PAGE_SIZE, total);

  const pageData = g_productivityDetailsData.slice(startIdx, endIdx);

  pageData.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.id}</td>
      <td>${item.type}</td>
      <td title="${item.title}" style="max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.title}</td>
      <td style="text-align:right; font-weight:600;">${item.hours.toFixed(1)}h</td>
      <td style="text-align:center;">${item.dateStr}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('productivity-modal-info').textContent = 'Mostrando ' + (startIdx + 1) + ' a ' + endIdx + ' de ' + total;
  document.getElementById('productivity-modal-page').textContent = 'Pág ' + g_productivityDetailsPage + ' de ' + maxPage;
  
  document.getElementById('btn-prod-modal-prev').disabled = g_productivityDetailsPage === 1;
  document.getElementById('btn-prod-modal-next').disabled = g_productivityDetailsPage === maxPage;
}

// ---- NEXT ---- 

    tbody.appendChild(tr);
  });
  
  if (panel) {
    panel.onclick = () => {
      navigateToPage('alerts');
    };
  }
}

// ============================================================================
// Produtividade: Modal de Detalhes de Tarefas e Atendimentos
// ============================================================================
let g_productivityDetailsData = [];
let g_productivityDetailsPage = 1;
let g_productivityDetailsSort = { column: 'date', direction: 'desc' };
const PRODUCTIVITY_PAGE_SIZE = 10;

function openProductivityDetailsModal(person) {
  g_productivityDetailsData = [];
  g_productivityDetailsPage = 1;

  // Extrair tasks
  const filteredWIs = getFilteredWorkItems();
  filteredWIs.forEach(wi => {
    const tasks = g_data.tasksByParent.get(wi.Id) || [];
    tasks.forEach(t => {
      const resp = t.Responsavel ? t.Responsavel.trim() : '';
      if (resp === person && (t.CompletedWork || 0) > 0) {
        const d = new Date(t.DataAlteracao || t.DataCriacao || 0);
        g_productivityDetailsData.push({
          id: t.TaskId || '-',
          type: 'Task (' + (wi.Tipo || '-') + ')',
          title: t.Titulo || '-',
          hours: t.CompletedWork || 0,
          date: d,
          dateStr: isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR')
        });
      }
    });
  });

  // Extrair atendimentos
  const filteredAtendimentos = getFilteredAtendimentos();
  filteredAtendimentos.forEach(at => {
    const resp = at.Responsavel ? at.Responsavel.trim() : '';
    if (resp === person && (at.CompletedWork || 0) > 0) {
      const d = new Date(at.ClosedDate || at.DataAlteracao || 0);
      g_productivityDetailsData.push({
        id: at.Id || '-',
        type: 'Atendimento',
        title: at.Titulo || '-',
        hours: at.CompletedWork || 0,
        date: d,
        dateStr: isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR')
      });
    }
  });

  document.getElementById('productivity-modal-title').textContent = 'Detalhes de Produtividade: ' + person;
  document.getElementById('productivity-details-modal').classList.remove('hidden');

  const btnClose = document.getElementById('btn-close-productivity-modal');
  if (btnClose && !btnClose.dataset.bound) {
    btnClose.dataset.bound = "true";
    btnClose.addEventListener('click', closeProductivityDetailsModal);
  }
  
  const modalOverlay = document.getElementById('productivity-details-modal');
  if (modalOverlay && !modalOverlay.dataset.bound) {
    modalOverlay.dataset.bound = "true";
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeProductivityDetailsModal();
    });
  }

  sortAndRenderProductivityDetails();
}

function closeProductivityDetailsModal() {
  document.getElementById('productivity-details-modal').classList.add('hidden');
}

function sortProductivityDetailsModal(column) {
  if (g_productivityDetailsSort.column === column) {
    g_productivityDetailsSort.direction = g_productivityDetailsSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    g_productivityDetailsSort.column = column;
    g_productivityDetailsSort.direction = 'asc';
  }

  // Atualiza ícones
  const headers = ['id', 'type', 'title', 'hours', 'date'];
  headers.forEach(h => {
    const icon = document.getElementById('sort-prod-icon-' + h);
    if (icon) icon.innerHTML = '';
  });
  const activeIcon = document.getElementById('sort-prod-icon-' + column);
  if (activeIcon) {
    activeIcon.innerHTML = g_productivityDetailsSort.direction === 'asc' ? '&#9652;' : '&#9662;';
  }

  sortAndRenderProductivityDetails();
}

function changeProductivityDetailsPage(delta) {
  const maxPage = Math.ceil(g_productivityDetailsData.length / PRODUCTIVITY_PAGE_SIZE) || 1;
  let newPage = g_productivityDetailsPage + delta;
  if (newPage < 1) newPage = 1;
  if (newPage > maxPage) newPage = maxPage;
  
  if (newPage !== g_productivityDetailsPage) {
    g_productivityDetailsPage = newPage;
    renderProductivityDetailsModal();
  }
}

function sortAndRenderProductivityDetails() {
  const col = g_productivityDetailsSort.column;
  const dir = g_productivityDetailsSort.direction === 'asc' ? 1 : -1;

  g_productivityDetailsData.sort((a, b) => {
    if (col === 'id') return (String(a.id).localeCompare(String(b.id))) * dir;
    if (col === 'type') return (a.type.localeCompare(b.type)) * dir;
    if (col === 'title') return (a.title.localeCompare(b.title)) * dir;
    if (col === 'hours') return (a.hours - b.hours) * dir;
    if (col === 'date') return (a.date.getTime() - b.date.getTime()) * dir;
    return 0;
  });

  g_productivityDetailsPage = 1;
  renderProductivityDetailsModal();
}

function renderProductivityDetailsModal() {
  const tbody = document.getElementById('productivity-modal-tbody');
  tbody.innerHTML = '';

  const total = g_productivityDetailsData.length;
  if (total === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">Nenhum registro encontrado no período filtrado.</td></tr>';
    document.getElementById('productivity-modal-info').textContent = 'Mostrando 0 de 0';
    document.getElementById('productivity-modal-page').textContent = 'Pág 1';
    return;
  }

  const maxPage = Math.ceil(total / PRODUCTIVITY_PAGE_SIZE);
  if (g_productivityDetailsPage > maxPage) g_productivityDetailsPage = maxPage;
  
  const startIdx = (g_productivityDetailsPage - 1) * PRODUCTIVITY_PAGE_SIZE;
  const endIdx = Math.min(startIdx + PRODUCTIVITY_PAGE_SIZE, total);

  const pageData = g_productivityDetailsData.slice(startIdx, endIdx);

  pageData.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.id}</td>
      <td>${item.type}</td>
      <td title="${item.title}" style="max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.title}</td>
      <td style="text-align:right; font-weight:600;">${item.hours.toFixed(1)}h</td>
      <td style="text-align:center;">${item.dateStr}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('productivity-modal-info').textContent = 'Mostrando ' + (startIdx + 1) + ' a ' + endIdx + ' de ' + total;
  document.getElementById('productivity-modal-page').textContent = 'Pág ' + g_productivityDetailsPage + ' de ' + maxPage;
  
  document.getElementById('btn-prod-modal-prev').disabled = g_productivityDetailsPage === 1;
  document.getElementById('btn-prod-modal-next').disabled = g_productivityDetailsPage === maxPage;
}


// ---- NEXT ---- 

    tbody.appendChild(tr);
  });
  
  if (panel) {
    panel.onclick = () => {
      navigateToPage('alerts');
    };
  }
}

// ============================================================================
// Produtividade: Modal de Detalhes de Tarefas e Atendimentos
// ============================================================================
let g_productivityDetailsData = [];
let g_productivityDetailsPage = 1;
let g_productivityDetailsSort = { column: 'date', direction: 'desc' };
const PRODUCTIVITY_PAGE_SIZE = 10;

function openProductivityDetailsModal(person) {
  g_productivityDetailsData = [];
  g_productivityDetailsPage = 1;

  // Extrair tasks
  const filteredWIs = getFilteredWorkItems();
  filteredWIs.forEach(wi => {
    const tasks = g_data.tasksByParent.get(wi.Id) || [];
    tasks.forEach(t => {
      const resp = t.Responsavel ? t.Responsavel.trim() : '';
      if (resp === person && (t.CompletedWork || 0) > 0) {
        const d = new Date(t.DataAlteracao || t.DataCriacao || 0);
        g_productivityDetailsData.push({
          id: t.TaskId || '-',
          type: 'Task (' + (wi.Tipo || '-') + ')',
          title: t.Titulo || '-',
          hours: t.CompletedWork || 0,
          date: d,
          dateStr: isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR')
        });
      }
    });
  });

  // Extrair atendimentos
  const filteredAtendimentos = getFilteredAtendimentos();
  filteredAtendimentos.forEach(at => {
    const resp = at.Responsavel ? at.Responsavel.trim() : '';
    if (resp === person && (at.CompletedWork || 0) > 0) {
      const d = new Date(at.ClosedDate || at.DataAlteracao || 0);
      g_productivityDetailsData.push({
        id: at.Id || '-',
        type: 'Atendimento',
        title: at.Titulo || '-',
        hours: at.CompletedWork || 0,
        date: d,
        dateStr: isNaN(d.getTime()) ? '-' : d.toLocaleDateString('pt-BR')
      });
    }
  });

  document.getElementById('productivity-modal-title').textContent = 'Detalhes de Produtividade: ' + person;
  document.getElementById('productivity-details-modal').classList.remove('hidden');

  const btnClose = document.getElementById('btn-close-productivity-modal');
  if (btnClose && !btnClose.dataset.bound) {
    btnClose.dataset.bound = "true";
    btnClose.addEventListener('click', closeProductivityDetailsModal);
  }
  
  const modalOverlay = document.getElementById('productivity-details-modal');
  if (modalOverlay && !modalOverlay.dataset.bound) {
    modalOverlay.dataset.bound = "true";
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeProductivityDetailsModal();
    });
  }

  sortAndRenderProductivityDetails();
}

function closeProductivityDetailsModal() {
  document.getElementById('productivity-details-modal').classList.add('hidden');
}

function sortProductivityDetailsModal(column) {
  if (g_productivityDetailsSort.column === column) {
    g_productivityDetailsSort.direction = g_productivityDetailsSort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    g_productivityDetailsSort.column = column;
    g_productivityDetailsSort.direction = 'asc';
  }

  // Atualiza ícones
  const headers = ['id', 'type', 'title', 'hours', 'date'];
  headers.forEach(h => {
    const icon = document.getElementById('sort-prod-icon-' + h);
    if (icon) icon.innerHTML = '';
  });
  const activeIcon = document.getElementById('sort-prod-icon-' + column);
  if (activeIcon) {
    activeIcon.innerHTML = g_productivityDetailsSort.direction === 'asc' ? '&#9652;' : '&#9662;';
  }

  sortAndRenderProductivityDetails();
}

function changeProductivityDetailsPage(delta) {
  const maxPage = Math.ceil(g_productivityDetailsData.length / PRODUCTIVITY_PAGE_SIZE) || 1;
  let newPage = g_productivityDetailsPage + delta;
  if (newPage < 1) newPage = 1;
  if (newPage > maxPage) newPage = maxPage;
  
  if (newPage !== g_productivityDetailsPage) {
    g_productivityDetailsPage = newPage;
    renderProductivityDetailsModal();
  }
}

function sortAndRenderProductivityDetails() {
  const col = g_productivityDetailsSort.column;
  const dir = g_productivityDetailsSort.direction === 'asc' ? 1 : -1;

  g_productivityDetailsData.sort((a, b) => {
    if (col === 'id') return (String(a.id).localeCompare(String(b.id))) * dir;
    if (col === 'type') return (a.type.localeCompare(b.type)) * dir;
    if (col === 'title') return (a.title.localeCompare(b.title)) * dir;
    if (col === 'hours') return (a.hours - b.hours) * dir;
    if (col === 'date') return (a.date.getTime() - b.date.getTime()) * dir;
    return 0;
  });

  g_productivityDetailsPage = 1;
  renderProductivityDetailsModal();
}

function renderProductivityDetailsModal() {
  const tbody = document.getElementById('productivity-modal-tbody');
  tbody.innerHTML = '';

  const total = g_productivityDetailsData.length;
  if (total === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--text-muted);">Nenhum registro encontrado no período filtrado.</td></tr>`;
    document.getElementById('productivity-modal-info').textContent = 'Mostrando 0 de 0';
    document.getElementById('productivity-modal-page').textContent = 'Pág 1';
    return;
  }

  const maxPage = Math.ceil(total / PRODUCTIVITY_PAGE_SIZE);
  if (g_productivityDetailsPage > maxPage) g_productivityDetailsPage = maxPage;
  
  const startIdx = (g_productivityDetailsPage - 1) * PRODUCTIVITY_PAGE_SIZE;
  const endIdx = Math.min(startIdx + PRODUCTIVITY_PAGE_SIZE, total);

  const pageData = g_productivityDetailsData.slice(startIdx, endIdx);

  pageData.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.id}</td>
      <td>${item.type}</td>
      <td title="${item.title}" style="max-width:300px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.title}</td>
      <td style="text-align:right; font-weight:600;">${item.hours.toFixed(1)}h</td>
      <td style="text-align:center;">${item.dateStr}</td>
    `;
    tbody.appendChild(tr);
  });

  document.getElementById('productivity-modal-info').textContent = `Mostrando ${startIdx + 1} a ${endIdx} de ${total}`;
  document.getElementById('productivity-modal-page').textContent = `Pág ${g_productivityDetailsPage} de ${maxPage}`;
  
  document.getElementById('btn-prod-modal-prev').disabled = g_productivityDetailsPage === 1;
  document.getElementById('btn-prod-modal-next').disabled = g_productivityDetailsPage === maxPage;
}

// ---- NEXT ---- 

    const taskTypeOrName = (task.Activity && task.Activity.trim()) ? task.Activity.trim() : (task.Titulo || 'Task');

    // Task Closed sem horas informadas
    if (isClosed && completedWork === 0) {
      alerts.push({
        id: task.TaskId,
        parentId: task.ParentId,
        title: taskTitle,
        type: 'Horas nÃ£o informadas',
        severity: 'info',
        owner: task.Responsavel || 'NENHUM',
        details: `Task '${taskTypeOrName}' concluÃ­da sem horas registradas (CompletedWork = 0)`
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

    // Task sem responsÃ¡vel definido
    const resp = task.Responsavel ? task.Responsavel.trim() : '';
    if (!resp || resp.toUpperCase() === 'NENHUM') {
      alerts.push({
        id: task.TaskId,
        parentId: task.ParentId,
        title: taskTitle,
        type: 'Task com dados faltantes',
        severity: 'info',
        owner: 'NENHUM',
        details: `Task '${taskTypeOrName}' sem responsÃ¡vel definido`
      });
    }
  });

// ---- NEXT ---- 

      return {
        id: id,
        idNum: id === '-' ? -1 : parseInt(id, 10),
        parentId: alerts[0].parentId,
        title: alerts[0].title,
        owner: alerts[0].owner,
        maxSeverity: maxSev,
        alerts: alerts
      };

// ---- NEXT ---- 

      pageGroups.forEach(group => {
        const rowCount = group.alerts.length;
        const linkId = group.parentId || group.id;
        const idCell = group.id !== '-' 
          ? `<a href="#" class="wi-drill-link" data-id="${linkId}">#${group.id}</a>` 
          : '<span style="color: var(--text-muted); font-weight:600;">-</span>';

// ---- NEXT ---- 

          if (idx === 0 && group.id !== '-') {
            tr.querySelector('.wi-drill-link').addEventListener('click', (e) => {
              e.preventDefault();
              g_selectedDrillDownId = String(group.parentId || group.id);
              navigateToPage('drilldown');
            });
          }

// ---- NEXT ---- 

  if (dateRangeVal !== 'all') {
    if (dateRangeVal === 'today') {
      startDateMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    } else if (dateRangeVal === 'this-month') {
      startDateMs = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
    } else if (dateRangeVal === 'last-month') {
      startDateMs = new Date(today.getFullYear(), today.getMonth() - 1, 1).getTime();
      endDateMs = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59).getTime();
    } else if (dateRangeVal === 'this-year') {
      startDateMs = new Date(today.getFullYear(), 0, 1).getTime();
    } else if (dateRangeVal === 'last-year') {
      startDateMs = new Date(today.getFullYear() - 1, 0, 1).getTime();
      endDateMs = new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59).getTime();
    } else {
      const days = parseInt(dateRangeVal.replace('last-', ''), 10) || 30;
      startDateMs = today.getTime() - (days * 24 * 60 * 60 * 1000);
    }
  }

// ---- NEXT ---- 

  if (dateRangeVal !== 'all') {
    if (dateRangeVal === 'today') {
      startDateMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    } else if (dateRangeVal === 'this-month') {
      startDateMs = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
    } else if (dateRangeVal === 'last-month') {
      startDateMs = new Date(today.getFullYear(), today.getMonth() - 1, 1).getTime();
      endDateMs = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59).getTime();
    } else if (dateRangeVal === 'this-year') {
      startDateMs = new Date(today.getFullYear(), 0, 1).getTime();
    } else if (dateRangeVal === 'last-year') {
      startDateMs = new Date(today.getFullYear() - 1, 0, 1).getTime();
      endDateMs = new Date(today.getFullYear() - 1, 11, 31, 23, 59, 59).getTime();
    } else {
      const days = parseInt(dateRangeVal.replace('last-', ''), 10) || 30;
      startDateMs = today.getTime() - (days * 24 * 60 * 60 * 1000);
    }
  }

// ---- NEXT ---- 

    } else if (dateRangeVal === 'this-month') {
      startDateMs = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
    } else if (dateRangeVal === 'last-month') {
      startDateMs = new Date(today.getFullYear(), today.getMonth() - 1, 1).getTime();
      endDateMs = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59).getTime();
    } else if (dateRangeVal === 'this-year') {