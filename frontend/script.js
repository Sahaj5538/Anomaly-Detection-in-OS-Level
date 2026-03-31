// CyberSphere SPA Interactive Logic (Risk-Based Assessment Upgrade)

// ---- DOM Elements ----
const els = {
    landing: document.getElementById('landing-page'),
    overlay: document.getElementById('loading-overlay'),
    app: document.getElementById('dashboard-layout'),
    btnStart: document.getElementById('btn-start-analysis'),
    btnStop: document.getElementById('btn-stop-analysis'),
    
    // Status & Nav
    statusDot: document.querySelector('#global-server-status .pulsing-dot'),
    statusText: document.getElementById('server-status-text'),
    globalStatus: document.getElementById('global-server-status'),
    lastUpdated: document.getElementById('last-updated-time'),
    navItems: document.querySelectorAll('.sidebar-nav .nav-item'),
    pageViews: document.querySelectorAll('.page-view'),
    alertsBadge: document.getElementById('nav-alerts-badge'),
    systemsBadge: document.getElementById('nav-systems-count'),
    
    // Side Panel
    panelOverlay: document.getElementById('panel-overlay'),
    sidePanel: document.getElementById('side-panel'),
    btnClosePanel: document.getElementById('btn-close-panel'),
    panelContent: document.getElementById('side-panel-content'),
    
    // Inputs
    globalSearch: document.getElementById('global-search'),
    filterStatus: document.getElementById('filter-status'),
    sortBy: document.getElementById('sort-by'),
    settingInterval: document.getElementById('setting-interval'),
    
    // Pages Containers
    dashTotalProc: document.getElementById('dash-total-proc'),
    dashNormalProc: document.getElementById('dash-normal-proc'),
    dashAnomalyProc: document.getElementById('dash-anomaly-proc'),
    dashClients: document.getElementById('dash-clients'),
    dashMiniTable: document.getElementById('dash-mini-table'),
    fullProcessTable: document.getElementById('full-process-table-body'),
    reasonsList: document.getElementById('xai-reasons-list'),
    systemsGrid: document.getElementById('systems-grid'),
    alertsHistory: document.getElementById('alerts-history'),
};

// ---- Global State ----
const state = {
    isAnalyzing: false,
    intervalId: null,
    pollingRate: 4000,
    currentView: 'dashboard',
    rawTelemetry: [],
    connectedClients: [],
    alertHistory: [],
    searchQuery: '',
    
    // Chart References
    charts: {
        miniAnomaly: null,
        bigCpu: null,
        bigMem: null,
        bigAnomaly: null,
        suspicious: null,
        xaiFeature: null
    },
    
    // Historical arrays
    history: {
        cpu: Array(20).fill(0),
        mem: Array(20).fill(0),
        anomaly: Array(20).fill(0),
        labels: Array(20).fill('')
    },
    
    // Monitoring State Tracker
    monitored: {},
    ignored: {}
};

// ---- Boot Initialization ----
document.addEventListener('DOMContentLoaded', () => {
    Chart.defaults.color = '#94A3B8';
    Chart.defaults.font.family = 'Inter';
    
    setupEventListeners();
    initGlobalCharts();
});

// ---- Event Listeners ----
function setupEventListeners() {
    // 1. App transitions
    if (els.btnStart) {
        els.btnStart.addEventListener('click', () => {
            els.landing.classList.add('hidden');
            els.overlay.classList.remove('hidden');
            setTimeout(() => {
                els.overlay.classList.add('hidden');
                els.app.classList.remove('hidden');
                resizeAllCharts();
                toggleAnalysis(true);
            }, 1200);
        });
    }

    if (els.btnStop) {
        els.btnStop.addEventListener('click', () => {
            toggleAnalysis(!state.isAnalyzing);
        });
    }

    // 2. SPA Navigation
    els.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const view = item.getAttribute('data-view');
            switchView(view);
        });
    });

    // 3. Side Panel interactions
    els.btnClosePanel.addEventListener('click', closeSidePanel);
    els.panelOverlay.addEventListener('click', closeSidePanel);
    
    // 4. Search & Filters
    els.globalSearch.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase();
        if(state.currentView !== 'processes') switchView('processes');
        renderFullTable();
    });
    
    els.filterStatus.addEventListener('change', renderFullTable);
    els.sortBy.addEventListener('change', renderFullTable);
    
    // 5. Settings
    els.settingInterval.addEventListener('change', (e) => {
        state.pollingRate = parseInt(e.target.value);
        if (state.isAnalyzing) {
            clearInterval(state.intervalId);
            state.intervalId = setInterval(fetchTelemetry, state.pollingRate);
        }
    });
}

