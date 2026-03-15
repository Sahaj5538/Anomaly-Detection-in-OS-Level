import pandas as pd
import matplotlib.pyplot as plt

INPUT_FILE = "../data/anomaly_results.csv"

df = pd.read_csv(INPUT_FILE)

# Count of predictions
counts = df["prediction"].value_counts()

plt.figure()
counts.plot(kind="bar")
plt.title("Anomaly Detection Results")
plt.ylabel("Number of Processes")
plt.xlabel("Prediction")
plt.show()