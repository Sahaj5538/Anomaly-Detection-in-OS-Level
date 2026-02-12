import pandas as pd
import numpy as np

# =========================
# Configuration
# =========================
INPUT_CSV = "../data/clean_process_data.csv"
OUTPUT_CSV = "../data/featured_process_data.csv"

print("Loading cleaned data...")
df = pd.read_csv(INPUT_CSV)

print("Initial shape:", df.shape)

# =========================
# Safety helpers
# =========================
EPSILON = 1e-6  # prevents divide-by-zero

# =========================
# Feature Extraction
# =========================

# 1️⃣ CPU / Memory Ratio
df["cpu_memory_ratio"] = df["cpu_usage"] / (df["memory_usage"] + EPSILON)

# 2️⃣ CPU / Runtime Ratio
df["cpu_runtime_ratio"] = df["cpu_usage"] / (df["runtime"] + EPSILON)

# 3️⃣ Memory Growth Rate
df["memory_growth_rate"] = df["memory_delta"] / (df["runtime"] + EPSILON)

# 4️⃣ Activity Intensity (spiky + heavy CPU)
df["activity_intensity"] = df["cpu_std"] * df["cpu_usage"]

# 5️⃣ Stability Score (low variability = stable)
df["stability_score"] = 1 / (df["cpu_std"] + EPSILON)

# =========================
# Handle invalid values
# =========================
df.replace([np.inf, -np.inf], 0, inplace=True)
df.fillna(0, inplace=True)

print("Feature extraction completed.")
print("Final shape:", df.shape)

# =========================
# Save output
# =========================
df.to_csv(OUTPUT_CSV, index=False)

print("Saved featured dataset to:", OUTPUT_CSV)