// ---- Navigation Control ----
window.switchView = function(viewName) {
    state.currentView = viewName;
    
    els.navItems.forEach(nav => {
        if(nav.getAttribute('data-view') === viewName) {
            nav.classList.add('active');
        } else {
            nav.classList.remove('active');
        }
    });

    els.pageViews.forEach(page => {
        if (page.id === `view-${viewName}`) {
            page.classList.remove('hidden');
            page.classList.add('active');
        } else {
            page.classList.add('hidden');
            page.classList.remove('active');
        }
    });
    
    if (viewName === 'analytics' || viewName === 'dashboard' || viewName === 'xai') {
        setTimeout(resizeAllCharts, 50);
    }
    
    if(viewName !== 'processes' && state.searchQuery !== '') {
        els.globalSearch.value = '';
        state.searchQuery = '';
    }
}

// ---- Analysis Control ----
function toggleAnalysis(start) {
    state.isAnalyzing = start;
    if (start) {
        els.btnStop.innerHTML = '<i class="fa-solid fa-stop"></i> Stop Analysis';
        els.btnStop.style.color = 'var(--danger-red)';
        els.btnStop.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        
        els.statusDot.className = 'pulsing-dot online';
        els.statusText.textContent = 'Receiving Data';
        els.globalStatus.className = 'status-pill status-running';
        
        fetchTelemetry();
        state.intervalId = setInterval(fetchTelemetry, state.pollingRate);
    } else {
        clearInterval(state.intervalId);
        
        els.btnStop.innerHTML = '<i class="fa-solid fa-play"></i> Resume Analysis';
        els.btnStop.style.color = 'white';
        els.btnStop.style.borderColor = 'transparent';
        
        els.statusDot.className = 'pulsing-dot offline';
        els.statusText.textContent = 'Server Offline (Paused)';
        els.globalStatus.className = 'status-pill';
        els.globalStatus.style.borderColor = 'rgba(255,255,255,0.1)';
    }
}

// ---- Data Fetching & Mock Logic ----
async function fetchTelemetry() {
    let raw;
    try {
        const res = await fetch('/data');
        if (!res.ok) throw new Error();
        const json = await res.json();
        raw = Array.isArray(json) ? json : [json];
    } catch {
        raw = generateMockTelemetry();
    }
    
    processIncomingData(raw);
}

