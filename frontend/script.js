// DOM Elements
const serverStatusDot = document.getElementById('server-status-dot');
const serverStatusText = document.getElementById('server-status-text');
const connectedClientsEl = document.getElementById('connected-clients');
const lastUpdatedTimeEl = document.getElementById('last-updated-time');

const totalProcessesEl = document.getElementById('total-processes');
const normalProcessesEl = document.getElementById('normal-processes');
const totalAnomaliesEl = document.getElementById('total-anomalies');

const tableBody = document.getElementById('process-table-body');
const xaiContent = document.getElementById('xai-content');

// Configuration
const REFRESH_INTERVAL_MS = 4000; // 4 seconds
const API_ENDPOINT = '/data';

// State
let currentData = [];
let selectedProcessId = null;

// Mock data generator for fallback if API is not available
function generateMockData() {
    const clients = ['PC1', 'PC2', 'PC3', 'SRV-01'];
    const processes = ['chrome.exe', 'svchost.exe', 'explorer.exe', 'mysql.exe', 'nginx.exe', 'node.exe', 'python.exe', 'unknown_miner.exe'];
    
    // Generate 15 to 25 processes
    const count = Math.floor(Math.random() * 11) + 15;
    const data = [];
    
    for (let i = 0; i < count; i++) {
        // 15% chance of anomaly
        const isAnomaly = Math.random() > 0.85; 
        const processName = processes[Math.floor(Math.random() * processes.length)];
        
        let reason = null;
        if (isAnomaly) {
            const reasons = ['High CPU usage', 'Unusual memory spike', 'Rare process behavior', 'High I/O pattern'];
            reason = reasons[Math.floor(Math.random() * reasons.length)];
        }
        
        data.push({
            id: `proc_${i}_${Date.now()}`,
            system_id: clients[Math.floor(Math.random() * clients.length)],
            process: processName,
            pid: Math.floor(Math.random() * 10000) + 100,
            cpu: isAnomaly ? (Math.random() * 60 + 40).toFixed(1) : (Math.random() * 10).toFixed(1),
            memory: isAnomaly ? Math.floor(Math.random() * 2000 + 500) : Math.floor(Math.random() * 200 + 50),
            anomaly: isAnomaly,
            reason: reason
        });
    }
    
    // Sort anomalies first
    return data.sort((a, b) => {
        if (a.anomaly === b.anomaly) return 0;
        return a.anomaly ? -1 : 1;
    });
}

// Fetch data from API (with fallback to mock)
async function fetchData() {
    try {
        const response = await fetch(API_ENDPOINT);
        if (!response.ok) throw new Error('Server returned ' + response.status);
        
        const data = await response.json();
        
        // Wrap in array if API returns single object
        const finalData = Array.isArray(data) ? data : [data];
        
        updateDashboard(finalData, true);
    } catch (error) {
        console.warn('API fetch failed, falling back to mock data:', error);
        const mockData = generateMockData();
        updateDashboard(mockData, false);
    }
}

// Update UI with new data
function updateDashboard(data, isOnline) {
    currentData = data;
    
    // Update Header Status
    if (isOnline) {
        serverStatusDot.className = 'status-dot online';
        serverStatusText.textContent = 'Server: Running';
    } else {
        serverStatusDot.className = 'status-dot offline';
        serverStatusText.textContent = 'Server: Offline (Mock API)';
    }
    
    // Update Time
    const now = new Date();
    lastUpdatedTimeEl.textContent = now.toLocaleTimeString();
    
    // Calculate Stats
    const total = data.length;
    const anomalies = data.filter(d => d.anomaly).length;
    const normals = total - anomalies;
    
    // Update connected clients count
    const uniqueClients = new Set(data.map(d => d.system_id)).size;
    connectedClientsEl.textContent = uniqueClients;
    
    totalProcessesEl.textContent = total;
    normalProcessesEl.textContent = normals;
    totalAnomaliesEl.textContent = anomalies;
    
    // Render Table
    renderTable(data);
    
    // Refresh XAI Panel if selected process still exists
    if (selectedProcessId) {
        const selectedProcess = data.find(d => getUniqueId(d) === selectedProcessId);
        if (selectedProcess) {
            showXAI(selectedProcessId);
        } else {
            selectedProcessId = null;
            resetXAI();
        }
    }
}

// Helper to get stable ID for a row
function getUniqueId(processItem) {
    if (processItem.id) return processItem.id;
    return `${processItem.system_id}-${processItem.pid}-${processItem.process}`;
}

// Render the process table
function renderTable(data) {
    tableBody.innerHTML = '';
    
    if (data.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No data available</td></tr>';
        return;
    }
    
    data.forEach(item => {
        const tr = document.createElement('tr');
        if (item.anomaly) tr.className = 'anomaly';
        
        const statusBadgeClasses = item.anomaly ? 'status-badge status-anomaly' : 'status-badge status-normal';
        const statusText = item.anomaly ? 'Anomaly' : 'Normal';
        const uniqueId = getUniqueId(item);
        
        tr.innerHTML = `
            <td>${item.system_id}</td>
            <td style="font-family: monospace;">${item.process}</td>
            <td>${item.pid}</td>
            <td>${item.cpu}%</td>
            <td>${item.memory} MB</td>
            <td><span class="${statusBadgeClasses}">${statusText}</span></td>
            <td>
                <button class="btn-view" onclick="showXAI('${uniqueId}')">View</button>
            </td>
        `;
        
        tableBody.appendChild(tr);
    });
}

// Show Explainable AI panel details
window.showXAI = function(uniqueId) {
    selectedProcessId = uniqueId;
    const processData = currentData.find(d => getUniqueId(d) === uniqueId);
    
    if (!processData) return;
    
    if (processData.anomaly) {
        xaiContent.innerHTML = `
            <div class="xai-detail">
                <div class="xai-item">
                    <span class="xai-label">Process Details</span>
                    <span class="xai-value" style="font-family: monospace;">${processData.process} (PID: ${processData.pid})</span>
                </div>
                <div class="xai-item">
                    <span class="xai-label">System context</span>
                    <span class="xai-value">${processData.system_id}</span>
                </div>
                <div class="xai-item">
                    <span class="xai-label">Resource Footprint</span>
                    <span class="xai-value">CPU: ${processData.cpu}% | RAM: ${processData.memory} MB</span>
                </div>
                
                <div class="xai-reason">
                    <div class="xai-item">
                        <span class="xai-label">Isolation Forest Detection Reason</span>
                        <span class="xai-value">${processData.reason || 'Anomalous behavior detected based on system telemetry.'}</span>
                    </div>
                </div>
            </div>
        `;
    } else {
        xaiContent.innerHTML = `
            <div class="xai-detail">
                <div class="xai-item">
                    <span class="xai-label">Process Details</span>
                    <span class="xai-value" style="font-family: monospace;">${processData.process} (PID: ${processData.pid})</span>
                </div>
                <div class="xai-item">
                    <span class="xai-label">System context</span>
                    <span class="xai-value">${processData.system_id}</span>
                </div>
                <div class="xai-item">
                    <span class="xai-label">Status</span>
                    <span class="xai-value" style="color: var(--normal-green);">Behavior aligns with normal baseline</span>
                </div>
            </div>
        `;
    }
}

// Reset XAI panel to placeholder
function resetXAI() {
    xaiContent.innerHTML = '<div class="placeholder-text">Select a process to view anomaly explanation.</div>';
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    fetchData();
    setInterval(fetchData, REFRESH_INTERVAL_MS);
});
