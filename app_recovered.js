/**
 * Squad Fiscal Dashboard â€” Core Application Logic (Vanilla JS)
 * Metanet | Squad Fiscal
 * Anchor Date: 2026-05-22
 */

// A Ã¢ncora de data agora Ã© dinÃ¢mica (data atual do sistema) para refletir o carregamento em tempo real do Google Sheets
const TODAY_ANCHOR = new Date();

const CSV_FILES = {
  workItems: 'fiscal-workitems.csv',
  tasks: 'fiscal-tasks.csv',
  transicoes: 'fiscal-transicoes.csv',
  tempoColuna: 'fiscal-tempo-coluna.csv',
  entregas: 'fiscal-entregas.csv',
  bugs: 'fiscal-bugs.csv',
  metricas: 'fiscal-metricas-periodo.csv',
  columnMap: 'fiscal-column-map.csv',
  tags: 'fiscal-tags.csv',
  pessoaPapel: 'fiscal-pessoa-papel.csv',
  statusMap: 'fiscal-status-map.csv',
  paralizacaoResumo: 'fiscal-paralizacao-resumo.csv',
  paralizacoes: 'fiscal-paralizacoes.csv',
  atendimentosConcluidos: 'fiscal-atendimentos-concluidos.csv'
};

const CSV_URLS = {
  workItems: 'fiscal-workitems.csv',
  tasks: 'fiscal-tasks.csv',
  transicoes: 'fiscal-transicoes.csv',
  tempoColuna: 'fiscal-tempo-coluna.csv',
  entregas: 'fiscal-entregas.csv',
  bugs: 'fiscal-bugs.csv',
  metricas: 'fiscal-metricas-periodo.csv',
  columnMap: 'fiscal-column-map.csv',
  tags: 'fiscal-tags.csv',
  pessoaPapel: 'fiscal-pessoa-papel.csv',
  statusMap: 'fiscal-status-map.csv',
  paralizacaoResumo: 'fiscal-paralizacao-resumo.csv',
  paralizacoes: 'fiscal-paralizacoes.csv',
  atendimentosConcluidos: 'fiscal-atendimentos-concluidos.csv'
};

const COL_ABBR = {
  'Ideias': 'Ideias',
  'IdÃ©ias': 'Ideias',
  'Backlog': 'Backlog',
  'Fazendo AnÃ¡lise': 'AnÃ¡lise',
  'DisponÃ­vel para Dev': 'Disp. Dev',
  'Dev implementando': 'Dev',
  'DisponÃ­vel RevisÃ£o de CÃ³digo': 'Disp. Rev',
  'Realizando RevisÃ£o de CÃ³digo': 'RevisÃ£o',
  'DisponÃ­vel para Teste': 'Disp. Teste',
  'Testando': 'Teste',
  'Aguardando pipeline': 'Pipeline',
  'Pronto pra Release': 'Release',
  'ConcluÃ­do': 'ConcluÃ­do'
};

let g_db = null;
let g_activePage = 'overview';
let g_selectedDrillDownId = null;
let g_deliveriesTypeFilter = null;
let g_deliveriesParalyzedFilter = false;
let g_flowParalizadosFilter = 'all'; // 'all', 'paralizados', 'ativos'
let g_flowActiveColumnFilter = null;
let g_flowTypeFilter = 'all'; // 'all', 'trabalho', 'fila', 'aguardando', 'pre_release'

// Configurações padrão de alertas e notificações
let g_rules = {
  backlog_aging_days: 30,
  bug_yellow_days: 5,
  bug_red_use_mttr: true,
  bug_red_days_fallback: 15,
  card_max_days_same_column: 2,
  dev_task_max_hours: 16,
  dev_column_max_hours: 16,
  person_hours_per_day: 8,
  max_wip_per_developer: 2,
  large_us_task_hours_limit: 20,
  large_us_active_hours_limit: 100,
  blocked_alert_threshold_hours: 24,
  activity_column_map: {
    "Desenvolvimento": "Dev implementando",
    "Testes": "Testando",
    "Revisão de Código": "Realizando Revisão de Código"
  }
};

let g_activeAlertTab = 'all'; // 'all', 'blocker', 'critical', 'warning', 'info', 'productivity'
let g_activeAlertWiTypeFilter = 'all'; // 'all', 'Bug', 'User Story', etc.
let g_selectedAlertTypes = null;
let g_alertsSortConfig = { column: 'severity', direction: 'desc' };
let g_computedAlerts = [];
let g_productivityGaps = [];
let g_bugsActiveOriginFilter = 'all'; // 'all', 'Legado', '!BUG', 'GeradoPorUS', 'Geral'
let g_throughputViewMode = 'weekly'; // 'weekly', 'monthly'




// Global state for grid sorting and filtering
const g_gridsState = {
  flowWip: { sortKey: 'DiasAberto', sortAsc: false, filters: {} },
  deliveriesList: { sortKey: 'CloseDate', sortAsc: false, filters: {} },
  capacityHoursList: { sortKey: 'Id', sortAsc: true, filters: {} },
  capacityPairList: { sortKey: 'Id', sortAsc: true, filters: {} },
  qualityBugsList: { sortKey: 'Id', sortAsc: false, filters: {} },
  atendimentosList: { sortKey: 'ClosedDate', sortAsc: false, filters: {} }
};

// Columns definitions for table grids
const GRID_COLUMNS = {
  flowWip: [
    { key: 'Id', label: 'ID', type: 'number' },
    { key: 'Titulo', label: 'TÃ­tulo', type: 'string' },
    { key: 'Tipo', label: 'Tipo', type: 'string' },
    { key: 'BoardColumn', label: 'Coluna Atual', type: 'string' },
    { key: 'TipoFluxo', label: 'Tipo do Fluxo', type: 'string' },
    { key: 'Responsavel', label: 'ResponsÃ¡vel', type: 'string' },
    { key: 'HoursInCol', label: 'Horas na Coluna Atual', type: 'number' },
    { key: 'DiasAberto', label: 'Dias Total Aberto', type: 'number' }
  ],
  deliveriesList: [
    { key: 'Id', label: 'ID', type: 'number' },
    { key: 'Titulo', label: 'TÃ­tulo', type: 'string' },
    { key: 'Tipo', label: 'Tipo', type: 'string' },
    { key: 'CloseDate', label: 'Data de Fechamento', type: 'date' },
    { key: 'Responsavel', label: 'ResponsÃ¡vel no Fechamento', type: 'string' },
    { key: 'LeadTime', label: 'Lead Time (Dias)', type: 'number' },
    { key: 'CycleTime', label: 'Cycle Time (Dias)', type: 'number' }
  ],
  capacityHoursList: [
    { key: 'Id', label: 'ID Pai', type: 'number' },
    { key: 'Titulo', label: 'TÃ­tulo do Item Pai', type: 'string' },
    { key: 'Responsavel', label: 'ResponsÃ¡vel', type: 'string' },
    { key: 'BoardColumn', label: 'Status Geral', type: 'string' },
    { key: 'TaskCount', label: 'Quantidade de Tasks', type: 'number' },
    { key: 'PlannedEst', label: 'EsforÃ§o Planejado (h)', type: 'number' },
    { key: 'CompletedComp', label: 'Trabalho ConcluÃ­do (h)', type: 'number' },
    { key: 'TaskStatus', label: 'Status das Tasks', type: 'string' }
  ],
  capacityPairList: [
    { key: 'Id', label: 'ID do Item', type: 'number' },
    { key: 'Titulo', label: 'TÃ­tulo', type: 'string' },
    { key: 'Dev', label: 'Dev Designado', type: 'string' },
    { key: 'QA', label: 'QA Designado', type: 'string' },
    { key: 'Sprint', label: 'Sprint', type: 'string' },
    { key: 'BoardColumn', label: 'Coluna no Board', type: 'string' }
  ],
  qualityBugsList: [
    { key: 'Id', label: 'ID', type: 'number' },
    { key: 'Titulo', label: 'TÃ­tulo', type: 'string' },
    { key: 'BoardColumn', label: 'Coluna do Board', type: 'string' },
    { key: 'Responsavel', label: 'ResponsÃ¡vel', type: 'string' },
    { key: 'Severidade', label: 'Severidade', type: 'string' },
    { key: 'DiasAbertoRes', label: 'Dias em Aberto / ResoluÃ§Ã£o', type: 'number' }
  ],
  atendimentosList: [
    { key: 'Id', label: 'ID', type: 'number' },
    { key: 'Responsavel', label: 'ResponsÃ¡vel', type: 'string' },
    { key: 'Descricao', label: 'DescriÃ§Ã£o', type: 'string' },
    { key: 'Numero', label: 'NÃºmero', type: 'number' },
    { key: 'CompletedWork', label: 'Horas ConcluÃ­das (h)', type: 'number' },
    { key: 'ClosedDate', label: 'Data de ConclusÃ£o', type: 'date' }
  ]
};

// Primary parsed datasets
let g_raw = {
  workItems: [],
  tasks: [],
  transicoes: [],
  tempoColuna: [],
  entregas: [],
  bugs: [],
  metricas: [],
  columnMap: [],
  tags: [],
  pessoaPapel: [],
  statusMap: [],
  paralizacaoResumo: [],
  paralizacoes: [],
  atendimentosConcluidos: []
};

// Relational maps & unique indexes
let g_data = {
  workItemsMap: new Map(),
  tasksByParent: new Map(),
  tempoColunaByWi: new Map(),
  transicoesByWi: new Map(),
  entregasMap: new Map(),
  bugsMap: new Map(),
  tagsByWi: new Map(),
  pessoaPapelByWi: new Map(),
  paralizacaoResumoMap: new Map(),
  paralizacoesByWi: new Map(),
  atendimentosConcluidosMap: new Map(),
  statusMapObj: {},
  columnMapObj: {},
  
  // Sets for filters
  iterations: new Set(),
  assignees: new Set(),
  qas: new Set(),
  allTags: new Set(),
  columns: new Set()
};

// IndexedDB Helper constants
const DB_NAME = 'SquadFiscalDB';
const DB_VERSION = 1;
const STORE_NAME = 'csv_store';

// 2. INDEXEDDB FUNCTIONS
function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

function getCSVFromDB(db, key) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

function saveCSVToDB(db, key, value) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

function clearDB(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
}

// 3. ROBUST RFC-4180 CSV PARSER
function parseCSV(text) {
  const lines = [];
  let row = [""];
  let insideQuote = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      row.push("");
    } else if ((char === '\r' || char === '\n') && !insideQuote) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      lines.push(row);
      row = [""];
    } else {
      row[row.length - 1] += char;
    }
  }
  if (row.length > 1 || row[0] !== "") {
    lines.push(row);
  }
  
  if (lines.length === 0) return [];
  
  const headers = lines[0].map(h => h.trim());
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const rowData = lines[i];
    // Graciosidade com linhas em branco ou desiguais
    if (rowData.length !== headers.length) {
      if (rowData.length === 1 && rowData[0] === "") continue;
      // Ajusta opcionalmente tamanho
      while (rowData.length < headers.length) rowData.push("");
    }
    
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = rowData[j].trim();
    }
    data.push(obj);
  }
  return data;
}

// Helper function to return beautiful Azure DevOps-like SVG icons for WI types
function getWiTypeIcon(type) {
  const t = (type || '').trim().toLowerCase();
  if (t.includes('story') || t.includes('user')) {
    // Azure DevOps User Story - Sky Blue Open Book (imagem 1)
    return `
      <span style="display: inline-flex; align-items: center; cursor: help;" title="User Story">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="#0097e6" stroke="#0097e6" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; flex-shrink: 0;">
          <path d="M12 21a2.5 2.5 0 0 1 3-2.5H22V4h-7a4 4 0 0 0-4 4v13z" />
          <path d="M12 21a2.5 2.5 0 0 0-3-2.5H2V4h7a4 4 0 0 1 4 4v13z" />
        </svg>
      </span>
    `;
  } else if (t.includes('bug')) {
    // Azure DevOps Bug - Red Ladybug/Beetle (imagem 2)
    return `
      <span style="display: inline-flex; align-items: center; cursor: help;" title="Bug">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#cc293d" stroke-width="2" stroke-linecap="round" style="vertical-align: middle; flex-shrink: 0;">
          <!-- Antennae -->
          <path d="M10 5C9 3 7 3 7 3M14 5C15 3 17 3 17 3" />
          <!-- Legs -->
          <path d="M6 8L4 6M18 8l2-2M5 13H2M19 13h3M6 18l-2 2M18 18l2 2" />
          <!-- Body -->
          <circle cx="12" cy="13" r="7" fill="#cc293d" stroke="none" />
          <!-- Head -->
          <ellipse cx="12" cy="6" rx="4" ry="3" fill="#cc293d" stroke="none" />
          <!-- Center division line -->
          <line x1="12" y1="6" x2="12" y2="20" stroke="#ffffff" stroke-width="1.2" />
          <!-- Dots -->
          <circle cx="9" cy="10" r="1" fill="#ffffff" stroke="none" />
          <circle cx="15" cy="10" r="1" fill="#ffffff" stroke="none" />
          <circle cx="9" cy="15" r="1" fill="#ffffff" stroke="none" />
          <circle cx="15" cy="15" r="1" fill="#ffffff" stroke="none" />
        </svg>
      </span>
    `;
  }
  return type || '';
}

// 4. LOAD CONFIG & AUTOMATIC SEQUENCE
document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupThemeToggle();
  tryAutoFetch();
});

async function tryAutoFetch() {
  const keys = Object.keys(CSV_URLS);
  try {
    const fetchPromises = keys.map(async key => {
      const response = await fetch(CSV_URLS[key]);
      if (!response.ok) throw new Error(`Could not fetch ${CSV_URLS[key]}`);
      const text = await response.text();
      return { key, text };
    });
    
    const results = await Promise.all(fetchPromises);
    g_db = await initDB();
    
    for (const res of results) {
      g_raw[res.key] = parseCSV(res.text);
      await saveCSVToDB(g_db, res.key, res.text);
    }
    
    const lblStatus = document.getElementById('lbl-connection-status');
    if (lblStatus) lblStatus.textContent = 'Azure DevOps (Local)';
    const pulse = document.querySelector('.update-status .pulse-indicator');
    if (pulse) {
      pulse.style.backgroundColor = '#10b981';
      pulse.style.boxShadow = '0 0 8px #10b981';
    }
    
    document.getElementById('upload-overlay').classList.add('hidden');
    initializeDashboard();
  } catch (err) {
    console.warn("Auto-fetch block (CORS/missing live files). Trying IndexedDB...", err);
    tryLoadFromIndexedDB();
  }
}

async function tryLoadFromIndexedDB() {
  try {
    g_db = await initDB();
    const keys = Object.keys(CSV_FILES);
    const results = [];
    
    for (const key of keys) {
      const text = await getCSVFromDB(g_db, key);
      if (!text) {
        throw new Error(`Missing ${key} in IndexedDB`);
      }
      results.push({ key, text });
    }
    
    for (const res of results) {
      g_raw[res.key] = parseCSV(res.text);
    }
    
    const lblStatus = document.getElementById('lbl-connection-status');
    if (lblStatus) lblStatus.textContent = 'Conectado a CSVs';
    const pulse = document.querySelector('.update-status .pulse-indicator');
    if (pulse) {
      pulse.style.backgroundColor = '#f59e0b';
      pulse.style.boxShadow = '0 0 8px #f59e0b';
    }
    
    document.getElementById('upload-overlay').classList.add('hidden');
    initializeDashboard();
  } catch (err) {
    console.warn("IndexedDB has no files. Triggering manual drop fallback.", err);
    document.getElementById('upload-overlay').classList.remove('hidden');
    setupUploadOverlay();
  }
}

// 5. DRAG & DROP MANUAL UPLOAD PANEL
function setupUploadOverlay() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('csv-file-input');
  const preview = document.getElementById('file-list-preview');
  const btnConfirm = document.getElementById('btn-confirm-upload');
  
  const uploadedFiles = {}; // Maps key -> file raw text
  
  // Click dropzone triggers input
  dropZone.addEventListener('click', () => fileInput.click());
  
  fileInput.addEventListener('change', (e) => handleFiles(e.target.files));
  
  // Drag-and-drop events
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
  
  function handleFiles(files) {
    Array.from(files).forEach(file => {
      const fileName = file.name.trim();
      let matchedKey = null;
      
      // Match file by its filename in CSV_FILES values
      for (const key in CSV_FILES) {
        if (CSV_FILES[key].toLowerCase() === fileName.toLowerCase()) {
          matchedKey = key;
          break;
        }
      }
      
      if (matchedKey) {
        const reader = new FileReader();
        reader.onload = function(e) {
          uploadedFiles[matchedKey] = e.target.result;
          updatePreviewList();
        };
        reader.readAsText(file, 'UTF-8');
      } else {
        alert(`Arquivo nÃ£o reconhecido: ${file.name}. Certifique-se de usar os nomes exportados (ex: fiscal-workitems.csv)`);
      }
    });
  }
  
  function updatePreviewList() {
    preview.innerHTML = '';
    let totalLoaded = 0;
    
    for (const key in CSV_FILES) {
      const isLoaded = !!uploadedFiles[key];
      if (isLoaded) totalLoaded++;
      
      const item = document.createElement('div');
      item.className = `preview-item ${isLoaded ? 'loaded' : 'missing'}`;
      item.innerHTML = `
        <span class="status-indicator"></span>
        <span class="file-name">${CSV_FILES[key]}</span>
        <span class="status-text">${isLoaded ? 'Carregado' : 'Aguardando'}</span>
      `;
      preview.appendChild(item);
    }
    
    // Enable confirm button only if all 14 files are ready
    if (totalLoaded === 14) {
      btnConfirm.disabled = false;
      btnConfirm.classList.remove('disabled');
    } else {
      btnConfirm.disabled = true;
      btnConfirm.classList.add('disabled');
    }
  }
  
  btnConfirm.addEventListener('click', async () => {
    try {
      g_db = await initDB();
      // Clear previous cache just in case
      await clearDB(g_db);
      
      // Parse & cache to DB
      for (const key in CSV_FILES) {
        const text = uploadedFiles[key];
        g_raw[key] = parseCSV(text);
        await saveCSVToDB(g_db, key, text);
      }
      
      const lblStatus = document.getElementById('lbl-connection-status');
      if (lblStatus) lblStatus.textContent = 'Conectado a CSVs';
      const pulse = document.querySelector('.update-status .pulse-indicator');
      if (pulse) {
        pulse.style.backgroundColor = '#f59e0b';
        pulse.style.boxShadow = '0 0 8px #f59e0b';
      }
      
      document.getElementById('upload-overlay').classList.add('hidden');
      initializeDashboard();
    } catch (err) {
      console.error("Erro salvando arquivos carregados no IndexedDB", err);
      alert("Falha crÃ­tica ao gravar os dados. Detalhe: " + err.message);
    }
  });
  
  updatePreviewList(); // Draw default blank state
}

// 6. RELATIONAL DATA PROCESSING & LEFT JOINS
async function loadRules() {
  try {
    const response = await fetch('rules_config.json');
    if (response.ok) {
      const data = await response.json();
      g_rules = { ...g_rules, ...data };
      console.log("Configurações de regras carregadas com sucesso:", g_rules);
    } else {
      console.warn("rules_config.json não pôde ser carregado. Usando padrões em memória.");
    }
  } catch (err) {
    console.warn("Erro ao ler rules_config.json, usando padrões em memória:", err);
  }
}

async function initializeDashboard() {
  await loadRules();
  processData();
  buildGlobalFilters();
  setupFilterPanelListeners();
  setupSyncButtonListener();
  setupAlertTabsListeners();
  setupThroughputToggleListeners();

  
  // Set last execution timestamp in footer
  if (g_raw.metricas.length > 0) {
    const dt = new Date(g_raw.metricas[0].DataExecucao);
    document.getElementById('txt-last-execution').textContent = dt.toLocaleString('pt-BR');
  } else {
    document.getElementById('txt-last-execution').textContent = TODAY_ANCHOR.toLocaleString('pt-BR');
  }
  
  // Default render
  renderActivePage();
}

function setupSyncButtonListener() {
  const btnSync = document.getElementById('btn-sync-azure');
  if (!btnSync || btnSync.dataset.listenerBound) return;
  
  btnSync.dataset.listenerBound = "true";
  
  const modal = document.getElementById('sync-modal');
  const btnCloseX = document.getElementById('btn-close-sync-modal');
  const btnCancel = document.getElementById('btn-cancel-sync');
  const btnConfirm = document.getElementById('btn-confirm-sync');
  const txtPat = document.getElementById('txt-azure-pat');
  const lblPatStatus = document.getElementById('lbl-pat-status');
  
  if (!modal || !btnConfirm) return;
  
  btnSync.addEventListener('click', async () => {
    // Open modal
    modal.classList.remove('hidden');
    txtPat.value = '';
    
    if (lblPatStatus) {
      lblPatStatus.textContent = "Buscando status das credenciais...";
      lblPatStatus.style.color = "var(--text-muted)";
    }
    
    // Check current config status from server
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const config = await response.json();
        if (config.success) {
          if (config.has_pat) {
            txtPat.placeholder = "•••••••••••••••• (Deixe em branco para manter o token atual)";
            if (lblPatStatus) {
              lblPatStatus.textContent = `Token ativo já configurado para a organização '${config.organization}' e projeto '${config.project}'.`;
              lblPatStatus.style.color = "var(--color-primary)";
            }
          } else {
            txtPat.placeholder = "Cole seu token aqui...";
            if (lblPatStatus) {
              lblPatStatus.textContent = "Nenhum token válido configurado. Por favor, insira seu PAT abaixo.";
              lblPatStatus.style.color = "var(--color-danger)";
            }
          }
        }
      }
    } catch (e) {
      console.warn("Não foi possível carregar as configurações do servidor local.", e);
      if (lblPatStatus) {
        lblPatStatus.textContent = "Não foi possível conectar ao servidor local para ler as credenciais.";
        lblPatStatus.style.color = "var(--color-warning)";
      }
    }
  });
  
  const hideModal = () => {
    modal.classList.add('hidden');
  };
  
  if (btnCloseX) btnCloseX.addEventListener('click', hideModal);
  if (btnCancel) btnCancel.addEventListener('click', hideModal);
  
  // Close on outside click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) hideModal();
  });
  
  btnConfirm.addEventListener('click', async () => {
    const patVal = txtPat.value.trim();
    
    // Hide modal first
    hideModal();
    
    // Trigger sync loading state
    btnSync.disabled = true;
    const originalText = btnSync.querySelector('span').textContent;
    const icon = btnSync.querySelector('.sync-icon');
    if (icon) icon.classList.add('spin');
    btnSync.querySelector('span').textContent = 'Sincronizando...';
    
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pat: patVal })
      });
      
      let data = {};
      try {
        data = await response.json();
      } catch (e) {}
      
      if (response.ok && data.success) {
        // Success! Reload data in-place
        await tryAutoFetch();
        
        // Update footer last execution timestamp
        if (g_raw.metricas.length > 0) {
          const dt = new Date(g_raw.metricas[0].DataExecucao);
          const txtLastExec = document.getElementById('txt-last-execution');
          if (txtLastExec) txtLastExec.textContent = dt.toLocaleString('pt-BR');
        }
        
        alert("Sincronização com o Azure DevOps concluída com sucesso! Os gráficos e tabelas foram atualizados.");
      } else {
        const errMsg = data.error || (data.stderr ? data.stderr : `Código de retorno: ${data.returncode || response.status}`);
        throw new Error(errMsg);
      }
    } catch (err) {
      console.error("Erro de sincronização:", err);
      alert("Erro ao sincronizar com o Azure DevOps.\n\nCertifique-se de que iniciou o servidor através do arquivo 'rodarServer.bat' e de que seu token (PAT) está configurado corretamente.\n\nDetalhe do erro: " + err.message);
    } finally {
      btnSync.disabled = false;
      if (icon) icon.classList.remove('spin');
      btnSync.querySelector('span').textContent = originalText;
    }
  });
}

function processData() {
  // Clear relational mappings
  g_data.workItemsMap.clear();
  g_data.tasksByParent.clear();
  g_data.tempoColunaByWi.clear();
  g_data.transicoesByWi.clear();
  g_data.entregasMap.clear();
  g_data.bugsMap.clear();
  g_data.tagsByWi.clear();
  g_data.pessoaPapelByWi.clear();
  g_data.paralizacaoResumoMap.clear();
  g_data.paralizacoesByWi.clear();
  g_data.atendimentosConcluidosMap.clear();
  
  g_data.iterations.clear();
  g_data.assignees.clear();
  g_data.qas.clear();
  g_data.allTags.clear();
  g_data.columns.clear();

  // Helper to standardize column name variations
  const standardizeCol = (col) => {
    if (!col) return '';
    const trimmed = col.trim();
    if (trimmed === 'IdÃ©ias' || trimmed === 'Ideia' || trimmed === 'Ideias') {
      return 'Ideias';
    }
    return trimmed;
  };
  
  // 1. Board Column Map
  const columnMapObj = {};
  g_raw.columnMap.forEach(row => {
    const rawCol = row.BoardColumn ? row.BoardColumn.trim() : '';
    if (!rawCol) return;
    const colName = standardizeCol(rawCol);
    
    columnMapObj[colName] = {
      State: row.State,
      TipoFluxo: row.TipoFluxo,
      ContaCycleTime: row.ContaCycleTime === 'Sim',
      ContaLeadTime: row.ContaLeadTime === 'Sim'
    };
    g_data.columns.add(colName);
  });
  g_data.columnMapObj = columnMapObj;
  
  // 2. Deliveries Map
  g_raw.entregas.forEach(row => {
    const id = row.Id ? row.Id.trim() : '';
    if (!id) return;
    
    g_data.entregasMap.set(id, {
      ...row,
      LeadTimeDias: parseFloat(row.LeadTimeDias) || 0,
      CycleTimeDias: row.CycleTimeDias ? parseFloat(row.CycleTimeDias) : null
    });
  });
  
  // 3. Bugs Map
  g_raw.bugs.forEach(row => {
    const id = row.Id ? row.Id.trim() : '';
    if (!id) return;
    if (row.BoardColumn) {
      row.BoardColumn = standardizeCol(row.BoardColumn);
    }
    
    // Normalizar severidade/classificação
    row.Severity = row.Severidade || row.Severity || '';
    row.Severidade = row.Severity;
    
    g_data.bugsMap.set(id, row);
  });
  
  // 4. Tasks (Subtasks) grouped by ParentId
  g_raw.tasks.forEach(row => {
    const parentId = row.ParentId ? row.ParentId.trim() : '';
    if (!parentId) return;
    
    // Ignore tasks assigned to Gilmar (not in Squad Fiscal)
    const resp = row.Responsavel ? row.Responsavel.trim() : '';
    if (resp.toLowerCase() === 'gilmar') {
      return;
    }
    
    if (!g_data.tasksByParent.has(parentId)) {
      g_data.tasksByParent.set(parentId, []);
    }
    g_data.tasksByParent.get(parentId).push({
      ...row,
      OriginalEstimate: parseFloat(row.OriginalEstimate) || 0,
      CompletedWork: parseFloat(row.CompletedWork) || 0
    });
  });
  
  // 5. Time in column records grouped by WorkItem ID
  g_raw.tempoColuna.forEach(row => {
    const id = row.Id ? row.Id.trim() : '';
    if (!id) return;
    
    let boardCol = row.BoardColumn ? row.BoardColumn.trim() : '';
    boardCol = standardizeCol(boardCol);
    
    if (!g_data.tempoColunaByWi.has(id)) {
      g_data.tempoColunaByWi.set(id, []);
    }
    g_data.tempoColunaByWi.get(id).push({
      ...row,
      BoardColumn: boardCol,
      TempoTotalHoras: parseFloat(row.TempoTotalHoras) || 0,
      TempoTotalDias: parseFloat(row.TempoTotalDias) || 0,
      TempoAtualHoras: parseFloat(row.TempoAtualHoras) || 0
    });
  });
  
  // 6. Chronological Transitions grouped by WorkItem ID
  g_raw.transicoes.forEach(row => {
    const id = row.Id ? row.Id.trim() : '';
    if (!id) return;
    
    let deVal = row.De ? row.De.trim() : '';
    let paraVal = row.Para ? row.Para.trim() : '';
    if (row.Campo === 'BoardColumn') {
      deVal = standardizeCol(deVal);
      paraVal = standardizeCol(paraVal);
    }
    
    if (!g_data.transicoesByWi.has(id)) {
      g_data.transicoesByWi.set(id, []);
    }
    g_data.transicoesByWi.get(id).push({
      ...row,
      De: deVal,
      Para: paraVal,
      DuracaoHoras: parseFloat(row.DuracaoHoras) || 0,
      DuracaoDias: parseFloat(row.DuracaoDias) || 0
    });
  });
  
  // 7. Tags grouped by WorkItem ID
  g_raw.tags.forEach(row => {
    const id = row.Id ? row.Id.trim() : '';
    const tag = row.Tag ? row.Tag.trim() : '';
    if (!id || !tag) return;
    
    if (!g_data.tagsByWi.has(id)) {
      g_data.tagsByWi.set(id, []);
    }
    g_data.tagsByWi.get(id).push(tag);
    g_data.allTags.add(tag);
  });
  
  // 8. Roles mapping (Dev/QA pairs) grouped by WorkItem ID
  g_raw.pessoaPapel.forEach(row => {
    const id = row.Id ? row.Id.trim() : '';
    const person = row.Pessoa ? row.Pessoa.trim() : '';
    const role = row.Papel ? row.Papel.trim() : '';
    if (!id || !person) return;
    
    if (!g_data.pessoaPapelByWi.has(id)) {
      g_data.pessoaPapelByWi.set(id, []);
    }
    g_data.pessoaPapelByWi.get(id).push(row);
    
    if (role === 'QA') {
      g_data.qas.add(person);
    }
  });
  
  // 9. Paralizacao Resumo
  g_raw.paralizacaoResumo.forEach(row => {
    const id = row.Id ? row.Id.trim() : '';
    if (!id) return;
    g_data.paralizacaoResumoMap.set(id, {
      ...row,
      QtdPeriodosParado: parseInt(row.QtdPeriodosParado) || 0,
      TotalHorasParado: parseFloat(row.TotalHorasParado) || 0,
      TotalDiasParado: parseFloat(row.TotalDiasParado) || 0,
      ParadoAgora: row.ParadoAgora === 'Sim'
    });
  });

  // 9b. Paralizacoes detalhadas
  g_raw.paralizacoes.forEach(row => {
    const id = row.Id ? row.Id.trim() : '';
    if (!id) return;
    if (!g_data.paralizacoesByWi.has(id)) {
      g_data.paralizacoesByWi.set(id, []);
    }
    g_data.paralizacoesByWi.get(id).push({
      ...row,
      DuracaoHoras: parseFloat(row.DuracaoHoras) || 0,
      DuracaoDias: parseFloat(row.DuracaoDias) || 0,
      Ativo: row.Ativo === 'Sim'
    });
  });

  // 10. Main Work Items
  g_raw.workItems.forEach(row => {
    const id = row.Id ? row.Id.trim() : '';
    if (!id) return;
    
    // Ignore items that have been removed
    if (row.State === 'Removed' || row.StateColuna === 'Removed') return;

    
    if (row.BoardColumn) {
      row.BoardColumn = standardizeCol(row.BoardColumn);
    }
    
    // Normalizar severidade/classificação
    row.Severidade = row.Severity || row.Severidade || '';
    row.Severity = row.Severidade;
    
    g_data.workItemsMap.set(id, row);
    
    // Extract filters
    if (row.IterationPath) g_data.iterations.add(row.IterationPath.trim());
    if (row.Responsavel && row.Responsavel !== 'NENHUM' && row.Responsavel.trim() !== '') {
      g_data.assignees.add(row.Responsavel.trim());
    }
    if (row.QA && row.QA !== 'NENHUM' && row.QA.trim() !== '') {
      g_data.qas.add(row.QA.trim());
    }
  });

  // 11. Atendimentos Concluidos
  g_raw.atendimentosConcluidos.forEach(row => {
    const id = row.Id ? row.Id.trim() : '';
    if (!id) return;
    g_data.atendimentosConcluidosMap.set(id, {
      ...row,
      CompletedWork: parseFloat(row.CompletedWork) || 0
    });
  });
}