function generateMockTelemetry() {
    const clients = ['SYS-Alpha', 'SYS-Beta', 'SYS-Gamma', 'SRV-Core', 'DB-Main'];
    const normals = ['chrome.exe', 'explorer.exe', 'svchost.exe', 'postgres.exe', 'node.exe', 'dockerd'];
    const anomalies = ['unknown_miner.exe', 'powershell.exe', 'nc.exe', 'bash', 'malicious_payload.dll'];
    
    const count = 25 + Math.floor(Math.random() * 20);
    const data = [];
    
    // Force inject monitored and ignored processes so they do not disappear on refresh
    const persistentKeys = new Set([...Object.keys(state.monitored), ...Object.keys(state.ignored)]);
    persistentKeys.forEach(key => {
        const m = state.monitored[key] || state.ignored[key];
        const isAnomaly = Math.random() > 0.85;
        let risk = 'Low';
        if (isAnomaly) risk = Math.random() > 0.5 ? 'High' : 'Medium';
        
        data.push({
            id: `sys_${Math.random().toString(36).substr(2, 9)}`,
            system_id: m.sys,
            process: m.proc,
            pid: 1000 + Math.floor(Math.random() * 8000), 
            cpu: parseFloat((Math.random() * (isAnomaly ? 95 : 15)).toFixed(1)),
            memory: Math.round(isAnomaly ? (800 + Math.random() * 3000) : (20 + Math.random() * 400)),
            risk_level: risk,
            reason: isAnomaly ? 'Suspicious behavior detected' : 'Trusted process behavior',
            recommended_action: isAnomaly ? 'Investigate immediately' : 'No action needed',
            confidence: isAnomaly ? (75 + Math.random() * 24).toFixed(1) : null
        });
    });
    
    for (let i = 0; i < count; i++) {
        const rand = Math.random();
        
        // 85% Low, 10% Medium, 5% High
        let risk = 'Low';
        let isAnomaly = false;
        
        if (rand > 0.95) {
            risk = 'High';
            isAnomaly = true;
        } else if (rand > 0.85) {
            risk = 'Medium';
            isAnomaly = true;
        }
        
        let procName, cpu, ram, reason, confidence, action;
        
        if (isAnomaly) {
            procName = anomalies[Math.floor(Math.random() * anomalies.length)];
            cpu = 40 + Math.random() * 59;
            ram = 800 + Math.random() * 3000;
            confidence = (75 + Math.random() * 24).toFixed(1);
            
            if (risk === 'High') {
                const highReasons = ['High CPU usage + abnormal memory allocation spike', 'Suspicious network payload fingerprint behavior'];
                reason = highReasons[Math.floor(Math.random() * highReasons.length)];
                action = 'Investigate immediately';
            } else {
                reason = 'Rare process execution path (Isolation Forest outlier)';
                action = 'Monitor this process';
            }
        } else {
            procName = normals[Math.floor(Math.random() * normals.length)];
            cpu = 0.5 + Math.random() * 15;
            ram = 20 + Math.random() * 400;
            reason = 'Trusted process behavior';
            confidence = null;
            action = 'No action needed';
        }
        
        data.push({
            id: `sys_${Math.random().toString(36).substr(2, 9)}`,
            system_id: clients[Math.floor(Math.random() * clients.length)],
            process: procName,
            pid: 1000 + Math.floor(Math.random() * 8000),
            cpu: parseFloat(cpu.toFixed(1)),
            memory: Math.round(ram),
            risk_level: risk, // Low, Medium, High
            reason: reason,
            recommended_action: action,
            confidence: confidence
        });
    }
    return data;
}

// ---- Data Processing Pipeline ----
function processIncomingData(data) {
    els.lastUpdated.textContent = new Date().toLocaleTimeString();
    
    // Apply Monitoring & Ignoring Logic FIRST
    data.forEach(d => {
        const key = `${d.system_id}_${d.process}`;
        
        if (state.ignored[key]) {
            d.isIgnored = true;
            d.risk_level = 'Low';
            d.recommended_action = 'Ignored by user';
            d.anomaly = false;
            d.reason = 'User suppressed alerts for this process';
        } 
        else if (state.monitored[key]) {
            d.isMonitored = true;
            
            if (d.anomaly || d.risk_level === 'High' || d.risk_level === 'Medium') {
                state.monitored[key].anomalyCount++;
                state.monitored[key].normalCount = 0;
                
                // Smart Logic: Upgrade to High Risk on repeated anomalies (>=2)
                if (state.monitored[key].anomalyCount >= 2) {
                    d.risk_level = 'High';
                    d.reason = d.reason + ' | 🟡 This process is being monitored due to repeated unusual behavior.';
                    d.recommended_action = 'Investigate immediately';
                }
            } else {
                state.monitored[key].normalCount++;
                // Smart Logic: Downgrade history if normal for multiple cycles
                if (state.monitored[key].normalCount >= 3) {
                    state.monitored[key].anomalyCount = Math.max(0, state.monitored[key].anomalyCount - 1);
                }
            }
        }
    });

    state.rawTelemetry = data;
    
    const highMedRisks = data.filter(d => d.risk_level === 'High' || d.risk_level === 'Medium');
    const highRisksOnly = data.filter(d => d.risk_level === 'High');
    
    // Process new alerts (High Risk Only)
    highRisksOnly.forEach(anomaly => {
        if (!state.alertHistory.find(a => a.pid === anomaly.pid && a.process === anomaly.process)) {
            state.alertHistory.unshift({
                ...anomaly,
                timestamp: new Date().toLocaleTimeString()
            });
            if (state.alertHistory.length > 50) state.alertHistory.pop();
        }
    });

    updateGlobalStats(data, highMedRisks.length);
    updateChartHistory(data, highMedRisks.length);
    
    renderDashboardMiniTable();
    renderFullTable();
    renderSystemsView(data);
    renderAlertsView();
    renderXAIPage(highMedRisks);
}

