import pandas as pd
from sklearn.ensemble import IsolationForest

# =========================
# Configuration
# =========================
INPUT_CSV = "../data/featured_process_data.csv"
OUTPUT_CSV = "../data/anomaly_results.csv"

# Model parameters
CONTAMINATION = 0.05   # expected anomaly proportion (adjustable)
RANDOM_STATE = 42

print("Loading featured dataset...")
df = pd.read_csv(INPUT_CSV)

print("Dataset shape:", df.shape)

# =========================
# Model Input Features
# =========================
features = df.columns.tolist()

X = df[features]

# =========================
# Train Isolation Forest
# =========================
print("Training Isolation Forest model...")

model = IsolationForest(
    contamination=CONTAMINATION,
    random_state=RANDOM_STATE
)

model.fit(X)

# =========================
# Predictions
# =========================
print("Computing anomaly scores...")

df["anomaly_score"] = model.decision_function(X)
df["prediction"] = model.predict(X)

# Convert prediction labels
df["prediction"] = df["prediction"].map({
    1: "Normal",
   -1: "Anomaly"
})

# =========================
# Save Results
# =========================
df.to_csv(OUTPUT_CSV, index=False)

print("\n✅ Anomaly detection completed.")
print("Results saved to:", OUTPUT_CSV)

# =========================
# Quick Summary
# =========================
print("\nPrediction Summary:")
print(df["prediction"].value_counts())