// 7. GLOBAL FILTER PANEL ACTIONS & DROPDOWNS
function updateTagTriggerText() {
  const trigger = document.getElementById('tag-combo-trigger');
  if (!trigger) return;
  const checkboxes = document.querySelectorAll('.filter-tag-checkbox');
  const checkedCount = document.querySelectorAll('.filter-tag-checkbox:checked').length;
  
  if (checkedCount === 0 || checkedCount === checkboxes.length) {
    trigger.textContent = "Todas as Tags";
  } else {
    trigger.textContent = `${checkedCount} Tag${checkedCount > 1 ? 's' : ''} Selecionada${checkedCount > 1 ? 's' : ''}`;
  }
}

function buildGlobalFilters() {
  const iterationSel = document.getElementById('filter-iteration');
  const assigneeSel = document.getElementById('filter-assignee');
  const qaSel = document.getElementById('filter-qa');
  
  // Clear previous options except "all"
  clearSelectOptions(iterationSel);
  clearSelectOptions(assigneeSel);
  clearSelectOptions(qaSel);
  
  // 1. Sprints
  Array.from(g_data.iterations).sort().forEach(it => {
    const opt = document.createElement('option');
    opt.value = it;
    opt.textContent = it.replace('Metanet\\', ''); // Shorten visual display
    iterationSel.appendChild(opt);
  });
  
  // 2. Assignees
  Array.from(g_data.assignees).sort().forEach(person => {
    const opt = document.createElement('option');
    opt.value = person;
    opt.textContent = person;
    assigneeSel.appendChild(opt);
  });
  
  // 3. QAs
  Array.from(g_data.qas).sort().forEach(qa => {
    const opt = document.createElement('option');
    opt.value = qa;
    opt.textContent = qa;
    qaSel.appendChild(opt);
  });
  
  // 4. Tags (Checklist)
  const tagContainer = document.getElementById('filter-tag-checklist');
  if (tagContainer) {
    tagContainer.innerHTML = '';
    const sortedTags = Array.from(g_data.allTags).sort();
    sortedTags.forEach(tag => {
      const label = document.createElement('label');
      label.className = 'filter-checklist-item';
      
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = tag;
      checkbox.className = 'filter-tag-checkbox';
      checkbox.checked = true; // Checked by default
      
      checkbox.addEventListener('change', () => {
        const selectAllCb = document.getElementById('tag-select-all');
        const checkboxes = document.querySelectorAll('.filter-tag-checkbox');
        const checkedCount = document.querySelectorAll('.filter-tag-checkbox:checked').length;
        
        if (selectAllCb) {
          selectAllCb.checked = (checkedCount === checkboxes.length);
        }
        updateTagTriggerText();
      });
      
      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(tag));
      tagContainer.appendChild(label);
    });
    
    // Bind "Select All" checkbox
    const selectAllCb = document.getElementById('tag-select-all');
    if (selectAllCb) {
      selectAllCb.checked = true; // Default checked
      selectAllCb.addEventListener('change', () => {
        const isChecked = selectAllCb.checked;
        document.querySelectorAll('.filter-tag-checkbox').forEach(cb => {
          cb.checked = isChecked;
        });
        updateTagTriggerText();
      });
    }
    
    // Initial update of trigger text
    updateTagTriggerText();
  }
}

function clearSelectOptions(selectElement) {
  while (selectElement.options.length > 1) {
    selectElement.remove(1);
  }
}

function setupFilterPanelListeners() {
  const btnToggle = document.getElementById('btn-toggle-filters');
  const filterPanel = document.getElementById('filter-panel');
  const btnClear = document.getElementById('btn-clear-filters');
  const btnApply = document.getElementById('btn-apply-filters');
  const badgeCount = document.getElementById('badge-active-filters');
  
  // Custom multiselect combo trigger toggle and outside click
  const tagCombo = document.getElementById('tag-multiselect-combo');
  const tagTrigger = document.getElementById('tag-combo-trigger');
  const tagPanel = document.getElementById('tag-combo-panel');
  
  if (tagTrigger && tagCombo) {
    tagTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      tagCombo.classList.toggle('open');
    });
  }
  
  if (tagPanel) {
    tagPanel.addEventListener('click', (e) => {
      e.stopPropagation(); // prevent closing when selecting items
    });
  }
  
  btnToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    filterPanel.classList.toggle('hidden');
  });
  
  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!filterPanel.contains(e.target) && e.target !== btnToggle && !btnToggle.contains(e.target)) {
      filterPanel.classList.add('hidden');
    }
    // Close tag multiselect combo if clicked outside
    if (tagCombo && !tagCombo.contains(e.target)) {
      tagCombo.classList.remove('open');
    }
  });
  
  btnClear.addEventListener('click', () => {
    document.getElementById('filter-date-range').value = 'all';
    document.getElementById('filter-wi-type').value = 'all';
    document.getElementById('filter-flow-type').value = 'all';
    document.getElementById('filter-iteration').value = 'all';
    document.getElementById('filter-assignee').value = 'all';
    document.getElementById('filter-qa').value = 'all';
    
    // Reset Tag Combobox to its initial "All Selected" state
    const selectAllCb = document.getElementById('tag-select-all');
    if (selectAllCb) selectAllCb.checked = true;
    document.querySelectorAll('.filter-tag-checkbox').forEach(cb => cb.checked = true);
    updateTagTriggerText();
    
    g_deliveriesTypeFilter = null;
    g_deliveriesParalyzedFilter = false;
    g_bugsActiveSeverityFilter = 'all';
    g_bugsActiveTagCategoryFilter.clear();
    badgeCount.classList.add('hidden');
    badgeCount.textContent = '0';
    
    filterPanel.classList.add('hidden');
    renderActivePage();
  });
  
  btnApply.addEventListener('click', () => {
    let activeFiltersCount = 0;
    
    if (document.getElementById('filter-date-range').value !== 'all') activeFiltersCount++;
    if (document.getElementById('filter-wi-type').value !== 'all') activeFiltersCount++;
    if (document.getElementById('filter-flow-type').value !== 'all') activeFiltersCount++;
    if (document.getElementById('filter-iteration').value !== 'all') activeFiltersCount++;
    if (document.getElementById('filter-assignee').value !== 'all') activeFiltersCount++;
    if (document.getElementById('filter-qa').value !== 'all') activeFiltersCount++;
    
    const totalTagsCount = document.querySelectorAll('.filter-tag-checkbox').length;
    const checkedTagsCount = document.querySelectorAll('.filter-tag-checkbox:checked').length;
    
    // Only count as active filter if a partial subset of tags is checked
    if (checkedTagsCount > 0 && checkedTagsCount < totalTagsCount) {
      activeFiltersCount++;
    }
    
    if (activeFiltersCount > 0) {
      badgeCount.textContent = activeFiltersCount;
      badgeCount.classList.remove('hidden');
    } else {
      badgeCount.classList.add('hidden');
    }
    
    g_deliveriesTypeFilter = null;
    g_deliveriesParalyzedFilter = false;
    g_bugsActiveSeverityFilter = 'all';
    g_bugsActiveTagCategoryFilter.clear();
    filterPanel.classList.add('hidden');
    // Also ensure tag dropdown closes on applying
    if (tagCombo) {
      tagCombo.classList.remove('open');
    }
    renderActivePage();
  });
}

/**
 * Filters the master workItems dataset based on the current active UI filters.
 */
function getFilteredWorkItems() {
  const dateRange = document.getElementById('filter-date-range').value;
  const wiType = document.getElementById('filter-wi-type').value;
  const flowType = document.getElementById('filter-flow-type').value;
  const iteration = document.getElementById('filter-iteration').value;
  const assignee = document.getElementById('filter-assignee').value;
  const qa = document.getElementById('filter-qa').value;
  
  const totalTagsCount = document.querySelectorAll('.filter-tag-checkbox').length;
  const checkedTags = Array.from(document.querySelectorAll('.filter-tag-checkbox:checked')).map(cb => cb.value);
  const isTagFilteringActive = totalTagsCount > 0 && checkedTags.length > 0 && checkedTags.length < totalTagsCount;
  
  const todayMs = TODAY_ANCHOR.getTime();
  let endDateMs = todayMs;
  if (dateRange === 'last-month') {
    endDateMs = new Date(TODAY_ANCHOR.getFullYear(), TODAY_ANCHOR.getMonth(), 0).getTime() + 86399000;
  } else if (dateRange === 'last-year') {
    endDateMs = new Date(TODAY_ANCHOR.getFullYear() - 1, 11, 31).getTime() + 86399000;
  }
  
  return g_raw.workItems.filter(wi => {
    // 0. Exclude items currently in 'Ideias' column
    if (wi.BoardColumn === 'Ideias') return false;
    
    // 1. Filter by Type
    if (wiType !== 'all' && wi.Tipo !== wiType) return false;
    
    // 2. Filter by Iteration
    if (iteration !== 'all' && wi.IterationPath !== iteration) return false;
    
    // 3. Filter by Assignee (Developer)
    if (assignee !== 'all' && wi.Responsavel !== assignee) return false;
    
    // 4. Filter by QA
    if (qa !== 'all') {
      const wiQa = wi.QA || '';
      const roles = g_data.pessoaPapelByWi.get(wi.Id) || [];
      const hasQaMapped = roles.some(r => r.Pessoa === qa && r.Papel === 'QA');
      if (wiQa !== qa && !hasQaMapped) return false;
    }
    
    // 5. Filter by Tag (Multi-select checklist combo)
    if (isTagFilteringActive) {
      const wiTags = g_data.tagsByWi.get(wi.Id) || [];
      const hasMatchingTag = checkedTags.some(t => wiTags.includes(t));
      if (!hasMatchingTag) return false;
    }
    
    // 6. Filter by Flow Type
    const columnInfo = g_data.columnMapObj[wi.BoardColumn] || {};
    const flowCat = columnInfo.TipoFluxo || 'fila';
    if (flowType !== 'all' && flowCat !== flowType) return false;
    
    // 7. Filter by Date Range (Operational Window for Closed / Delivered items)
    const isClosed = wi.State === 'Closed' || wi.BoardColumn === 'ConcluÃ­do';
    if (isClosed) {
      if (!wi.DataFechamento) return false;
      const closedDateObj = new Date(wi.DataFechamento);
      const closedTime = closedDateObj.getTime();
      const diffDays = (todayMs - closedTime) / (1000 * 60 * 60 * 24);
      
      if (dateRange === 'all') {
        // Toda a base: no date limit, show everything historically
        if (diffDays < 0) return false;
      } else if (dateRange === 'this-month') {
        const closedYear = closedDateObj.getFullYear();
        const closedMonth = closedDateObj.getMonth();
        const anchorYear = TODAY_ANCHOR.getFullYear();
        const anchorMonth = TODAY_ANCHOR.getMonth();
        if (closedYear !== anchorYear || closedMonth !== anchorMonth) return false;
      } else if (dateRange === 'last-month') {
        const closedYear = closedDateObj.getFullYear();
        const closedMonth = closedDateObj.getMonth();
        let targetYear = TODAY_ANCHOR.getFullYear();
        let targetMonth = TODAY_ANCHOR.getMonth() - 1;
        if (targetMonth < 0) {
          targetMonth = 11;
          targetYear -= 1;
        }
        if (closedYear !== targetYear || closedMonth !== targetMonth) return false;
      } else if (dateRange === 'this-year') {
        const closedYear = closedDateObj.getFullYear();
        const anchorYear = TODAY_ANCHOR.getFullYear();
        if (closedYear !== anchorYear) return false;
      } else if (dateRange === 'last-year') {
        const closedYear = closedDateObj.getFullYear();
        const anchorYear = TODAY_ANCHOR.getFullYear() - 1;
        if (closedYear !== anchorYear) return false;
      } else {
        const windowDays = parseInt(dateRange, 10);
        if (diffDays < 0 || diffDays > windowDays) return false;
      }
    } else {
      // Open items (WIP, Active Bugs) are ALWAYS shown regardless of age in the period filter
      // EXCEPT: BUGS open should only be considered if created <= endDate
      if (wi.Tipo === 'Bug' && dateRange !== 'all') {
        if (wi.DataCriacao) {
          const createdTime = new Date(wi.DataCriacao).getTime();
          if (createdTime > endDateMs) return false;
        }
      }
    }
    
    return true;
  });
}

function getFilteredAtendimentos() {
  const dateRange = document.getElementById('filter-date-range').value;
  const assignee = document.getElementById('filter-assignee').value;
  const todayMs = TODAY_ANCHOR.getTime();
  
  return g_raw.atendimentosConcluidos.filter(row => {
    // 1. Filter by Assignee
    if (assignee !== 'all' && row.Responsavel !== assignee) return false;
    
    // 2. Filter by Date Range (ClosedDate)
    if (!row.ClosedDate) return false;
    const closedDateObj = new Date(row.ClosedDate);
    const closedTime = closedDateObj.getTime();
    if (isNaN(closedTime)) return false;
    const diffDays = (todayMs - closedTime) / (1000 * 60 * 60 * 24);
    
    if (dateRange === 'all') {
      if (diffDays < 0) return false;
    } else if (dateRange === 'this-month') {
      const closedYear = closedDateObj.getFullYear();
      const closedMonth = closedDateObj.getMonth();
      const anchorYear = TODAY_ANCHOR.getFullYear();
      const anchorMonth = TODAY_ANCHOR.getMonth();
      if (closedYear !== anchorYear || closedMonth !== anchorMonth) return false;
    } else if (dateRange === 'last-month') {
      const closedYear = closedDateObj.getFullYear();
      const closedMonth = closedDateObj.getMonth();
      let targetYear = TODAY_ANCHOR.getFullYear();
      let targetMonth = TODAY_ANCHOR.getMonth() - 1;
      if (targetMonth < 0) {
        targetMonth = 11;
        targetYear -= 1;
      }
      if (closedYear !== targetYear || closedMonth !== targetMonth) return false;
    } else if (dateRange === 'this-year') {
      const closedYear = closedDateObj.getFullYear();
      const anchorYear = TODAY_ANCHOR.getFullYear();
      if (closedYear !== anchorYear) return false;
    } else if (dateRange === 'last-year') {
      const closedYear = closedDateObj.getFullYear();
      const anchorYear = TODAY_ANCHOR.getFullYear() - 1;
      if (closedYear !== anchorYear) return false;
    } else {
      const windowDays = parseInt(dateRange, 10);
      if (diffDays < 0 || diffDays > windowDays) return false;
    }
    return true;
  });
}

// --- DYNAMIC GRID SORTING AND FILTERING ENGINE ---

/**
 * Initializes table headers with sortable classes, sorting indicators,
 * and a second header row containing text inputs for column-specific filtering.
 */
function initializeGridHeaders(tableId, gridKey, onGridChange) {
  let table = document.getElementById(tableId);
  if (!table) return;
  
  if (table.tagName === 'TBODY') {
    table = table.parentNode;
  }
  
  const thead = table.querySelector('thead');
  if (!thead) return;
  
  const columns = GRID_COLUMNS[gridKey];
  if (!columns) return;
  
  const state = g_gridsState[gridKey];
  
  // 1. Rebuild primary header row with sort classes & indicators
  let headerHtml = '<tr>';
  columns.forEach(col => {
    const isSortable = col.type !== 'html' && col.key !== 'Actions';
    if (isSortable) {
      const activeSortClass = state.sortKey === col.key ? (state.sortAsc ? 'sorted-asc' : 'sorted-desc') : '';
      const arrow = state.sortKey === col.key ? (state.sortAsc ? ' â–²' : ' â–¼') : ' â†•';
      headerHtml += `<th class="sortable-th ${activeSortClass}" data-col-key="${col.key}">${col.label}<span class="sort-indicator">${arrow}</span></th>`;
    } else {
      headerHtml += `<th>${col.label}</th>`;
    }
  });
  headerHtml += '</tr>';
  
  // 2. Rebuild secondary filter inputs row
  let filterHtml = '<tr class="table-filter-row">';
  columns.forEach(col => {
    const isFilterable = col.type !== 'html' && col.key !== 'Actions';
    if (isFilterable) {
      const currentFilterVal = state.filters[col.key] || '';
      filterHtml += `<td><input type="text" class="table-col-filter" data-col-key="${col.key}" placeholder="Filtrar..." value="${currentFilterVal}"></td>`;
    } else {
      filterHtml += '<td></td>'; // No filter for Actions / HTML columns
    }
  });
  filterHtml += '</tr>';
  
  thead.innerHTML = headerHtml + filterHtml;
  thead.dataset.gridInitialized = "true";
  
  // 3. Attach click event listeners for sorting
  thead.querySelectorAll('.sortable-th').forEach(th => {
    th.addEventListener('click', () => {
      const colKey = th.getAttribute('data-col-key');
      if (state.sortKey === colKey) {
        // Toggle direction
        state.sortAsc = !state.sortAsc;
      } else {
        state.sortKey = colKey;
        state.sortAsc = true;
      }
      
      // Update header indicators without rebuilding the inputs to preserve DOM focus
      updateGridHeaderSortIndicators(thead, colKey, state.sortAsc);
      state.page = 1; // Reset to page 1 on sort
      onGridChange();
    });
  });
  
  // 4. Attach input event listeners for real-time filtering
  thead.querySelectorAll('.table-col-filter').forEach(input => {
    input.addEventListener('input', (e) => {
      const colKey = input.getAttribute('data-col-key');
      const val = e.target.value;
      if (val === '') {
        delete state.filters[colKey];
      } else {
        state.filters[colKey] = val;
      }
      state.page = 1; // Reset to page 1 on filter
      onGridChange();
    });
  });
}

/**
 * Updates sort styling/indicator text in real-time without rewriting input fields.
 */
function updateGridHeaderSortIndicators(thead, activeKey, isAsc) {
  thead.querySelectorAll('.sortable-th').forEach(th => {
    const colKey = th.getAttribute('data-col-key');
    const indicator = th.querySelector('.sort-indicator');
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (colKey === activeKey) {
      th.classList.add(isAsc ? 'sorted-asc' : 'sorted-desc');
      if (indicator) indicator.textContent = isAsc ? ' â–²' : ' â–¼';
    } else {
      if (indicator) indicator.textContent = ' â†•';
    }
  });
}

/**
 * Processes flat rows: applies active column filtering (text or multi-select checklist),
 * performs typed-based column sorting, and renders results to tbody.
 */
function processAndRenderGridGeneric(tableId, gridKey, mappedRows, renderRowFn, onCountChange) {
  let table = document.getElementById(tableId);
  if (!table) return;
  
  let tbody;
  if (table.tagName === 'TBODY') {
    tbody = table;
    table = table.parentNode;
  } else {
    tbody = table.querySelector('tbody');
  }
  if (!tbody) return;
  
  const state = g_gridsState[gridKey];
  const columns = GRID_COLUMNS[gridKey];

  // Refresh checklist options from latest full dataset
  const thead = table.querySelector('thead');
  if (thead && thead.dataset.gridInitialized) {
    refreshChecklistOptions(thead, gridKey, mappedRows);
  }
  
  // 1. Apply column filtering (text or checklist/array)
  let filtered = [...mappedRows];
  Object.keys(state.filters).forEach(colKey => {
    const filterVal = state.filters[colKey];
    if (Array.isArray(filterVal)) {
      // Checklist multi-select: row must match at least one selected value
      if (filterVal.length === 0) return; // no restriction
      filtered = filtered.filter(row => {
        const cellVal = row[colKey];
        const displayVal = row[colKey + 'Str'] || row[colKey + 'Display'];
        const valStr = String((displayVal !== undefined && displayVal !== null) ? displayVal : (cellVal !== undefined && cellVal !== null ? cellVal : '')).trim();
        return filterVal.includes(valStr);
      });
    } else {
      // Text input: substring match
      const filterText = filterVal.toLowerCase().trim();
      filtered = filtered.filter(row => {
        const cellVal = row[colKey];
        const displayVal = row[colKey + 'Str'] || row[colKey + 'Display'];
        const hasCellVal = cellVal !== undefined && cellVal !== null;
        const hasDisplayVal = displayVal !== undefined && displayVal !== null;
        if (!hasCellVal && !hasDisplayVal) return false;
        const matchCell = hasCellVal && String(cellVal).toLowerCase().includes(filterText);
        const matchDisplay = hasDisplayVal && String(displayVal).toLowerCase().includes(filterText);
        return matchCell || matchDisplay;
      });
    }
  });
  
  // 2. Update count if callback is provided
  if (onCountChange) {
    onCountChange(filtered.length, filtered);
  }
  
  // 3. Apply column sorting
  const sortKey = state.sortKey;
  const isAsc = state.sortAsc;
  const colDef = columns.find(c => c.key === sortKey);
  
  if (sortKey && colDef) {
    filtered.sort((a, b) => {
      let valA = a[sortKey];
      let valB = b[sortKey];
      
      // Handle nulls / undefined - put them at the end always
      const aNull = valA === undefined || valA === null || valA === '-' || valA === '';
      const bNull = valB === undefined || valB === null || valB === '-' || valB === '';
      
      if (aNull && bNull) return 0;
      if (aNull) return 1; // puts empty/null at the end
      if (bNull) return -1;
      
      if (colDef.type === 'number') {
        const numA = typeof valA === 'number' ? valA : parseFloat(String(valA).replace(/[^0-9.-]/g, '')) || 0;
        const numB = typeof valB === 'number' ? valB : parseFloat(String(valB).replace(/[^0-9.-]/g, '')) || 0;
        return isAsc ? numA - numB : numB - numA;
      } else if (colDef.type === 'date') {
        const timeA = new Date(valA).getTime() || 0;
        const timeB = new Date(valB).getTime() || 0;
        return isAsc ? timeA - timeB : timeB - timeA;
      } else {
        // string comparison
        const strA = String(valA).trim();
        const strB = String(valB).trim();
        return isAsc ? strA.localeCompare(strB, 'pt-BR') : strB.localeCompare(strA, 'pt-BR');
      }
    });
  }
  
  // 4. Render to tbody with Pagination
  if (!state.page) state.page = 1;
  const itemsPerPage = 20;
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  
  if (state.page > totalPages && totalPages > 0) state.page = totalPages;
  if (state.page < 1) state.page = 1;

  const startIdx = (state.page - 1) * itemsPerPage;
  const pageItems = filtered.slice(startIdx, startIdx + itemsPerPage);

  tbody.innerHTML = '';
  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${columns.length}" class="text-center" style="color: var(--text-muted); padding: 16px 0;">Nenhum registro encontrado.</td></tr>`;
  } else {
    pageItems.forEach(row => {
      renderRowFn(row, tbody);
    });
  }

  // 5. Build Pagination Controls
  let paginationContainer = table.nextElementSibling;
  if (paginationContainer && paginationContainer.classList.contains('grid-pagination-container')) {
    // Exists, we will just update innerHTML
  } else {
    paginationContainer = document.createElement('div');
    paginationContainer.className = 'grid-pagination-container';
    paginationContainer.style.display = 'flex';
    paginationContainer.style.justifyContent = 'space-between';
    paginationContainer.style.alignItems = 'center';
    paginationContainer.style.padding = '12px 16px';
    paginationContainer.style.background = 'var(--bg-card)';
    paginationContainer.style.borderTop = '1px solid var(--border-light)';
    paginationContainer.style.borderBottomLeftRadius = '8px';
    paginationContainer.style.borderBottomRightRadius = '8px';
    
    table.parentNode.insertBefore(paginationContainer, table.nextSibling);
  }

  if (filtered.length === 0 || filtered.length <= itemsPerPage) {
    paginationContainer.style.display = 'none';
  } else {
    paginationContainer.style.display = 'flex';
    
    const displayStart = startIdx + 1;
    const displayEnd = Math.min(state.page * itemsPerPage, filtered.length);

    paginationContainer.innerHTML = `
      <div style="font-size: 0.85rem; color: var(--text-muted);">
        Mostrando <strong>${displayStart} - ${displayEnd}</strong> de <strong>${filtered.length}</strong>
      </div>
      <div style="display: flex; gap: 8px;">
        <button class="btn-grid-prev" ${state.page <= 1 ? 'disabled' : ''} style="padding: 4px 12px; font-size: 0.85rem; border-radius: 4px; background: var(--bg-body); border: 1px solid var(--border-light); cursor: pointer; color: var(--text-main);">Anterior</button>
        <div style="display: flex; align-items: center; font-size: 0.85rem; padding: 0 8px;">Página ${state.page} de ${totalPages}</div>
        <button class="btn-grid-next" ${state.page >= totalPages ? 'disabled' : ''} style="padding: 4px 12px; font-size: 0.85rem; border-radius: 4px; background: var(--bg-body); border: 1px solid var(--border-light); cursor: pointer; color: var(--text-main);">Próxima</button>
      </div>
    `;

    const btnPrev = paginationContainer.querySelector('.btn-grid-prev');
    const btnNext = paginationContainer.querySelector('.btn-grid-next');

    if (btnPrev && !btnPrev.disabled) {
      btnPrev.addEventListener('click', () => {
        state.page--;
        processAndRenderGridGeneric(tableId, gridKey, mappedRows, renderRowFn, onCountChange);
      });
    }

    if (btnNext && !btnNext.disabled) {
      btnNext.addEventListener('click', () => {
        state.page++;
        processAndRenderGridGeneric(tableId, gridKey, mappedRows, renderRowFn, onCountChange);
      });
    }
  }
  


// 8. SPA ROUTER
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      // Toggle active states
      navItems.forEach(btn => btn.classList.remove('active'));
      item.classList.add('active');
      
      const pageId = item.getAttribute('data-page');
      g_activePage = pageId;
      g_deliveriesTypeFilter = null;
      g_deliveriesParalyzedFilter = false;
      g_flowParalizadosFilter = 'all';
      g_flowActiveColumnFilter = null;
      g_flowTypeFilter = 'all';
      g_bugsActiveSeverityFilter = 'all';
      g_bugsActiveTagCategoryFilter.clear();
      
      // Update header
      const pageTitle = document.getElementById('page-title');
      const pageSubtitle = document.getElementById('page-subtitle');
      
      switch (pageId) {
        case 'overview':
          pageTitle.textContent = "VisÃ£o Geral";
          pageSubtitle.textContent = "Principais KPIs operacionais da Squad Fiscal";
          break;
        case 'flow':
          pageTitle.textContent = "Fluxo e Gargalos";
          pageSubtitle.textContent = "AnÃ¡lise de lead time, aging e gargalos no fluxo de valor";
          break;
        case 'deliveries':
          pageTitle.textContent = "Entregas e Produtividade";
          pageSubtitle.textContent = "HistÃ³rico de throughput e previsibilidade das entregas (P85)";
          break;
        case 'capacity':
          pageTitle.textContent = "Time e Capacidade";
          pageSubtitle.textContent = "DistribuiÃ§Ã£o de WIP, subtasks e mix de atividades";
          break;
        case 'quality':
          pageTitle.textContent = "Qualidade e Bugs";
          pageSubtitle.textContent = "Taxa de defeitos, severidades e fila operacional de bugs";
          break;
        case 'atendimentos':
          pageTitle.textContent = "Atendimentos ConcluÃ­dos";
          pageSubtitle.textContent = "Consulta de atendimentos finalizados da Squad Fiscal";
          break;
        case 'drilldown':
          pageTitle.textContent = "Detalhamento (Drill)";
          pageSubtitle.textContent = "AnÃ¡lise cronolÃ³gica, transiÃ§Ãµes e subtasks de um item especÃ­fico";
          break;
      }
      
      // Show page container
      document.querySelectorAll('.page-section').forEach(section => {
        section.classList.add('hidden');
      });
      document.getElementById(`page-${pageId}`).classList.remove('hidden');
      
      renderActivePage();
    });
  });
}

function renderActivePage() {
  const filteredWIs = getFilteredWorkItems();
  
  switch (g_activePage) {
    case 'overview':
      renderOverview(filteredWIs);
      break;
    case 'flow':
      renderFlow(filteredWIs);
      break;
    case 'deliveries':
      renderDeliveries(filteredWIs);
      break;
    case 'capacity':
      renderCapacity(filteredWIs);
      break;
    case 'quality':
      renderQuality(filteredWIs);
      break;
    case 'alerts':
      renderAlertsPage(filteredWIs);
      break;
    case 'atendimentos':
      renderAtendimentosPage();
      break;
    case 'drilldown':
      renderDrillDownPage();
      break;
  }
}

// Helper to switch pages programmatically (e.g. from Drill-down action clicks)
function navigateToPage(pageId, extraInitCallback) {
  const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (navItem) {
    if (extraInitCallback) extraInitCallback();
    navItem.click();
  }
}