// ---- Global Statistics Updates ----
function updateGlobalStats(data, riskCount) {
    els.dashTotalProc.textContent = data.length;
    els.dashAnomalyProc.textContent = riskCount;
    els.dashNormalProc.textContent = data.length - riskCount;
    
    const uniqueClients = new Set(data.map(d => d.system_id));
    els.dashClients.textContent = uniqueClients.size;
    els.systemsBadge.textContent = uniqueClients.size;
    
    if (state.alertHistory.length > 0) {
        els.alertsBadge.textContent = state.alertHistory.length;
        els.alertsBadge.classList.remove('hidden');
    }
}

// ---- Render Table logic ----
window.handleActionClick = function(e, actionType, id) {
    if (e) e.stopPropagation(); 
    const item = state.rawTelemetry.find(d => d.id === id);
    if(!item) return;

    if (actionType === 'details') {
        openSidePanel(item);
    } else if (actionType === 'ignore') {
        const key = `${item.system_id}_${item.process}`;
        if (state.monitored[key]) delete state.monitored[key];
        state.ignored[key] = { sys: item.system_id, proc: item.process };
        
        const idx = state.rawTelemetry.findIndex(d => d.id === id);
        if (idx > -1) {
            state.rawTelemetry[idx].risk_level = 'Low';
            state.rawTelemetry[idx].recommended_action = 'Ignored by user';
            state.rawTelemetry[idx].isIgnored = true;
            state.rawTelemetry[idx].isMonitored = false;
        }
        
        renderDashboardMiniTable();
        renderFullTable();
    } else if (actionType === 'unignore') {
        const key = `${item.system_id}_${item.process}`;
        if (state.ignored[key]) delete state.ignored[key];
        
        const idx = state.rawTelemetry.findIndex(d => d.id === id);
        if (idx > -1) state.rawTelemetry[idx].isIgnored = false;
        
        renderDashboardMiniTable();
        renderFullTable();
    } else if (actionType === 'monitor') {
        const key = `${item.system_id}_${item.process}`;
        if (state.ignored[key]) delete state.ignored[key];
        
        if (!state.monitored[key]) {
            state.monitored[key] = { anomalyCount: 0, normalCount: 0, sys: item.system_id, proc: item.process };
        }
        
        const idx = state.rawTelemetry.findIndex(d => d.id === id);
        if (idx > -1) {
            state.rawTelemetry[idx].isMonitored = true;
            state.rawTelemetry[idx].isIgnored = false;
        }
        
        // Force refresh UI immediately
        renderDashboardMiniTable();
        renderFullTable();
    }
}

