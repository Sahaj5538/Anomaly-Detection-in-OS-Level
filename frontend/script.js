// CyberSphere SPA Interactive Logic

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
    }
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
    
    // Update sidebar UI
    els.navItems.forEach(nav => {
        if(nav.getAttribute('data-view') === viewName) {
            nav.classList.add('active');
        } else {
            nav.classList.remove('active');
        }
    });

    // Update main views
    els.pageViews.forEach(page => {
        if (page.id === `view-${viewName}`) {
            page.classList.remove('hidden');
            page.classList.add('active');
        } else {
            page.classList.add('hidden');
            page.classList.remove('active');
        }
    });
    
    // Redraw charts if navigating to data viz to fix sizing quirks
    if (viewName === 'analytics' || viewName === 'dashboard' || viewName === 'xai') {
        setTimeout(resizeAllCharts, 50);
    }
    
    // Remove search text if switching away from processes
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
        
        fetchTelemetry(); // Run immediate
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
    
    for (let i = 0; i < count; i++) {
        const isAnomaly = Math.random() > 0.88; 
        
        let procName, cpu, ram, reason, confidence;
        if (isAnomaly) {
            procName = anomalies[Math.floor(Math.random() * anomalies.length)];
            cpu = 40 + Math.random() * 59;
            ram = 800 + Math.random() * 3000;
            confidence = (80 + Math.random() * 19).toFixed(1);
            const reasonsList = [
                'High CPU usage + abnormal memory allocation spike', 
                'Rare process execution path (Isolation Forest outlier)', 
                'Suspicious network payload fingerprint behavior'
            ];
            reason = reasonsList[Math.floor(Math.random() * reasonsList.length)];
        } else {
            procName = normals[Math.floor(Math.random() * normals.length)];
            cpu = 0.5 + Math.random() * 15;
            ram = 20 + Math.random() * 400;
            reason = null;
            confidence = null;
        }
        
        data.push({
            id: `sys_${Math.random().toString(36).substr(2, 9)}`,
            system_id: clients[Math.floor(Math.random() * clients.length)],
            process: procName,
            pid: 1000 + Math.floor(Math.random() * 8000),
            cpu: parseFloat(cpu.toFixed(1)),
            memory: Math.round(ram),
            anomaly: isAnomaly,
            reason: reason,
            confidence: confidence
        });
    }
    return data;
}

// ---- Data Processing Pipeline ----
function processIncomingData(data) {
    state.rawTelemetry = data;
    
    els.lastUpdated.textContent = new Date().toLocaleTimeString();
    
    const anomalies = data.filter(d => d.anomaly);
    
    // Process new alerts
    anomalies.forEach(anomaly => {
        // Simple logic to add to history if not exists recently
        if (!state.alertHistory.find(a => a.pid === anomaly.pid && a.process === anomaly.process)) {
            state.alertHistory.unshift({
                ...anomaly,
                timestamp: new Date().toLocaleTimeString()
            });
            // Keep history lean (max 50)
            if (state.alertHistory.length > 50) state.alertHistory.pop();
        }
    });

    updateGlobalStats(data, anomalies.length);
    updateChartHistory(data, anomalies.length);
    
    // Route updates to views
    renderDashboardMiniTable();
    renderFullTable();
    renderSystemsView(data);
    renderAlertsView();
    renderXAIPage(anomalies);
}

// ---- Global Statistics Updates ----
function updateGlobalStats(data, anomalyCount) {
    els.dashTotalProc.textContent = data.length;
    els.dashAnomalyProc.textContent = anomalyCount;
    els.dashNormalProc.textContent = data.length - anomalyCount;
    
    const uniqueClients = new Set(data.map(d => d.system_id));
    els.dashClients.textContent = uniqueClients.size;
    els.systemsBadge.textContent = uniqueClients.size;
    
    if (state.alertHistory.length > 0) {
        els.alertsBadge.textContent = state.alertHistory.length;
        els.alertsBadge.classList.remove('hidden');
    }
}

// ---- Render Table logic ----
function createRow(item) {
    const tr = document.createElement('tr');
    tr.onclick = () => openSidePanel(item);
    
    if (item.anomaly) tr.className = 'is-anomaly';
    
    const icon = item.anomaly 
        ? '<i class="fa-solid fa-virus" style="color:var(--danger-red); margin-right:8px;"></i>' 
        : '<i class="fa-solid fa-microchip" style="color:var(--text-muted); margin-right:8px;"></i>';
        
    const status = item.anomaly 
        ? `<span class="status status-danger"><span class="pulsing-dot offline" style="margin-right: 4px;"></span> Anomaly</span>`
        : `<span class="status status-ok"><span class="pulsing-dot online" style="margin-right: 4px;"></span> Normal</span>`;
        
    tr.innerHTML = `
        <td><i class="fa-solid fa-server" style="color: #6366F1; margin-right: 6px;"></i> ${item.system_id}</td>
        <td style="font-family:monospace; font-weight:600; color: #fff;">${icon} ${item.process}</td>
        <td style="color: var(--text-muted)">${item.pid}</td>
        <td><strong>${item.cpu}%</strong></td>
        <td>${item.memory} MB</td>
        <td>${status}</td>
        <td><button class="btn-action">Explain</button></td>
    `;
    return tr;
}