// 9. PAGE 1 RENDERER: VISÃƒO GERAL (OVERVIEW)
function showWorkItemsModal(title, items) {
  // Remove existing modal if any
  const existing = document.getElementById('work-items-modal');
  if (existing) {
    existing.remove();
  }
  
  const backdrop = document.createElement('div');
  backdrop.id = 'work-items-modal';
  backdrop.className = 'modal-backdrop';
  
  // Detect if the modal displays completed/closed items
  const isClosed = title.toLowerCase().includes('concl') || title.toLowerCase().includes('entreg');
  
  // Format rows
  let rowsHtml = '';
  if (items.length === 0) {
    const colspan = isClosed ? 5 : 7;
    rowsHtml = `<tr><td colspan="${colspan}" style="text-align: center; color: var(--text-muted); padding: 24px 0;">Nenhum item encontrado.</td></tr>`;
  } else {
    items.forEach(wi => {
      let closeDtStr = '-';
      if (isClosed) {
        if (wi.DataFechamento) {
          closeDtStr = new Date(wi.DataFechamento).toLocaleDateString('pt-BR');
        } else if (wi.originalWi && wi.originalWi.DataFechamento) {
          closeDtStr = new Date(wi.originalWi.DataFechamento).toLocaleDateString('pt-BR');
        } else {
          const delivery = g_data.entregasMap.get(wi.Id);
          if (delivery && delivery.CloseDate) {
            closeDtStr = new Date(delivery.CloseDate).toLocaleDateString('pt-BR');
          }
        }
      }
      
      let middleColHtml = '';
      if (isClosed) {
        middleColHtml = `<td>${closeDtStr}</td>`;
      } else {
        // Calculate Data de Movimento
        let moveDate = null;
        const trans = g_data.transicoesByWi.get(wi.Id) || [];
        const boardTransitions = trans
          .filter(t => t.Campo === 'BoardColumn')
          .sort((a, b) => new Date(b.DataMudanca) - new Date(a.DataMudanca));

        if (boardTransitions.length > 0) {
          moveDate = new Date(boardTransitions[0].DataMudanca);
        } else {
          // Fallback: activeCol.TempoAtualHoras
          const activeColTime = g_data.tempoColunaByWi.get(wi.Id) || [];
          const activeCol = activeColTime.find(c => c.ColunaAtual === 'Sim');
          if (activeCol && activeCol.TempoAtualHoras !== undefined) {
            const timeDiffMs = activeCol.TempoAtualHoras * 60 * 60 * 1000;
            moveDate = new Date(TODAY_ANCHOR.getTime() - timeDiffMs);
          } else if (wi.DataAlteracao) {
            moveDate = new Date(wi.DataAlteracao);
          } else if (wi.DataCriacao) {
            moveDate = new Date(wi.DataCriacao);
          }
        }
        const moveDateStr = moveDate && !isNaN(moveDate.getTime()) ? moveDate.toLocaleDateString('pt-BR') : '-';

        // Calculate Dias em aberto
        let diasAberto = null;
        if (wi.DiasAberto !== undefined && wi.DiasAberto !== null && wi.DiasAberto !== '') {
          diasAberto = parseInt(wi.DiasAberto);
        } else if (wi.originalWi && wi.originalWi.DiasAberto !== undefined && wi.originalWi.DiasAberto !== null) {
          diasAberto = parseInt(wi.originalWi.DiasAberto);
        }
        if (diasAberto === null || isNaN(diasAberto)) {
          if (wi.DataCriacao) {
            const createdDate = new Date(wi.DataCriacao);
            if (!isNaN(createdDate.getTime())) {
              const diffTime = Math.abs(TODAY_ANCHOR.getTime() - createdDate.getTime());
              diasAberto = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            }
          }
        }
        const diasAbertoStr = (diasAberto !== null && !isNaN(diasAberto)) ? `${diasAberto} dias` : '-';

        middleColHtml = `
          <td>${wi.BoardColumn || '-'}</td>
          <td>${moveDateStr}</td>
          <td>${diasAbertoStr}</td>
        `;
      }
      
      rowsHtml += `
        <tr>
          <td style="font-weight: 600; color: var(--color-primary); width: 80px;">
            <a href="#" class="wi-drill-link" data-id="${wi.Id}" style="color: var(--color-primary); font-weight: 700; text-decoration: none; border-bottom: 1px dashed var(--color-primary); transition: var(--transition-smooth);">#${wi.Id}</a>
          </td>
          <td style="font-weight: 500; max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${wi.Titulo}">${wi.Titulo}</td>
          <td>${getWiTypeIcon(wi.Tipo)}</td>
          ${middleColHtml}
          <td>${wi.Responsavel || '-'}</td>
        </tr>
      `;
    });
  }
  
  const middleHeaderHtml = isClosed ? '<th>Data de ConclusÃ£o</th>' : '<th>Coluna</th><th>Data de Movimento</th><th>Dias em aberto</th>';
  
  backdrop.innerHTML = `
    <div class="modal-container">
      <div class="modal-header">
        <h2>${title} (${items.length})</h2>
        <button class="modal-close" id="modal-close-btn">&times;</button>
      </div>
      <div class="modal-body">
        <div class="modal-table-container">
          <table class="modal-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>TÃ­tulo</th>
                <th>Tipo</th>
                ${middleHeaderHtml}
                <th>ResponsÃ¡vel</th>
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
  
  document.body.appendChild(backdrop);
  
  // Force reflow and show transition
  setTimeout(() => backdrop.classList.add('show'), 10);
  
  // Close functions
  const closeModal = () => {
    backdrop.classList.remove('show');
    setTimeout(() => backdrop.remove(), 250);
  };
  
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });
  
  document.getElementById('modal-close-btn').addEventListener('click', closeModal);
  
  // Drill-down link clicks
  backdrop.querySelectorAll('.wi-drill-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const id = link.getAttribute('data-id');
      closeModal();
      
      // Navigate to drilldown page
      navigateToPage('drilldown', () => {
        g_selectedDrillDownId = id;
      });
    });
  });
  
  // Enable interactive sorting inside the modal table
  const modalTable = backdrop.querySelector('.modal-table');
  if (modalTable && items.length > 0) {
    makeModalTableSortable(modalTable);
  }
}

// Client-side helper function to perform instant interactive column sorting in modal tables
function makeModalTableSortable(table) {
  const headers = table.querySelectorAll('th');
  headers.forEach((th, index) => {
    th.style.cursor = 'pointer';
    th.style.userSelect = 'none';
    th.innerHTML = th.textContent + ' <span class="sort-arrow" style="opacity: 0.5;">â†•</span>';
    
    let asc = true;
    th.addEventListener('click', () => {
      const tbody = table.querySelector('tbody');
      const rows = Array.from(tbody.querySelectorAll('tr'));
      
      // Reset arrows on other headers
      table.querySelectorAll('.sort-arrow').forEach(arrow => {
        arrow.textContent = 'â†•';
        arrow.style.opacity = '0.5';
      });
      
      const arrow = th.querySelector('.sort-arrow');
      arrow.textContent = asc ? ' â–²' : ' â–¼';
      arrow.style.opacity = '1';
      
      rows.sort((rowA, rowB) => {
        const cellA = rowA.cells[index];
        const cellB = rowB.cells[index];
        if (!cellA || !cellB) return 0;
        
        let valA = cellA.textContent.trim();
        let valB = cellB.textContent.trim();
        
        // Handle ID comparison
        if (index === 0) {
          const numA = parseInt(valA.replace(/#/g, '')) || 0;
          const numB = parseInt(valB.replace(/#/g, '')) || 0;
          return asc ? numA - numB : numB - numA;
        }
        
        // Check if value is a date (DD/MM/YYYY)
        const dateRegex = /^\d{2}\/\d{2}\/\d{4}/;
        if (dateRegex.test(valA) && dateRegex.test(valB)) {
          const parseDate = (dStr) => {
            const parts = dStr.split(' ')[0].split('/');
            return new Date(parts[2], parts[1] - 1, parts[0]).getTime();
          };
          return asc ? parseDate(valA) - parseDate(valB) : parseDate(valB) - parseDate(valA);
        }
        
        // Check if numeric (handles "15 dias", "2.5 dias", etc.)
        const parseNumeric = (str) => {
          const cleaned = str.replace(/[^\d.,-]/g, '').replace(',', '.');
          return cleaned ? parseFloat(cleaned) : NaN;
        };
        const nA = parseNumeric(valA);
        const nB = parseNumeric(valB);
        if (!isNaN(nA) && !isNaN(nB)) {
          return asc ? nA - nB : nB - nA;
        }
        
        // Text comparison
        return asc ? valA.localeCompare(valB, 'pt-BR') : valB.localeCompare(valA, 'pt-BR');
      });
      
      // Re-append sorted rows
      tbody.innerHTML = '';
      rows.forEach(r => tbody.appendChild(r));
      asc = !asc;
    });
  });
}

function renderOverview(filteredWIs) {
  const todayMs = TODAY_ANCHOR.getTime();
  
  // Calculate analyzed period dates
  const dateRange = document.getElementById('filter-date-range').value;
  const today = new Date(TODAY_ANCHOR);
  let startDate, endDate;
  
  if (dateRange === 'all') {
    let minDate = new Date(today);
    let maxDate = new Date(today);
    let found = false;
    filteredWIs.forEach(wi => {
      const closedDateStr = wi.DataFechamento;
      if (closedDateStr) {
        const d = new Date(closedDateStr);
        if (!isNaN(d.getTime())) {
          if (!found || d < minDate) minDate = d;
          if (!found || d > maxDate) maxDate = d;
          found = true;
        }
      }
    });
    startDate = minDate;
    endDate = maxDate;
  } else if (dateRange === 'this-month') {
    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    endDate = new Date(today);
  } else if (dateRange === 'last-month') {
    startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    endDate = new Date(today.getFullYear(), today.getMonth(), 0);
  } else if (dateRange === 'this-year') {
    startDate = new Date(today.getFullYear(), 0, 1);
    endDate = new Date(today);
  } else if (dateRange === 'last-year') {
    startDate = new Date(today.getFullYear() - 1, 0, 1);
    endDate = new Date(today.getFullYear() - 1, 11, 31);
  } else if (dateRange === 'this-month') {
    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    endDate = new Date(today);
  } else if (dateRange === 'last-month') {
    startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    endDate = new Date(today.getFullYear(), today.getMonth(), 0);
  } else {
    const days = parseInt(dateRange, 10);
    startDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
    endDate = new Date(today);
  }
  
  const formatDate = (d) => {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };
  
  const periodStr = `PerÃ­odo Analisado: de ${formatDate(startDate)} a ${formatDate(endDate)}`;
  const periodText = document.getElementById('txt-overview-period');
  if (periodText) {
    periodText.textContent = periodStr;
  }
  
  // Separations
  const openWIs = filteredWIs.filter(wi => wi.State !== 'Closed' && wi.BoardColumn !== 'ConcluÃ­do');
  const closedWIs = filteredWIs.filter(wi => wi.State === 'Closed' || wi.BoardColumn === 'ConcluÃ­do');
  
  // 1. WIP Ativo
  const cardWip = document.getElementById('card-kpi-wip');
  if (cardWip) {
    const newCardWip = cardWip.cloneNode(true);
    cardWip.parentNode.replaceChild(newCardWip, cardWip);
    newCardWip.querySelector('#kpi-wip').textContent = openWIs.length;
    newCardWip.addEventListener('click', () => {
      showWorkItemsModal("Itens em WIP Ativo", openWIs);
    });
  } else {
    document.getElementById('kpi-wip').textContent = openWIs.length;
  }
  
  // 2. Entregas Recentes
  const cardDeliveries = document.getElementById('card-kpi-deliveries');
  if (cardDeliveries) {
    const newCardDeliveries = cardDeliveries.cloneNode(true);
    cardDeliveries.parentNode.replaceChild(newCardDeliveries, cardDeliveries);
    newCardDeliveries.querySelector('#kpi-deliveries').textContent = closedWIs.length;
    newCardDeliveries.addEventListener('click', () => {
      showWorkItemsModal("Itens ConcluÃ­dos (Entregas Recentes)", closedWIs);
    });
  } else {
    document.getElementById('kpi-deliveries').textContent = closedWIs.length;
  }
  
  // 3. Lead & Cycle Time averages
  let totalLead = 0;
  let totalCycle = 0;
  let countLead = 0;
  let countCycle = 0;
  
  closedWIs.forEach(wi => {
    const delivery = g_data.entregasMap.get(wi.Id);
    if (delivery) {
      totalLead += delivery.LeadTimeDias;
      countLead++;
      
      if (delivery.CycleTimeDias !== null && delivery.CycleTimeDias !== undefined) {
        totalCycle += delivery.CycleTimeDias;
        countCycle++;
      }
    } else {
      // Fallback lead time calculation from creation
      if (wi.DataCriacao && wi.DataFechamento) {
        const lTime = (new Date(wi.DataFechamento).getTime() - new Date(wi.DataCriacao).getTime()) / (1000 * 60 * 60 * 24);
        if (lTime >= 0) {
          totalLead += lTime;
          countLead++;
        }
      }
    }
  });
  
  const avgLead = countLead > 0 ? (totalLead / countLead).toFixed(1) : '-';
  const avgCycle = countCycle > 0 ? (totalCycle / countCycle).toFixed(1) : '-';
  
  document.getElementById('kpi-lead-time').textContent = avgLead === '-' ? '-' : `${avgLead}d`;
  document.getElementById('kpi-cycle-time').textContent = avgCycle === '-' ? '-' : `${avgCycle}d`;
  
  // 4. Bugs Abertos & Severidades
  const bugsOpen = openWIs.filter(wi => wi.Tipo === 'Bug');
  
  const cardBugs = document.getElementById('card-kpi-bugs-open');
  if (cardBugs) {
    const newCardBugs = cardBugs.cloneNode(true);
    cardBugs.parentNode.replaceChild(newCardBugs, cardBugs);
    newCardBugs.querySelector('#kpi-bugs-open').textContent = bugsOpen.length;
    
    const criticalBugs = bugsOpen.filter(wi => {
      const sev = (wi.Severidade || '').toLowerCase();
      return sev.includes('1') || sev.includes('crit') || sev.includes('bloq') || sev.includes('high') || sev.includes('alta') || sev.includes('alto');
    });
    newCardBugs.querySelector('#kpi-bugs-critical').textContent = `${criticalBugs.length} de severidade alta`;
    
    newCardBugs.addEventListener('click', () => {
      showWorkItemsModal("Bugs Ativos em Aberto", bugsOpen);
    });
  } else {
    document.getElementById('kpi-bugs-open').textContent = bugsOpen.length;
    const criticalBugs = bugsOpen.filter(wi => {
      const sev = (wi.Severidade || '').toLowerCase();
      return sev.includes('1') || sev.includes('crit') || sev.includes('bloq') || sev.includes('high') || sev.includes('alta') || sev.includes('alto');
    });
    document.getElementById('kpi-bugs-critical').textContent = `${criticalBugs.length} de severidade alta`;
  }
  
  // Render open bugs severity split bar
  const bugsSeveritySplit = document.getElementById('bugs-severity-split');
  if (bugsOpen.length > 0) {
    let high = 0, med = 0, low = 0;
    bugsOpen.forEach(b => {
      const sev = (b.Severidade || '').toLowerCase();
      if (sev.includes('1') || sev.includes('crit') || sev.includes('bloq') || sev.includes('high') || sev.includes('alta') || sev.includes('alto')) high++;
      else if (sev.includes('2') || sev.includes('3') || sev.includes('med') || sev.includes('mÃ©dia') || sev.includes('media') || sev.includes('mÃ©dio') || sev.includes('medio')) med++;
      else low++;
    });
    
    const pctHigh = ((high / bugsOpen.length) * 100).toFixed(0);
    const pctMed = ((med / bugsOpen.length) * 100).toFixed(0);
    const pctLow = ((low / bugsOpen.length) * 100).toFixed(0);
    
    bugsSeveritySplit.innerHTML = `
      <div style="margin-bottom: 12px; font-weight: 500;">DivisÃ£o por Severidade (${bugsOpen.length})</div>
      <div class="stacked-progress-track" style="margin: 8px 0; height: 16px;">
        <div class="stacked-segment" style="width: ${pctHigh}%; background-color: var(--color-danger);" title="Alta: ${high}"></div>
        <div class="stacked-segment" style="width: ${pctMed}%; background-color: var(--color-warning);" title="MÃ©dia: ${med}"></div>
        <div class="stacked-segment" style="width: ${pctLow}%; background-color: var(--color-info);" title="Baixa: ${low}"></div>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted);">
        <span>CrÃ­tico: ${high}</span>
        <span>MÃ©dio: ${med}</span>
        <span>Baixo: ${low}</span>
      </div>
    `;
  } else {
    bugsSeveritySplit.innerHTML = `<div class="placeholder-text" style="color: var(--text-muted); font-size: 0.85rem; padding: 20px 0;">Nenhum bug ativo para a seleÃ§Ã£o.</div>`;
  }
  
  // 5. Bug Rate Geral
  let globalBugRateStr = '-';
  if (g_raw.metricas.length > 0) {
    const rawRate = parseFloat(g_raw.metricas[0].BugRate);
    if (!isNaN(rawRate)) {
      globalBugRateStr = `${(rawRate * 100).toFixed(2)}%`;
    }
  }
  
  // Recalculate filtered Bug Rate for comparison (denominator is completed Stories in active period)
  const filteredStories = closedWIs.filter(wi => wi.Tipo === 'User Story');
  const filteredBugs = filteredWIs.filter(wi => wi.Tipo === 'Bug');
  let filteredBugRateStr = '-';
  if (filteredStories.length > 0) {
    const rate = ((filteredBugs.length / filteredStories.length) * 100).toFixed(2);
    filteredBugRateStr = `${rate}%`;
  }
  
  document.getElementById('kpi-bug-rate').textContent = filteredBugRateStr !== '-' ? filteredBugRateStr : globalBugRateStr;
  
  // 6. WIP por BoardColumn (Vertical Bar Chart SVG)
  renderWipByColumnChart(openWIs);
  
  // 7. Throughput Semanal (Emerald Area Chart SVG)
  renderThroughputChart(closedWIs);
  
  // 8. Alertas e Sinalizações Críticas
  processAlerts(filteredWIs);
  renderOverviewAlerts();
  
  // 8.5. Tabela de Envelhecimento (Top 20 Itens com mais dias em aberto)
  renderAgingTable(openWIs);

  // 8b. Bugs ConcluÃ­dos KPI Card
  const bugsClosed = closedWIs.filter(wi => wi.Tipo === 'Bug');
  const cardBugsClosed = document.getElementById('card-kpi-bugs-closed');
  if (cardBugsClosed) {
    const newCardBugsClosed = cardBugsClosed.cloneNode(true);
    cardBugsClosed.parentNode.replaceChild(newCardBugsClosed, cardBugsClosed);
    
    newCardBugsClosed.querySelector('#kpi-bugs-closed').textContent = bugsClosed.length;
    newCardBugsClosed.querySelector('#kpi-bugs-closed-meta').textContent = `${bugsClosed.length} no perÃ­odo`;
    
    newCardBugsClosed.addEventListener('click', () => {
      showWorkItemsModal("Bugs ConcluÃ­dos no PerÃ­odo", bugsClosed);
    });
  } else {
    const closedBugsCountEl = document.getElementById('kpi-bugs-closed');
    if (closedBugsCountEl) closedBugsCountEl.textContent = bugsClosed.length;
  }

  // 9. Atendimentos KPI Card
  const filteredAtendimentos = getFilteredAtendimentos();
  const totalAtendimentosHours = filteredAtendimentos.reduce((sum, item) => sum + (parseFloat(item.CompletedWork) || 0), 0);
  
  const cardAtendimentos = document.getElementById('card-kpi-atendimentos');
  if (cardAtendimentos) {
    const newCardAtendimentos = cardAtendimentos.cloneNode(true);
    cardAtendimentos.parentNode.replaceChild(newCardAtendimentos, cardAtendimentos);
    
    newCardAtendimentos.querySelector('#kpi-atendimentos-count').textContent = filteredAtendimentos.length;
    newCardAtendimentos.querySelector('#kpi-atendimentos-hours').textContent = `${totalAtendimentosHours.toFixed(1)}h totalizadas`;
    
    newCardAtendimentos.addEventListener('click', () => {
      navigateToPage('atendimentos');
    });
  } else {
    const countEl = document.getElementById('kpi-atendimentos-count');
    const hoursEl = document.getElementById('kpi-atendimentos-hours');
    if (countEl) countEl.textContent = filteredAtendimentos.length;
    if (hoursEl) hoursEl.textContent = `${totalAtendimentosHours.toFixed(1)}h totalizadas`;
  }
}

function renderWipByColumnChart(openWIs) {
  const container = document.getElementById('chart-wip-column');
  container.innerHTML = '';
  
  // Columns order
  const flowColumns = [
    'Ideias', 'Backlog', 'Fazendo AnÃ¡lise', 'DisponÃ­vel para Dev', 'Dev implementando',
    'DisponÃ­vel RevisÃ£o de CÃ³digo', 'Realizando RevisÃ£o de CÃ³digo', 'DisponÃ­vel para Teste',
    'Testando', 'Aguardando pipeline', 'Pronto pra Release'
  ];
  
  // Group and count
  const counts = {};
  flowColumns.forEach(c => counts[c] = 0);
  
  openWIs.forEach(wi => {
    let col = wi.BoardColumn;
    if (col === 'IdÃ©ias') col = 'Ideias';
    if (counts[col] !== undefined) {
      counts[col]++;
    }
  });
  
  const data = flowColumns.map(col => ({ column: col, label: COL_ABBR[col] || col, count: counts[col] }));
  const maxCount = Math.max(...data.map(d => d.count), 5);
  
  if (openWIs.length === 0) {
    container.innerHTML = `<span class="placeholder-text">Sem WIP ativo na seleÃ§Ã£o atual</span>`;
    return;
  }
  
  // Draw SVG
  const width = 500;
  const height = 220;
  const paddingLeft = 35;
  const paddingRight = 10;
  const paddingTop = 20;
  const paddingBottom = 40;
  
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;
  const colW = chartW / data.length;
  
  let gridLines = '';
  for (let i = 0; i <= 4; i++) {
    const yVal = Math.round((maxCount / 4) * i);
    const y = paddingTop + chartH - (yVal / maxCount) * chartH;
    gridLines += `
      <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="hsla(263, 90%, 66%, 0.08)" stroke-width="1" stroke-dasharray="4,4"/>
      <text x="${paddingLeft - 8}" y="${y + 4}" fill="var(--text-muted)" font-size="9" text-anchor="end">${yVal}</text>
    `;
  }
  
  let bars = '';
  data.forEach((d, idx) => {
    const barH = d.count > 0 ? (d.count / maxCount) * chartH : 0;
    const x = paddingLeft + idx * colW + colW * 0.15;
    const y = paddingTop + chartH - barH;
    const barW = colW * 0.7;
    
    // Draw bar and count label
    bars += `
      <g class="svg-bar-group" data-column="${d.column}" data-label="${d.label}" data-count="${d.count}">
        <rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="url(#purpleGrad)" rx="3" ry="3" class="svg-bar"/>
        ${d.count > 0 ? `<text x="${x + barW / 2}" y="${y - 4}" fill="var(--text-main)" font-size="10" font-weight="600" text-anchor="middle">${d.count}</text>` : ''}
        <text x="${x + barW / 2}" y="${height - paddingBottom + 16}" fill="var(--text-muted)" font-size="8" font-weight="500" text-anchor="middle" transform="rotate(-15, ${x + barW / 2}, ${height - paddingBottom + 16})">${d.label}</text>
      </g>
    `;
  });
  
  container.innerHTML = `
    <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="purpleGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--color-primary)"/>
          <stop offset="100%" stop-color="hsl(280, 85%, 60%)"/>
        </linearGradient>
      </defs>
      ${gridLines}
      ${bars}
      <!-- Axis lines -->
      <line x1="${paddingLeft}" y1="${paddingTop + chartH}" x2="${width - paddingRight}" y2="${paddingTop + chartH}" stroke="var(--border-color)" stroke-width="1.5"/>
      <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${paddingTop + chartH}" stroke="var(--border-color)" stroke-width="1.5"/>
    </svg>
  `;
  
  // Attach click listeners to SVG bar groups for modal drill-down
  container.querySelectorAll('.svg-bar-group').forEach(group => {
    const count = parseInt(group.getAttribute('data-count'), 10);
    if (count > 0) {
      group.style.cursor = 'pointer';
      group.addEventListener('click', () => {
        const colName = group.getAttribute('data-column');
        const filtered = openWIs.filter(wi => {
          let col = wi.BoardColumn;
          if (col === 'IdÃ©ias') col = 'Ideias';
          return col === colName;
        });
        showWorkItemsModal(`Itens na coluna: ${colName}`, filtered);
      });
    }
  });
}

function renderThroughputChart(closedWIs) {
  const container = document.getElementById('chart-throughput-weekly');
  container.innerHTML = '';
  
  if (closedWIs.length === 0) {
    container.innerHTML = `<span class="placeholder-text">Sem entregas no perÃ­odo para a seleÃ§Ã£o atual</span>`;
    return;
  }
  
  const today = new Date(TODAY_ANCHOR);
  const dayMs = 24 * 60 * 60 * 1000;
  
  // Find current Sunday
  const currentSunday = new Date(today);
  currentSunday.setDate(today.getDate() - today.getDay());
  currentSunday.setHours(0, 0, 0, 0);
  const currentSundayMs = currentSunday.getTime();
  
  // Define 4 sequential calendar weeks (Sunday to Saturday) millisecond boundaries
  const t_week3_start = currentSundayMs;
  const t_week3_end = currentSundayMs + 7 * dayMs; // Esta semana
  
  const t_week2_start = currentSundayMs - 7 * dayMs;
  const t_week2_end = currentSundayMs; // Semana passada
  
  const t_week1_start = currentSundayMs - 14 * dayMs;
  const t_week1_end = currentSundayMs - 7 * dayMs; // 2 semanas atrÃ¡s
  
  const t_week0_start = currentSundayMs - 21 * dayMs;
  const t_week0_end = currentSundayMs - 14 * dayMs; // 3 semanas atrÃ¡s
  
  // Group into 4 weekly bins with items
  const weekItems = [[], [], [], []];
  
  closedWIs.forEach(wi => {
    if (!wi.DataFechamento) return;
    const closedTime = new Date(wi.DataFechamento).getTime();
    
    if (closedTime >= t_week3_start && closedTime < t_week3_end) {
      weekItems[3].push(wi); // Esta semana
    } else if (closedTime >= t_week2_start && closedTime < t_week2_end) {
      weekItems[2].push(wi); // Semana passada
    } else if (closedTime >= t_week1_start && closedTime < t_week1_end) {
      weekItems[1].push(wi); // 2 semanas atrÃ¡s
    } else if (closedTime >= t_week0_start && closedTime < t_week0_end) {
      weekItems[0].push(wi); // 3 semanas atrÃ¡s
    }
  });
  
  const weekCounts = weekItems.map(list => list.length);
  const labels = ["3 semanas atrÃ¡s", "2 semanas atrÃ¡s", "Semana passada", "Esta semana"];
  const maxVal = Math.max(...weekCounts, 5);
  
  // Draw SVG area chart
  const width = 500;
  const height = 220;
  const paddingLeft = 35;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;
  
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;
  const stepX = chartW / 3;
  
  // Generate points
  const points = weekCounts.map((val, idx) => {
    const x = paddingLeft + idx * stepX;
    const y = paddingTop + chartH - (val / maxVal) * chartH;
    return { x, y, val };
  });
  
  // Paths
  let pathD = `M ${points[0].x} ${points[0].y}`;
  let areaD = `M ${points[0].x} ${paddingTop + chartH} L ${points[0].x} ${points[0].y}`;
  
  for (let i = 1; i < points.length; i++) {
    pathD += ` L ${points[i].x} ${points[i].y}`;
    areaD += ` L ${points[i].x} ${points[i].y}`;
  }
  areaD += ` L ${points[points.length - 1].x} ${paddingTop + chartH} Z`;
  
  let gridLines = '';
  for (let i = 0; i <= 4; i++) {
    const yVal = Math.round((maxVal / 4) * i);
    const y = paddingTop + chartH - (yVal / maxVal) * chartH;
    gridLines += `
      <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="hsla(162, 76%, 45%, 0.08)" stroke-width="1" stroke-dasharray="4,4"/>
      <text x="${paddingLeft - 8}" y="${y + 4}" fill="var(--text-muted)" font-size="9" text-anchor="end">${yVal}</text>
    `;
  }
  
  let markers = '';
  points.forEach((p, idx) => {
    markers += `
      <g class="svg-dot-group" data-week-idx="${idx}" style="cursor: pointer;">
        <!-- Wide invisible click zone -->
        <circle cx="${p.x}" cy="${p.y}" r="15" fill="transparent" />
        <circle cx="${p.x}" cy="${p.y}" r="5" fill="var(--color-flow-prerelease)" stroke="#fff" stroke-width="1.5" class="svg-dot"/>
        <text x="${p.x}" y="${p.y - 10}" fill="var(--text-main)" font-size="10" font-weight="600" text-anchor="middle">${p.val}</text>
        <text x="${p.x}" y="${height - paddingBottom + 18}" fill="var(--text-muted)" font-size="8.5" font-weight="500" text-anchor="middle">${labels[idx]}</text>
      </g>
    `;
  });
  
  container.innerHTML = `
    <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="emeraldArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--color-flow-prerelease)" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="var(--color-flow-prerelease)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${gridLines}
      <!-- Filled Area -->
      <path d="${areaD}" fill="url(#emeraldArea)" class="svg-area"/>
      <!-- Line -->
      <path d="${pathD}" fill="none" stroke="var(--color-flow-prerelease)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="svg-line"/>
      ${markers}
      <!-- Axis lines -->
      <line x1="${paddingLeft}" y1="${paddingTop + chartH}" x2="${width - paddingRight}" y2="${paddingTop + chartH}" stroke="var(--border-color)" stroke-width="1.5"/>
      <line x1="${paddingLeft}" y1="${paddingTop}" x2="${paddingLeft}" y2="${paddingTop + chartH}" stroke="var(--border-color)" stroke-width="1.5"/>
    </svg>
  `;
  
  // Attach click listeners to Throughput dots
  container.querySelectorAll('.svg-dot-group').forEach(group => {
    group.addEventListener('click', () => {
      const idx = parseInt(group.getAttribute('data-week-idx'), 10);
      const items = weekItems[idx];
      const weekLabel = labels[idx];
      
      let startDate, endDate;
      
      if (idx === 3) {
        startDate = new Date(t_week3_start);
        endDate = new Date(t_week3_end - 1000);
      } else if (idx === 2) {
        startDate = new Date(t_week2_start);
        endDate = new Date(t_week2_end - 1000);
      } else if (idx === 1) {
        startDate = new Date(t_week1_start);
        endDate = new Date(t_week1_end - 1000);
      } else {
        startDate = new Date(t_week0_start);
        endDate = new Date(t_week0_end - 1000);
      }
      
      const formatDate = (d) => {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      };
      
      const title = `Entregas: ${weekLabel} (de ${formatDate(startDate)} a ${formatDate(endDate)})`;
      showWorkItemsModal(title, items);
    });
  });
}

function renderAgingTable(openWIs) {
  const tbody = document.getElementById('table-overview-aging-wip');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  const badgeTotal = document.getElementById('lbl-aging-total-count');
  
  // Sort open work items by DaysOpen descending
  const sorted = [...openWIs].sort((a, b) => {
    const valA = parseInt(a.DiasAberto) || 0;
    const valB = parseInt(b.DiasAberto) || 0;
    return valB - valA;
  }).slice(0, 20);
  
  if (badgeTotal) {
    badgeTotal.textContent = `${sorted.length} Itens em Foco`;
  }
  
  if (sorted.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="color: var(--text-muted); padding: 16px 0;">Nenhum item ativo no momento.</td></tr>`;
    return;
  }
  
  sorted.forEach(wi => {
    const row = document.createElement('tr');
    
    // Find active column time
    const activeColTime = g_data.tempoColunaByWi.get(wi.Id) || [];
    const activeCol = activeColTime.find(c => c.ColunaAtual === 'Sim');
    let colTimeStr = '-';
    if (activeCol) {
      const days = activeCol.TempoAtualHoras / 24;
      colTimeStr = days >= 1 ? `${days.toFixed(1)}d` : `${activeCol.TempoAtualHoras.toFixed(0)}h`;
    }
    
    row.innerHTML = `
      <td><a href="#" class="drill-link" data-wi-id="${wi.Id}">#${wi.Id}</a></td>
      <td class="text-ellipsis" title="${wi.Titulo}"><strong>${wi.Titulo}</strong></td>
      <td>${getWiTypeIcon(wi.Tipo)}</td>
      <td><span class="badge badge-outline">${wi.BoardColumn}</span></td>
      <td>${wi.Responsavel || 'NENHUM'}</td>
      <td>
        <strong style="color: var(--color-danger);">${wi.DiasAberto} dias</strong>
        <span style="font-size: 0.72rem; color: var(--text-muted); display: block;">na coluna: ${colTimeStr}</span>
      </td>
    `;
    
    // Hook click to go to drill-down
    row.querySelector('.drill-link').addEventListener('click', (e) => {
      e.preventDefault();
      const id = e.target.getAttribute('data-wi-id');
      navigateToPage('drilldown', () => { g_selectedDrillDownId = id; });
    });
    
    tbody.appendChild(row);
  });
}