function createRow(item) {
    const tr = document.createElement('tr');
    tr.onclick = () => openSidePanel(item); // Row click defaults to View Details
    
    let rowClasses = [];
    if (item.isIgnored) rowClasses.push('is-ignored');
    else if (item.risk_level === 'High') rowClasses.push('is-high-risk');
    else if (item.risk_level === 'Medium') rowClasses.push('is-medium-risk');
    
    if (item.isMonitored) rowClasses.push('is-monitored');
    tr.className = rowClasses.join(' ');
    
    // Determine badge and icons
    let statusHtml = '';
    let iconHtml = '';
    
    if (item.isIgnored) {
        iconHtml = '<i class="fa-solid fa-circle-minus" style="color:var(--text-muted); margin-right:8px;"></i>';
        statusHtml = `<span class="status"><span class="pulsing-dot" style="background:var(--text-muted); margin-right: 4px;"></span> Low Risk (Ignored)</span>`;
    } else if (item.risk_level === 'High') {
        iconHtml = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--danger-red); margin-right:8px;"></i>';
        statusHtml = `<span class="status status-danger"><span class="pulsing-dot offline" style="margin-right: 4px;"></span> High Risk</span>`;
    } else if (item.risk_level === 'Medium') {
        iconHtml = '<i class="fa-solid fa-circle-exclamation" style="color:var(--warning-orange); margin-right:8px;"></i>';
        statusHtml = `<span class="status status-warning"><span class="pulsing-dot offline" style="background:var(--warning-orange); box-shadow:0 0 8px var(--warning-orange); margin-right: 4px;"></span> Medium Risk</span>`;
    } else {
        iconHtml = '<i class="fa-solid fa-microchip" style="color:var(--text-muted); margin-right:8px;"></i>';
        statusHtml = `<span class="status status-ok"><span class="pulsing-dot online" style="margin-right: 4px;"></span> Low Risk</span>`;
    }

    let badgesHtml = '';
    if (item.isIgnored) {
        badgesHtml = `<div style="margin-top:6px;"><span class="badge ignored-badge">⚪ Ignored</span></div>`;
    } else if (item.isMonitored) {
        badgesHtml = `<div style="margin-top:6px;"><span class="badge monitor-badge"><span class="pulsing-dot" style="background:var(--warning-orange); box-shadow:0 0 8px var(--warning-orange);"></span> Under Monitoring</span></div>`;
    }
        
    let ignoreBtnHtml = item.isIgnored
        ? `<button class="btn-ghost" onclick="handleActionClick(event, 'unignore', '${item.id}')">Un-ignore</button>`
        : `<button class="btn-ghost" onclick="handleActionClick(event, 'ignore', '${item.id}')">Ignore</button>`;
        
    let monitorBtnHtml = item.isMonitored
        ? `<button class="btn-ghost" disabled style="opacity:0.6; cursor:not-allowed; border-color:var(--warning-orange); color:var(--warning-orange);"><i class="fa-solid fa-code-commit"></i> Monitoring...</button>`
        : `<button class="btn-ghost" onclick="handleActionClick(event, 'monitor', '${item.id}')">Monitor</button>`;
        
    tr.innerHTML = `
        <td><i class="fa-solid fa-server" style="color: #6366F1; margin-right: 6px;"></i> ${item.system_id}</td>
        <td style="font-family:monospace; font-weight:600; color: #fff;">${iconHtml} ${item.process} ${badgesHtml}</td>
        <td style="color: var(--text-muted)">${item.pid}</td>
        <td>${statusHtml}</td>
        <td style="color:rgba(255,255,255,0.8); font-size:13px; line-height:1.4;">${item.reason}</td>
        <td style="color:rgba(255,255,255,0.8); font-size:13px;">${item.recommended_action}</td>
        <td>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button class="btn-action" onclick="handleActionClick(event, 'details', '${item.id}')">View Details</button>
                ${ignoreBtnHtml}
                ${monitorBtnHtml}
            </div>
        </td>
    `;
    return tr;
}

function renderDashboardMiniTable() {
    els.dashMiniTable.innerHTML = '';
    // Top 5 worst (High first, then Medium)
    const sorted = [...state.rawTelemetry]
        .filter(d => d.risk_level === 'High' || d.risk_level === 'Medium')
        .sort((a,b) => (a.risk_level === 'High' ? -1 : 1))
        .slice(0, 5);
    
    if(sorted.length === 0) {
        els.dashMiniTable.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--success-green);">No risks detected</td></tr>';
        return;
    }
    
    sorted.forEach(item => {
        const tr = document.createElement('tr');
        tr.onclick = () => openSidePanel(item);
        if (item.risk_level === 'High') tr.className = 'is-high-risk';
        else tr.className = 'is-medium-risk';
        
        let iconHtml = item.risk_level === 'High' 
            ? '<i class="fa-solid fa-triangle-exclamation" style="color:var(--danger-red); margin-right:6px;"></i>'
            : '<i class="fa-solid fa-circle-exclamation" style="color:var(--warning-orange); margin-right:6px;"></i>';
            
        tr.innerHTML = `
            <td style="font-family:monospace; font-weight:600; color:#fff">${iconHtml} ${item.process}</td>
            <td style="color:var(--text-muted)">${item.system_id}</td>
            <td><strong>${item.cpu}%</strong></td>
            <td><button class="btn-action">View</button></td>
        `;
        els.dashMiniTable.appendChild(tr);
    });
}

function renderFullTable() {
    let data = [...state.rawTelemetry];
    
    // Filtering
    const statusVal = els.filterStatus.value;
    if (statusVal === 'high') data = data.filter(d => d.risk_level === 'High');
    else if (statusVal === 'medium') data = data.filter(d => d.risk_level === 'Medium');
    else if (statusVal === 'low') data = data.filter(d => d.risk_level === 'Low');
    
    // Searching
    if (state.searchQuery) {
        data = data.filter(d => 
            d.process.toLowerCase().includes(state.searchQuery) ||
            d.pid.toString().includes(state.searchQuery) ||
            d.system_id.toLowerCase().includes(state.searchQuery)
        );
    }
    
    // Sorting
    const sortVal = els.sortBy.value;
    const riskScore = { 'High': 3, 'Medium': 2, 'Low': 1 };
    
    if (sortVal === 'risk-desc') {
        data.sort((a,b) => riskScore[b.risk_level] - riskScore[a.risk_level]);
    }
    else if (sortVal === 'cpu-desc') data.sort((a,b) => b.cpu - a.cpu);
    else if (sortVal === 'ram-desc') data.sort((a,b) => b.memory - a.memory);

    els.fullProcessTable.innerHTML = '';
    
    if (data.length === 0) {
        els.fullProcessTable.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 40px; color:var(--text-muted);">No processes match filter criteria.</td></tr>';
        return;
    }
    
    data.forEach(item => {
        els.fullProcessTable.appendChild(createRow(item));
    });
}