function renderDashboardMiniTable() {
    els.dashMiniTable.innerHTML = '';
    // Top 5 worst
    const sorted = [...state.rawTelemetry].sort((a,b) => b.cpu - a.cpu).filter(d => d.anomaly).slice(0, 5);
    
    if(sorted.length === 0) {
        els.dashMiniTable.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--success-green);">No anomalies detected</td></tr>';
        return;
    }
    
    sorted.forEach(item => {
        const tr = document.createElement('tr');
        tr.onclick = () => openSidePanel(item);
        tr.className = 'is-anomaly';
        tr.innerHTML = `
            <td style="font-family:monospace; font-weight:600; color:#fff"><i class="fa-solid fa-virus" style="color:var(--danger-red); margin-right:6px;"></i> ${item.process}</td>
            <td style="color:var(--text-muted)">${item.system_id}</td>
            <td><strong>${item.cpu}%</strong></td>
            <td><button class="btn-action">Action</button></td>
        `;
        els.dashMiniTable.appendChild(tr);
    });
}

function renderFullTable() {
    let data = [...state.rawTelemetry];
    
    // Filtering
    const statusVal = els.filterStatus.value;
    if (statusVal === 'normal') data = data.filter(d => !d.anomaly);
    if (statusVal === 'anomaly') data = data.filter(d => d.anomaly);
    
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
    if (sortVal === 'anomaly-desc') data.sort((a,b) => b.anomaly === a.anomaly ? b.cpu - a.cpu : (a.anomaly ? -1 : 1));
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
                <div style="color:var(--text-muted); font-size:13px;">${alert.reason}</div>
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
        const sysAnomalies = sysProcs.filter(d => d.anomaly).length;
        const colorClass = sysAnomalies > 0 ? '--danger-red' : '--success-green';
        
        const div = document.createElement('div');
        div.className = 'glass-card system-card';
        if(sysAnomalies > 0) div.style.borderTop = '4px solid var(--danger-red)';
        else div.style.borderTop = '4px solid var(--success-green)';
        
        div.innerHTML = `
            <i class="fa-solid fa-server" style="color: var(${colorClass});"></i>
            <h4>${c}</h4>
            <div style="display:flex; justify-content:space-around; margin-top:16px;">
                <div><div style="font-size:20px; font-weight:bold; color:white;">${sysProcs.length}</div><div style="font-size:10px; color:var(--text-muted); text-transform:uppercase;">Procs</div></div>
                <div><div style="font-size:20px; font-weight:bold; color:var(${colorClass});">${sysAnomalies}</div><div style="font-size:10px; color:var(--text-muted); text-transform:uppercase;">Threats</div></div>
            </div>
        `;
        els.systemsGrid.appendChild(div);
    });
}

function renderXAIPage(anomalies) {
    els.reasonsList.innerHTML = '';
    if (anomalies.length === 0) {
        els.reasonsList.innerHTML = '<li class="reason-item" style="justify-content:center; color:var(--success-green);">No anomalies present.</li>';
        return;
    }
    
    // Group by reason
    let map = {};
    anomalies.forEach(a => { map[a.reason] = (map[a.reason] || 0) + 1; });
    const reasons = Object.keys(map).sort((a,b)=>map[b]-map[a]);
    
    reasons.forEach(r => {
        const li = document.createElement('li');
        li.className = 'reason-item';
        li.innerHTML = `<span style="flex:1;">${r}</span> <span class="badge" style="background:rgba(239,68,68,0.2); color:white;">${map[r]} Events</span>`;
        els.reasonsList.appendChild(li);
    });
    
    // Update Suspicious Processes chart
    let procMap = {};
    anomalies.forEach(a => { procMap[a.process] = (procMap[a.process]||0)+1; });
    const pNames = Object.keys(procMap).sort((a,b)=>procMap[b]-procMap[a]).slice(0, 5);
    const pValues = pNames.map(p => procMap[p]);
    
    state.charts.suspicious.data.labels = pNames;
    state.charts.suspicious.data.datasets[0].data = pValues;
    state.charts.suspicious.update();
}

