// Premium Dashboard Logic

// DOM Elements
const landingPage = document.getElementById('landing-page');
const dashboardLayout = document.getElementById('dashboard-layout');
const loadingOverlay = document.getElementById('loading-overlay');
const btnStart = document.getElementById('btn-start-analysis');
const btnStop = document.getElementById('btn-stop-analysis');

const tableBody = document.getElementById('process-table-body');
const xaiContent = document.getElementById('xai-content');
const criticalAlert = document.getElementById('critical-alert');
const alertMessage = document.getElementById('alert-message');

const globalStatusDot = document.querySelector('#global-server-status .pulsing-dot');
const serverStatusText = document.getElementById('server-status-text');

// State
let isAnalyzing = false;
let updateInterval = null;
let currentData = [];
let cpuChartRef = null;
let anomalyChartRef = null;
let xaiChartRef = null;

let cpuHistory = Array(15).fill(0);
let anomalyHistory = Array(15).fill(0);

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    // Add event listeners immediately
    if (btnStart) {
        btnStart.addEventListener('click', () => {
            console.log("Start button clicked");
            landingPage.classList.add('hidden');
            loadingOverlay.classList.remove('hidden');

            // Wait for DOM to hide landing page and show loader
            setTimeout(() => {
                loadingOverlay.classList.add('hidden');
                dashboardLayout.classList.remove('hidden');

                // Initialize charts AFTER dashboard is visible to prevent sizing bugs
                if (!cpuChartRef) {
                    try {
                        initCharts();
                    } catch (e) {
                        console.error("Failed to initialize charts:", e);
                    }
                }

                startAnalysis();
            }, 1000);
        });
    } else {
        console.error("Could not find btn-start-analysis in DOM");
    }

    if (btnStop) {
        btnStop.addEventListener('click', () => {
            if (isAnalyzing) stopAnalysis();
            else startAnalysis();
        });
    }
});