// ---- Render Other Pages ----
function renderAlertsView() {
    els.alertsHistory.innerHTML = '';
    if(state.alertHistory.length === 0) {
        els.alertsHistory.innerHTML = '<div class="empty-state" style="padding:40px;">No alerts recorded yet. All systems clear.</div>';
        return;
    }
    
    state.alertHistory.forEach(alert => {
        const div = document.createElement('div');
        div.className = 'alert-item glass-card';
        div.onclick = () => openSidePanel(alert);
        div.innerHTML = `
            <i class="fa-solid fa-triangle-exclamation" style="color:var(--danger-red); font-size:24px; margin-top:4px;"></i>
            <div class="alert-content">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <strong style="color:white; font-family:monospace;">${alert.process} (PID: ${alert.pid})</strong>
                    <span class="alert-time">${alert.timestamp} on ${alert.system_id}</span>
                </div>
                <div style="color:var(--text-muted); font-size:13px;">${alert.reason} | Action: ${alert.recommended_action}</div>
            </div>
            <i class="fa-solid fa-chevron-right" style="color:var(--text-muted); padding-top:8px;"></i>
        `;
        els.alertsHistory.appendChild(div);
    });
}

window.clearAlerts = function() {
    state.alertHistory = [];
    els.alertsBadge.classList.add('hidden');
    renderAlertsView();
}

function renderSystemsView(data) {
    const clients = [...new Set(data.map(d => d.system_id))].sort();
    els.systemsGrid.innerHTML = '';
    
    clients.forEach(c => {
        const sysProcs = data.filter(d => d.system_id === c);
        const sysHigh = sysProcs.filter(d => d.risk_level === 'High').length;
        const sysMed = sysProcs.filter(d => d.risk_level === 'Medium').length;
        
        let colorClass = '--success-green';
        if (sysHigh > 0) colorClass = '--danger-red';
        else if (sysMed > 0) colorClass = '--warning-orange';
        
        const div = document.createElement('div');
        div.className = 'glass-card system-card';
        div.style.borderTop = `4px solid var(${colorClass})`;
        
        div.innerHTML = `
            <i class="fa-solid fa-server" style="color: var(${colorClass});"></i>
            <h4>${c}</h4>
            <div style="display:flex; justify-content:space-around; margin-top:16px;">
                <div><div style="font-size:20px; font-weight:bold; color:white;">${sysProcs.length}</div><div style="font-size:10px; color:var(--text-muted); text-transform:uppercase;">Procs</div></div>
                <div><div style="font-size:20px; font-weight:bold; color:var(${colorClass});">${sysHigh + sysMed}</div><div style="font-size:10px; color:var(--text-muted); text-transform:uppercase;">Risks</div></div>
            </div>
        `;
        els.systemsGrid.appendChild(div);
    });
}

function renderXAIPage(risks) {
    els.reasonsList.innerHTML = '';
    if (risks.length === 0) {
        els.reasonsList.innerHTML = '<li class="reason-item" style="justify-content:center; color:var(--success-green);">No anomalies present.</li>';
        return;
    }
    
    // Group by reason
    let map = {};
    risks.forEach(a => { map[a.reason] = (map[a.reason] || 0) + 1; });
    const reasons = Object.keys(map).sort((a,b)=>map[b]-map[a]);
    
    reasons.forEach(r => {
        const li = document.createElement('li');
        li.className = 'reason-item';
        li.innerHTML = `<span style="flex:1;">${r}</span> <span class="badge" style="background:rgba(239,68,68,0.2); color:white;">${map[r]} Events</span>`;
        els.reasonsList.appendChild(li);
    });
    
    // Update Suspicious Processes chart
    let procMap = {};
    risks.forEach(a => { procMap[a.process] = (procMap[a.process]||0)+1; });
    const pNames = Object.keys(procMap).sort((a,b)=>procMap[b]-procMap[a]).slice(0, 5);
    const pValues = pNames.map(p => procMap[p]);
    
    state.charts.suspicious.data.labels = pNames;
    state.charts.suspicious.data.datasets[0].data = pValues;
    state.charts.suspicious.update();
}

