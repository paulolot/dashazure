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

