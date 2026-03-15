import subprocess
import time
import signal
import sys

print("Starting OS-Level Anomaly Detection System...")

monitor_process = subprocess.Popen(["python", "monitor.py"])
print("Monitor PID:", monitor_process.pid)

analysis_process = subprocess.Popen(["python", "analysis.py"])
print("Analysis PID:", analysis_process.pid)

print("Monitor and Analysis pipeline started successfully.")
print("System is running... Press CTRL+C to stop.")

try:
    while True:
        time.sleep(1)

except KeyboardInterrupt:
    print("\nStopping system...")

    monitor_process.terminate()
    analysis_process.terminate()

    monitor_process.wait()
    analysis_process.wait()

    print("System stopped successfully.")
    sys.exit(0)