// ---- Slide-in Panel Logic (XAI Explanation) ----
window.openSidePanel = function(processObj) {
    els.sidePanel.classList.remove('hidden');
    els.panelOverlay.classList.remove('hidden');
    
    if (processObj.risk_level === 'Low') {
        els.panelContent.innerHTML = `
            <div style="text-align:center; padding: 40px 20px;">
                <i class="fa-solid fa-check-shield" style="font-size:64px; color:var(--success-green); margin-bottom:24px;"></i>
                <h3 style="font-size:24px; color:white; margin-bottom:12px;">Safe & Verified</h3>
                <p style="color:var(--text-muted); line-height:1.6;">
                    <strong>${processObj.process}</strong> on <strong>${processObj.system_id}</strong> is executing within expected telemetry baselines.
                    <br><br>Reason: ${processObj.reason}
                    <br>Action: ${processObj.recommended_action}
                </p>
            </div>
        `;
        return;
    }
    
    // Medium / High Risk rendering
    const features = ['CPU Usage', 'Memory Alloc', 'Net Outbound', 'Syscalls', 'Thread Count'];
    const importance = [
        processObj.cpu > 70 ? 80 : 30,
        processObj.memory > 1500 ? 70 : 40,
        Math.floor(Math.random()*60 + 20),
        Math.floor(Math.random()*40 + 10),
        Math.floor(Math.random()*30 + 10)
    ];

    const isHigh = processObj.risk_level === 'High';
    const accentColor = isHigh ? 'var(--danger-red)' : 'var(--warning-orange)';
    const bgAccent = isHigh ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)';
    const iconClass = isHigh ? 'fa-triangle-exclamation' : 'fa-circle-exclamation';

    els.panelContent.innerHTML = `
        <div class="xai-details">
            <div class="reason-box" style="background:${bgAccent}; border-left-color:${accentColor};">
                <h4 style="color:${accentColor};"><i class="fa-solid ${iconClass}"></i> Primary Detection Rationale</h4>
                <p>${processObj.reason}</p>
                <div style="margin-top:12px; padding-top:8px; border-top:1px solid rgba(255,255,255,0.1); font-weight:600;">
                    Action: ${processObj.recommended_action}
                </div>
            </div>
            
            <div class="xai-meta">
                <div class="meta-box">
                    <div class="meta-label">Process Details</div>
                    <div class="meta-val">${processObj.process} <br><span style="font-size: 12px; color: var(--text-muted); font-weight: 400;">PID: ${processObj.pid}</span></div>
                    <div style="margin-top:8px; font-size:12px; color:var(--text-muted);"><i class="fa-solid fa-server"></i> Node: ${processObj.system_id}</div>
                </div>
                <div class="meta-box">
                    <div class="meta-label">AI Confidence</div>
                    <div class="meta-val" style="color:${accentColor}">${processObj.confidence}%</div>
                    <div class="meter-bg"><div class="meter-fill" style="width: ${processObj.confidence}%; background:${accentColor}; box-shadow: 0 0 10px ${accentColor}"></div></div>
                </div>
            </div>

            <div class="meta-box" style="display:flex; justify-content:space-around; text-align:center;">
                <div><div class="meta-label">CPU LOAD</div><div class="meta-val" style="color:${processObj.cpu>70?'var(--danger-red)':'white'}">${processObj.cpu}%</div></div>
                <div><div class="meta-label">MEM FOOTPRINT</div><div class="meta-val" style="color:${processObj.memory>1000?'var(--danger-red)':'white'}">${processObj.memory} MB</div></div>
            </div>
            
            <div style="margin-top: 10px;">
                <h4 style="font-size: 13px; color: var(--text-muted); text-transform: uppercase;">Isolation Forest Feature Weights</h4>
                <div class="feature-chart-container" style="height:250px;">
                    <canvas id="xaiSlideChart"></canvas>
                </div>
            </div>
        </div>
    `;
    
    setTimeout(() => {
        const ctx = document.getElementById('xaiSlideChart').getContext('2d');
        if (state.charts.xaiFeature) state.charts.xaiFeature.destroy();
        state.charts.xaiFeature = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: features,
                datasets: [{
                    label: 'Anomaly Contribution %',
                    data: importance,
                    backgroundColor: importance.map(v => v>70? '#EF4444' : (v>40?'#F59E0B':'#6366F1')),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: { max: 100, border: {display: false}, grid:{color:'rgba(255,255,255,0.05)'} },
                    y: { border: {display: false}, grid:{display:false} }
                }
            }
        });
    }, 100);
}