// 10. PAGE 2 RENDERER: FLUXO E GARGALOS (FLOW & BOTTLENECK)
function renderFlow(filteredWIs) {
  const activeWIs = filteredWIs.filter(wi => wi.State !== 'Closed' && wi.BoardColumn !== 'ConcluÃ­do');
  
  document.getElementById('lbl-flow-wip-count').textContent = `${activeWIs.length} itens ativos`;
  
  // 1. TOP 5 COLUNAS POR TEMPO MÃ‰DIO (Horizontal Bar Chart)
  renderTopColumnsFlowChart(filteredWIs);
  
  // 2. ITENS PARALISADOS VS ATIVOS (Donut Chart)
  renderParalizadosDonutChart(activeWIs);
  
  // 3. EFICIÃŠNCIA DO FLUXO (FILA vs TRABALHO vs HANDOFF)
  renderFlowEfficiencySegmented(filteredWIs);
  
  // Filter activeWIs based on Donut selection
  let wipGridItems = activeWIs;
  if (g_flowParalizadosFilter === 'paralizados') {
    wipGridItems = activeWIs.filter(wi => {
      const pInfo = g_data.paralizacaoResumoMap.get(wi.Id);
      return pInfo && pInfo.ParadoAgora;
    });
  } else if (g_flowParalizadosFilter === 'ativos') {
    wipGridItems = activeWIs.filter(wi => {
      const pInfo = g_data.paralizacaoResumoMap.get(wi.Id);
      return !pInfo || !pInfo.ParadoAgora;
    });
  }
  
  // 4. TABELA DE WIP EM ANDAMENTO
  renderFlowWipTable(wipGridItems);
  
  // 5. MAPA DE RETRANSIÃ‡Ã•ES RECENTES (RETRABALHO DE -> PARA)
  renderRetransitionsTimeline(filteredWIs);
}

function renderParalizadosDonutChart(activeWIs) {
  const container = document.getElementById('chart-flow-paralizacao-donut');
  const legend = document.getElementById('flow-paralizacao-legend');
  container.innerHTML = '';
  legend.innerHTML = '';
  
  if (activeWIs.length === 0) {
    container.innerHTML = `<span class="placeholder-text">Sem itens ativos</span>`;
    return;
  }
  
  let paralyzedCount = 0;
  let activeCount = 0;
  let totalHoursParalyzedNow = 0;
  
  activeWIs.forEach(wi => {
    const pInfo = g_data.paralizacaoResumoMap.get(wi.Id);
    if (pInfo && pInfo.ParadoAgora) {
      paralyzedCount++;
      totalHoursParalyzedNow += pInfo.TotalHorasParado;
    } else {
      activeCount++;
    }
  });
  
  const total = activeWIs.length;
  
  // Draw SVG Donut
  const width = 280;
  const height = 280;
  const cx = width / 2;
  const cy = height / 2;
  const radius = 100;
  const strokeWidth = 36;
  
  let svgContent = '';
  let startAngle = -90;
  
  const items = [
    { key: 'paralizados', label: 'Paralisados', count: paralyzedCount, color: 'var(--color-danger)' },
    { key: 'ativos', label: 'Em Andamento', count: activeCount, color: 'var(--color-flow-trabalho)' }
  ];
  
  items.forEach(item => {
    if (item.count === 0) return;
    const angle = (item.count / total) * 360;
    
    let pathData;
    if (item.count === total) {
      pathData = `
        M ${cx} ${cy - radius}
        A ${radius} ${radius} 0 1 1 ${cx} ${cy + radius}
        A ${radius} ${radius} 0 1 1 ${cx} ${cy - radius}
      `;
    } else {
      const endAngle = startAngle + angle;
      const x1 = cx + radius * Math.cos(Math.PI * startAngle / 180);
      const y1 = cy + radius * Math.sin(Math.PI * startAngle / 180);
      const x2 = cx + radius * Math.cos(Math.PI * endAngle / 180);
      const y2 = cy + radius * Math.sin(Math.PI * endAngle / 180);
      const largeArc = angle > 180 ? 1 : 0;
      
      pathData = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
      startAngle += angle;
    }
    
    const isSelected = g_flowParalizadosFilter === item.key;
    const opacity = (g_flowParalizadosFilter === 'all' || isSelected) ? 1 : 0.3;
    const strokeW = isSelected ? strokeWidth + 4 : strokeWidth;
    const transformStr = isSelected ? `transform="scale(1.05)" transform-origin="${cx} ${cy}"` : '';
    
    svgContent += `
      <path d="${pathData}" fill="none" stroke="${item.color}" stroke-width="${strokeW}" 
            style="opacity: ${opacity}; transition: var(--transition-smooth); cursor: pointer; ${transformStr}" 
            class="donut-segment" data-key="${item.key}">
        <title>${item.label}: ${item.count}</title>
      </path>
    `;
  });
  
  const centerValue = g_flowParalizadosFilter === 'paralizados' ? paralyzedCount :
                      g_flowParalizadosFilter === 'ativos' ? activeCount : total;
  const centerLabel = g_flowParalizadosFilter === 'paralizados' ? 'PARALISADOS' :
                      g_flowParalizadosFilter === 'ativos' ? 'EM ANDAMENTO' : 'TOTAL ATIVOS';
  const centerColor = g_flowParalizadosFilter === 'paralizados' ? 'var(--color-danger)' :
                      g_flowParalizadosFilter === 'ativos' ? 'var(--color-flow-trabalho)' : 'var(--text-main)';
  
  container.innerHTML = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      ${svgContent}
      <!-- Center Text -->
      <text x="${cx}" y="${cy - 4}" fill="${centerColor}" font-size="28" font-weight="800" text-anchor="middle" style="transition: var(--transition-smooth);">${centerValue}</text>
      <text x="${cx}" y="${cy + 18}" fill="var(--text-muted)" font-size="10" font-weight="600" text-anchor="middle" letter-spacing="0.5">${centerLabel}</text>
      <circle cx="${cx}" cy="${cy}" r="${radius - strokeWidth/2 - 5}" fill="transparent" class="donut-center-click" style="cursor: pointer;" title="Limpar Filtro"></circle>
    </svg>
  `;
  
  // Render Legend
  items.forEach(item => {
    const isSelected = g_flowParalizadosFilter === item.key;
    const opacity = (g_flowParalizadosFilter === 'all' || isSelected) ? 1 : 0.4;
    
    legend.innerHTML += `
      <div class="legend-item" data-key="${item.key}" style="opacity: ${opacity}; cursor: pointer; transition: var(--transition-smooth); display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; border-radius: 4px; background: ${isSelected ? 'var(--bg-panel-hover)' : 'transparent'};">
        <div style="display: flex; align-items: center;">
          <span class="legend-color" style="background-color: ${item.color}; width: 12px; height: 12px; border-radius: 3px; display: inline-block; margin-right: 8px;"></span>
          <span style="font-size: 0.85rem; color: var(--text-main);">${item.label}</span>
        </div>
        <strong style="font-size: 0.95rem; margin-left: 12px;">${item.count}</strong>
      </div>
    `;
  });

  const footer = document.getElementById('flow-paralizacao-footer');
  if (footer) footer.innerHTML = '';

  if (paralyzedCount > 0) {
    const days = totalHoursParalyzedNow / 24;
    let summaryText = '';
    if (days >= 1) {
      summaryText = `<span style="font-size: 0.9rem;">Atualmente parados a</span><br><strong style="font-size: 1.25rem;">${days.toFixed(1)} dias</strong><br><span style="font-size: 0.8rem; opacity: 0.8;">(total sumÃ¡rio)</span>`;
    } else {
      summaryText = `<span style="font-size: 0.9rem;">Atualmente parados a</span><br><strong style="font-size: 1.25rem;">${totalHoursParalyzedNow.toFixed(1)} horas</strong><br><span style="font-size: 0.8rem; opacity: 0.8;">(total sumÃ¡rio)</span>`;
    }
    if (footer) {
      footer.innerHTML = `
        <div style="color: var(--color-danger); line-height: 1.4;">
          ${summaryText}
        </div>
      `;
    }
  } else {
    if (footer) {
      footer.innerHTML = `
        <div style="font-size: 0.9rem; color: var(--text-muted);">
          Nenhum item ativo parado agora
        </div>
      `;
    }
  }
  
  // Event Listeners
  const toggleFilter = (key) => {
    if (g_flowParalizadosFilter === key) {
      g_flowParalizadosFilter = 'all'; // toggle off
    } else {
      g_flowParalizadosFilter = key;
    }
    renderFlow(getFilteredWorkItems());
  };
  
  container.querySelectorAll('.donut-segment').forEach(el => {
    el.addEventListener('click', () => toggleFilter(el.getAttribute('data-key')));
  });
  
  legend.querySelectorAll('.legend-item').forEach(el => {
    el.addEventListener('click', () => toggleFilter(el.getAttribute('data-key')));
  });
  
  const centerClick = container.querySelector('.donut-center-click');
  if (centerClick) {
    centerClick.addEventListener('click', () => {
      g_flowParalizadosFilter = 'all';
      renderFlow(getFilteredWorkItems());
    });
  }

  const clearBtn = document.getElementById('btn-clear-paralizados');
  if (clearBtn) {
    if (g_flowParalizadosFilter !== 'all') {
      clearBtn.style.display = 'block';
      clearBtn.onclick = () => {
        g_flowParalizadosFilter = 'all';
        renderFlow(getFilteredWorkItems());
      };
    } else {
      clearBtn.style.display = 'none';
    }
  }
}

function renderTopColumnsFlowChart(filteredWIs) {
  const container = document.getElementById('chart-flow-avg-time');
  container.innerHTML = '';
  
  // Gather all unique visits of filtered items
  const colTimes = {};
  const colItemCount = {};
  
  filteredWIs.forEach(wi => {
    const visits = g_data.tempoColunaByWi.get(wi.Id) || [];
    visits.forEach(v => {
      const col = v.BoardColumn ? v.BoardColumn.trim() : '';
      if (!col || col === 'ConcluÃ­do') return; // Exclude finished
      
      if (!colTimes[col]) {
        colTimes[col] = 0;
        colItemCount[col] = new Set();
      }
      colTimes[col] += v.TempoTotalDias;
      colItemCount[col].add(wi.Id);
    });
  });
  
  // Calculate average per column
  const averages = [];
  for (const col in colTimes) {
    const count = colItemCount[col].size;
    const avg = count > 0 ? colTimes[col] / count : 0;
    averages.push({ col, avg, count });
  }
  
  // Sort and take all (was previously top 5)
  const top5 = averages.sort((a, b) => b.avg - a.avg);
  
  if (top5.length === 0) {
    container.innerHTML = `<span class="placeholder-text">Sem dados de fluxo para os itens selecionados</span>`;
    return;
  }
  
  const maxAvg = Math.max(...top5.map(t => t.avg), 1.0);
  
  // Draw Horizontal Bars
  let barsHTML = '';
  top5.forEach((item, index) => {
    const pct = ((item.avg / maxAvg) * 80).toFixed(0); // scale max to 80% width
    
    // Choose color category based on flow mapping
    const colInfo = g_data.columnMapObj[item.col] || {};
    let barColor = 'var(--color-primary)';
    if (colInfo.TipoFluxo === 'fila') barColor = 'var(--color-flow-fila)';
    else if (colInfo.TipoFluxo === 'trabalho') barColor = 'var(--color-flow-trabalho)';
    else if (colInfo.TipoFluxo === 'aguardando') barColor = 'var(--color-flow-aguardando)';
    else if (colInfo.TipoFluxo === 'handoff') barColor = 'var(--color-flow-handoff)';
    
    barsHTML += `
      <div style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 6px;">
          <strong>${item.col}</strong>
          <span style="color: var(--text-muted);">${item.avg.toFixed(1)} dias mÃ©dios (${item.count} itens)</span>
        </div>
        <div style="width: 100%; height: 14px; background-color: hsla(252, 31%, 6%, 0.4); border-radius: 7px; overflow: hidden; border: 1px solid var(--border-color);">
          <div style="width: ${pct}%; height: 100%; background-color: ${barColor}; border-radius: 7px; transition: var(--transition-smooth);" class="svg-bar"></div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = `<div style="width: 100%; text-align: left; padding: 10px 0;">${barsHTML}</div>`;
}

function renderFlowEfficiencySegmented(filteredWIs) {
  const barContainer = document.getElementById('chart-flow-efficiency-bar');
  const legendContainer = document.getElementById('flow-efficiency-legend');
  barContainer.innerHTML = '';
  legendContainer.innerHTML = '';
  
  let timeFila = 0, timeTrabalho = 0, timeAguardando = 0, timeRelease = 0;
  
  filteredWIs.forEach(wi => {
    const visits = g_data.tempoColunaByWi.get(wi.Id) || [];
    visits.forEach(v => {
      const col = v.BoardColumn;
      const colInfo = g_data.columnMapObj[col] || {};
      const cat = colInfo.TipoFluxo || '';
      
      if (cat === 'fila') timeFila += v.TempoTotalDias;
      else if (cat === 'trabalho') timeTrabalho += v.TempoTotalDias;
      else if (cat === 'aguardando') timeAguardando += v.TempoTotalDias;
      else if (cat === 'pre_release') timeRelease += v.TempoTotalDias;
    });
  });
  
  const total = timeFila + timeTrabalho + timeHandoff + timeRelease;
  
  if (total === 0) {
    barContainer.innerHTML = `<span class="placeholder-text">Sem dados suficientes para eficiÃªncia do fluxo</span>`;
    return;
  }
  
  const pctFila = ((timeFila / total) * 100).toFixed(1);
  const pctTrab = ((timeTrabalho / total) * 100).toFixed(1);
  const pctHand = ((timeHandoff / total) * 100).toFixed(1);
  const pctRel = ((timeRelease / total) * 100).toFixed(1);
  
  // Render Stacked Bar
  barContainer.innerHTML = `
    <div class="stacked-progress-track">
      ${timeTrabalho > 0 ? `<div class="stacked-segment" style="width: ${pctTrab}%; background-color: var(--color-flow-trabalho);" title="Trabalho Ativo: ${pctTrab}%">Trabalho</div>` : ''}
      ${timeFila > 0 ? `<div class="stacked-segment" style="width: ${pctFila}%; background-color: var(--color-flow-fila);" title="Tempo de Espera/Fila: ${pctFila}%">Fila</div>` : ''}
      ${timeHandoff > 0 ? `<div class="stacked-segment" style="width: ${pctHand}%; background-color: var(--color-flow-handoff);" title="HomologaÃ§Ãµes/Handoff: ${pctHand}%">Handoff</div>` : ''}
      ${timeRelease > 0 ? `<div class="stacked-segment" style="width: ${pctRel}%; background-color: var(--color-flow-prerelease);" title="Pronto Release: ${pctRel}%">Release</div>` : ''}
    </div>
  `;
  
  // Render detailed calculations in legend
  legendContainer.innerHTML = `
    <div class="legend-item">
      <span class="legend-bullet" style="background-color: var(--color-flow-trabalho);"></span>
      <span><strong>Ativo:</strong> ${timeTrabalho.toFixed(1)} dias (${pctTrab}%)</span>
    </div>
    <div class="legend-item">
      <span class="legend-bullet" style="background-color: var(--color-flow-fila);"></span>
      <span><strong>Fila (Espera):</strong> ${timeFila.toFixed(1)} dias (${pctFila}%)</span>
    </div>
    <div class="legend-item">
      <span class="legend-bullet" style="background-color: var(--color-flow-handoff);"></span>
      <span><strong>Handoff (RevisÃµes):</strong> ${timeHandoff.toFixed(1)} dias (${pctHand}%)</span>
    </div>
    <div class="legend-item">
      <span class="legend-bullet" style="background-color: var(--color-flow-prerelease);"></span>
      <span><strong>Pronto Release:</strong> ${timeRelease.toFixed(1)} dias (${pctRel}%)</span>
    </div>
  `;
}

