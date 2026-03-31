import pandas as pd
from sklearn.ensemble import IsolationForest

# =========================
# Configuration
# =========================
INPUT_CSV = "../data/featured_process_data.csv"
OUTPUT_CSV = "../data/anomaly_results.csv"

CONTAMINATION = 0.02   # Reduced false positives
RANDOM_STATE = 42

# Optional whitelist (safe processes)
WHITELIST = ["chrome.exe", "Code.exe", "expler.exe"]

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

# Convert labels
df["prediction"] = df["prediction"].map({
    1: "Normal",
   -1: "Anomaly"
})

# =========================
# 🧠 Risk Scoring + Explainability
# =========================
def assign_risk(row):
    score = row["anomaly_score"]

    if row["prediction"] == "Normal":
        return "Low"

    # More negative = more abnormal
    if score < -0.2:
        return "High"
    elif score < -0.1:
        return "Medium"
    else:
        return "Low"


def generate_reason(row):
    reasons = []

    # Example logic (adjust based on your features)
    for col in features:
        value = row[col]

        # Heuristic rules (you can tune these)
        if "cpu" in col.lower() and value > 80:
            reasons.append("High CPU usage")

        if "memory" in col.lower() and value > 500:
            reasons.append("High memory usage")

        if "threads" in col.lower() and value > 50:
            reasons.append("Unusual number of threads")

    if not reasons and row["prediction"] == "Anomaly":
        reasons.append("Behavior deviates from normal patterns")

    return ", ".join(reasons)


def safe_action(row):
    if row["risk_level"] == "High":
        return "Investigate immediately"
    elif row["risk_level"] == "Medium":
        return "Monitor this process"
    else:
        return "No action needed"


# Apply logic
df["risk_level"] = df.apply(assign_risk, axis=1)
df["reason"] = df.apply(generate_reason, axis=1)
df["recommended_action"] = df.apply(safe_action, axis=1)

# =========================
# 🛡️ Whitelist Handling
# =========================
if "process_name" in df.columns:
    df.loc[df["process_name"].isin(WHITELIST), "risk_level"] = "Low"
    df.loc[df["process_name"].isin(WHITELIST), "recommended_action"] = "Trusted process"

# =========================
# Save Results
# =========================
df.to_csv(OUTPUT_CSV, index=False)

print("\n✅ Anomaly detection completed with risk analysis.")
print("Results saved to:", OUTPUT_CSV)

# =========================
# Summary
# =========================
print("\nPrediction Summary:")
print(df["prediction"].value_counts())

print("\nRisk Level Summary:")
print(df["risk_level"].value_counts())