window.closeSidePanel = function() {
    els.sidePanel.classList.add('hidden');
    els.panelOverlay.classList.add('hidden');
}

// ---- Chart Management ----
function initGlobalCharts() {
    const ctx1 = document.getElementById('miniAnomalyChart').getContext('2d');
    state.charts.miniAnomaly = new Chart(ctx1, { type: 'bar', data: { labels: state.history.labels, datasets: [{ data: state.history.anomaly, backgroundColor: '#EF4444', borderRadius:4 }] }, options: commonChartOptions(10) });
    
    const ctx2 = document.getElementById('bigCpuChart').getContext('2d');
    const grad = ctx2.createLinearGradient(0,0,0,400); grad.addColorStop(0, 'rgba(99, 102, 241, 0.5)'); grad.addColorStop(1, 'transparent');
    state.charts.bigCpu = new Chart(ctx2, { type: 'line', data: { labels: state.history.labels, datasets: [{ data: state.history.cpu, borderColor: '#6366F1', backgroundColor: grad, fill: true, tension: 0.4 }] }, options: commonChartOptions(100) });

    const ctx3 = document.getElementById('bigMemChart').getContext('2d');
    const gradM = ctx3.createLinearGradient(0,0,0,400); gradM.addColorStop(0, 'rgba(245, 158, 11, 0.4)'); gradM.addColorStop(1, 'transparent');
    state.charts.bigMem = new Chart(ctx3, { type: 'line', data: { labels: state.history.labels, datasets: [{ data: state.history.mem, borderColor: '#F59E0B', backgroundColor: gradM, fill: true, tension: 0.4 }] }, options: commonChartOptions(5000) });

    const ctx4 = document.getElementById('bigAnomalyChart').getContext('2d');
    const gradA = ctx4.createLinearGradient(0,0,0,400); gradA.addColorStop(0, 'rgba(239, 68, 68, 0.5)'); gradA.addColorStop(1, 'transparent');
    state.charts.bigAnomaly = new Chart(ctx4, { type: 'bar', data: { labels: state.history.labels, datasets: [{ data: state.history.anomaly, backgroundColor: gradA, borderColor:'#EF4444', borderWidth: 2, borderRadius:4 }] }, options: commonChartOptions(10) });

    const ctx5 = document.getElementById('suspiciousProcChart').getContext('2d');
    state.charts.suspicious = new Chart(ctx5, {
        type: 'doughnut',
        data: { labels: [], datasets: [{ data: [], backgroundColor: ['#EF4444', '#F59E0B', '#6366F1', '#10B981', '#8B5CF6'], borderWidth: 0}] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels:{color:'white'} } } }
    });
}

function commonChartOptions(maxVal) {
    return {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            y: { suggestedMax: maxVal, beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, border:{display:false} },
            x: { grid: { display: false }, border:{display:false} }
        },
        animation: { duration: 0 }
    }
}

function updateChartHistory(data, riskCount) {
    const avgCpu = data.length ? data.reduce((a,b)=>a+b.cpu,0)/data.length : 0;
    const avgMem = data.length ? data.reduce((a,b)=>a+b.memory,0)/data.length : 0;
    
    state.history.cpu.shift(); state.history.cpu.push(avgCpu);
    state.history.mem.shift(); state.history.mem.push(avgMem);
    state.history.anomaly.shift(); state.history.anomaly.push(riskCount);
    
    const time = new Date().toLocaleTimeString().slice(0, -3);
    state.history.labels.shift(); state.history.labels.push(time);
    
    try {
        state.charts.miniAnomaly.update();
        state.charts.bigCpu.update();
        state.charts.bigMem.update();
        state.charts.bigAnomaly.update();
    } catch(e) {}
}

function resizeAllCharts() {
    try {
        Object.values(state.charts).forEach(c => { if(c && c.resize) c.resize(); });
    } catch(e) {}
}