function renderFlowWipTable(activeWIs) {
  const mapped = activeWIs.map(wi => {
    const visits = g_data.tempoColunaByWi.get(wi.Id) || [];
    const activeVis = visits.find(v => v.ColunaAtual === 'Sim');
    const hoursInCol = activeVis ? activeVis.TempoAtualHoras : 0;
    
    const colInfo = g_data.columnMapObj[wi.BoardColumn] || {};
    const flowCat = colInfo.TipoFluxo || 'aguardando';
    const diasAbertoNum = parseInt(wi.DiasAberto) || 0;
    
    return {
      Id: parseInt(wi.Id) || 0,
      Titulo: wi.Titulo || '',
      Tipo: wi.Tipo || '',
      BoardColumn: wi.BoardColumn || '',
      TipoFluxo: flowCat === 'aguardando' ? 'AGUARDANDO' :
                 flowCat === 'fila' ? 'FILA' :
                 flowCat === 'trabalho' ? 'ATIVO' :
                 flowCat === 'pre_release' ? 'RELEASE' :
                 flowCat.toUpperCase(),
      Responsavel: wi.Responsavel || 'NENHUM',
      HoursInCol: hoursInCol,
      DiasAberto: diasAbertoNum,
      originalWi: wi,
      flowCat: flowCat
    };
  });
  
  const thead = document.getElementById('table-flow-wip').parentNode.querySelector('thead');
  if (thead && !thead.dataset.gridInitialized) {
    initializeGridHeaders('table-flow-wip', 'flowWip', () => {
      renderFlowWipTable(activeWIs);
    });
  }
  
  processAndRenderGridGeneric('table-flow-wip', 'flowWip', mapped, (row, tbody) => {
    const tr = document.createElement('tr');
    
    let flowBadge = 'badge-outline';
    if (row.flowCat === 'fila') flowBadge = 'badge-blue';
    else if (row.flowCat === 'trabalho') flowBadge = 'badge-amber';
    else if (row.flowCat === 'aguardando') flowBadge = 'badge-orange';
    else if (row.flowCat === 'pre_release') flowBadge = 'badge-emerald';
    
    tr.innerHTML = `
      <td><a href="#" class="wi-drill-link" data-wi-id="${row.Id}" style="color: var(--color-primary); font-weight: 700; text-decoration: none; border-bottom: 1px dashed var(--color-primary); transition: var(--transition-smooth);">#${row.Id}</a></td>
      <td class="text-ellipsis" title="${row.Titulo}"><strong>${row.Titulo}</strong></td>
      <td>${getWiTypeIcon(row.Tipo)}</td>
      <td><span class="badge badge-outline">${row.BoardColumn}</span></td>
      <td><span class="badge ${flowBadge}">${row.TipoFluxo}</span></td>
      <td>${row.Responsavel}</td>
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

function renderRetransitionsTimeline(filteredWIs) {
  const container = document.getElementById('flow-transition-timeline');
  container.innerHTML = '';
  
  // Normal workflow order
  const colOrder = [
    'Ideias', 'Backlog', 'Fazendo AnÃ¡lise', 'DisponÃ­vel para Dev', 'Dev implementando',
    'DisponÃ­vel RevisÃ£o de CÃ³digo', 'Realizando RevisÃ£o de CÃ³digo', 'DisponÃ­vel para Teste',
    'Testando', 'Aguardando pipeline', 'Pronto pra Release', 'ConcluÃ­do'
  ];
  
  const colIndex = {};
  colOrder.forEach((c, idx) => colIndex[c] = idx);
  
  const retransitions = [];
  
  filteredWIs.forEach(wi => {
    const trans = g_data.transicoesByWi.get(wi.Id) || [];
    trans.forEach(t => {
      if (t.Campo === 'BoardColumn') {
        const fromIdx = colIndex[t.De];
        const toIdx = colIndex[t.Para];
        
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
  
  // Sort retransitions by date descending, take top 6
  const topRetrans = retransitions.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
  
  if (topRetrans.length === 0) {
    container.innerHTML = `<div class="placeholder-text" style="color: var(--text-muted); font-size: 0.85rem; padding: 20px 0; text-align: center;">Nenhuma movimentaÃ§Ã£o de retrabalho (retransiÃ§Ã£o para trÃ¡s) identificada no perÃ­odo.</div>`;
    return;
  }
  
  let html = '';
  topRetrans.forEach(rt => {
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
  
  container.innerHTML = `
    <div style="text-align: left; padding: 10px 0;">
      <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 12px;">IdentificaÃ§Ã£o de atritos no fluxo (itens que voltaram etapas no board):</p>
      ${html}
    </div>
  `;
  
  // Attach links
  container.querySelectorAll('.drill-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const id = e.target.getAttribute('data-wi-id');
      navigateToPage('drilldown', () => { g_selectedDrillDownId = id; });
    });
  });
}

// 10.5 COMPOSITION CHART RENDERER (BUGS VS USER STORIES DONUT)
function renderDeliveriesCompositionChart(closedWIs) {
  const container = document.getElementById('chart-deliveries-composition');
  if (!container) return;
  container.innerHTML = '';
  
  // 1. Count Bugs and User Stories
  const numBugs = closedWIs.filter(wi => wi.Tipo === 'Bug').length;
  const numStories = closedWIs.filter(wi => wi.Tipo === 'User Story').length;
  const total = numBugs + numStories;
  
  if (total === 0) {
    container.innerHTML = `<span class="placeholder-text">Sem Bugs ou User Stories concluÃ­dos no perÃ­odo</span>`;
    const filterBadge = document.getElementById('badge-composition-filter');
    if (filterBadge) filterBadge.style.display = 'none';
    return;
  }
  
  // 2. Control active filter badge in panel header
  const filterBadge = document.getElementById('badge-composition-filter');
  if (filterBadge) {
    if (g_deliveriesTypeFilter) {
      filterBadge.style.display = 'inline-block';
      filterBadge.textContent = `${g_deliveriesTypeFilter === 'Bug' ? 'Apenas Bugs' : 'Apenas Stories'} Ã—`;
    } else {
      filterBadge.style.display = 'none';
    }
  }

  // 3. SVG parameters
  const r = 70;
  const cx = 100;
  const cy = 100;
  const strokeWidth = 18;
  const circumference = 2 * Math.PI * r; // ~439.82
  
  const bugPct = numBugs / total;
  const storyPct = numStories / total;
  
  const bugStroke = bugPct * circumference;
  const storyStroke = storyPct * circumference;
  
  let bugSegmentClass = "donut-segment donut-bug";
  let storySegmentClass = "donut-segment donut-story";
  
  if (g_deliveriesTypeFilter) {
    if (g_deliveriesTypeFilter === 'Bug') {
      storySegmentClass += " inactive";
      bugSegmentClass += " active";
    } else if (g_deliveriesTypeFilter === 'User Story') {
      bugSegmentClass += " inactive";
      storySegmentClass += " active";
    }
  }
  
  // 4. SVG Content
  let svgContent = '';
  if (numBugs > 0 && numStories > 0) {
    svgContent = `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="transparent" 
              stroke="var(--color-danger)" stroke-width="${strokeWidth}" 
              stroke-dasharray="${bugStroke} ${circumference}" stroke-dashoffset="0"
              class="${bugSegmentClass}" data-type="Bug" />
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="transparent" 
              stroke="var(--color-primary)" stroke-width="${strokeWidth}" 
              stroke-dasharray="${storyStroke} ${circumference}" stroke-dashoffset="-${bugStroke}"
              class="${storySegmentClass}" data-type="User Story" />
    `;
  } else if (numBugs > 0) {
    svgContent = `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="transparent" 
              stroke="var(--color-danger)" stroke-width="${strokeWidth}" 
              stroke-dasharray="${circumference} ${circumference}" stroke-dashoffset="0"
              class="${bugSegmentClass}" data-type="Bug" />
    `;
  } else {
    svgContent = `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="transparent" 
              stroke="var(--color-primary)" stroke-width="${strokeWidth}" 
              stroke-dasharray="${circumference} ${circumference}" stroke-dashoffset="0"
              class="${storySegmentClass}" data-type="User Story" />
    `;
  }
  
  // 5. Center Text Values
  let centerValue = total;
  let centerLabel = 'ConcluÃ­dos';
  if (g_deliveriesTypeFilter) {
    centerValue = g_deliveriesTypeFilter === 'Bug' ? numBugs : numStories;
    centerLabel = g_deliveriesTypeFilter === 'Bug' ? 'Bugs' : 'Stories';
  }
  
  const bugPctStr = (bugPct * 100).toFixed(0) + '%';
  const storyPctStr = (storyPct * 100).toFixed(0) + '%';

  // 6. Horizontal Legend HTML
  const legendHtml = `
    <div class="donut-legend">
      <div class="donut-legend-item ${g_deliveriesTypeFilter === 'User Story' ? 'active-legend' : (g_deliveriesTypeFilter ? 'inactive' : '')}" data-type="User Story">
        <span class="donut-legend-color" style="background-color: var(--color-primary);"></span>
        <span class="donut-legend-label">Stories</span>
        <span class="donut-legend-value">${numStories} (${storyPctStr})</span>
      </div>
      <div class="donut-legend-item ${g_deliveriesTypeFilter === 'Bug' ? 'active-legend' : (g_deliveriesTypeFilter ? 'inactive' : '')}" data-type="Bug">
        <span class="donut-legend-color" style="background-color: var(--color-danger);"></span>
        <span class="donut-legend-label">Bugs</span>
        <span class="donut-legend-value">${numBugs} (${bugPctStr})</span>
      </div>
    </div>
  `;
  
  // 7. Inject HTML
  container.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; height: 100%;">
      <div style="position: relative; width: 200px; height: 180px;">
        <svg width="200" height="180" viewBox="0 0 200 180" style="transform: rotate(-90deg); overflow: visible;">
          ${svgContent}
        </svg>
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; text-align: center;">
          <span style="font-size: 2.2rem; font-weight: 800; color: var(--text-main); line-height: 1;">${centerValue}</span>
          <span style="font-size: 0.72rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.8px; margin-top: 4px;">${centerLabel}</span>
        </div>
      </div>
      ${legendHtml}
    </div>
  `;
  
  // 8. Event listeners
  container.querySelectorAll('.donut-segment, .donut-legend-item').forEach(el => {
    el.addEventListener('click', () => {
      const type = el.getAttribute('data-type');
      g_deliveriesTypeFilter = (g_deliveriesTypeFilter === type) ? null : type;
      renderDeliveries(getFilteredWorkItems());
    });
  });
  
  if (filterBadge) {
    filterBadge.addEventListener('click', (e) => {
      e.stopPropagation();
      g_deliveriesTypeFilter = null;
      renderDeliveries(getFilteredWorkItems());
    });
  }
}

// 11. PAGE 3 RENDERER: ENTREGAS (DELIVERIES)
function renderDeliveries(filteredWIs) {
  const closedWIs = filteredWIs.filter(wi => wi.State === 'Closed' || wi.BoardColumn === 'ConcluÃ­do');
  
  // Render composition donut chart (always with page's full baseline)
  renderDeliveriesCompositionChart(closedWIs);
  
  // Apply page-level interactive type filter
  let pageClosedWIs = closedWIs;
  if (g_deliveriesTypeFilter) {
    pageClosedWIs = closedWIs.filter(wi => wi.Tipo === g_deliveriesTypeFilter);
  }

  // Apply page-level interactive paralyzed filter
  if (g_deliveriesParalyzedFilter) {
    pageClosedWIs = pageClosedWIs.filter(wi => {
      const pInfo = g_data.paralizacaoResumoMap.get(wi.Id);
      return pInfo && pInfo.TotalHorasParado > 0;
    });
  }
  
  // Calculate averages, medians, and SLA Percentile 85 (P85)
  const leadTimes = [];
  const cycleTimes = [];
  
  pageClosedWIs.forEach(wi => {
    const delivery = g_data.entregasMap.get(wi.Id);
    if (delivery) {
      leadTimes.push(delivery.LeadTimeDias);
      if (delivery.CycleTimeDias !== null && delivery.CycleTimeDias !== undefined) {
        cycleTimes.push(delivery.CycleTimeDias);
      }
    } else {
      if (wi.DataCriacao && wi.DataFechamento) {
        const lTime = (new Date(wi.DataFechamento).getTime() - new Date(wi.DataCriacao).getTime()) / (1000 * 60 * 60 * 24);
        if (lTime >= 0) leadTimes.push(lTime);
      }
    }
  });
  
  // Lead Time Metrics
  const avgLead = leadTimes.length > 0 ? (leadTimes.reduce((s, v) => s + v, 0) / leadTimes.length) : 0;
  const medLead = getMedian(leadTimes);
  const p85Lead = getPercentile(leadTimes, 85);
  
  // Cycle Time Metrics
  const avgCycle = cycleTimes.length > 0 ? (cycleTimes.reduce((s, v) => s + v, 0) / cycleTimes.length) : 0;
  const medCycle = getMedian(cycleTimes);
  const p85Cycle = getPercentile(cycleTimes, 85);
  
  // Calculate average weekly throughput based on active date range selection
  const dateRangeVal = document.getElementById('filter-date-range') ? document.getElementById('filter-date-range').value : '30';
  const today = new Date(TODAY_ANCHOR);
  let startDate, endDate;
  if (dateRangeVal === 'all') {
    let minDate = new Date(today);
    let maxDate = new Date(today);
    let found = false;
    closedWIs.forEach(wi => {
      const closedDateStr = wi.DataFechamento;
      if (closedDateStr) {
        const d = new Date(closedDateStr);
        if (!isNaN(d.getTime())) {
          if (!found || d < minDate) minDate = d;
          if (!found || d > maxDate) maxDate = d;
          found = true;
        }
      }
    });
    startDate = minDate;
    endDate = maxDate;
  } else if (dateRangeVal === 'this-month') {
    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    endDate = new Date(today);
  } else if (dateRangeVal === 'last-month') {
    startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    endDate = new Date(today.getFullYear(), today.getMonth(), 0);
  } else if (dateRangeVal === 'this-year') {
    startDate = new Date(today.getFullYear(), 0, 1);
    endDate = new Date(today);
  } else if (dateRangeVal === 'last-year') {
    startDate = new Date(today.getFullYear() - 1, 0, 1);
    endDate = new Date(today.getFullYear() - 1, 11, 31);
  } else {
    const days = parseInt(dateRangeVal, 10) || 30;
    startDate = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
    endDate = new Date(today);
  }

  const periodDays = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const numWeeks = periodDays / 7;
  const avgWeeklyThroughput = pageClosedWIs.length / numWeeks;
  
  document.getElementById('lbl-deliv-avg-lead').textContent = leadTimes.length > 0 ? `${avgLead.toFixed(1)}d` : '-';
  document.getElementById('lbl-deliv-med-lead').textContent = leadTimes.length > 0 ? `${medLead.toFixed(1)}d` : '-';
  document.getElementById('lbl-deliv-p85-lead').textContent = leadTimes.length > 0 ? `${p85Lead.toFixed(1)}d` : '-';
  document.getElementById('lbl-deliv-avg-throughput').textContent = pageClosedWIs.length > 0 ? `${avgWeeklyThroughput.toFixed(1)}/sem` : '0/sem';
  
  document.getElementById('lbl-deliv-avg-cycle').textContent = cycleTimes.length > 0 ? `${avgCycle.toFixed(1)}d` : '-';
  document.getElementById('lbl-deliv-med-cycle').textContent = cycleTimes.length > 0 ? `${medCycle.toFixed(1)}d` : '-';
  document.getElementById('lbl-deliv-p85-cycle').textContent = cycleTimes.length > 0 ? `${p85Cycle.toFixed(1)}d` : '-';
  
  // Calculate total paralyzed time for delivered work items
  let totalHoursParalyzed = 0;
  pageClosedWIs.forEach(wi => {
    const pInfo = g_data.paralizacaoResumoMap.get(wi.Id);
    if (pInfo) {
      totalHoursParalyzed += pInfo.TotalHorasParado;
    }
  });

  let paralyzedDisplay = '-';
  let paralyzedSubText = 'Sem tempo paralisado';
  if (totalHoursParalyzed > 0) {
    const totalDays = totalHoursParalyzed / 24;
    if (totalDays >= 1) {
      paralyzedDisplay = `${totalDays.toFixed(1)}d`;
      paralyzedSubText = `${Math.round(totalHoursParalyzed)}h de paralisaÃ§Ã£o`;
    } else {
      paralyzedDisplay = `${Math.round(totalHoursParalyzed)}h`;
      paralyzedSubText = 'Menos de 1 dia';
    }
  }

  document.getElementById('lbl-deliv-total-paralizado').textContent = paralyzedDisplay;
  document.getElementById('lbl-deliv-total-paralizado-sub').textContent = paralyzedSubText;
  
  // Set count badge
  document.getElementById('lbl-deliveries-total-count').textContent = `${pageClosedWIs.length} entregues`;
  
  const titleEl = document.getElementById('lbl-deliveries-table-title');
  if (titleEl) {
    if (g_deliveriesParalyzedFilter) {
      titleEl.textContent = 'Lista Mestre de Entregas ConcluÃ­das no PerÃ­odo (com paralisaÃ§Ãµes)';
    } else {
      titleEl.textContent = 'Lista Mestre de Entregas ConcluÃ­das no PerÃ­odo';
    }
  }

  // Set up click listener on the KPI card to toggle filtering of paralyzed items
  const originalCard = document.getElementById('card-kpi-deliv-paralizado');
  if (originalCard) {
    const card = originalCard.cloneNode(true);
    originalCard.parentNode.replaceChild(card, originalCard);
    
    // Highlight if active
    if (g_deliveriesParalyzedFilter) {
      card.classList.add('active-filter');
    } else {
      card.classList.remove('active-filter');
    }
    
    card.addEventListener('click', () => {
      g_deliveriesParalyzedFilter = !g_deliveriesParalyzedFilter;
      renderDeliveries(getFilteredWorkItems());
    });
  }
  
  // 1. Chart: Deliveries by Person
  renderDeliveriesByPersonChart(pageClosedWIs);
  
  // 1.2 Chart: Deliveries by Person (Subtasks)
  renderDeliveriesByCollaboratorTasks(filteredWIs);
  
  // 1.5. Chart: Throughput by Person (weekly/monthly stacked)
  renderCollaboratorThroughputChart(pageClosedWIs);
  
  // 2. Chart: Lead vs Cycle Distribution histogram
  renderDeliveriesDistribution(leadTimes, cycleTimes);
  
  // 3. Table: Master Deliveries List
  renderDeliveriesList(pageClosedWIs);
}

function getMedian(arr) {
  if (arr.length === 0) return 0;
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

function renderDeliveriesByPersonChart(closedWIs) {
  const container = document.getElementById('chart-deliveries-by-person');
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
    container.innerHTML = `<span class="placeholder-text">Sem entregas no perÃ­odo selecionado</span>`;
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


function renderDeliveriesDistribution(leadTimes, cycleTimes) {
  const container = document.getElementById('chart-deliveries-distribution');
  container.innerHTML = '';
  
  if (leadTimes.length === 0) {
    container.innerHTML = `<span class="placeholder-text">Sem dados suficientes de SLA</span>`;
    return;
  }
  
  // Frequency in bins: 0-5d, 5-10d, 10-15d, 15-20d, 20+d
  const bins = ["0-5d", "5-10d", "10-15d", "15-20d", "20d+"];
  const leadFreq = [0, 0, 0, 0, 0];
  const cycleFreq = [0, 0, 0, 0, 0];
  
  leadTimes.forEach(t => {
    if (t < 5) leadFreq[0]++;
    else if (t < 10) leadFreq[1]++;
    else if (t < 15) leadFreq[2]++;
    else if (t < 20) leadFreq[3]++;
    else leadFreq[4]++;
  });
  
  cycleTimes.forEach(t => {
    if (t < 5) cycleFreq[0]++;
    else if (t < 10) cycleFreq[1]++;
    else if (t < 15) cycleFreq[2]++;
    else if (t < 20) cycleFreq[3]++;
    else cycleFreq[4]++;
  });
  
  const maxFreq = Math.max(...leadFreq, ...cycleFreq, 4);
  
  // Render double vertical bar SVG
  const width = 500;
  const height = 220;
  const paddingLeft = 35;
  const paddingRight = 15;
  const paddingTop = 25;
  const paddingBottom = 40;
  
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;
  const binStep = chartW / bins.length;
  
  let gridLines = '';
  for (let i = 0; i <= 4; i++) {
    const yVal = Math.round((maxFreq / 4) * i);
    const y = paddingTop + chartH - (yVal / maxFreq) * chartH;
    gridLines += `
      <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="var(--border-color)" stroke-width="0.75" stroke-dasharray="4,4"/>
      <text x="${paddingLeft - 8}" y="${y + 4}" fill="var(--text-muted)" font-size="9" text-anchor="end">${yVal}</text>
    `;
  }
  
  let bars = '';
  bins.forEach((binLabel, idx) => {
    const lf = leadFreq[idx];
    const cf = cycleFreq[idx];
    
    const lBarH = (lf / maxFreq) * chartH;
    const cBarH = (cf / maxFreq) * chartH;
    
    const xBin = paddingLeft + idx * binStep;
    const barW = binStep * 0.35;
    
    const lx = xBin + binStep * 0.1;
    const ly = paddingTop + chartH - lBarH;
    
    const cx = xBin + binStep * 0.1 + barW + binStep * 0.05;
    const cy = paddingTop + chartH - cBarH;
    
    bars += `
      <g>
        <!-- Lead Time Bar (Purple) -->
        <rect x="${lx}" y="${ly}" width="${barW}" height="${lBarH}" fill="var(--color-primary)" rx="2" ry="2" class="svg-bar"/>
        ${lf > 0 ? `<text x="${lx + barW / 2}" y="${ly - 4}" fill="var(--color-primary)" font-size="8.5" font-weight="600" text-anchor="middle">${lf}</text>` : ''}
        
        <!-- Cycle Time Bar (Amber) -->
        <rect x="${cx}" y="${cy}" width="${barW}" height="${cBarH}" fill="var(--color-flow-trabalho)" rx="2" ry="2" class="svg-bar"/>
        ${cf > 0 ? `<text x="${cx + barW / 2}" y="${cy - 4}" fill="var(--color-flow-trabalho)" font-size="8.5" font-weight="600" text-anchor="middle">${cf}</text>` : ''}
        
        <text x="${xBin + binStep / 2}" y="${height - paddingBottom + 18}" fill="var(--text-muted)" font-size="9" font-weight="500" text-anchor="middle">${binLabel}</text>
      </g>
    `;
  });
  
  container.innerHTML = `
    <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}">
      ${gridLines}
      ${bars}
      <line x1="${paddingLeft}" y1="${paddingTop + chartH}" x2="${width - paddingRight}" y2="${paddingTop + chartH}" stroke="var(--border-color)" stroke-width="1.5"/>
      <!-- Legend inside chart -->
      <g transform="translate(${width - 150}, 10)">
        <rect x="0" y="0" width="8" height="8" fill="var(--color-primary)" rx="1"/>
        <text x="14" y="8" fill="var(--text-muted)" font-size="8.5">Lead Time</text>
        <rect x="70" y="0" width="8" height="8" fill="var(--color-flow-trabalho)" rx="1"/>
        <text x="84" y="8" fill="var(--text-muted)" font-size="8.5">Cycle Time</text>
      </g>
    </svg>
  `;
}

function getWeekStartDate(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function getPersonColor(name) {
  const cleanName = name ? name.trim() : 'Indefinido';
  const predefined = {
    'maysson': 'hsl(217, 91%, 60%)',
    'ivan': 'hsl(142, 70%, 45%)',
    'fabio': 'hsl(38, 92%, 50%)',
    'rodolfo': 'hsl(262, 83%, 58%)',
    'paulo': 'hsl(328, 86%, 53%)',
    'joao': 'hsl(189, 94%, 43%)',
    'luis': 'hsl(350, 89%, 60%)',
    'leandro': 'hsl(173, 80%, 40%)'
  };
  const first = cleanName.split(' ')[0].split('.')[0].toLowerCase();
  if (predefined[first]) return predefined[first];
  
  let hash = 0;
  for (let i = 0; i < cleanName.length; i++) {
    hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return `hsl(${h}, 65%, 50%)`;
}

function renderCollaboratorThroughputChart(closedWIs) {
  const container = document.getElementById('chart-throughput-by-person');
  if (!container) return;
  container.innerHTML = '';
  
  // Sync toggle buttons DOM active state
  const btnWeekly = document.getElementById('btn-throughput-weekly');
  const btnMonthly = document.getElementById('btn-throughput-monthly');
  if (btnWeekly && btnMonthly) {
    if (g_throughputViewMode === 'weekly') {
      btnWeekly.classList.add('active');
      btnMonthly.classList.remove('active');
    } else {
      btnMonthly.classList.add('active');
      btnWeekly.classList.remove('active');
    }
  }
  
  if (closedWIs.length === 0) {
    container.innerHTML = `<span class="placeholder-text">Sem entregas no período selecionado</span>`;
    return;
  }
  
  const periodsMap = {};
  const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  
  closedWIs.forEach(wi => {
    const delivery = g_data.entregasMap.get(wi.Id);
    const dateStr = delivery ? delivery.DataFechamento : wi.DataFechamento;
    if (!dateStr) return;
    const date = new Date(dateStr);
    
    let periodKey = '';
    let periodTime = 0;
    
    if (g_throughputViewMode === 'weekly') {
      const mon = getWeekStartDate(date);
      periodKey = `${String(mon.getDate()).padStart(2, '0')}/${String(mon.getMonth() + 1).padStart(2, '0')}`;
      periodTime = mon.getTime();
    } else {
      periodKey = `${MONTHS_PT[date.getMonth()]}/${String(date.getFullYear()).slice(-2)}`;
      const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      periodTime = firstOfMonth.getTime();
    }
    
    const person = delivery ? delivery.ResponsavelNoFechamento : wi.Responsavel;
    const name = person && person !== 'NENHUM' && person.trim() !== '' ? person : 'Indefinido';
    
    if (!periodsMap[periodKey]) {
      periodsMap[periodKey] = {
        key: periodKey,
        time: periodTime,
        total: 0,
        contributors: {}
      };
    }
    
    periodsMap[periodKey].contributors[name] = (periodsMap[periodKey].contributors[name] || 0) + 1;
    periodsMap[periodKey].total++;
  });
  
  const sortedPeriods = Object.values(periodsMap).sort((a, b) => a.time - b.time);
  const displayPeriods = sortedPeriods.slice(-10); // show last 10 periods
  
  if (displayPeriods.length === 0) {
    container.innerHTML = `<span class="placeholder-text">Sem dados suficientes</span>`;
    return;
  }
  
  const maxVal = Math.max(...displayPeriods.map(p => p.total), 4);
  
  // Dimensions
  const width = 500;
  const height = 220;
  const paddingLeft = 35;
  const paddingRight = 130; // space for legend on right
  const paddingTop = 25;
  const paddingBottom = 40;
  
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;
  const step = chartW / displayPeriods.length;
  
  // Gridlines
  let gridLines = '';
  for (let i = 0; i <= 4; i++) {
    const yVal = Math.round((maxVal / 4) * i);
    const y = paddingTop + chartH - (yVal / maxVal) * chartH;
    gridLines += `
      <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="var(--border-color)" stroke-width="0.75" stroke-dasharray="4,4"/>
      <text x="${paddingLeft - 8}" y="${y + 4}" fill="var(--text-muted)" font-size="9" text-anchor="end">${yVal}</text>
    `;
  }
  
  // Collect all unique contributors in the display periods
  const activeContributors = new Set();
  displayPeriods.forEach(p => {
    Object.keys(p.contributors).forEach(c => activeContributors.add(c));
  });
  const contributorsList = Array.from(activeContributors).sort();
  
  // Draw stacked bars
  let bars = '';
  displayPeriods.forEach((period, idx) => {
    const barX = paddingLeft + idx * step + step * 0.15;
    const barW = step * 0.7;
    
    let yOffset = 0;
    
    // We stack contributors in contributorsList order to keep color positions stable
    contributorsList.forEach(cName => {
      const cnt = period.contributors[cName] || 0;
      if (cnt === 0) return;
      
      const segmentH = (cnt / maxVal) * chartH;
      const y = paddingTop + chartH - yOffset - segmentH;
      const col = getPersonColor(cName);
      
      bars += `
        <rect x="${barX}" y="${y}" width="${barW}" height="${segmentH}" fill="${col}" rx="1.5" ry="1.5" style="transition: var(--transition-smooth);"/>
      `;
      
      if (segmentH > 10) {
        bars += `
          <text x="${barX + barW / 2}" y="${y + segmentH / 2 + 3.5}" fill="#fff" font-size="8" font-weight="600" text-anchor="middle">${cnt}</text>
        `;
      }
      
      yOffset += segmentH;
    });
    
    // Total count above the bar
    if (period.total > 0) {
      bars += `
        <text x="${barX + barW / 2}" y="${paddingTop + chartH - yOffset - 5}" fill="var(--text-main)" font-size="9.5" font-weight="700" text-anchor="middle">${period.total}</text>
      `;
    }
    
    // Label
    bars += `
      <text x="${barX + barW / 2}" y="${height - paddingBottom + 18}" fill="var(--text-muted)" font-size="9" font-weight="500" text-anchor="middle">${period.key}</text>
    `;
  });
  
  // Render legend on right
  let legendSvg = '';
  contributorsList.forEach((cName, cIdx) => {
    const lx = width - paddingRight + 12;
    const ly = paddingTop + cIdx * 14;
    const col = getPersonColor(cName);
    const label = cName.split(' ')[0]; // use first name
    
    if (ly < height - paddingBottom + 10) {
      legendSvg += `
        <g>
          <rect x="${lx}" y="${ly}" width="8" height="8" fill="${col}" rx="1.5"/>
          <text x="${lx + 14}" y="${ly + 7.5}" fill="var(--text-muted)" font-size="8.5" font-weight="500">${label}</text>
        </g>
      `;
    }
  });
  
  container.innerHTML = `
    <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}">
      ${gridLines}
      ${bars}
      ${legendSvg}
      <line x1="${paddingLeft}" y1="${paddingTop + chartH}" x2="${width - paddingRight}" y2="${paddingTop + chartH}" stroke="var(--border-color)" stroke-width="1.5"/>
    </svg>
  `;
}

function renderDeliveriesList(closedWIs) {
  const mapped = closedWIs.map(wi => {
    const delivery = g_data.entregasMap.get(wi.Id);
    let leadTime = 0;
    let cycleTime = null;
    let person = wi.Responsavel || 'NENHUM';
    let closeDate = '';
    let closeDtStr = '-';
    
    if (delivery) {
      leadTime = delivery.LeadTimeDias;
      cycleTime = delivery.CycleTimeDias; // can be null
      person = delivery.ResponsavelNoFechamento || wi.Responsavel;
      closeDate = delivery.DataFechamento || '';
      if (delivery.DataFechamento) {
        closeDtStr = new Date(delivery.DataFechamento).toLocaleDateString('pt-BR');
      }
    } else {
      closeDate = wi.DataFechamento || '';
      if (wi.DataFechamento) {
        closeDtStr = new Date(wi.DataFechamento).toLocaleDateString('pt-BR');
      }
      if (wi.DataCriacao && wi.DataFechamento) {
        leadTime = (new Date(wi.DataFechamento).getTime() - new Date(wi.DataCriacao).getTime()) / (1000 * 60 * 60 * 24);
      }
    }
    
    const leadTimeStr = leadTime > 0 ? `${leadTime.toFixed(1)}d` : '-';
    const cycleTimeStr = cycleTime !== null ? `${cycleTime.toFixed(1)}d` : 'Sem active';
    
    return {
      Id: parseInt(wi.Id) || 0,
      Titulo: wi.Titulo || '',
      Tipo: wi.Tipo || '',
      CloseDate: closeDate,
      CloseDateStr: closeDtStr,
      Responsavel: person,
      LeadTime: leadTime,
      LeadTimeStr: leadTimeStr,
      CycleTime: cycleTime,
      CycleTimeStr: cycleTimeStr,
      originalWi: wi
    };
  });

  const thead = document.getElementById('table-deliveries-list').parentNode.querySelector('thead');
  if (thead && !thead.dataset.gridInitialized) {
    initializeGridHeaders('table-deliveries-list', 'deliveriesList', () => {
      renderDeliveriesList(closedWIs);
    });
  }

  processAndRenderGridGeneric('table-deliveries-list', 'deliveriesList', mapped, (row, tbody) => {
    const tr = document.createElement('tr');
    
    tr.innerHTML = `
      <td><a href="#" class="wi-drill-link" data-wi-id="${row.Id}" style="color: var(--color-primary); font-weight: 700; text-decoration: none; border-bottom: 1px dashed var(--color-primary); transition: var(--transition-smooth);">#${row.Id}</a></td>
      <td class="text-ellipsis" title="${row.Titulo}"><strong>${row.Titulo}</strong></td>
      <td>${getWiTypeIcon(row.Tipo)}</td>
      <td>${row.CloseDateStr}</td>
      <td>${row.Responsavel}</td>
      <td><strong style="color: var(--color-flow-fila);">${row.LeadTimeStr}</strong></td>
      <td><strong style="color: var(--color-flow-trabalho);">${row.CycleTimeStr}</strong></td>
    `;
    
    tr.querySelector('.wi-drill-link').addEventListener('click', (e) => {
      e.preventDefault();
      const id = e.target.getAttribute('data-wi-id');
      navigateToPage('drilldown', () => { g_selectedDrillDownId = id; });
    });
    
    tbody.appendChild(tr);
  }, (count) => {
    document.getElementById('lbl-deliveries-total-count').textContent = `${count} entregues`;
  });
}

// 12. PAGE 4 RENDERER: TIME E CAPACIDADE (CAPACITY)
function renderCapacity(filteredWIs) {
  const activeWIs = filteredWIs.filter(wi => wi.State !== 'Closed' && wi.BoardColumn !== 'ConcluÃ­do');
  
  // 1. WIP por ResponsÃ¡vel
  renderWipByPersonChart(activeWIs);
  
  // 2. Mix de Atividades nas Tasks Filhas (SVG Donut Rosca)
  renderTaskActivityDonut(filteredWIs);
  
  // 3. EsforÃ§o Planejado vs Realizado (Estimado vs ConcluÃ­do)
  renderPlannedVsCompletedHours(filteredWIs);
  
  // 4. Mapeamento de Dev + QA
  renderDevQaPairsTable(filteredWIs);
}

function renderWipByPersonChart(activeWIs) {
  const container = document.getElementById('chart-capacity-wip-person');
  if (!container) return;
  container.innerHTML = '';
  
  const counts = {};
  activeWIs.forEach(wi => {
    const person = wi.Responsavel && wi.Responsavel !== 'NENHUM' && wi.Responsavel.trim() !== '' ? wi.Responsavel : 'Sem ResponsÃ¡vel';
    counts[person] = (counts[person] || 0) + 1;
  });
  
  const data = Object.keys(counts).map(name => ({ name, count: counts[name] })).sort((a, b) => b.count - a.count);
  
  if (data.length === 0) {
    container.style.display = 'flex';
    container.style.alignItems = 'center';
    container.style.justifyContent = 'center';
    container.innerHTML = `<span class="placeholder-text">Nenhum WIP ativo para os filtros no momento.</span>`;
    return;
  }
  
  // Override centering flexbox styles to allow elegant vertical scrolling and prevent overlaps
  container.style.display = 'block';
  container.style.overflowY = 'auto';
  container.style.maxHeight = '300px';
  container.style.boxSizing = 'border-box';
  container.style.paddingRight = '8px';
  
  const maxVal = Math.max(...data.map(d => d.count), 4);
  
  // Draw Horizontal Bar Chart dynamically
  let html = '';
  data.forEach(d => {
    const pct = ((d.count / maxVal) * 80).toFixed(0);
    html += `
      <div style="margin-bottom: 12px; text-align: left;">
        <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 4px;">
          <span>${d.name}</span>
          <strong>${d.count} itens</strong>
        </div>
        <div style="width: 100%; height: 10px; background-color: hsla(252, 31%, 6%, 0.4); border-radius: 5px; overflow: hidden; border: 1px solid var(--border-color);">
          <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, var(--color-primary), hsl(280, 85%, 60%)); border-radius: 5px;" class="svg-bar"></div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = `<div style="padding: 10px 0; width: 100%;">${html}</div>`;
}

function renderTaskActivityDonut(filteredWIs) {
  const container = document.getElementById('chart-capacity-task-activities');
  container.innerHTML = '';
  
  const activities = {};
  let totalTasks = 0;
  
  filteredWIs.forEach(wi => {
    const tasks = g_data.tasksByParent.get(wi.Id) || [];
    tasks.forEach(t => {
      const act = t.Activity && t.Activity.trim() !== '' ? t.Activity.trim() : 'Outros/Indefinido';
      activities[act] = (activities[act] || 0) + 1;
      totalTasks++;
    });
  });
  
  if (totalTasks === 0) {
    container.innerHTML = `<span class="placeholder-text">Os itens selecionados nÃ£o possuem subtasks filhas</span>`;
    return;
  }
  
  const sortedActivities = Object.keys(activities).map(act => ({ label: act, count: activities[act] }))
                                 .sort((a, b) => b.count - a.count);
  
  // Colors for donut segments
  const colors = [
    'var(--color-primary)',
    'var(--color-flow-trabalho)',
    'var(--color-flow-fila)',
    'var(--color-flow-prerelease)',
    'var(--color-danger)',
    'var(--text-muted)'
  ];
  
  // Draw premium SVG circular stroke-dasharray donut chart!
  // Radius = 50, Center = 80, strokeWidth = 14 -> circumference = 2 * PI * 50 = 314.16
  const radius = 50;
  const circ = 2 * Math.PI * radius; // 314.16
  
  let currentOffset = 0;
  let segments = '';
  
  sortedActivities.forEach((act, idx) => {
    const col = colors[idx % colors.length];
    const pct = act.count / totalTasks;
    const dashArrayVal = pct * circ;
    const strokeDash = `${dashArrayVal} ${circ - dashArrayVal}`;
    const strokeOffset = -currentOffset;
    
    segments += `
      <circle cx="100" cy="85" r="${radius}" fill="none" stroke="${col}" stroke-width="14" 
              stroke-dasharray="${strokeDash}" stroke-dashoffset="${strokeOffset}" 
              transform="rotate(-90, 100, 85)" class="svg-bar" style="transform-origin: center; transition: var(--transition-smooth);"/>
    `;
    currentOffset += dashArrayVal;
  });
  
  // Build detailed Legend
  let legendHtml = '';
  sortedActivities.forEach((act, idx) => {
    const col = colors[idx % colors.length];
    const pct = ((act.count / totalTasks) * 100).toFixed(0);
    legendHtml += `
      <div class="legend-item" style="font-size: 0.8rem; margin-bottom: 6px;">
        <span class="legend-bullet" style="background-color: ${col}; width: 10px; height: 10px;"></span>
        <span><strong>${act.label}:</strong> ${act.count} (${pct}%)</span>
      </div>
    `;
  });
  
  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-around; width: 100%; padding: 10px 0;">
      <svg width="200" height="170" viewBox="0 0 200 170" style="display: block;">
        ${segments}
        <!-- Inner Glow Circle -->
        <circle cx="100" cy="85" r="41" fill="var(--bg-main)" stroke="var(--border-color)" stroke-width="1"/>
        <text x="100" y="82" fill="#fff" font-size="16" font-weight="700" text-anchor="middle">${totalTasks}</text>
        <text x="100" y="96" fill="var(--text-muted)" font-size="9" text-anchor="middle" uppercase>Tasks Filhas</text>
      </svg>
      <div style="display: flex; flex-direction: column; justify-content: center; text-align: left;">
        ${legendHtml}
      </div>
    </div>
  `;
}

function renderPlannedVsCompletedHours(filteredWIs) {
  const mapped = filteredWIs.map(wi => {
    const tasks = g_data.tasksByParent.get(wi.Id) || [];
    let sumEst = 0;
    let sumComp = 0;
    
    if (tasks.length > 0) {
      tasks.forEach(t => {
        sumEst += t.OriginalEstimate;
        sumComp += t.CompletedWork;
      });
    }
    
    let statusText = '-';
    let statusColor = 'var(--text-muted)';
    if (tasks.length > 0) {
      const openCount = tasks.filter(t => t.State !== 'Closed').length;
      if (openCount === 0) {
        statusText = 'ConcluÃ­das';
        statusColor = 'var(--color-success)';
      } else {
        statusText = `${openCount} abertas`;
        statusColor = 'var(--color-warning)';
      }
    }
    
    return {
      Id: parseInt(wi.Id) || 0,
      Titulo: wi.Titulo || '',
      Responsavel: wi.Responsavel || 'NENHUM',
      BoardColumn: wi.BoardColumn || '',
      TaskCount: tasks.length,
      TaskCountStr: tasks.length > 0 ? `${tasks.length} subtasks` : 'Sem tasks',
      PlannedEst: sumEst,
      PlannedEstStr: tasks.length > 0 ? `${sumEst}h` : '-',
      CompletedComp: sumComp,
      CompletedCompStr: tasks.length > 0 ? `${sumComp}h` : '-',
      TaskStatus: statusText,
      statusColor: statusColor,
      hasTasks: tasks.length > 0,
      originalWi: wi
    };
  });
  
  const thead = document.getElementById('table-capacity-hours-list').parentNode.querySelector('thead');
  if (thead && !thead.dataset.gridInitialized) {
    initializeGridHeaders('table-capacity-hours-list', 'capacityHoursList', () => {
      renderPlannedVsCompletedHours(filteredWIs);
    });
  }
  
  processAndRenderGridGeneric('table-capacity-hours-list', 'capacityHoursList', mapped, (row, tbody) => {
    const tr = document.createElement('tr');
    
    tr.innerHTML = `
      <td><a href="#" class="drill-link" data-wi-id="${row.Id}">#${row.Id}</a></td>
      <td class="text-ellipsis" title="${row.Titulo}">${row.Titulo}</td>
      <td>${row.Responsavel}</td>
      <td><span class="badge badge-outline">${row.BoardColumn}</span></td>
      <td>${row.hasTasks ? row.TaskCountStr : '<em style="color: var(--text-muted);">Sem tasks</em>'}</td>
      <td>${row.PlannedEstStr}</td>
      <td>${row.CompletedCompStr}</td>
      <td><strong style="color: ${row.statusColor};">${row.TaskStatus}</strong></td>
    `;
    
    tr.querySelector('.drill-link').addEventListener('click', (e) => {
      e.preventDefault();
      const id = e.target.getAttribute('data-wi-id');
      navigateToPage('drilldown', () => { g_selectedDrillDownId = id; });
    });
    
    tbody.appendChild(tr);
  }, (count, filteredRows) => {
    let totalWithTasks = 0;
    let totalEstimate = 0;
    let totalCompleted = 0;
    
    filteredRows.forEach(row => {
      if (row.hasTasks) {
        totalWithTasks++;
        totalEstimate += row.PlannedEst;
        totalCompleted += row.CompletedComp;
      }
    });
    
    const coverageLbl = document.getElementById('lbl-capacity-coverage');
    if (count > 0) {
      const coveragePct = ((totalWithTasks / count) * 100).toFixed(0);
      coverageLbl.innerHTML = `Cobertura: <strong>${coveragePct}%</strong> (${totalEstimate}h Est. vs ${totalCompleted}h Real.)`;
    } else {
      coverageLbl.textContent = 'Cobertura de Tasks: 0%';
    }
  });
}


// 13. PAGE 5 RENDERER: QUALIDADE E BUGS (QUALITY)
let g_bugsActiveSeverityFilter = 'all';
let g_bugsActiveTagCategoryFilter = new Set();

// NEW HELPER: Severity Donut/Pie Chart Renderer for Page 5
function renderBugsSeverityPizza(bugs) {
  const container = document.getElementById('chart-bugs-severity-pizza');
  if (!container) return;
  container.innerHTML = '';
  
  // 1. Group bugs by severity
  let high = 0, med = 0, low = 0;
  bugs.forEach(b => {
    const sev = (b.Severidade || '').toLowerCase();
    if (sev.includes('1') || sev.includes('crit') || sev.includes('bloq') || sev.includes('high') || sev.includes('alta') || sev.includes('alto')) high++;
    else if (sev.includes('2') || sev.includes('3') || sev.includes('med') || sev.includes('mÃ©dia') || sev.includes('media') || sev.includes('mÃ©dio') || sev.includes('medio')) med++;
    else low++;
  });
  
  const total = high + med + low;
  if (total === 0) {
    container.innerHTML = `<span class="placeholder-text">Sem bugs para exibir</span>`;
    const badge = document.getElementById('badge-bugs-severity-filter');
    if (badge) badge.style.display = 'none';
    return;
  }
  
  // 2. Control filter badge in header
  const badge = document.getElementById('badge-bugs-severity-filter');
  if (badge) {
    if (g_bugsActiveSeverityFilter !== 'all') {
      badge.style.display = 'inline-block';
      let label = 'Alta';
      if (g_bugsActiveSeverityFilter === 'medium') label = 'MÃ©dia';
      else if (g_bugsActiveSeverityFilter === 'baixa') label = 'Baixa';
      badge.textContent = `Apenas ${label} Ã—`;
    } else {
      badge.style.display = 'none';
    }
  }
  
  // 3. SVG Donut drawing (Square layout viewBox 0 0 200 200, cx/cy = 100/100, r = 76)
  const r = 76;
  const cx = 100;
  const cy = 100;
  const circumference = 2 * Math.PI * r;
  
  const highPct = high / total;
  const medPct = med / total;
  const lowPct = low / total;
  
  const highStroke = highPct * circumference;
  const medStroke = medPct * circumference;
  const lowStroke = lowPct * circumference;
  
  let highClass = "donut-segment donut-sev-high";
  let medClass = "donut-segment donut-sev-med";
  let lowClass = "donut-segment donut-sev-low";
  
  if (g_bugsActiveSeverityFilter !== 'all') {
    if (g_bugsActiveSeverityFilter === 'crÃ­tico') {
      highClass += " active";
      medClass += " inactive";
      lowClass += " inactive";
    } else if (g_bugsActiveSeverityFilter === 'medium') {
      highClass += " inactive";
      medClass += " active";
      lowClass += " inactive";
    } else if (g_bugsActiveSeverityFilter === 'baixa') {
      highClass += " inactive";
      medClass += " inactive";
      lowClass += " active";
    }
  }
  
  let svgContent = '';
  if (high > 0) {
    svgContent += `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="transparent" 
              stroke="var(--color-danger)" stroke-width="${g_bugsActiveSeverityFilter === 'crÃ­tico' ? 24 : 18}" 
              stroke-dasharray="${highStroke} ${circumference}" stroke-dashoffset="0"
              class="${highClass}" data-severity="crÃ­tico" style="cursor: pointer; transition: var(--transition-smooth);" />
    `;
  }
  if (med > 0) {
    svgContent += `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="transparent" 
              stroke="var(--color-warning)" stroke-width="${g_bugsActiveSeverityFilter === 'medium' ? 24 : 18}" 
              stroke-dasharray="${medStroke} ${circumference}" stroke-dashoffset="-${highStroke}"
              class="${medClass}" data-severity="medium" style="cursor: pointer; transition: var(--transition-smooth);" />
    `;
  }
  if (low > 0) {
    svgContent += `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="transparent" 
              stroke="var(--text-muted)" stroke-width="${g_bugsActiveSeverityFilter === 'baixa' ? 24 : 18}" 
              stroke-dasharray="${lowStroke} ${circumference}" stroke-dashoffset="-${highStroke + medStroke}"
              class="${lowClass}" data-severity="baixa" style="cursor: pointer; transition: var(--transition-smooth);" />
    `;
  }
  
  let centerVal = total;
  let centerLabel = 'Bugs';
  if (g_bugsActiveSeverityFilter !== 'all') {
    centerVal = g_bugsActiveSeverityFilter === 'crÃ­tico' ? high : (g_bugsActiveSeverityFilter === 'medium' ? med : low);
    centerLabel = g_bugsActiveSeverityFilter === 'crÃ­tico' ? 'Alta' : (g_bugsActiveSeverityFilter === 'medium' ? 'MÃ©dia' : 'Baixa');
  }
  
  const highPctStr = (highPct * 100).toFixed(0) + '%';
  const medPctStr = (medPct * 100).toFixed(0) + '%';
  const lowPctStr = (lowPct * 100).toFixed(0) + '%';

  const legendHtml = `
    <div class="donut-legend" style="display: flex; flex-direction: column; align-items: flex-start; gap: 8px; max-width: 48%; box-sizing: border-box; flex-shrink: 0;">
      <div class="donut-legend-item ${g_bugsActiveSeverityFilter === 'crÃ­tico' ? 'active-legend' : (g_bugsActiveSeverityFilter !== 'all' ? 'inactive' : '')}" data-severity="crÃ­tico" style="padding: 4px 8px; font-size: 0.75rem; width: 100%; box-sizing: border-box; justify-content: flex-start;">
        <span class="donut-legend-color" style="background-color: var(--color-danger); flex-shrink: 0;"></span>
        <span class="donut-legend-label" style="text-align: left;">Alta</span>
        <span class="donut-legend-value" style="margin-left: auto; font-weight: 700; padding-left: 8px;">${high} (${highPctStr})</span>
      </div>
      <div class="donut-legend-item ${g_bugsActiveSeverityFilter === 'medium' ? 'active-legend' : (g_bugsActiveSeverityFilter !== 'all' ? 'inactive' : '')}" data-severity="medium" style="padding: 4px 8px; font-size: 0.75rem; width: 100%; box-sizing: border-box; justify-content: flex-start;">
        <span class="donut-legend-color" style="background-color: var(--color-warning); flex-shrink: 0;"></span>
        <span class="donut-legend-label" style="text-align: left;">MÃ©dia</span>
        <span class="donut-legend-value" style="margin-left: auto; font-weight: 700; padding-left: 8px;">${med} (${medPctStr})</span>
      </div>
      <div class="donut-legend-item ${g_bugsActiveSeverityFilter === 'baixa' ? 'active-legend' : (g_bugsActiveSeverityFilter !== 'all' ? 'inactive' : '')}" data-severity="baixa" style="padding: 4px 8px; font-size: 0.75rem; width: 100%; box-sizing: border-box; justify-content: flex-start;">
        <span class="donut-legend-color" style="background-color: var(--text-muted); flex-shrink: 0;"></span>
        <span class="donut-legend-label" style="text-align: left;">Baixa</span>
        <span class="donut-legend-value" style="margin-left: auto; font-weight: 700; padding-left: 8px;">${low} (${lowPctStr})</span>
      </div>
    </div>
  `;
  
  container.innerHTML = `
    <div style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; width: 100%; height: 100%; padding: 0 10px; box-sizing: border-box; gap: 15px;">
      ${legendHtml}
      <div style="position: relative; width: 200px; height: 200px; flex-shrink: 0;">
        <svg width="100%" height="100%" viewBox="0 0 200 200" style="transform: rotate(-90deg); overflow: visible; width: 100%; height: 100%;">
          ${svgContent}
        </svg>
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; text-align: center;">
          <span style="font-size: 2.2rem; font-weight: 800; color: var(--text-main); line-height: 1;">${centerVal}</span>
          <span style="font-size: 0.72rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.8px; margin-top: 4px;">${centerLabel}</span>
        </div>
      </div>
    </div>
  `;
  
  container.querySelectorAll('.donut-segment, .donut-legend-item').forEach(el => {
    el.addEventListener('click', () => {
      const sev = el.getAttribute('data-severity');
      g_bugsActiveSeverityFilter = (g_bugsActiveSeverityFilter === sev) ? 'all' : sev;
      
      document.querySelectorAll('.btn-quick-filter').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-severity') === g_bugsActiveSeverityFilter) {
          btn.classList.add('active');
        }
      });
      
      renderQuality(getFilteredWorkItems());
    });
  });
  
  if (badge) {
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      g_bugsActiveSeverityFilter = 'all';
      document.querySelectorAll('.btn-quick-filter').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-severity') === 'all') btn.classList.add('active');
      });
      renderQuality(getFilteredWorkItems());
    });
  }
}

function renderBugsTagsChart(bugs) {
  const container = document.getElementById('chart-bugs-tags-bar');
  if (!container) return;
  container.innerHTML = '';
  
  // 1. Group bugs by tag category (cumulative/non-mutually exclusive)
  const counts = { Legado: 0, GeradoPorUS: 0, '!BUG': 0, 'Outra Squad': 0, Outros: 0 };
  bugs.forEach(b => {
    const wiTags = g_data.tagsByWi.get(b.Id) || [];
    const lowerTags = wiTags.map(t => t.toLowerCase());
    
    let hasMainTag = false;
    if (lowerTags.includes('legado')) {
      counts['Legado']++;
      hasMainTag = true;
    }
    if (lowerTags.includes('geradoporus')) {
      counts['GeradoPorUS']++;
      hasMainTag = true;
    }
    if (lowerTags.includes('!bug')) {
      counts['!BUG']++;
      hasMainTag = true;
    }
    if (lowerTags.includes('outra squad')) {
      counts['Outra Squad']++;
      hasMainTag = true;
    }
    
    if (!hasMainTag) {
      counts['Outros']++;
    }
  });
  
  // Filter out categories that don't have any items
  const allCategories = ['Legado', 'GeradoPorUS', '!BUG', 'Outra Squad', 'Outros'];
  const categories = allCategories.filter(cat => counts[cat] > 0);
  
  const total = bugs.length;
  if (total === 0 || categories.length === 0) {
    container.innerHTML = `<span class="placeholder-text">Sem bugs para exibir</span>`;
    const badge = document.getElementById('badge-bugs-tags-filter');
    if (badge) badge.style.display = 'none';
    return;
  }
  
  const sumCounts = categories.reduce((sum, cat) => sum + counts[cat], 0);
  
  // 2. Control active filter badge in header
  const badge = document.getElementById('badge-bugs-tags-filter');
  if (badge) {
    if (g_bugsActiveTagCategoryFilter.size > 0) {
      badge.style.display = 'inline-block';
      badge.textContent = `Tags: ${Array.from(g_bugsActiveTagCategoryFilter).join(', ')} Ã—`;
    } else {
      badge.style.display = 'none';
    }
  }
  
  // Calculate interactive center value depending on selected filter
  let centerVal = total;
  let centerLabel = 'Bugs';
  if (g_bugsActiveTagCategoryFilter.size > 0) {
    const matchingBugs = bugs.filter(b => {
      const wiTags = g_data.tagsByWi.get(b.Id) || [];
      const lowerTags = wiTags.map(t => t.toLowerCase());
      let bugCategories = [];
      if (lowerTags.includes('legado')) bugCategories.push('Legado');
      if (lowerTags.includes('geradoporus')) bugCategories.push('GeradoPorUS');
      if (lowerTags.includes('!bug')) bugCategories.push('!BUG');
      if (lowerTags.includes('outra squad')) bugCategories.push('Outra Squad');
      if (bugCategories.length === 0) bugCategories.push('Outros');
      return bugCategories.some(cat => g_bugsActiveTagCategoryFilter.has(cat));
    });
    centerVal = matchingBugs.length;
    centerLabel = g_bugsActiveTagCategoryFilter.size === 1 ? Array.from(g_bugsActiveTagCategoryFilter)[0] : 'Filtrado';
  }
  
  // 3. Draw Donut Pizza Chart in SVG (Square layout viewBox 0 0 200 200, cx/cy = 100/100, r = 76)
  const colors = {
    'Legado': 'var(--color-primary)',      // Violet
    'GeradoPorUS': 'var(--color-flow-fila)', // Blue
    '!BUG': 'var(--color-danger)',          // Rose
    'Outra Squad': 'var(--color-flow-trabalho)', // Amber
    'Outros': 'var(--color-flow-done)'       // Grey
  };
  
  const r = 76;
  const cx = 100;
  const cy = 100;
  const circumference = 2 * Math.PI * r;
  
  let currentOffset = 0;
  let svgContent = '';
  
  categories.forEach(cat => {
    const count = counts[cat];
    const pct = count / sumCounts;
    const strokeLength = pct * circumference;
    const strokeOffset = currentOffset;
    currentOffset += strokeLength;
    
    let opacity = 1.0;
    let strokeWidth = 18;
    let strokeAttr = '';
    
    if (g_bugsActiveTagCategoryFilter.size > 0) {
      if (g_bugsActiveTagCategoryFilter.has(cat)) {
        strokeWidth = 24;
        strokeAttr = `stroke-width="24"`;
      } else {
        opacity = 0.25;
      }
    }
    
    svgContent += `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="transparent" 
              stroke="${colors[cat]}" stroke-width="${strokeWidth}" 
              stroke-dasharray="${strokeLength} ${circumference}" stroke-dashoffset="-${strokeOffset}"
              style="cursor: pointer; opacity: ${opacity}; transition: var(--transition-smooth);"
              class="donut-segment tag-donut-segment" data-category="${cat}" ${strokeAttr} />
    `;
  });
  
  let legendHtml = '<div class="donut-legend" style="display: flex; flex-direction: column; align-items: flex-start; gap: 6px; max-width: 48%; box-sizing: border-box; flex-shrink: 0;">';
  categories.forEach(cat => {
    const count = counts[cat];
    const pctStr = ((count / total) * 100).toFixed(0) + '%';
    
    const isActive = g_bugsActiveTagCategoryFilter.has(cat);
    const hasFilters = g_bugsActiveTagCategoryFilter.size > 0;
    
    let itemClass = '';
    if (hasFilters) {
      itemClass = isActive ? 'active-legend' : 'inactive';
    }
    
    legendHtml += `
      <div class="donut-legend-item ${itemClass}" data-category="${cat}" style="padding: 4px 8px; font-size: 0.75rem; width: 100%; box-sizing: border-box; justify-content: flex-start;">
        <span class="donut-legend-color" style="background-color: ${colors[cat]}; flex-shrink: 0;"></span>
        <span class="donut-legend-label" style="text-align: left;">${cat}</span>
        <span class="donut-legend-value" style="margin-left: auto; font-weight: 700; padding-left: 8px;">${count} (${pctStr})</span>
      </div>
    `;
  });
  legendHtml += '</div>';
  
  container.innerHTML = `
    <div style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; width: 100%; height: 100%; padding: 0 10px; box-sizing: border-box; gap: 15px;">
      ${legendHtml}
      <div style="position: relative; width: 200px; height: 200px; flex-shrink: 0;">
        <svg width="100%" height="100%" viewBox="0 0 200 200" style="transform: rotate(-90deg); overflow: visible; width: 100%; height: 100%;">
          ${svgContent}
        </svg>
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; text-align: center;">
          <span style="font-size: 2.2rem; font-weight: 800; color: var(--text-main); line-height: 1;">${centerVal}</span>
          <span style="font-size: 0.72rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.8px; margin-top: 4px;">${centerLabel}</span>
        </div>
      </div>
    </div>
  `;
  
  container.querySelectorAll('.tag-donut-segment, .donut-legend-item').forEach(el => {
    el.addEventListener('click', () => {
      const cat = el.getAttribute('data-category');
      if (g_bugsActiveTagCategoryFilter.has(cat)) {
        g_bugsActiveTagCategoryFilter.delete(cat);
      } else {
        g_bugsActiveTagCategoryFilter.add(cat);
      }
      renderQuality(getFilteredWorkItems());
    });
  });
  
  if (badge) {
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      g_bugsActiveTagCategoryFilter.clear();
      renderQuality(getFilteredWorkItems());
    });
  }
}

