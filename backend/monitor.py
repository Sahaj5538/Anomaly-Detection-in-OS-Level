import psutil
import time
import csv
import os
from datetime import datetime
from collections import defaultdict
import statistics

# =========================
# Configuration
# =========================
INTERVAL = 5  # seconds
DATA_DIR = "../data"
CSV_FILE = os.path.join(DATA_DIR, "process_data.csv")
WINDOW_SIZE = 5  # for CPU variability

os.makedirs(DATA_DIR, exist_ok=True)

# =========================
# State storage (for time-based features)
# =========================
cpu_history = defaultdict(list)
memory_history = {}
restart_tracker = defaultdict(int)

# =========================
# CSV initialization
# =========================
if not os.path.exists(CSV_FILE):
    with open(CSV_FILE, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "timestamp",
            "pid",
            "process_name",
            "parent_process",
            "cpu_usage",
            "cpu_std",
            "memory_usage",
            "memory_delta",
            "runtime",
            "cpu_per_second",
            "child_process_count"
        ])

print("✅ Real-time OS process monitoring started...\n")

# =========================
# Monitoring loop
# =========================
while True:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    for proc in psutil.process_iter():
        try:
            pid = proc.pid
            name = proc.name()
            cpu = proc.cpu_percent(interval=0.1)
            mem = proc.memory_percent()
            runtime = time.time() - proc.create_time()

            # -------- CPU variability --------
            cpu_history[pid].append(cpu)
            if len(cpu_history[pid]) > WINDOW_SIZE:
                cpu_history[pid].pop(0)

            cpu_std = (
                statistics.stdev(cpu_history[pid])
                if len(cpu_history[pid]) > 1 else 0
            )

            # -------- Memory growth --------
            prev_mem = memory_history.get(pid, mem)
            mem_delta = mem - prev_mem
            memory_history[pid] = mem

            # -------- CPU vs runtime mismatch --------
            cpu_per_second = cpu / runtime if runtime > 0 else 0

            # -------- Parent process --------
            try:
                parent = proc.parent().name()
            except Exception:
                parent = "Unknown"

            # -------- Child process count --------
            try:
                child_count = len(proc.children())
            except Exception:
                child_count = 0

            # -------- Print live output --------
            print(
                f"[{timestamp}] {name} (PID {pid}) | "
                f"CPU={cpu:.2f}% | CPU_STD={cpu_std:.2f} | "
                f"MEM={mem:.2f}% | ΔMEM={mem_delta:.2f}% | "
                f"Runtime={int(runtime)}s | "
                f"Parent={parent} | Children={child_count}"
            )

            # -------- Save to CSV --------
            with open(CSV_FILE, "a", newline="") as f:
                writer = csv.writer(f)
                writer.writerow([
                    timestamp,
                    pid,
                    name,
                    parent,
                    round(cpu, 2),
                    round(cpu_std, 2),
                    round(mem, 2),
                    round(mem_delta, 2),
                    int(runtime),
                    round(cpu_per_second, 4),
                    child_count
                ])

        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue

    print("\n--- Waiting for next cycle ---\n")
    time.sleep(INTERVAL)
