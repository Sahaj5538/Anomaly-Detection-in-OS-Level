import psutil
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import random

app = FastAPI()

# Enable CORS for the frontend to communicate with the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

WHITELIST = ["chrome.exe", "explorer.exe", "svchost.exe", "Code.exe", "System"]

@app.get("/data")
def get_telemetry():
    data = []
    processes = []
    
    # Grab live processes from the OS
    for proc in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info']):
        try:
            processes.append(proc.info)
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
            
    # Sort processes by CPU usage to highlight the active ones
    processes.sort(key=lambda x: x.get('cpu_percent', 0) or 0, reverse=True)
    
    # Select the top 30 active processes to display
    for p in processes[:30]:
        name = p.get('name', 'Unknown')
        cpu = p.get('cpu_percent', 0) or 0
        mem_mb = (p.get('memory_info').rss / (1024 * 1024)) if p.get('memory_info') else 0
        
        # Rule-based simulated analysis for live data
        risk = "Low"
        reason = "Trusted process behavior"
        action = "No action needed"
        
        if name not in WHITELIST:
            if cpu > 15 or mem_mb > 500:
                risk = "Medium"
                reason = "Elevated resource usage detected."
                action = "Monitor this process"
                if cpu > 40 or mem_mb > 1500:
                    reason = "High resource consumption detected. Requires deep analysis."
                
        data.append({
            "system_id": "Local-Node",
            "process": name,
            "pid": p.get('pid'),
            "cpu": round(float(cpu), 1),
            "memory": int(mem_mb),
            "risk_level": risk,
            "reason": reason,
            "recommended_action": action,
            "confidence": random.randint(80, 99) if risk != "Low" else None
        })
        
    return data

if __name__ == "__main__":
    import uvicorn
    # Starts server on http://127.0.0.1:8000
    uvicorn.run(app, host="127.0.0.1", port=8000)
