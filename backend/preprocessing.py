import sys
import subprocess
import pandas as pd
from datetime import datetime, timedelta

# =========================
# Ensure scikit-learn is installed
# =========================
try:
    from sklearn.preprocessing import StandardScaler
except ImportError:
    print("scikit-learn not found. Installing...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "scikit-learn"])
    from sklearn.preprocessing import StandardScaler
except ImportError:
    print("scikit-learn installed successfully.")
    print("Please re-run preprocessing.py to continue.")
    sys.exit(0)


# =========================
# Configuration
# =========================
RAW_CSV = "../data/process_data.csv"
FINAL_CSV = "../data/clean_process_data.csv"
WINDOW_MINUTES = 10
TIME_WINDOW = "10S"
CHUNK_SIZE = 10000

# =========================
# Sliding window calculation
# =========================
now = datetime.now()
window_start = now - timedelta(minutes=WINDOW_MINUTES)

print(f"Processing last {WINDOW_MINUTES} minutes of data...")

# =========================
# Read CSV in chunks
# =========================
chunks = pd.read_csv(
    RAW_CSV,
    chunksize=CHUNK_SIZE,
    parse_dates=["timestamp"]
)

recent_data = []

for chunk in chunks:
    chunk = chunk[chunk["timestamp"] >= window_start]
    if not chunk.empty:
        recent_data.append(chunk)

if not recent_data:
    print("No recent data found. Exiting.")
    sys.exit(0)

df = pd.concat(recent_data, ignore_index=True)

# =========================
# Deduplication
# =========================
df["time_window"] = df["timestamp"].dt.floor(TIME_WINDOW)

df = df.drop_duplicates(
    subset=["pid", "process_name", "time_window", "cpu_usage", "memory_usage"],
    keep="last"
)

df.drop(columns=["time_window"], inplace=True)

# =========================
# Feature selection (preprocessing only)
# =========================
numeric_features = [
    "cpu_usage",
    "cpu_std",
    "memory_usage",
    "memory_delta",
    "runtime",
    "cpu_per_second",
    "child_process_count"
]

# =========================
# Cleaning
# =========================
df[numeric_features] = df[numeric_features].fillna(0)
df = df[df["runtime"] > 0]

# =========================
# Scaling
# =========================
scaler = StandardScaler()
scaled_data = scaler.fit_transform(df[numeric_features])

df_clean = pd.DataFrame(scaled_data, columns=numeric_features)

# =========================
# Save final output
# =========================
df_clean.to_csv(FINAL_CSV, index=False)

print("Preprocessing completed successfully.")
print("Saved to:", FINAL_CSV)
print("Rows processed:", len(df_clean))
