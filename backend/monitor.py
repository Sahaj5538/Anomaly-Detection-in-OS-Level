import psutil
import time
import csv
from datetime import datetime
import os

# ==============================
# Configuration
# ==============================
INTERVAL_SECONDS = 5
DATA_DIR = "../data"
CSV_FILE = os.path.join(DATA_DIR, "process_data.csv")

# ==============================
# Ensure data directory exists
# ==============================
os.makedirs(DATA_DIR, exist_ok=True)

# ==============================
# Initialize CSV file with header
# ==============================
if not os.path.exists(CSV_FILE):
    with open(CSV_FILE, mode="w", newline="") as file:
        writer = csv.writer(file)
        writer.writerow([
            "timestamp",
            "pid",
            "process_name",
            "cpu_usage",
            "memory_usage",
            "runtime_seconds"
        ])

# ==============================
# Live Monitoring Loop
# ==============================
print("Starting live OS process monitoring...\n")

while True:
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    for proc in psutil.process_iter():
        try:
            pid = proc.pid
            name = proc.name()
            cpu = proc.cpu_percent(interval=0.1)
            memory = proc.memory_percent()
            runtime = time.time() - proc.create_time()

            # Print live output
            print(
                f"[{timestamp}] "
                f"PID={pid} | "
                f"Name={name} | "
                f"CPU={cpu:.2f}% | "
                f"Memory={memory:.2f}% | "
                f"Runtime={int(runtime)}s"
            )

            # Save to CSV
            with open(CSV_FILE, mode="a", newline="") as file:
                writer = csv.writer(file)
                writer.writerow([
                    timestamp,
                    pid,
                    name,
                    cpu,
                    memory,
                    int(runtime)
                ])

        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue

    print("\n--- Waiting for next cycle ---\n")
    time.sleep(INTERVAL_SECONDS)
