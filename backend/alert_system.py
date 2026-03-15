import pandas as pd

df = pd.read_csv("../data/anomaly_results.csv")

anomalies = df[df["prediction"] == "Anomaly"]

if len(anomalies) > 0:
    print("⚠ ALERT: Anomalous processes detected!")
    print(anomalies.head())
else:
    print("System behavior normal.")