// 13. PAGE 5 RENDERER: QUALIDADE E BUGS (QUALITY)
// PDF-1: Horas Dev vs Testando por Tipo de WI (gráfico empilhado)
function renderDevVsTestByType(filteredWIs) {
  const container = document.getElementById('chart-capacity-dev-vs-test');
  if (!container) return;
  container.innerHTML = '';

  const DEV_ACTS  = new Set(['Development','CodeAdjustment','CodeReview','Rework','Deployment','DevelopmentTest']);
  const TEST_ACTS = new Set(['Testing','TechnicalValidation']);

  const groups = { 'Bug': {dev:0,test:0,other:0}, 'User Story': {dev:0,test:0,other:0} };

  filteredWIs.forEach(wi => {
    const tipo = wi.Tipo;
    if (!groups[tipo]) return;
    const tasks = g_data.tasksByParent.get(wi.Id) || [];
    tasks.forEach(t => {
      const cw = t.CompletedWork || 0;
      if (cw <= 0) return;
      const act = (t.Activity || '').trim();
      if (DEV_ACTS.has(act))       groups[tipo].dev   += cw;
      else if (TEST_ACTS.has(act)) groups[tipo].test  += cw;
      else                          groups[tipo].other += cw;
    });
  });

  const tipos = Object.keys(groups).filter(t => (groups[t].dev + groups[t].test + groups[t].other) > 0);
  if (tipos.length === 0) {
    container.innerHTML = `<span class="placeholder-text">Sem dados de tasks com CompletedWork</span>`;
    return;
  }

  // ── Layout constants ────────────────────────────────────────────────────────
  const svgW  = 520;
  const svgH  = 260;
  const padL  = 52;   // y-axis labels
  const padR  = 20;
  const padT  = 28;   // room for ratio label
  const padB  = 52;   // x-axis labels + legend
  const chartW = svgW - padL - padR;
  const chartH = svgH - padT - padB;

  const n     = tipos.length;
  const slot  = chartW / n;             // width allotted per group
  const barW  = Math.min(72, slot * 0.55);

  const maxVal = Math.max(...tipos.map(t => groups[t].dev + groups[t].test + groups[t].other), 1);

  const COLORS = { dev: 'hsl(210,80%,55%)', test: 'hsl(160,65%,45%)', other: 'hsl(38,80%,55%)' };
  const LABELS = { dev: 'Dev / Código', test: 'Testes / QA', other: 'Outros' };

  // ── Y-axis grid lines & labels ──────────────────────────────────────────────
  const tickCount = 4;
  const tickStep  = maxVal / tickCount;
  let axis = '';
  for (let i = 0; i <= tickCount; i++) {
    const v = tickStep * i;
    const y = padT + chartH - (v / maxVal) * chartH;
    axis += `<line x1="${padL}" y1="${y}" x2="${padL + chartW}" y2="${y}" stroke="var(--border-color)" stroke-dasharray="3 3" stroke-opacity="0.5"/>`;
    axis += `<text x="${padL - 6}" y="${y + 4}" text-anchor="end" fill="var(--text-muted)" font-size="10">${Math.round(v)}h</text>`;
  }

  // ── Bars ────────────────────────────────────────────────────────────────────
  let bars = '';
  tipos.forEach((tipo, i) => {
    const g     = groups[tipo];
    const total = g.dev + g.test + g.other;
    const cx    = padL + slot * i + slot / 2;   // center of slot
    const bx    = cx - barW / 2;

    let yOff = padT + chartH;
    [['dev', g.dev], ['test', g.test], ['other', g.other]].forEach(([key, val]) => {
      if (val <= 0) return;
      const h = (val / maxVal) * chartH;
      yOff -= h;
      bars += `<rect x="${bx.toFixed(1)}" y="${yOff.toFixed(1)}" width="${barW}" height="${h.toFixed(1)}" fill="${COLORS[key]}" rx="3" opacity="0.9"/>`;
      if (h > 16) {
        bars += `<text x="${cx.toFixed(1)}" y="${(yOff + h / 2 + 4).toFixed(1)}" text-anchor="middle" fill="#fff" font-size="11" font-weight="700">${Math.round(val)}h</text>`;
      }
    });

    // Label below bar
    bars += `<text x="${cx.toFixed(1)}" y="${(padT + chartH + 16).toFixed(1)}" text-anchor="middle" fill="var(--text-main)" font-size="12" font-weight="600">${tipo}</text>`;
    bars += `<text x="${cx.toFixed(1)}" y="${(padT + chartH + 30).toFixed(1)}" text-anchor="middle" fill="var(--text-muted)" font-size="10">${Math.round(total)}h total</text>`;

    // Ratio dev:test above bar
    if (g.test > 0) {
      const ratio = (g.dev / g.test).toFixed(1);
      bars += `<text x="${cx.toFixed(1)}" y="${(padT - 8).toFixed(1)}" text-anchor="middle" fill="var(--text-muted)" font-size="9">ratio ${ratio}:1</text>`;
    }
  });

  // ── Legend (bottom, centered) ───────────────────────────────────────────────
  const legendItems  = [['dev', COLORS.dev, LABELS.dev], ['test', COLORS.test, LABELS.test], ['other', COLORS.other, LABELS.other]];
  const legendItemW  = 110;
  const legendTotalW = legendItems.length * legendItemW;
  const legendStartX = (svgW - legendTotalW) / 2;
  const legendY      = svgH - 12;

  let legend = '';
  legendItems.forEach(([, color, label], i) => {
    const lx = legendStartX + i * legendItemW;
    legend += `<rect x="${lx}" y="${legendY - 10}" width="11" height="11" fill="${color}" rx="2"/>`;
    legend += `<text x="${lx + 15}" y="${legendY}" fill="var(--text-muted)" font-size="10">${label}</text>`;
  });

  container.innerHTML = `<svg width="100%" height="100%" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMidYMid meet">${axis}${bars}${legend}</svg>`;
}

function renderQuality(filteredWIs) {
  const bugs = filteredWIs.filter(wi => wi.Tipo === 'Bug');
  
  // Render sub-page charts
  renderBugsSeverityPizza(bugs);
  renderBugsTagsChart(bugs);
  
  // Apply local filtering to compute page statistics
  const pageBugs = bugs.filter(b => {
    // 1. Severity filter
    const sev = (b.Severidade || '').toLowerCase();
    let matchesSev = true;
    if (g_bugsActiveSeverityFilter === 'crÃ­tico') {
      matchesSev = sev.includes('1') || sev.includes('crit') || sev.includes('bloq') || sev.includes('high') || sev.includes('alta') || sev.includes('alto');
    } else if (g_bugsActiveSeverityFilter === 'medium') {
      matchesSev = sev.includes('2') || sev.includes('3') || sev.includes('med') || sev.includes('mÃ©dia') || sev.includes('media') || sev.includes('mÃ©dio') || sev.includes('medio');
    } else if (g_bugsActiveSeverityFilter === 'baixa') {
      matchesSev = !sev.includes('1') && !sev.includes('crit') && !sev.includes('bloq') && !sev.includes('high') && !sev.includes('alta') && !sev.includes('alto') &&
                   !sev.includes('2') && !sev.includes('3') && !sev.includes('med') && !sev.includes('mÃ©dia') && !sev.includes('media') && !sev.includes('mÃ©dio') && !sev.includes('medio');
    }
    
    // 2. Tag category filter
    let matchesTag = true;
    if (g_bugsActiveTagCategoryFilter.size > 0) {
      const wiTags = g_data.tagsByWi.get(b.Id) || [];
      const lowerTags = wiTags.map(t => t.toLowerCase());
      
      let bugCategories = [];
      if (lowerTags.includes('legado')) bugCategories.push('Legado');
      if (lowerTags.includes('geradoporus')) bugCategories.push('GeradoPorUS');
      if (lowerTags.includes('!bug')) bugCategories.push('!BUG');
      if (lowerTags.includes('outra squad')) bugCategories.push('Outra Squad');
      
      if (bugCategories.length === 0) {
        bugCategories.push('Outros');
      }
      
      matchesTag = bugCategories.some(cat => g_bugsActiveTagCategoryFilter.has(cat));
    }
    
    return matchesSev && matchesTag;
  });
  
  // Calculate Bug Rate
  // Formula: (Bugs Fechados + Bugs Abertos Totais) / User Stories ConcluÃ­das no perÃ­odo
  const closedWIs = filteredWIs.filter(wi => wi.State === 'Closed' || wi.BoardColumn === 'ConcluÃ­do');
  const stories = closedWIs.filter(wi => wi.Tipo === 'User Story');
  
  const bugsOpen = pageBugs.filter(b => b.State !== 'Closed' && b.BoardColumn !== 'ConcluÃ­do');
  const bugsClosed = pageBugs.filter(b => b.State === 'Closed' || b.BoardColumn === 'ConcluÃ­do');
  
  const numerator = bugsOpen.length + bugsClosed.length;
  const denominator = stories.length;
  
  let calculatedRate = '-';
  if (denominator > 0) {
    calculatedRate = `${((numerator / denominator) * 100).toFixed(2)}%`;
  }
  const pctEl = document.getElementById('lbl-quality-formula-pct');
  const descEl = document.getElementById('lbl-quality-formula-desc');
  if (pctEl && descEl) {
    pctEl.textContent = calculatedRate;
    descEl.textContent = `Fator Atual: ${numerator} Bugs / ${denominator} Stories`;
  }
  // Calculate MTTR (Mean Time To Resolution) for locally filtered closed bugs!
  const pageBugsClosed = pageBugs.filter(b => b.State === 'Closed' || b.BoardColumn === 'ConcluÃ­do');
  const resolutionTimes = [];
  pageBugsClosed.forEach(b => {
    const delivery = g_data.entregasMap.get(b.Id);
    if (delivery) {
      resolutionTimes.push(delivery.LeadTimeDias);
    } else if (b.DataCriacao && b.DataFechamento) {
      const diff = (new Date(b.DataFechamento).getTime() - new Date(b.DataCriacao).getTime()) / (1000 * 60 * 60 * 24);
      if (diff >= 0) resolutionTimes.push(diff);
    }
  });
  
  const mttr = resolutionTimes.length > 0 ? (resolutionTimes.reduce((s, v) => s + v, 0) / resolutionTimes.length) : 0;
  const mttrLbl = document.getElementById('lbl-quality-mttr');
  if (mttrLbl) {
    mttrLbl.textContent = resolutionTimes.length > 0 ? `${mttr.toFixed(1)} dias` : '-';
  }
  
  // Load metric card factor
  let globalBugRateStr = '-';
  if (g_raw.metricas.length > 0) {
    const rawRate = parseFloat(g_raw.metricas[0].BugRate);
    if (!isNaN(rawRate)) {
      globalBugRateStr = `${(rawRate * 100).toFixed(2)}%`;
    }
  }
  document.getElementById('kpi-bug-rate').textContent = calculatedRate !== '-' ? calculatedRate : globalBugRateStr;
  
  // Render Open vs Closed comparison bar chart (using the locally filtered bugs subset!)
  const pageBugsOpen = pageBugs.filter(b => b.State !== 'Closed' && b.BoardColumn !== 'ConcluÃ­do');
  renderBugsComparisonChart(pageBugsOpen.length, pageBugsClosed.length);
  
  // Setup Quick Filter buttons
  setupBugQuickFilters(bugs);
  
  // 3. Render Bugs List Table
  const thead = document.getElementById('table-quality-bugs-list').parentNode.querySelector('thead');
  if (thead && !thead.dataset.gridInitialized) {
    initializeGridHeaders('table-quality-bugs-list', 'qualityBugsList', () => {
      renderBugsTable(bugs);
    });
  }
  
  renderBugsTable(bugs);

  // MD-2: Lead Time até PRR has been removed

  // MD-6: Bugs sem responsável
  renderBugsSemResponsavel(bugs);

  // PDF-2: Taxa Bug → US via !BUG
  renderBugToUSRate();
}

function renderBugsComparisonChart(openCount, closedCount) {
  const container = document.getElementById('chart-quality-bugs-comparison');
  container.innerHTML = '';
  
  if (openCount === 0 && closedCount === 0) {
    container.innerHTML = `<span class="placeholder-text">Nenhum bug para os filtros selecionados</span>`;
    return;
  }
  
  const maxVal = Math.max(openCount, closedCount, 4);
  
  // Render programmatically styled double horizontal visual bar SVG
  const width = 500;
  const height = 180;
  const paddingLeft = 140;
  const paddingRight = 40;
  const paddingTop = 30;
  const paddingBottom = 20;
  
  const chartW = width - paddingLeft - paddingRight;
  
  const openW = (openCount / maxVal) * chartW;
  const closedW = (closedCount / maxVal) * chartW;
  
  container.innerHTML = `
    <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}">
      <!-- Open Bugs Row -->
      <text x="${paddingLeft - 15}" y="65" fill="var(--text-main)" font-size="11" font-weight="600" text-anchor="end">Bugs Abertos (Todos)</text>
      <rect x="${paddingLeft}" y="50" width="${openW}" height="22" fill="var(--color-danger)" rx="3" ry="3" class="svg-bar"/>
      <text x="${paddingLeft + openW + 10}" y="65" fill="var(--text-main)" font-size="11.5" font-weight="700">${openCount}</text>
      
      <!-- Closed Bugs Row -->
      <text x="${paddingLeft - 15}" y="115" fill="var(--text-main)" font-size="11" font-weight="600" text-anchor="end">Bugs Fechados (30d)</text>
      <rect x="${paddingLeft}" y="100" width="${closedW}" height="22" fill="var(--color-flow-done)" rx="3" ry="3" class="svg-bar"/>
      <text x="${paddingLeft + closedW + 10}" y="115" fill="var(--text-main)" font-size="11.5" font-weight="700">${closedCount}</text>
    </svg>
  `;
}

function setupBugQuickFilters(bugs) {
  const quickFilters = document.querySelectorAll('.btn-quick-filter');
  
  quickFilters.forEach(btn => {
    // Remove previous listeners
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    newBtn.addEventListener('click', () => {
      document.querySelectorAll('.btn-quick-filter').forEach(b => b.classList.remove('active'));
      newBtn.classList.add('active');
      
      g_bugsActiveSeverityFilter = newBtn.getAttribute('data-severity');
      renderQuality(getFilteredWorkItems());
    });
  });
}

function renderBugsTable(bugs) {
  const tbody = document.getElementById('table-quality-bugs-list');
  const countLabel = document.getElementById('lbl-quality-bugs-count');
  
  // Filter bugs based on active quick severity filter AND active tag category filter
  const filteredBugs = bugs.filter(b => {
    // 1. Severity filter
    const sev = (b.Severidade || '').toLowerCase();
    let matchesSev = true;
    if (g_bugsActiveSeverityFilter === 'crÃ­tico') {
      matchesSev = sev.includes('1') || sev.includes('crit') || sev.includes('bloq') || sev.includes('high') || sev.includes('alta') || sev.includes('alto');
    } else if (g_bugsActiveSeverityFilter === 'medium') {
      matchesSev = sev.includes('2') || sev.includes('3') || sev.includes('med') || sev.includes('mÃ©dia') || sev.includes('media') || sev.includes('mÃ©dio') || sev.includes('medio');
    } else if (g_bugsActiveSeverityFilter === 'baixa') {
      matchesSev = !sev.includes('1') && !sev.includes('crit') && !sev.includes('bloq') && !sev.includes('high') && !sev.includes('alta') && !sev.includes('alto') &&
                   !sev.includes('2') && !sev.includes('3') && !sev.includes('med') && !sev.includes('mÃ©dia') && !sev.includes('media') && !sev.includes('mÃ©dio') && !sev.includes('medio');
    }
    
    // 2. Tag category filter
    let matchesTag = true;
    if (g_bugsActiveTagCategoryFilter.size > 0) {
      const wiTags = g_data.tagsByWi.get(b.Id) || [];
      const lowerTags = wiTags.map(t => t.toLowerCase());
      
      let bugCategories = [];
      if (lowerTags.includes('legado')) bugCategories.push('Legado');
      if (lowerTags.includes('geradoporus')) bugCategories.push('GeradoPorUS');
      if (lowerTags.includes('!bug')) bugCategories.push('!BUG');
      if (lowerTags.includes('outra squad')) bugCategories.push('Outra Squad');
      
      if (bugCategories.length === 0) {
        bugCategories.push('Outros');
      }
      
      matchesTag = bugCategories.some(cat => g_bugsActiveTagCategoryFilter.has(cat));
    }
    
    return matchesSev && matchesTag;
  });
  
  // Map raw bug elements to a flat object format compatible with our generic grid engine.
  const mapped = filteredBugs.map(b => {
    const isOpen = b.State !== 'Closed' && b.BoardColumn !== 'ConcluÃ­do';
    
    // Severity indicator badge styling classes
    const sev = (b.Severidade || '').toLowerCase();
    let sevClass = 'badge-grey';
    if (sev.includes('1') || sev.includes('crit') || sev.includes('bloq') || sev.includes('high') || sev.includes('alta') || sev.includes('alto')) {
      sevClass = 'badge-rose';
    } else if (sev.includes('2') || sev.includes('3') || sev.includes('med') || sev.includes('mÃ©dia') || sev.includes('media') || sev.includes('mÃ©dio') || sev.includes('medio')) {
      sevClass = 'badge-amber';
    }
    
    const priStr = b.Prioridade ? `P${b.Prioridade}` : '-';
    const priVal = b.Prioridade ? parseInt(b.Prioridade) : null;
    
    const stateBadge = isOpen ? 'badge-rose' : 'badge-outline';
    
    // Period status (Open vs Closed in 30d operational window)
    const bugInfo = g_data.bugsMap.get(b.Id);
    let statusPeriodStr = 'Aberto Geral';
    if (bugInfo) {
      if (bugInfo.FechadoNoPeriodo === 'Sim') statusPeriodStr = 'Fechado 30d';
      else if (bugInfo.Aberto === 'Sim') statusPeriodStr = 'Aberto Ativo';
    }
    
    // Days open or resolution times calculation
    let daysStr = '-';
    let daysVal = null;
    if (isOpen) {
      daysStr = b.DiasAberto ? `${b.DiasAberto} dias` : '-';
      daysVal = b.DiasAberto ? parseFloat(b.DiasAberto) : null;
    } else {
      const delivery = g_data.entregasMap.get(b.Id);
      daysStr = delivery ? `${delivery.LeadTimeDias.toFixed(1)} dias res.` : 'Resolvido';
      daysVal = delivery ? delivery.LeadTimeDias : 0;
    }
    
    // MD-2: Lead Time até PRR
    const prrVisits = (g_data.tempoColunaByWi.get(b.Id) || []).filter(v => v.BoardColumn === 'Pronto pra Release');
    let leadPRRHours = null;
    let leadPRRStr = '-';
    let leadPRRVal = null;
    if (prrVisits.length > 0) {
      const prrEntry = prrVisits[0].UltimaEntrada;
      if (prrEntry && b.DataCriacao) {
        leadPRRHours = (new Date(prrEntry) - new Date(b.DataCriacao)) / 3600000;
        if (leadPRRHours >= 0) {
          leadPRRVal = leadPRRHours;
          if (leadPRRHours < 24) leadPRRStr = `${leadPRRHours.toFixed(1)} h`;
          else leadPRRStr = `${(leadPRRHours / 24).toFixed(1)} d`;
        }
      }
    } else if (!isOpen) {
      leadPRRStr = '<span class="badge badge-rose" style="font-size:0.68rem;">Fechado sem PRR</span>';
    } else {
      leadPRRStr = '<span style="color:var(--text-muted);font-size:0.8rem;">Em aberto sem PRR</span>';
    }

    return {
      Id: parseInt(b.Id) || 0,
      IdStr: `#${b.Id}`,
      Titulo: b.Titulo || '',
      State: b.State || '',
      stateBadge: stateBadge,
      BoardColumn: b.BoardColumn || '',
      Responsavel: b.Responsavel || 'NENHUM',
      Prioridade: priVal,
      PrioridadeStr: priStr,
      Severidade: b.Severidade || 'Indefinida',
      sevClass: sevClass,
      StatusPeriodo: statusPeriodStr,
      DiasAbertoRes: daysVal,
      DiasAbertoResStr: daysStr,
      LeadPRRVal: leadPRRVal,
      LeadPRRStr: leadPRRStr,
      isOpen: isOpen,
      rawBug: b
    };
  });
  
  processAndRenderGridGeneric('table-quality-bugs-list', 'qualityBugsList', mapped, (row, tbody) => {
    const tr = document.createElement('tr');
    
    // Map bug State to text colors: New = Cinza, Active = Amarelo, Resolved = Azul, Closed = Verde
    const state = (row.State || '').trim().toLowerCase();
    let stateColor = 'var(--text-muted)'; // Default / New: Cinza
    if (state === 'active') {
      stateColor = 'var(--color-warning)'; // Amarelo/Ã‚mbar
    } else if (state === 'resolved') {
      stateColor = 'var(--color-info)'; // Azul
    } else if (state === 'closed') {
      stateColor = 'var(--color-success)'; // Verde
    }
    
    tr.innerHTML = `
      <td><a href="#" class="wi-drill-link" data-wi-id="${row.Id}" style="color: var(--color-primary); font-weight: 700; text-decoration: none; border-bottom: 1px dashed var(--color-primary); transition: var(--transition-smooth);">${row.IdStr}</a></td>
      <td class="text-ellipsis" title="${row.Titulo}"><strong>${row.Titulo}</strong></td>
      <td><strong style="color: ${stateColor};">${row.BoardColumn}</strong></td>
      <td>${row.Responsavel}</td>
      <td><span class="badge ${row.sevClass}">${row.Severidade}</span></td>
      <td>${row.DiasAbertoResStr}</td>
      <td style="white-space:nowrap;">${row.LeadPRRStr}</td>
    `;
    
    tr.querySelector('.wi-drill-link').addEventListener('click', (e) => {
      e.preventDefault();
      const id = e.target.getAttribute('data-wi-id');
      navigateToPage('drilldown', () => { g_selectedDrillDownId = id; });
    });
    
    tbody.appendChild(tr);
  }, (count) => {
    countLabel.textContent = `${count} bugs`;
  });
}