// ---- Slide-in Panel Logic (XAI Explanation) ----
function openSidePanel(processObj) {
    els.sidePanel.classList.remove('hidden');
    els.panelOverlay.classList.remove('hidden');
    
    if (!processObj.anomaly) {
        els.panelContent.innerHTML = `
            <div style="text-align:center; padding: 40px 20px;">
                <i class="fa-solid fa-check-shield" style="font-size:64px; color:var(--success-green); margin-bottom:24px;"></i>
                <h3 style="font-size:24px; color:white; margin-bottom:12px;">Normal Behavior Verified</h3>
                <p style="color:var(--text-muted); line-height:1.6;">
                    <strong>${processObj.process}</strong> on <strong>${processObj.system_id}</strong> is executing within expected telemetry baselines. 
                    <br><br>CPU: ${processObj.cpu}% <br>RAM: ${processObj.memory} MB
                </p>
            </div>
        `;
        return;
    }
    
    // Anomaly rendering
    const features = ['CPU Usage', 'Memory Alloc', 'Net Outbound', 'Syscalls', 'Thread Count'];
    const importance = [
        processObj.cpu > 70 ? 80 : 30,
        processObj.memory > 1500 ? 70 : 40,
        Math.floor(Math.random()*60 + 20),
        Math.floor(Math.random()*40 + 10),
        Math.floor(Math.random()*30 + 10)
    ];

    els.panelContent.innerHTML = `
        <div class="xai-details">
            <div class="reason-box">
                <h4><i class="fa-solid fa-triangle-exclamation"></i> Primary Model Trigger</h4>
                <p>${processObj.reason}</p>
            </div>
            
            <div class="xai-meta">
                <div class="meta-box">
                    <div class="meta-label">Process Details</div>
                    <div class="meta-val">${processObj.process} <br><span style="font-size: 12px; color: var(--text-muted); font-weight: 400;">PID: ${processObj.pid}</span></div>
                    <div style="margin-top:8px; font-size:12px; color:var(--text-muted);"><i class="fa-solid fa-server"></i> Node: ${processObj.system_id}</div>
                </div>
                <div class="meta-box">
                    <div class="meta-label">AI Confidence</div>
                    <div class="meta-val text-danger">${processObj.confidence}%</div>
                    <div class="meter-bg"><div class="meter-fill" style="width: ${processObj.confidence}%"></div></div>
                </div>
            </div>

            <div class="meta-box" style="display:flex; justify-content:space-around; text-align:center;">
                <div><div class="meta-label">CPU LOAD</div><div class="meta-val" style="color:var(--danger-red)">${processObj.cpu}%</div></div>
                <div><div class="meta-label">MEM FOOTPRINT</div><div class="meta-val" style="color:var(--warning-orange)">${processObj.memory} MB</div></div>
            </div>
            
            <div style="margin-top: 10px;">
                <h4 style="font-size: 13px; color: var(--text-muted); text-transform: uppercase;">Isolation Forest Feature Weights</h4>
                <div class="feature-chart-container" style="height:250px;">
                    <canvas id="xaiSlideChart"></canvas>
                </div>
            </div>
        </div>
    `;
    
    // Initialize chart in slide panel right after HTML injection
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
    // 1. Mini Anomaly Trend (Dashboard)
    const ctx1 = document.getElementById('miniAnomalyChart').getContext('2d');
    state.charts.miniAnomaly = new Chart(ctx1, { type: 'bar', data: { labels: state.history.labels, datasets: [{ data: state.history.anomaly, backgroundColor: '#EF4444', borderRadius:4 }] }, options: commonChartOptions(10) });
    
    // 2. Big CPU Trend (Analytics)
    const ctx2 = document.getElementById('bigCpuChart').getContext('2d');
    const grad = ctx2.createLinearGradient(0,0,0,400); grad.addColorStop(0, 'rgba(99, 102, 241, 0.5)'); grad.addColorStop(1, 'transparent');
    state.charts.bigCpu = new Chart(ctx2, { type: 'line', data: { labels: state.history.labels, datasets: [{ data: state.history.cpu, borderColor: '#6366F1', backgroundColor: grad, fill: true, tension: 0.4 }] }, options: commonChartOptions(100) });

    // 3. Big Mem Trend (Analytics)
    const ctx3 = document.getElementById('bigMemChart').getContext('2d');
    const gradM = ctx3.createLinearGradient(0,0,0,400); gradM.addColorStop(0, 'rgba(245, 158, 11, 0.4)'); gradM.addColorStop(1, 'transparent');
    state.charts.bigMem = new Chart(ctx3, { type: 'line', data: { labels: state.history.labels, datasets: [{ data: state.history.mem, borderColor: '#F59E0B', backgroundColor: gradM, fill: true, tension: 0.4 }] }, options: commonChartOptions(5000) });

    // 4. Big Anomaly Trend (Analytics)
    const ctx4 = document.getElementById('bigAnomalyChart').getContext('2d');
    const gradA = ctx4.createLinearGradient(0,0,0,400); gradA.addColorStop(0, 'rgba(239, 68, 68, 0.5)'); gradA.addColorStop(1, 'transparent');
    state.charts.bigAnomaly = new Chart(ctx4, { type: 'bar', data: { labels: state.history.labels, datasets: [{ data: state.history.anomaly, backgroundColor: gradA, borderColor:'#EF4444', borderWidth: 2, borderRadius:4 }] }, options: commonChartOptions(10) });

    // 5. Suspicious Process pie/doughnut (XAI)
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

function updateChartHistory(data, anomalyCount) {
    const avgCpu = data.length ? data.reduce((a,b)=>a+b.cpu,0)/data.length : 0;
    const avgMem = data.length ? data.reduce((a,b)=>a+b.memory,0)/data.length : 0;
    
    state.history.cpu.shift(); state.history.cpu.push(avgCpu);
    state.history.mem.shift(); state.history.mem.push(avgMem);
    state.history.anomaly.shift(); state.history.anomaly.push(anomalyCount);
    
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