function initCharts() {
    Chart.defaults.color = '#94A3B8';
    Chart.defaults.font.family = 'Inter';

    // 1. CPU Trend Line Chart
    const ctxCpu = document.getElementById('cpuChart').getContext('2d');
    const gradientCpu = ctxCpu.createLinearGradient(0, 0, 0, 400);
    gradientCpu.addColorStop(0, 'rgba(99, 102, 241, 0.5)');
    gradientCpu.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    cpuChartRef = new Chart(ctxCpu, {
        type: 'line',
        data: {
            labels: Array(15).fill(''),
            datasets: [{
                label: 'Avg CPU %',
                data: cpuHistory,
                borderColor: '#6366F1',
                backgroundColor: gradientCpu,
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            },
            animation: { duration: 0 }
        }
    });

    // 2. Anomaly Trend Bar Chart
    const ctxAnomaly = document.getElementById('anomalyChart').getContext('2d');
    anomalyChartRef = new Chart(ctxAnomaly, {
        type: 'bar',
        data: {
            labels: Array(15).fill(''),
            datasets: [{
                label: 'Anomalies',
                data: anomalyHistory,
                backgroundColor: '#EF4444',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, suggestedMax: 10, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            },
            animation: { duration: 0 }
        }
    });
}

function startAnalysis() {
    isAnalyzing = true;
    btnStop.innerHTML = '<i class="fa-solid fa-stop"></i> Stop Analysis';
    btnStop.style.color = 'var(--danger-red)';
    btnStop.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    btnStop.style.background = 'transparent';

    globalStatusDot.className = 'pulsing-dot online';
    serverStatusText.textContent = 'Server Online';

    fetchData(); // run immediately
    updateInterval = setInterval(fetchData, 3000);
}

function stopAnalysis() {
    isAnalyzing = false;
    clearInterval(updateInterval);

    btnStop.innerHTML = '<i class="fa-solid fa-play"></i> Resume Analysis';
    btnStop.style.color = 'white';
    btnStop.style.borderColor = 'transparent';
    btnStop.style.background = 'linear-gradient(135deg, var(--primary-indigo), #818CF8)';

    globalStatusDot.className = 'pulsing-dot offline';
    serverStatusText.textContent = 'Server Offline (Paused)';
}

// Generate Realistic Mock Telemetry Data
function generateData() {
    const clients = ['SYS-Alpha', 'SYS-Beta', 'SYS-Gamma', 'SRV-Core'];
    const processes = ['chrome.exe', 'explorer.exe', 'svchost.exe', 'postgres.exe', 'node.exe', 'docker-desktop.exe'];
    const anomalyProcs = ['unknown_miner.exe', 'powershell.exe', 'bash', 'nc.exe'];

    const count = 15 + Math.floor(Math.random() * 10);
    const data = [];
    let hasCritical = false;

    for (let i = 0; i < count; i++) {
        const isAnomaly = Math.random() > 0.85;
        let procName, reason, cpu, ram, confidence;

        if (isAnomaly) {
            procName = Math.random() > 0.6 ? anomalyProcs[Math.floor(Math.random() * anomalyProcs.length)] : processes[Math.floor(Math.random() * processes.length)];

            const reasonsList = [
                'High CPU usage + abnormal memory spike detected',
                'Rare process execution pattern (Isolation Forest score > threshold)',
                'Unusual network I/O combined with payload execution'
            ];
            reason = reasonsList[Math.floor(Math.random() * reasonsList.length)];
            cpu = (50 + Math.random() * 49).toFixed(1);
            ram = Math.floor(800 + Math.random() * 2000);
            confidence = (85 + Math.random() * 14).toFixed(1);

            if (procName === 'unknown_miner.exe') hasCritical = true;
        } else {
            procName = processes[Math.floor(Math.random() * processes.length)];
            cpu = (1 + Math.random() * 15).toFixed(1);
            ram = Math.floor(50 + Math.random() * 300);
            confidence = null;
            reason = null;
        }

        data.push({
            id: `p_${Date.now()}_${i}`,
            system_id: clients[Math.floor(Math.random() * clients.length)],
            process: procName,
            pid: 1000 + Math.floor(Math.random() * 8000),
            cpu: parseFloat(cpu),
            memory: ram,
            anomaly: isAnomaly,
            reason,
            confidence
        });
    }

    return { data, hasCritical };
}

async function fetchData() {
    // Attempt real API if available, else mock
    let payload;
    try {
        const res = await fetch('/data');
        if (!res.ok) throw new Error();
        const json = await res.json();
        payload = { data: Array.isArray(json) ? json : [json], hasCritical: false };
        // Check for critical in real data simply
        payload.hasCritical = payload.data.some(d => d.process.includes('miner'));
    } catch {
        payload = generateData();
    }

    updateUI(payload.data, payload.hasCritical);
}

function updateUI(data, hasCritical) {
    currentData = data.sort((a, b) => b.anomaly === a.anomaly ? b.cpu - a.cpu : (a.anomaly ? -1 : 1));

    // Top Bar updates
    document.getElementById('last-updated-time').textContent = new Date().toLocaleTimeString();
    document.getElementById('connected-clients').textContent = new Set(data.map(d => d.system_id)).size;

    // Cards
    const total = data.length;
    const anomalies = data.filter(d => d.anomaly).length;

    document.getElementById('total-processes').textContent = total;
    document.getElementById('normal-processes').textContent = total - anomalies;
    document.getElementById('total-anomalies').textContent = anomalies;

    // Alert System
    if (hasCritical) {
        criticalAlert.classList.remove('hidden');
        alertMessage.textContent = "High severity threat (crypto-miner signature) detected across endpoints.";
    } else {
        criticalAlert.classList.add('hidden');
    }

    // Charts update
    const avgCpu = (data.reduce((acc, d) => acc + d.cpu, 0) / total).toFixed(1);
    cpuHistory.shift(); cpuHistory.push(parseFloat(avgCpu));
    cpuChartRef.update();

    anomalyHistory.shift(); anomalyHistory.push(anomalies);
    anomalyChartRef.update();

    // Table update
    renderTable();
}

function renderTable() {
    tableBody.innerHTML = '';

    currentData.forEach(item => {
        const tr = document.createElement('tr');
        if (item.anomaly) tr.className = 'is-anomaly';

        const procIcon = item.anomaly ? '<i class="fa-solid fa-virus" style="color:var(--danger-red); margin-right:8px;"></i>' : '<i class="fa-solid fa-microchip" style="color:var(--text-muted); margin-right:8px;"></i>';

        const statusHTML = item.anomaly
            ? `<span class="status status-danger"><span class="pulsing-dot offline" style="margin-right: 4px;"></span> Anomaly</span>`
            : `<span class="status status-ok"><span class="pulsing-dot online" style="margin-right: 4px;"></span> Normal</span>`;

        tr.innerHTML = `
            <td><i class="fa-solid fa-server" style="color: #6366F1; margin-right: 6px;"></i> ${item.system_id}</td>
            <td style="font-family:monospace; font-weight:600; color: #fff;">${procIcon} ${item.process}</td>
            <td style="color: var(--text-muted)">${item.pid}</td>
            <td><strong>${item.cpu}%</strong></td>
            <td>${item.memory} MB</td>
            <td>${statusHTML}</td>
            <td><button class="btn-action" onclick="viewXAI('${item.id}', this)">Explain</button></td>
        `;
        tableBody.appendChild(tr);
    });
}

window.viewXAI = function (id, btnElement) {
    document.querySelectorAll('.btn-action').forEach(b => b.classList.remove('active'));
    if (btnElement) btnElement.classList.add('active');

    const proc = currentData.find(d => d.id === id);
    if (!proc) return;

    if (!proc.anomaly) {
        xaiContent.innerHTML = `
            <div class="empty-state" style="padding: 20px;">
                <i class="fa-solid fa-check-circle" style="color: var(--success-green); opacity: 1; font-size: 32px;"></i>
                <h3 style="color:white; margin: 10px 0;">Normal Process Behavior</h3>
                <p>Telemetry for ${proc.process} is well within acceptable baseline parameters.</p>
            </div>
        `;
        return;
    }

    // AI Feature Importance mock data
    const features = ['CPU Usage', 'Memory Alloc', 'Thread Count', 'I/O Rate', 'Syscalls'];
    const importance = [
        proc.cpu > 70 ? 85 : 40,
        proc.memory > 1000 ? 75 : 30,
        Math.floor(Math.random() * 60 + 20),
        Math.floor(Math.random() * 80 + 10),
        Math.floor(Math.random() * 50 + 10)
    ];

    xaiContent.innerHTML = `
        <div class="xai-details">
            <div class="reason-box">
                <h4><i class="fa-solid fa-triangle-exclamation"></i> Model Detection Reasoning</h4>
                <p>${proc.reason}</p>
            </div>
            
            <div class="xai-meta">
                <div class="meta-box">
                    <div class="meta-label">Process Details</div>
                    <div class="meta-val">${proc.process} <br><span style="font-size: 12px; color: var(--text-muted); font-weight: 400;">PID: ${proc.pid}</span></div>
                </div>
                <div class="meta-box">
                    <div class="meta-label">Confidence Score</div>
                    <div class="meta-val text-danger">${proc.confidence}%</div>
                    <div class="meter-bg"><div class="meter-fill" style="width: ${proc.confidence}%"></div></div>
                </div>
            </div>
            
            <div style="margin-top: 10px;">
                <h4 style="font-size: 13px; color: var(--text-muted); text-transform: uppercase;">Isolation Forest Feature Contributions</h4>
                <div class="feature-chart-container">
                    <canvas id="xaiChart"></canvas>
                </div>
            </div>
        </div>
    `;

    // Render Feature Chart
    setTimeout(() => {
        const ctx = document.getElementById('xaiChart').getContext('2d');
        if (xaiChartRef) xaiChartRef.destroy();
        xaiChartRef = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: features,
                datasets: [{
                    label: 'Anomaly Contribution %',
                    data: importance,
                    backgroundColor: importance.map(val => val > 70 ? '#EF4444' : (val > 40 ? '#F59E0B' : '#6366F1')),
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: { max: 100, border: { display: false }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { border: { display: false }, grid: { display: false } }
                }
            }
        });
    }, 50);
}