// MD-2: KPIs de Lead Time até PRR para bugs
function renderBugsPRRMetrics(bugs) {
  const prrMedianEl = document.getElementById('kpi-bug-prr-median');
  const prrCoverageEl = document.getElementById('kpi-bug-prr-coverage');
  if (!prrMedianEl || !prrCoverageEl) return;



// MD-6: Bugs sem responsável identificado
function renderBugsSemResponsavel(bugs) {
  const panel = document.getElementById('panel-bugs-sem-resp');
  const tbody = document.getElementById('table-bugs-sem-resp');
  const countLbl = document.getElementById('lbl-bugs-sem-resp-count');
  if (!panel || !tbody) return;

  const ACTIVE_COLS = new Set(['Dev implementando','Fazendo Análise','Testando','Realizando Revisão de Código','Disponível para Teste','Disponível Revisão de Código','Aguardando pipeline']);

  // Collect bugs with no assignee, OR in active column with no AssignedTo history
  const semResp = bugs.filter(b => {
    const resp = (b.Responsavel || '').trim();
    const noAssignee = !resp || resp === 'NENHUM';
    // Also flag bugs in active flow columns that never had an AssignedTo transition
    const inActiveCol = ACTIVE_COLS.has(b.BoardColumn);
    const transitions = g_data.transicoesByWi.get(b.Id) || [];
    const hadAssignment = transitions.some(t => t.Campo === 'AssignedTo' && t.Para && t.Para !== 'NENHUM' && t.Para.trim() !== '');
    return noAssignee || (inActiveCol && !hadAssignment && !resp);
  });

  if (semResp.length === 0) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = '';
  if (countLbl) countLbl.textContent = `${semResp.length} bug${semResp.length > 1 ? 's' : ''}`;

  tbody.innerHTML = '';
  semResp.forEach(b => {
    const isOpen = b.State !== 'Closed' && b.BoardColumn !== 'Concluído';
    const inActive = ACTIVE_COLS.has(b.BoardColumn);
    const situacao = inActive
      ? `<span class="badge badge-rose" style="font-size:0.68rem;">Em coluna ativa sem dono ⚠️</span>`
      : `<span class="badge badge-grey" style="font-size:0.68rem;">Sem assignee</span>`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a href="#" class="wi-drill-link" data-wi-id="${b.Id}" style="color:var(--color-primary);font-weight:700;text-decoration:none;border-bottom:1px dashed var(--color-primary);">#${b.Id}</a></td>
      <td class="text-ellipsis" title="${b.Titulo}"><strong>${b.Titulo}</strong></td>
      <td>${b.BoardColumn}</td>
      <td>${b.State}</td>
      <td>${b.DiasAberto ? b.DiasAberto + ' dias' : '-'}</td>
      <td>${situacao}</td>
    `;
    tr.querySelector('.wi-drill-link').addEventListener('click', e => {
      e.preventDefault();
      navigateToPage('drilldown', () => { g_selectedDrillDownId = b.Id; });
    });
    tbody.appendChild(tr);
  });
}

// PDF-2: Taxa Bug → User Story via tag !BUG
function renderBugToUSRate() {
  const rateEl = document.getElementById('lbl-quality-bug-to-us-rate');
  const absEl = document.getElementById('lbl-quality-bug-to-us-abs');
  if (!rateEl) return;

  // Count WIs with !BUG tag that are currently User Story (converted)
  let convertedCount = 0;
  let bugWithBugTag = 0;

  g_data.workItemsMap.forEach((wi, id) => {
    const tags = (g_data.tagsByWi.get(id) || []).map(t => t.toLowerCase());
    if (!tags.includes('!bug')) return;
    if (wi.Tipo === 'User Story') convertedCount++;
    else if (wi.Tipo === 'Bug') bugWithBugTag++;
  });

  const totalBugs = g_raw.bugs ? g_raw.bugs.length : 0;
  const denominator = totalBugs + convertedCount;
  if (denominator > 0) {
    const pct = (convertedCount / denominator * 100).toFixed(1);
    rateEl.textContent = `${pct}%`;
    if (absEl) absEl.textContent = `(${convertedCount} cards convertidos)`;
  } else {
    rateEl.textContent = '-';
    if (absEl) absEl.textContent = '';
  }

  // If there are bugs still tagged !BUG (questionable), show count
  if (bugWithBugTag > 0 && absEl) {
    absEl.textContent += ` · ${bugWithBugTag} bug(s) ainda com !BUG`;
  }
}

// 14. PAGE 6 RENDERER: DETALHAMENTO (DRILL-DOWN ENGINE)
function renderDrillDownPage() {
  const displayContainer = document.getElementById('drilldown-display-container');
  const placeholder = document.getElementById('drilldown-placeholder');
  const searchInput = document.getElementById('txt-search-wi');
  const btnClearSearch = document.getElementById('btn-clear-search');
  
  setupSearchAutocomplete();
  
  if (g_selectedDrillDownId) {
    const wi = g_data.workItemsMap.get(g_selectedDrillDownId);
    if (wi) {
      displayContainer.classList.remove('hidden');
      placeholder.classList.add('hidden');
      searchInput.value = `#${wi.Id} - ${wi.Titulo}`;
      btnClearSearch.classList.remove('hidden');
      
      renderDrillDownWI(wi);
      return;
    }
  }
  
  displayContainer.classList.add('hidden');
  placeholder.classList.remove('hidden');
}

function setupSearchAutocomplete() {
  const searchInput = document.getElementById('txt-search-wi');
  const btnClear = document.getElementById('btn-clear-search');
  const suggestBox = document.getElementById('search-suggest-dropdown');
  
  searchInput.addEventListener('input', () => {
    const val = searchInput.value.trim().toLowerCase();
    if (val.length === 0) {
      btnClear.classList.add('hidden');
      suggestBox.classList.add('hidden');
      return;
    }
    
    btnClear.classList.remove('hidden');
    
    // Find matching items
    const matches = g_raw.workItems.filter(wi => {
      return wi.Id.toLowerCase().includes(val) || wi.Titulo.toLowerCase().includes(val);
    }).slice(0, 8); // Limit to 8 suggestions
    
    if (matches.length > 0) {
      suggestBox.innerHTML = '';
      suggestBox.classList.remove('hidden');
      
      matches.forEach(match => {
        const item = document.createElement('div');
        item.className = 'suggest-item';
        item.innerHTML = `
          <div style="display: flex; gap: 8px; align-items: center;">
            <span class="wi-id-badge">#${match.Id}</span>
            ${getWiTypeIcon(match.Tipo)}
            <span class="text-ellipsis suggest-title">${match.Titulo}</span>
          </div>
        `;
        
        item.addEventListener('click', () => {
          g_selectedDrillDownId = match.Id;
          suggestBox.classList.add('hidden');
          renderActivePage(); // Reloads drill-down
        });
        
        suggestBox.appendChild(item);
      });
    } else {
      suggestBox.classList.add('hidden');
    }
  });
  
  btnClear.addEventListener('click', () => {
    searchInput.value = '';
    btnClear.classList.add('hidden');
    suggestBox.classList.add('hidden');
    g_selectedDrillDownId = null;
    renderActivePage();
  });
  
  // Close suggestions on outside click
  document.addEventListener('click', (e) => {
    if (!suggestBox.contains(e.target) && e.target !== searchInput) {
      suggestBox.classList.add('hidden');
    }
  });
}

function renderDrillDownWI(wi) {
  // 1. Header Details
  document.getElementById('drill-wi-id').textContent = `ID ${wi.Id}`;
  
  const typeBadge = document.getElementById('drill-wi-type');
  typeBadge.innerHTML = getWiTypeIcon(wi.Tipo);
  typeBadge.className = ''; // Limpar estilos padrÃ£o de badge para usar o Ã­cone customizado
  
  document.getElementById('drill-wi-state').textContent = wi.State || 'New';
  
  const colBadge = document.getElementById('drill-wi-column');
  colBadge.textContent = wi.BoardColumn;
  
  document.getElementById('drill-wi-title').textContent = wi.Titulo;
  
  document.getElementById('drill-wi-area').textContent = wi.AreaPath || 'Metanet\\Squad Fiscal';
  document.getElementById('drill-wi-iteration').textContent = wi.IterationPath || '-';
  document.getElementById('drill-wi-assignee').textContent = wi.Responsavel || 'NENHUM';
  
  // QA Lookup
  let qaName = wi.QA || 'NENHUM';
  const roles = g_data.pessoaPapelByWi.get(wi.Id) || [];
  roles.forEach(r => {
    if (r.Papel === 'QA') qaName = r.Pessoa;
  });
  document.getElementById('drill-wi-qa').textContent = qaName;
  
  document.getElementById('drill-wi-creator').textContent = wi.CriadoPor || '-';
  
  // Pri/Sev indicators
  const pStr = wi.Prioridade ? `Prioridade ${wi.Prioridade}` : 'P-';
  const sStr = wi.Severidade ? ` / ${wi.Severidade}` : '';
  document.getElementById('drill-wi-priority-sev').textContent = `${pStr}${sStr}`;
  
  // Dates
  document.getElementById('drill-wi-created-date').textContent = wi.DataCriacao ? new Date(wi.DataCriacao).toLocaleString('pt-BR') : '-';
  document.getElementById('drill-wi-altered-date').textContent = wi.DataAlteracao ? new Date(wi.DataAlteracao).toLocaleString('pt-BR') : '-';
  
  // Tags
  const tagsList = document.getElementById('drill-wi-tags-list');
  tagsList.innerHTML = '';
  const itemTags = g_data.tagsByWi.get(wi.Id) || [];
  if (itemTags.length > 0) {
    itemTags.forEach(tag => {
      const tagBadge = document.createElement('span');
      tagBadge.className = 'badge badge-outline';
      tagBadge.style.marginRight = '6px';
      tagBadge.textContent = tag;
      tagsList.appendChild(tagBadge);
    });
  } else {
    tagsList.innerHTML = `<em style="color: var(--text-muted); font-size: 0.8rem;">Sem tags vinculadas</em>`;
  }
  
  // 2. Tempo em Cada Coluna
  renderDrillDownColumnTimes(wi.Id);
  
  // 3. Timeline de TransiÃ§Ãµes
  renderDrillDownTransitions(wi.Id);
  
  // 3b. HistÃ³rico de ParalisaÃ§Ãµes
  renderDrillDownParalisacoes(wi.Id);
  
  // 4. Subtasks Filhas Vinculadas
  renderDrillDownSubtasks(wi.Id);
}

function renderDrillDownColumnTimes(id) {
  const container = document.getElementById('drill-tempo-coluna-container');
  container.innerHTML = '';
  
  const visits = g_data.tempoColunaByWi.get(id) || [];
  
  if (visits.length === 0) {
    container.innerHTML = `<span class="placeholder-text">Nenhum histÃ³rico de tempo em coluna registrado para este item.</span>`;
    return;
  }
  
  const maxDias = Math.max(...visits.map(v => v.TempoTotalDias), 1.0);
  
  let html = '';
  visits.forEach(v => {
    const pct = ((v.TempoTotalDias / maxDias) * 80).toFixed(0);
    const isCurrent = v.ColunaAtual === 'Sim';
    
    // Choose color category
    const colInfo = g_data.columnMapObj[v.BoardColumn] || {};
    let barColor = 'var(--color-primary)';
    if (colInfo.TipoFluxo === 'fila') barColor = 'var(--color-flow-fila)';
    else if (colInfo.TipoFluxo === 'trabalho') barColor = 'var(--color-flow-trabalho)';
    else if (colInfo.TipoFluxo === 'aguardando') barColor = 'var(--color-flow-aguardando)';
    else if (colInfo.TipoFluxo === 'handoff') barColor = 'var(--color-flow-handoff)';
    
    const glowStyle = isCurrent ? `box-shadow: 0 0 10px ${barColor};` : '';
    
    html += `
      <div style="margin-bottom: 12px; text-align: left;">
        <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 4px;">
          <span>
            <strong>${v.BoardColumn}</strong>
            ${isCurrent ? ` <span class="pulse-indicator" style="display: inline-block; margin-left: 6px;"></span>` : ''}
          </span>
          <span style="color: var(--text-muted);">
            ${v.TempoTotalDias.toFixed(1)} dias totais
            ${isCurrent ? ` (Ativo hÃ¡ ${(v.TempoAtualHoras / 24).toFixed(1)}d)` : ''}
          </span>
        </div>
        <div style="width: 100%; height: 10px; background-color: hsla(252, 31%, 6%, 0.4); border-radius: 5px; overflow: hidden; border: 1px solid ${isCurrent ? barColor : 'var(--border-color)'}; ${glowStyle}">
          <div style="width: ${pct}%; height: 100%; background-color: ${barColor}; border-radius: 5px;" class="svg-bar"></div>
        </div>
      </div>
    `;
  });
  
  container.innerHTML = `<div style="padding: 10px 0; width: 100%;">${html}</div>`;
}

function renderDrillDownTransitions(id) {
  const timeline = document.getElementById('drill-transitions-timeline');
  timeline.innerHTML = '';
  
  const trans = g_data.transicoesByWi.get(id) || [];
  
  if (trans.length === 0) {
    timeline.innerHTML = `<div class="placeholder-text" style="color: var(--text-muted); font-size: 0.85rem; padding: 20px 0;">Nenhuma transiÃ§Ã£o cronolÃ³gica registrada.</div>`;
    return;
  }
  
  // Sort chronologically ascending
  const sorted = [...trans].sort((a, b) => new Date(a.DataMudanca) - new Date(b.DataMudanca));
  
  sorted.forEach(t => {
    const item = document.createElement('div');
    item.className = 'timeline-item';
    
    const dt = new Date(t.DataMudanca);
    const dateStr = `${dt.toLocaleDateString('pt-BR')} Ã s ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    
    let details = '';
    if (t.Campo === 'BoardColumn') {
      details = `Moveu coluna: <span style="color: var(--color-flow-handoff); font-weight: 500;">${t.De}</span> â†’ <span style="color: var(--color-flow-trabalho); font-weight: 600;">${t.Para}</span>`;
    } else if (t.Campo === 'AssignedTo') {
      details = `ResponsÃ¡vel: <span style="color: var(--text-muted);">${t.De}</span> â†’ <strong>${t.Para}</strong>`;
    } else if (t.Campo === 'State') {
      details = `Alterou Estado: <span style="color: var(--text-muted);">${t.De}</span> â†’ <strong>${t.Para}</strong>`;
    } else {
      details = `Alterou ${t.Campo}: ${t.De} â†’ ${t.Para}`;
    }
    
    let durationStr = '';
    if (t.DuracaoDias > 0) {
      durationStr = `<span style="font-size: 0.72rem; color: var(--color-flow-trabalho); font-weight: 500; display: block; margin-top: 4px;">Permaneceu no estado anterior por: ${t.DuracaoDias.toFixed(1)} dias</span>`;
    }
    
    item.innerHTML = `
      <div class="timeline-dot"></div>
      <div class="timeline-content" style="text-align: left;">
        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">
          <span>${dateStr}</span>
          <span>Por: <strong>${t.Por}</strong></span>
        </div>
        <p style="font-size: 0.85rem; margin: 0; color: var(--text-main);">${details}</p>
        ${durationStr}
      </div>
    `;
    
    timeline.appendChild(item);
  });
}

function renderDrillDownParalisacoes(id) {
  const panel = document.getElementById('drill-paralisacoes-panel');
  const timeline = document.getElementById('drill-paralisacoes-timeline');
  const totalLabel = document.getElementById('lbl-drill-paralisacoes-total');
  
  if (!panel || !timeline || !totalLabel) return;
  
  const paralisacoes = g_data.paralizacoesByWi.get(id) || [];
  
  if (paralisacoes.length === 0) {
    panel.classList.add('hidden');
    return;
  }
  
  panel.classList.remove('hidden');
  timeline.innerHTML = '';
  
  // Calculate total hours
  let totalHours = 0;
  paralisacoes.forEach(p => {
    totalHours += p.DuracaoHoras;
  });
  
  // Format total sum
  const totalDays = totalHours / 24;
  let summaryText = '';
  if (totalDays >= 1) {
    summaryText = `${totalDays.toFixed(1)}d (${Math.round(totalHours)}h) paralisado`;
  } else {
    summaryText = `${Math.round(totalHours)}h paralisado`;
  }
  totalLabel.textContent = summaryText;
  
  // Sort chronologically ascending
  const sorted = [...paralisacoes].sort((a, b) => new Date(a.DataInicio) - new Date(b.DataInicio));
  
  sorted.forEach(p => {
    const item = document.createElement('div');
    item.className = 'timeline-item';
    
    const startDt = new Date(p.DataInicio);
    const startStr = `${startDt.toLocaleDateString('pt-BR')} Ã s ${startDt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    
    let endStr = 'Ativo (Em andamento)';
    if (p.DataFim) {
      const endDt = new Date(p.DataFim);
      endStr = `${endDt.toLocaleDateString('pt-BR')} Ã s ${endDt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    let details = `Motivo: <strong style="color: var(--color-danger);">${p.Status}</strong>`;
    let durationStr = `<span style="font-size: 0.72rem; color: var(--color-danger); font-weight: 600; display: block; margin-top: 4px;">DuraÃ§Ã£o da paralisaÃ§Ã£o: ${p.DuracaoExibicao}</span>`;
    
    let teamInfo = `Marcado por: <strong>${p.MarcadoPor || '-'}</strong>`;
    if (p.LiberadoPor) {
      teamInfo += ` | Liberado por: <strong>${p.LiberadoPor}</strong>`;
    }
    
    item.innerHTML = `
      <div class="timeline-dot" style="background-color: var(--color-danger); box-shadow: 0 0 8px var(--color-danger);"></div>
      <div class="timeline-content" style="text-align: left; border-left-color: var(--color-danger);">
        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 4px;">
          <span>PerÃ­odo: <strong>${startStr}</strong> atÃ© <strong>${endStr}</strong></span>
          <span>${p.Ativo ? '<span class="badge badge-rose" style="font-size: 0.65rem;">Parado Agora</span>' : ''}</span>
        </div>
        <p style="font-size: 0.85rem; margin: 0; color: var(--text-main);">${details}</p>
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">
          ${teamInfo}
        </div>
        ${durationStr}
      </div>
    `;
    timeline.appendChild(item);
  });
}

function renderDrillDownSubtasks(id) {
  const tbody = document.getElementById('table-drill-tasks');
  tbody.innerHTML = '';
  
  const tasks = g_data.tasksByParent.get(id) || [];
  
  if (tasks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center" style="color: var(--text-muted); padding: 24px 0;"><em style="font-style: normal; opacity: 0.8;">Este item fiscal nÃ£o possui subtasks filhas vinculadas.</em></td></tr>`;
    return;
  }
  
  tasks.forEach(t => {
    const row = document.createElement('tr');
    
    const crDate = t.DataCriacao ? new Date(t.DataCriacao).toLocaleDateString('pt-BR') : '-';
    const altDate = t.DataAlteracao ? new Date(t.DataAlteracao).toLocaleDateString('pt-BR') : '-';
    
    const est = t.OriginalEstimate ? `${t.OriginalEstimate}h` : '-';
    const comp = t.CompletedWork ? `${t.CompletedWork}h` : '-';
    
    const stateBadge = t.State === 'Closed' ? 'badge-outline' : 'badge-purple';
    
    row.innerHTML = `
      <td>#${t.TaskId}</td>
      <td class="text-ellipsis" title="${t.Titulo}"><strong>${t.Titulo}</strong></td>
      <td><span class="badge ${stateBadge}">${t.State}</span></td>
      <td>${t.Responsavel || 'NENHUM'}</td>
      <td><span class="badge badge-outline">${t.Activity || 'Outro'}</span></td>
      <td><strong>${est}</strong></td>
      <td><strong>${comp}</strong></td>
      <td>${crDate}</td>
      <td>${altDate}</td>
    `;
    
    tbody.appendChild(row);
  });
}

// NEW HELPER: Theme Toggle Setup (Light / Dark Mode)
function setupThemeToggle() {
  const btn = document.getElementById('btn-toggle-theme');
  if (!btn) return;
  
  const sunIcon = btn.querySelector('.theme-icon-sun');
  const moonIcon = btn.querySelector('.theme-icon-moon');
  
  // Check local storage for preference
  const savedTheme = localStorage.getItem('squad-fiscal-theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    sunIcon.classList.remove('hidden');
    moonIcon.classList.add('hidden');
  } else {
    document.body.classList.remove('light-theme');
    sunIcon.classList.add('hidden');
    moonIcon.classList.remove('hidden');
  }
  
  btn.addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-theme');
    localStorage.setItem('squad-fiscal-theme', isLight ? 'light' : 'dark');
    
    if (isLight) {
      sunIcon.classList.remove('hidden');
      moonIcon.classList.add('hidden');
    } else {
      sunIcon.classList.add('hidden');
      moonIcon.classList.remove('hidden');
    }
  });
}

function renderAtendimentosPage() {
  const list = getFilteredAtendimentos();
  
  const tableId = 'table-atendimentos-list';
  const gridKey = 'atendimentosList';
  const table = document.getElementById(tableId);
  
  if (table && !table.querySelector('thead').dataset.gridInitialized) {
    initializeGridHeaders(tableId, gridKey, renderAtendimentosPage);
  }
  
  processAndRenderGridGeneric(
    tableId,
    gridKey,
    list,
    (row, tbody) => {
      const tr = document.createElement('tr');
      
      let closeDtStr = '-';
      if (row.ClosedDate) {
        closeDtStr = new Date(row.ClosedDate).toLocaleString('pt-BR');
      }
      
      tr.innerHTML = `
        <td style="font-weight: 600; color: var(--color-primary); width: 80px;">#${row.Id}</td>
        <td style="font-weight: 500;">${row.Responsavel || '-'}</td>
        <td style="font-weight: 400; max-width: 450px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${row.Descricao || ''}">${row.Descricao || '-'}</td>
        <td>${row.Numero || '-'}</td>
        <td style="font-weight: 600;">${row.CompletedWork ? parseFloat(row.CompletedWork).toFixed(1) + 'h' : '-'}</td>
        <td>${closeDtStr}</td>
      `;
      tbody.appendChild(tr);
    },
    (count) => {
      const badge = document.getElementById('lbl-atendimentos-total-count');
      if (badge) badge.textContent = `${count} chamado${count !== 1 ? 's' : ''}`;
    }
  );
}

/* ==========================================================================
   FUNÇÕES DO SISTEMA DE SINALIZAÇÕES E ALERTAS
   ========================================================================== */

/**
 * Retorna a quantidade de dias úteis (Segunda a Sexta) entre duas datas
 */
function getWorkingDays(start, end) {
  let count = 0;
  let cur = new Date(start.getTime());
  cur.setHours(0, 0, 0, 0);
  const endNormalized = new Date(end.getTime());
  endNormalized.setHours(0, 0, 0, 0);
  
  while (cur <= endNormalized) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) { // 0 = Domingo, 6 = Sábado
      count++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/**
 * Varre a base e calcula os alertas e desvios de produtividade
 */
function processAlerts(filteredWIs) {
  const alerts = [];
  
  // 1. Calcular MTTR dinâmico de Bugs fechados no período analisado
  let mttrDays = g_rules.bug_red_days_fallback;
  if (g_rules.bug_red_use_mttr) {
    const closedBugs = g_raw.bugs.filter(b => b.State === 'Closed' || b.BoardColumn === 'Concluído');
    const resolutionTimes = [];
    closedBugs.forEach(b => {
      const delivery = g_data.entregasMap.get(b.Id);
      if (delivery) {
        resolutionTimes.push(delivery.LeadTimeDias);
      } else if (b.DataCriacao && b.DataFechamento) {
        const diff = (new Date(b.DataFechamento).getTime() - new Date(b.DataCriacao).getTime()) / (1000 * 60 * 60 * 24);
        if (diff >= 0) resolutionTimes.push(diff);
      }
    });
    if (resolutionTimes.length > 0) {
      mttrDays = resolutionTimes.reduce((s, v) => s + v, 0) / resolutionTimes.length;
    }
  }

  // 2. Extrair itens em andamento para sinalização de cards e tarefas
  const activeWIs = g_raw.workItems.filter(wi => wi.State !== 'Closed' && wi.State !== 'Removed' && wi.BoardColumn !== 'Concluído' && wi.BoardColumn !== 'Ideias' && wi.BoardColumn !== 'Removed');

  // Controle de WIP por programador para a regra de Atenção
  const developerWipCounts = {};

  activeWIs.forEach(wi => {
    const id = wi.Id;
    const title = wi.Titulo;
    const type = wi.Tipo;
    const owner = wi.Responsavel ? wi.Responsavel.trim() : 'NENHUM';
    const column = wi.BoardColumn;
    
    // Obter tags do item
    const wiTags = g_data.tagsByWi.get(id) || [];
    const lowerTags = wiTags.map(t => t.toLowerCase());

    // Incrementar contagem de WIP por pessoa (se não for Backlog/Ideias e for programador válido)
    if (owner !== 'NENHUM' && column !== 'Backlog' && column !== 'Ideias') {
      if (!developerWipCounts[owner]) developerWipCounts[owner] = 0;
      developerWipCounts[owner]++;
    }

    // Obter tempo em coluna
    const colTimes = g_data.tempoColunaByWi.get(id) || [];
    const currentColTime = colTimes.find(ct => ct.ColunaAtual === 'Sim' || ct.BoardColumn === column);
    const timeInColHours = currentColTime ? currentColTime.TempoAtualHoras || currentColTime.TempoTotalHoras : 0;
    const timeInColDays = timeInColHours / 24;

    // Regra Blocker: Impedimento ativo (ParadoAgora === 'Sim') > 24h
    const blockResumo = g_data.paralizacaoResumoMap.get(id);
    if (blockResumo && blockResumo.ParadoAgora) {
      // Buscar tempo ativo de bloqueio
      const wiBlocks = g_data.paralizacoesByWi.get(id) || [];
      const activeBlock = wiBlocks.find(b => b.Ativo);
      const blockHours = activeBlock ? activeBlock.DuracaoHoras : blockResumo.TotalHorasParado;
      
      if (blockHours > g_rules.blocked_alert_threshold_hours) {
        alerts.push({
          id,
          title,
          type: 'Impedimento Crítico',
          severity: 'blocker',
          owner,
          details: `Card com impedimento ativo há ${blockHours.toFixed(1)}h (limite: ${g_rules.blocked_alert_threshold_hours}h)`
        });
      }
    }

    // Regra 1: Backlog aging > 30 dias (Atenção - Yellow)
    if (column === 'Backlog' && timeInColDays > g_rules.backlog_aging_days) {
      alerts.push({
        id,
        title,
        type: 'Backlog Envelhecido',
        severity: 'yellow',
        owner,
        details: `Parado na coluna Backlog há ${timeInColDays.toFixed(1)} dias (limite: ${g_rules.backlog_aging_days} dias)`
      });
    }

    // Regra 2: SLA de Bugs (Yellow / Critical)
    if (type === 'Bug') {
      const createdDate = new Date(wi.DataCriacao);
      const ageInDays = (TODAY_ANCHOR.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
      
      // Validação de severidade pela coluna Severity (Classificação no card)
      const rawSev = wi.Severity || wi.Severidade || '';
      const sevLower = rawSev.toLowerCase();
      const isCriticalSeverity = sevLower.includes('1') || sevLower.includes('crit') || sevLower.includes('bloq') || sevLower.includes('high') || sevLower.includes('alta') || sevLower.includes('alto') || sevLower.includes('2');

      if (isCriticalSeverity) {
        alerts.push({
          id,
          title,
          type: 'Bug Alta Severidade',
          severity: 'critical',
          owner,
          details: `Bug de classificação '${rawSev}' em aberto há ${ageInDays.toFixed(1)} dias (SLA Crítico)`
        });
      } else if (ageInDays > mttrDays) {
        alerts.push({
          id,
          title,
          type: 'Bug SLA Excedido (MTTR)',
          severity: 'critical',
          owner,
          details: `Bug aberto há ${ageInDays.toFixed(1)} dias (MTTR Médio: ${mttrDays.toFixed(1)} dias)`
        });
      } else if (ageInDays > g_rules.bug_yellow_days) {
        alerts.push({
          id,
          title,
          type: 'Bug Sem Conclusão (5 dias)',
          severity: 'yellow',
          owner,
          details: `Bug aberto há ${ageInDays.toFixed(1)} dias (Sinal Amarelo: ${g_rules.bug_yellow_days} dias)`
        });
      }

      // Regra Info: Bug ativo sem dono
      if (owner === 'NENHUM') {
        alerts.push({
          id,
          title,
          type: 'Bug sem Responsável',
          severity: 'info',
          owner,
          details: `Bug na coluna ${column} sem programador designado`
        });
      }

      // Regra Info: Presença de tags de controle específico da Squad
      if (lowerTags.includes('legado')) {
        alerts.push({
          id,
          title,
          type: 'Bug em Código Legado',
          severity: 'info',
          owner,
          details: `Bug classificado com a tag 'Legado' (dívida técnica preexistente)`
        });
      }
      if (lowerTags.includes('!bug')) {
        alerts.push({
          id,
          title,
          type: 'Ajuste / Dúvida (!BUG)',
          severity: 'info',
          owner,
          details: `Card marcado com '!BUG' (não é um defeito de código real)`
        });
      }
      if (lowerTags.includes('geradoporus')) {
        alerts.push({
          id,
          title,
          type: 'Regressão (GeradoPorUS)',
          severity: 'info',
          owner,
          details: `Bug originado de desenvolvimento recente (Métrica DORA CFR)`
        });
      }
    }

    // Regra Info: Cards com tag de IA pendentes de homologação atenta
    if (lowerTags.includes('ia') || lowerTags.includes('implementacao feita por ia')) {
      alerts.push({
        id,
        title,
        type: 'Homologação IA Necessária',
        severity: 'info',
        owner,
        details: `Código desenvolvido/ajustado com auxílio de Inteligência Artificial`
      });
    }

    // Regra Info: User Story Gigante (DORA - Large Batch Risk)
    if (type === 'User Story') {
      const childTasks = g_data.tasksByParent.get(id) || [];
      const totalTaskEst = childTasks.reduce((s, t) => s + (t.OriginalEstimate || 0), 0);
      const isLargeUS = totalTaskEst > g_rules.large_us_task_hours_limit || timeInColHours > g_rules.large_us_active_hours_limit;
      
      if (isLargeUS) {
        alerts.push({
          id,
          title,
          type: 'User Story Gigante (Lote Grande)',
          severity: 'info',
          owner,
          details: `US ativa excede limites de tamanho. Estimado: ${totalTaskEst.toFixed(1)}h em tasks, Ativo no board: ${timeInColHours.toFixed(1)}h`
        });
      }

      // NOVA Regra Info: Tasks do mesmo tipo (Activity) somando >16h
      const hoursByActivity = {};
      childTasks.forEach(t => {
        const act = t.Activity ? t.Activity.trim() : 'Sem Atividade';
        if (!hoursByActivity[act]) hoursByActivity[act] = 0;
        hoursByActivity[act] += (t.OriginalEstimate || 0) + (t.CompletedWork || 0);
      });
      Object.keys(hoursByActivity).forEach(act => {
        if (hoursByActivity[act] > 16) {
          alerts.push({
            id,
            title,
            type: 'User Story Gigante (Lote Grande)',
            severity: 'info',
            owner,
            details: `Tasks do tipo '${act}' somam ${hoursByActivity[act].toFixed(1)}h (limite: 16h)`
          });
        }
      });
    }

    // NOVA Regra Info: Cards sem tasks filhas definidas
    if (type !== 'Atendimento' && type !== 'Bug') {
      const childTasksCheck = g_data.tasksByParent.get(id) || [];
      if (childTasksCheck.length === 0) {
        alerts.push({
          id,
          title,
          type: 'Tasks não definidas',
          severity: 'info',
          owner,
          details: `Card '${type}' sem nenhuma task filha cadastrada`
        });
      }
    }

    // NOVA Regra Atenção: Cards com total de dias paralisados > 7 dias
    const resumoParal = g_data.paralizacaoResumoMap.get(String(id));
    if (resumoParal && resumoParal.TotalDiasParado > 7) {
      alerts.push({
        id,
        title,
        type: 'Card paralizado além do permitido',
        severity: 'yellow',
        owner,
        details: `Card paralisado por ${resumoParal.TotalDiasParado.toFixed(1)} dias no total (limite: 7 dias)`
      });
    }

    // Regra 4: Card parado > 2 dias na mesma coluna (Atenção - Yellow)
    if (column !== 'Backlog' && column !== 'Ideias' && timeInColDays > g_rules.card_max_days_same_column) {
      alerts.push({
        id,
        title,
        type: 'Inatividade na Coluna',
        severity: 'yellow',
        owner,
        details: `Card na coluna ${column} sem mover há ${timeInColDays.toFixed(1)} dias (limite: ${g_rules.card_max_days_same_column} dias)`
      });
    }

    // Regra 5: Tempo limite na coluna Dev implementando (>16h) (Crítico - Orange)
    const mappedDevColumn = 'Dev implementando';
    if (column === mappedDevColumn && timeInColHours > g_rules.dev_column_max_hours) {
      alerts.push({
        id,
        title,
        type: 'Esforço Dev Excedido (Coluna)',
        severity: 'critical',
        owner,
        details: `Card parado na coluna '${column}' por ${timeInColHours.toFixed(1)}h (limite: ${g_rules.dev_column_max_hours}h)`
      });
    }

    // Regra 6: Desvio de estimativa por etapa (Tasks em atraso) (Crítico - Orange)
    const childTasks = g_data.tasksByParent.get(id) || [];
    const activityEstimates = {};
    childTasks.forEach(task => {
      const actNorm = getNormalizedActivity(task.Activity);
      if (!activityEstimates[actNorm]) activityEstimates[actNorm] = 0;
      activityEstimates[actNorm] += task.OriginalEstimate || 0;
    });

    Object.keys(g_rules.activity_column_map).forEach(activityName => {
      const colName = g_rules.activity_column_map[activityName];
      const taskEstimate = activityEstimates[activityName] || 0;
      
      if (taskEstimate > 0) {
        const colRec = colTimes.find(ct => ct.BoardColumn === colName);
        const colSpentHours = colRec ? colRec.TempoTotalHoras : 0;
        
        if (colSpentHours > taskEstimate) {
          alerts.push({
            id,
            title,
            type: 'Desvio de Estimativa por Etapa',
            severity: 'critical',
            owner,
            details: `Tempo gasto na coluna '${colName}' (${colSpentHours.toFixed(1)}h) superou estimativa de tasks de '${activityName}' (${taskEstimate.toFixed(1)}h)`
          });
        }
      }
    });

    // Carga de Subtasks individuais de Dev (>16h estimadas/realizadas) (Atenção - Yellow)
    childTasks.forEach(task => {
      const actNorm = getNormalizedActivity(task.Activity);
      if (actNorm === 'Desenvolvimento') {
        const estVal = task.OriginalEstimate || 0;
        const compVal = task.CompletedWork || 0;
        if (estVal > g_rules.dev_task_max_hours || compVal > g_rules.dev_task_max_hours) {
          alerts.push({
            id,
            title: `${title} (Task #${task.TaskId})`,
            type: 'Esforço Dev Excedido (Task)',
            severity: 'yellow',
            owner: task.Responsavel || owner,
            details: `Task de dev com esforço excessivo. Estimado: ${estVal.toFixed(1)}h, Realizado: ${compVal.toFixed(1)}h (limite: ${g_rules.dev_task_max_hours}h)`
          });
        }
      }
    });
  });

  // NOVA Regra Info: Cards de Atendimento sem Horas Concluídas
  filteredWIs.forEach(wi => {
    if (wi.Tipo === 'Atendimento') {
      const atend = g_data.atendimentosConcluidosMap.get(String(wi.Id));
      const hasHours = atend && atend.CompletedWork > 0;
      if (!hasHours) {
        alerts.push({
          id: wi.Id,
          title: wi.Titulo,
          type: 'Horas não informadas',
          severity: 'info',
          owner: wi.Responsavel || 'NENHUM',
          details: `Atendimento sem horas concluídas registradas`
        });
      }
    }
  });

  // NOVA Regra Info: Tasks com dados faltantes (sem atividade, sem responsável, ou fechadas sem horas)
  g_raw.tasks.forEach(task => {
    const taskTitle = `${task.Titulo || 'Task'} (#${task.TaskId})`;
    const parentWi = filteredWIs.find(w => String(w.Id) === String(task.ParentId));
    if (!parentWi) return; // só alertar tasks de WIs no período filtrado

    const isClosed = task.State === 'Closed' || task.State === 'Done';
    const completedWork = parseFloat(task.CompletedWork) || 0;

    const taskTypeOrName = (task.Activity && task.Activity.trim()) ? task.Activity.trim() : (task.Titulo || 'Task');

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
    }
  });

  // NOVA Regra Info/Atenção: BUGs — verificar abertos e concluídos no período
  const bugsInScope = g_raw.bugs.filter(b => {
    const isOpen = b.Aberto === 'Sim' || (b.State !== 'Closed' && b.BoardColumn !== 'Concluído');
    const isClosedInPeriod = b.FechadoNoPeriodo === 'Sim';
    return isOpen || isClosedInPeriod;
  });

  bugsInScope.forEach(b => {
    const bugId = b.Id;
    const bugTitle = b.Titulo || `Bug #${bugId}`;
    const bugOwner = b.Responsavel ? b.Responsavel.trim() : 'NENHUM';

    // BUG sem Tag (INFO)
    const bugTags = g_data.tagsByWi.get(String(bugId)) || [];
    if (bugTags.length === 0) {
      alerts.push({
        id: bugId,
        title: bugTitle,
        type: 'BUG sem validação',
        severity: 'info',
        owner: bugOwner,
        details: `Bug sem nenhuma tag de classificação/validação cadastrada`
      });
    }

    // BUG sem responsável definido (ATENÇÃO)
    if (!bugOwner || bugOwner.toUpperCase() === 'NENHUM') {
      alerts.push({
        id: bugId,
        title: bugTitle,
        type: 'Responsável não definido',
        severity: 'yellow',
        owner: 'NENHUM',
        details: `Bug sem responsável designado`
      });
    }
  });

  // Alerta de estouro de WIP por desenvolvedor (Atenção - Yellow)
  Object.keys(developerWipCounts).forEach(dev => {
    const count = developerWipCounts[dev];
    if (count > g_rules.max_wip_per_developer) {
      alerts.push({
        id: '-',
        title: `Carga de Trabalho de ${dev}`,
        type: 'Limite de WIP Excedido',
        severity: 'yellow',
        owner: dev,
        details: `Programador com ${count} cards ativos em paralelo no board (limite DORA: ${g_rules.max_wip_per_developer})`
      });
    }
  });

  g_computedAlerts = alerts.map(a => {
    if (a.id === '-') return { ...a, wiType: '-' };
    const wi = filteredWIs.find(w => String(w.Id) === String(a.id));
    return { ...a, wiType: wi ? (wi.Tipo || '-') : '-' };
  });


  // 3. Cálculo de Gaps de Produtividade (Capacidade vs. Realizado)
  const today = TODAY_ANCHOR;
  const dateRange = document.getElementById('filter-date-range').value;
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

  // Somar CompletedWork das subtasks de cada pessoa nos cards ativos do período filtrado
  const personHours = {};
  filteredWIs.forEach(wi => {
    const tasks = g_data.tasksByParent.get(wi.Id) || [];
    tasks.forEach(t => {
      const resp = t.Responsavel ? t.Responsavel.trim() : '';
      if (!resp || resp === 'NENHUM') return;
      if (!personHours[resp]) personHours[resp] = 0;
      personHours[resp] += t.CompletedWork || 0;
    });
  });

  // Somar CompletedWork de atendimentos concluídos no período
  const filteredAtendimentos = getFilteredAtendimentos();
  filteredAtendimentos.forEach(at => {
    const resp = at.Responsavel ? at.Responsavel.trim() : '';
    if (!resp || resp === 'NENHUM') return;
    if (!personHours[resp]) personHours[resp] = 0;
    personHours[resp] += at.CompletedWork || 0;
  });

  const productivity = [];
  // Considerar apenas colaboradores que tiveram tasks ou atendimentos no período (e excluir Gilmar)
  const uniqueTeam = Object.keys(personHours).filter(name => name.toLowerCase() !== 'gilmar');

  uniqueTeam.forEach(person => {
    const completed = personHours[person] || 0;
    const gap = completed - availableHours;
    const rate = availableHours > 0 ? (completed / availableHours) * 100 : 0;
    
    productivity.push({
      person,
      workingDays,
      availableHours,
      completedHours: completed,
      gap,
      rate
    });
  });

  productivity.sort((a, b) => a.person.localeCompare(b.person, 'pt-BR'));
  g_productivityGaps = productivity;
}

/**
 * Registra escutas de cliques para alternar as abas de Alertas (6 abas)
 */
function setupAlertTabsListeners() {
  const tabs = ['all', 'blocker', 'critical', 'warning', 'info', 'productivity'];
  tabs.forEach(tab => {
    const btn = document.getElementById(`btn-tab-alerts-${tab}`);
    if (btn) {
      btn.addEventListener('click', () => {
        tabs.forEach(t => {
          const b = document.getElementById(`btn-tab-alerts-${t}`);
          if (b) b.classList.remove('active');
        });
        btn.classList.add('active');
        g_activeAlertTab = tab;
        window.g_alertsPage = 1;
        
        const panelTable = document.getElementById('panel-alerts-table');
        const panelProd = document.getElementById('panel-productivity-gaps');
        
        if (tab === 'productivity') {
          if (panelTable) panelTable.classList.add('hidden');
          if (panelProd) panelProd.classList.remove('hidden');
        } else {
          if (panelTable) panelTable.classList.remove('hidden');
          if (panelProd) panelProd.classList.add('hidden');
        }
        
        const filteredWIs = getFilteredWorkItems();
        renderAlertsPageContents(filteredWIs);
      });
    }
  });
}

function setupThroughputToggleListeners() {
  const btnWeekly = document.getElementById('btn-throughput-weekly');
  const btnMonthly = document.getElementById('btn-throughput-monthly');
  if (!btnWeekly || !btnMonthly) return;
  
  if (btnWeekly.dataset.listenerBound) return;
  btnWeekly.dataset.listenerBound = "true";
  
  btnWeekly.addEventListener('click', () => {
    if (g_throughputViewMode === 'weekly') return;
    g_throughputViewMode = 'weekly';
    renderActivePage();
  });
  
  btnMonthly.addEventListener('click', () => {
    if (g_throughputViewMode === 'monthly') return;
    g_throughputViewMode = 'monthly';
    renderActivePage();
  });
}

/**
 * Renderizador principal da página de Alertas e Sinalizações
 */
function renderAlertsPage(filteredWIs) {
  processAlerts(filteredWIs);
  
  const totalCount = g_computedAlerts.length;
  const blockerCount = g_computedAlerts.filter(a => a.severity === 'blocker').length;
  const criticalCount = g_computedAlerts.filter(a => a.severity === 'critical').length;
  const warningCount = g_computedAlerts.filter(a => a.severity === 'yellow').length;
  const infoCount = g_computedAlerts.filter(a => a.severity === 'info').length;
  const prodGapCount = g_productivityGaps.filter(p => p.gap < 0).length;

  document.getElementById('kpi-total-alerts').textContent = totalCount;
  document.getElementById('kpi-blocker-alerts').textContent = blockerCount;
  document.getElementById('kpi-critical-alerts').textContent = criticalCount;
  document.getElementById('kpi-warning-alerts').textContent = warningCount;
  document.getElementById('kpi-info-alerts').textContent = infoCount;
  document.getElementById('kpi-productivity-gaps-count').textContent = prodGapCount;

  // Atalhos nos cards de KPI para as abas
  document.getElementById('card-kpi-total-alerts').onclick = () => {
    document.getElementById('btn-tab-alerts-all').click();
  };
  document.getElementById('card-kpi-blocker-alerts').onclick = () => {
    document.getElementById('btn-tab-alerts-blocker').click();
  };
  document.getElementById('card-kpi-critical-alerts').onclick = () => {
    document.getElementById('btn-tab-alerts-critical').click();
  };
  document.getElementById('card-kpi-warning-alerts').onclick = () => {
    document.getElementById('btn-tab-alerts-warning').click();
  };
  document.getElementById('card-kpi-info-alerts').onclick = () => {
    document.getElementById('btn-tab-alerts-info').click();
  };
  document.getElementById('card-kpi-productivity-gaps').onclick = () => {
    document.getElementById('btn-tab-alerts-productivity').click();
  };

  const typeFilter = document.getElementById('filter-alert-wi-type');
  if (typeFilter) {
    typeFilter.value = g_activeAlertWiTypeFilter;
    typeFilter.onchange = (e) => {
      g_activeAlertWiTypeFilter = e.target.value;
      window.g_alertsPage = 1;
      renderAlertsPageContents(filteredWIs);
    };
  }

  initAlertsUIPageControls(filteredWIs);
  renderAlertsPageContents(filteredWIs);
}

function initAlertsUIPageControls(filteredWIs) {
  const panel = document.getElementById('alert-rule-combo-panel');
  const trigger = document.getElementById('alert-rule-combo-trigger');
  const selectAll = document.getElementById('alert-rule-select-all');
  const checklist = document.getElementById('filter-alert-rule-checklist');
  
  if (trigger && panel && checklist && g_computedAlerts.length > 0) {
    const uniqueTypes = [...new Set(g_computedAlerts.map(a => a.type))].sort();
    
    if (!g_selectedAlertTypes) {
      g_selectedAlertTypes = [...uniqueTypes];
      
      let html = '';
      uniqueTypes.forEach(t => {
        html += `
          <label class="filter-checklist-item" style="display: flex; align-items: center; gap: 8px; padding: 6px 12px; cursor: pointer;">
            <input type="checkbox" value="${t}" class="alert-rule-checkbox" checked>
            <span style="font-size: 0.85rem;">${t}</span>
          </label>
        `;
      });
      checklist.innerHTML = html;
      
      trigger.onclick = (e) => {
        e.stopPropagation();
        panel.classList.toggle('hidden');
      };
      
      document.addEventListener('click', (e) => {
        if (!e.target.closest('#alert-rule-multiselect-combo')) {
          panel.classList.add('hidden');
        }
      });
      
      selectAll.onchange = (e) => {
        const checked = e.target.checked;
        checklist.querySelectorAll('.alert-rule-checkbox').forEach(cb => cb.checked = checked);
        updateAlertTypesFilter(filteredWIs);
      };
      
      checklist.addEventListener('change', (e) => {
        if (e.target.classList.contains('alert-rule-checkbox')) {
          const allBoxes = checklist.querySelectorAll('.alert-rule-checkbox');
          const anyUnchecked = Array.from(allBoxes).some(cb => !cb.checked);
          selectAll.checked = !anyUnchecked;
          updateAlertTypesFilter(filteredWIs);
        }
      });
    }
  }
  
  const headers = document.querySelectorAll('#table-alerts-list th.sortable-header');
  headers.forEach(th => {
    if (th.dataset.bound) return;
    th.dataset.bound = "true";
    
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (g_alertsSortConfig.column === col) {
        g_alertsSortConfig.direction = g_alertsSortConfig.direction === 'asc' ? 'desc' : 'asc';
      } else {
        g_alertsSortConfig.column = col;
        g_alertsSortConfig.direction = 'asc';
      }
      
      headers.forEach(h => {
        const icon = h.querySelector('.sort-icon');
        if (icon) icon.textContent = '';
      });
      const icon = th.querySelector('.sort-icon');
      if (icon) icon.textContent = g_alertsSortConfig.direction === 'asc' ? ' ▲' : ' ▼';
      
      window.g_alertsPage = 1;
      renderAlertsPageContents(filteredWIs);
    });
  });
}

function updateAlertTypesFilter(filteredWIs) {
  const checklist = document.getElementById('filter-alert-rule-checklist');
  if (checklist) {
    const checkedBoxes = Array.from(checklist.querySelectorAll('.alert-rule-checkbox:checked'));
    g_selectedAlertTypes = checkedBoxes.map(cb => cb.value);
    
    const trigger = document.getElementById('alert-rule-combo-trigger');
    if (trigger) {
      if (checkedBoxes.length === checklist.querySelectorAll('.alert-rule-checkbox').length) {
        trigger.textContent = 'Tipos de Alerta (Todos)';
      } else {
        trigger.textContent = `Tipos de Alerta (${checkedBoxes.length})`;
      }
    }
    
    window.g_alertsPage = 1;
    renderAlertsPageContents(filteredWIs);
  }
}

/**
 * Renderiza o corpo das tabelas de Alertas e Produtividade
 */
function renderAlertsPageContents(filteredWIs) {
  const tbodyAlerts = document.getElementById('tbody-alerts-list');
  const tbodyProd = document.getElementById('tbody-productivity-gaps');
  
  if (g_activeAlertTab === 'productivity') {
    tbodyProd.innerHTML = '';
    const periodText = document.getElementById('filter-date-range').options[document.getElementById('filter-date-range').selectedIndex].text;
    document.getElementById('lbl-productivity-period').textContent = `Período: ${periodText}`;
    
    if (g_productivityGaps.length === 0) {
      tbodyProd.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 16px 0; color: var(--text-muted);">Nenhum colaborador com dados no período.</td></tr>`;
      return;
    }
    
    g_productivityGaps.forEach(p => {
      const tr = document.createElement('tr');
      const rateText = p.availableHours > 0 ? `${p.rate.toFixed(1)}%` : '-';
      
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
      
      tr.innerHTML = `
        <td style="font-weight: 600; color: var(--text-main); cursor: pointer; text-decoration: underline;" onclick="openProductivityDetailsModal('${p.person}')" title="Ver detalhes de tarefas e horas concluídas">${p.person}</td>
        <td>${p.workingDays} dias úteis</td>
        <td>${p.availableHours}h</td>
        <td style="font-weight: 600;">${p.completedHours.toFixed(1)}h</td>
        <td class="${gapClass}">${gapSign}${p.gap.toFixed(1)}h</td>
        <td>
          <div class="productivity-progress-wrapper">
            <div class="productivity-progress-text">
              <span style="color: var(--text-muted); font-size: 0.72rem;">${rateText} entregue</span>
            </div>
            <div class="productivity-progress-bar">
              <div class="productivity-progress-fill ${fillClass}" style="width: ${progressWidth}%;"></div>
            </div>
          </div>
        </td>
      `;
      tbodyProd.appendChild(tr);
    });
  } else {
    tbodyAlerts.innerHTML = '';
    
    let filteredAlerts = [...g_computedAlerts];
    if (g_activeAlertTab !== 'all') {
      filteredAlerts = filteredAlerts.filter(a => {
        let expectedSeverity = g_activeAlertTab;
        if (expectedSeverity === 'warning') expectedSeverity = 'yellow';
        return a.severity === expectedSeverity;
      });
    }
    if (g_activeAlertWiTypeFilter !== 'all') {
      filteredAlerts = filteredAlerts.filter(a => a.wiType === g_activeAlertWiTypeFilter);
    }
    if (g_selectedAlertTypes && g_selectedAlertTypes.length > 0) {
      filteredAlerts = filteredAlerts.filter(a => g_selectedAlertTypes.includes(a.type));
    }
    
    // Group by ID
    const groupedAlerts = {};
    filteredAlerts.forEach(a => {
      const id = String(a.id);
      if (!groupedAlerts[id]) groupedAlerts[id] = [];
      groupedAlerts[id].push(a);
    });
    
    let groupArray = Object.keys(groupedAlerts).map(id => {
      const alerts = groupedAlerts[id];
      const sevValues = { 'blocker': 4, 'critical': 3, 'yellow': 2, 'info': 1 };
      let maxSev = 0;
      alerts.forEach(al => {
        if (sevValues[al.severity] > maxSev) {
          maxSev = sevValues[al.severity];
        }
      });
      return {
        id: id,
        idNum: id === '-' ? -1 : parseInt(id, 10),
        parentId: alerts[0].parentId,
        title: alerts[0].title,
        owner: alerts[0].owner,
        maxSeverity: maxSev,
        alerts: alerts
      };
    });
    
    if (g_alertsSortConfig) {
      const { column, direction } = g_alertsSortConfig;
      groupArray.sort((gA, gB) => {
        let valA, valB;
        if (column === 'id') { valA = gA.idNum; valB = gB.idNum; }
        else if (column === 'title') { valA = gA.title || ''; valB = gB.title || ''; }
        else if (column === 'assignee') { valA = gA.owner || ''; valB = gB.owner || ''; }
        else if (column === 'severity') { valA = gA.maxSeverity; valB = gB.maxSeverity; }
        
        if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
          if (valA < valB) return direction === 'asc' ? -1 : 1;
          if (valA > valB) return direction === 'asc' ? 1 : -1;
          return 0;
        } else {
          return direction === 'asc' ? valA - valB : valB - valA;
        }
      });
    }

    document.getElementById('lbl-alerts-table-count').textContent = `${filteredAlerts.length} alerta${filteredAlerts.length !== 1 ? 's' : ''} (${groupArray.length} iten${groupArray.length !== 1 ? 's' : ''})`;
    
    if (groupArray.length === 0) {
      tbodyAlerts.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 16px 0; color: var(--text-muted);">Nenhum alerta ativo com este filtro.</td></tr>`;
    } else {
      if (!window.g_alertsPage) window.g_alertsPage = 1;
      const itemsPerPage = 20; // groups per page
      const totalPages = Math.ceil(groupArray.length / itemsPerPage);
      
      if (window.g_alertsPage > totalPages && totalPages > 0) window.g_alertsPage = totalPages;
      if (window.g_alertsPage < 1) window.g_alertsPage = 1;

      const startIdx = (window.g_alertsPage - 1) * itemsPerPage;
      const pageGroups = groupArray.slice(startIdx, startIdx + itemsPerPage);

      pageGroups.forEach(group => {
        const rowCount = group.alerts.length;
        const linkId = group.parentId || group.id;
        const idCell = group.id !== '-' 
          ? `<a href="#" class="wi-drill-link" data-id="${linkId}">#${group.id}</a>` 
          : '<span style="color: var(--text-muted); font-weight:600;">-</span>';
          
        group.alerts.forEach((a, idx) => {
          const tr = document.createElement('tr');
          
          let badgeClass = 'badge-alert-info';
          let badgeText = 'Info';
          if (a.severity === 'blocker') {
            badgeClass = 'badge-alert-blocker';
            badgeText = '🛑 Impedido';
          } else if (a.severity === 'critical') {
            badgeClass = 'badge-alert-critical';
            badgeText = '🟠 Crítico';
          } else if (a.severity === 'yellow') {
            badgeClass = 'badge-alert-yellow';
            badgeText = '🟡 Atenção';
          } else if (a.severity === 'info') {
            badgeClass = 'badge-alert-info';
            badgeText = '🔵 Info';
          }
          
          if (idx === 0) {
            tr.innerHTML = `
              <td rowspan="${rowCount}" style="width: 80px; vertical-align: middle;">${idCell}</td>
              <td rowspan="${rowCount}" style="font-weight: 600; max-width: 350px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;" title="${group.title}">${group.title}</td>
              <td style="font-weight: 500;">${a.type}</td>
              <td><span class="${badgeClass}">${badgeText}</span></td>
              <td rowspan="${rowCount}" style="vertical-align: middle;">${group.owner}</td>
              <td style="color: var(--text-muted); max-width: 450px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${a.details}">${a.details}</td>
            `;
          } else {
            tr.innerHTML = `
              <td style="font-weight: 500;">${a.type}</td>
              <td><span class="${badgeClass}">${badgeText}</span></td>
              <td style="color: var(--text-muted); max-width: 450px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${a.details}">${a.details}</td>
            `;
          }
          
          if (idx === 0 && group.id !== '-') {
            tr.querySelector('.wi-drill-link').addEventListener('click', (e) => {
              e.preventDefault();
              g_selectedDrillDownId = String(group.parentId || group.id);
              navigateToPage('drilldown');
            });
          }
          
          tbodyAlerts.appendChild(tr);
        });
      });

      // Pagination controls for Alerts
      let table = document.getElementById('table-alerts-list');
      let paginationContainer = table.nextElementSibling;
      if (paginationContainer && paginationContainer.classList.contains('grid-pagination-container')) {
        // Exists
      } else {
        paginationContainer = document.createElement('div');
        paginationContainer.className = 'grid-pagination-container';
        paginationContainer.style.display = 'flex';
        paginationContainer.style.justifyContent = 'space-between';
        paginationContainer.style.alignItems = 'center';
        paginationContainer.style.padding = '12px 16px';
        paginationContainer.style.background = 'var(--bg-card)';
        paginationContainer.style.borderTop = '1px solid var(--border-light)';
        paginationContainer.style.borderBottomLeftRadius = '8px';
        paginationContainer.style.borderBottomRightRadius = '8px';
        table.parentNode.insertBefore(paginationContainer, table.nextSibling);
      }

      if (groupArray.length <= itemsPerPage) {
        paginationContainer.style.display = 'none';
      } else {
        paginationContainer.style.display = 'flex';
        
        const displayStart = startIdx + 1;
        const displayEnd = Math.min(window.g_alertsPage * itemsPerPage, groupArray.length);

        paginationContainer.innerHTML = `
          <div style="font-size: 0.85rem; color: var(--text-muted);">
            Mostrando grupos <strong>${displayStart} - ${displayEnd}</strong> de <strong>${groupArray.length}</strong>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn-grid-prev" ${window.g_alertsPage <= 1 ? 'disabled' : ''} style="padding: 4px 12px; font-size: 0.85rem; border-radius: 4px; background: var(--bg-body); border: 1px solid var(--border-light); cursor: pointer; color: var(--text-main);">Anterior</button>
            <div style="display: flex; align-items: center; font-size: 0.85rem; padding: 0 8px;">Página ${window.g_alertsPage} de ${totalPages}</div>
            <button class="btn-grid-next" ${window.g_alertsPage >= totalPages ? 'disabled' : ''} style="padding: 4px 12px; font-size: 0.85rem; border-radius: 4px; background: var(--bg-body); border: 1px solid var(--border-light); cursor: pointer; color: var(--text-main);">Próxima</button>
          </div>
        `;

        const btnPrev = paginationContainer.querySelector('.btn-grid-prev');
        const btnNext = paginationContainer.querySelector('.btn-grid-next');

        if (btnPrev && !btnPrev.disabled) {
          btnPrev.addEventListener('click', () => {
            window.g_alertsPage--;
            renderAlertsPageContents(filteredWIs);
          });
        }

        if (btnNext && !btnNext.disabled) {
          btnNext.addEventListener('click', () => {
            window.g_alertsPage++;
            renderAlertsPageContents(filteredWIs);
          });
        }
      }
    }
  }

  // Mapa de Retransições Recentes (Sinalizações)
  renderRetransitionsTimeline(filteredWIs);
  
  // Mapa de Fluxo Anormal (Etapas Puladas)
  renderSkippedFlowsTimeline(filteredWIs);
}

