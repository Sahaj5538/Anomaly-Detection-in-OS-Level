import time
import subprocess
from datetime import datetime


def run_step(step_name, script_name):
    print("\n======================================")
    print(f"{step_name} STARTED")
    print("Script:", script_name)
    print("Time:", datetime.now())
    print("======================================")

    subprocess.run(["python", script_name])

    print(f"{step_name} COMPLETED")


while True:

    print("\n\n######################################")
    print("ANALYSIS PIPELINE TRIGGERED")
    print("Time:", datetime.now())
    print("######################################")

    run_step("STEP 1: PREPROCESSING", "preprocessing.py")

    run_step("STEP 2: FEATURE EXTRACTION", "feature_extraction.py")

    run_step("STEP 3: ANOMALY DETECTION MODEL", "model.py")

    run_step("STEP 4: EXPLAINABLE AI", "explainability.py")

    print("\nANALYSIS CYCLE COMPLETED")
    print("Waiting 2 minutes for next cycle...")

    time.sleep(120)