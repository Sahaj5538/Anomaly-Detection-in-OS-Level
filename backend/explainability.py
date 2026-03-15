import pandas as pd
import sys
import subprocess

# Try importing shap
try:
    import shap
except ImportError:
    print("SHAP not found. Installing shap...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "shap"])
    import shap
import matplotlib.pyplot as plt
from sklearn.ensemble import IsolationForest
import os

# =========================
# Configuration
# =========================
INPUT_CSV = "../data/featured_process_data.csv"
RESULT_CSV = "../data/anomaly_results.csv"

CONTAMINATION = 0.05
RANDOM_STATE = 42

PLOT_DIR = "../data/shap_plots"

# Create folder for plots
os.makedirs(PLOT_DIR, exist_ok=True)

print("Loading dataset...")

df = pd.read_csv(INPUT_CSV)

print("Dataset shape:", df.shape)

# =========================
# Features
# =========================
features = df.columns.tolist()
X = df[features]

# =========================
# Train Isolation Forest
# =========================
print("Training model for SHAP explanation...")

model = IsolationForest(
    contamination=CONTAMINATION,
    random_state=RANDOM_STATE
)

model.fit(X)

# =========================
# Create SHAP Explainer
# =========================
print("Creating SHAP explainer...")

explainer = shap.TreeExplainer(model)
shap_values = explainer.shap_values(X)

# =========================
# Global Feature Importance
# =========================
print("Generating global feature importance plot...")

plt.figure()
shap.summary_plot(shap_values, X, show=False)
plt.savefig(f"{PLOT_DIR}/global_feature_importance.png")
plt.close()

print("Global SHAP plot saved.")

# =========================
# Explain Top Anomalies
# =========================

print("Detecting anomalies...")

df["anomaly_score"] = model.decision_function(X)
df["prediction"] = model.predict(X)

df["prediction"] = df["prediction"].map({
    1: "Normal",
   -1: "Anomaly"
})

anomalies = df[df["prediction"] == "Anomaly"]

print("Number of anomalies found:", len(anomalies))

# Explain first few anomalies
max_explain = min(5, len(anomalies))

for i in range(max_explain):

    index = anomalies.index[i]

    plt.figure()

    shap.force_plot(
        explainer.expected_value,
        shap_values[index],
        X.iloc[index],
        matplotlib=True,
        show=False
    )

    plt.savefig(f"{PLOT_DIR}/anomaly_explanation_{i}.png")
    plt.close()

print("Anomaly explanations saved.")

print("\nExplainability analysis completed.")