/**
 * Renderiza o mini-painel de alertas de ação no topo do Overview principal
 */
function renderOverviewAlerts() {
  const tbody = document.getElementById('table-overview-alerts');
  const badge = document.getElementById('lbl-overview-alerts-badge');
  const panel = document.getElementById('panel-overview-alerts');
  
  if (!tbody) return;
  tbody.innerHTML = '';
  
  // Ordenação de prioridade Blocker > Critical > Warning > Info
  const severityWeight = { 'blocker': 4, 'critical': 3, 'yellow': 2, 'info': 1 };
  const sortedAlerts = [...g_computedAlerts].sort((a, b) => {
    return (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
  });
  
  const topAlerts = sortedAlerts.slice(0, 6);
  const blockerCount = g_computedAlerts.filter(a => a.severity === 'blocker').length;
  const criticalCount = g_computedAlerts.filter(a => a.severity === 'critical').length;
  
  if (badge) {
    if (blockerCount > 0) {
      badge.textContent = `${blockerCount} Impedidos`;
      badge.className = 'badge badge-rose';
    } else if (criticalCount > 0) {
      badge.textContent = `${criticalCount} Críticos`;
      badge.className = 'badge-alert-critical';
      badge.style.padding = '2px 6px';
      badge.style.borderRadius = '4px';
    } else if (g_computedAlerts.length > 0) {
      badge.textContent = `${g_computedAlerts.length} Alertas`;
      badge.className = 'badge badge-purple';
    } else {
      badge.textContent = 'Sem Alertas';
      badge.className = 'badge badge-emerald';
    }
  }
  
  if (topAlerts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center" style="padding: 16px 0; color: var(--text-muted);">Nenhum alerta crítico ativo. Bom trabalho!</td></tr>`;
    return;
  }
  
  topAlerts.forEach(a => {
    const tr = document.createElement('tr');
    
    let badgeClass = 'badge-alert-info';
    let badgeText = 'Info';
    if (a.severity === 'blocker') {
      badgeClass = 'badge-alert-blocker';
      badgeText = '🛑 Blocker';
    } else if (a.severity === 'critical') {
      badgeClass = 'badge-alert-critical';
      badgeText = '🟠 Crítico';
    } else if (a.severity === 'yellow') {
      badgeClass = 'badge-alert-yellow';
      badgeText = '🟡 Atenção';
    } else if (a.severity === 'info') {
      badgeClass = 'badge-alert-info';
      badgeText = '🔵 Info';
    }
    
    const linkId = a.parentId || a.id;
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
    }
    
    tbody.appendChild(tr);
  });
  
  if (panel) {
    panel.onclick = () => {
      navigateToPage('alerts');
    };
  }
}






