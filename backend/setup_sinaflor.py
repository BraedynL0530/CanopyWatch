import pandas as pd
import sqlite3
import os

CSV_URL = "https://stibamadadosabertosprd.blob.core.windows.net/dados-abertos/dados/SINAFLOR/AutSuprVegetacao/sinaflor-autorizacao-de-supressao-de-vegetacao.csv"
DB_PATH = "artifacts/sinaflor.db"

os.makedirs("artifacts", exist_ok=True)

print("Downloading SINAFLOR ASV data...")
df = pd.read_csv(CSV_URL, sep=";", encoding="latin-1", low_memory=False)

print("COLUMNS:", df.columns.tolist())
print("ROW COUNT:", len(df))
print(df.head(2))

conn = sqlite3.connect(DB_PATH)
df.to_sql("asv_permits", conn, if_exists="replace", index=False)
conn.close()

print(f"Loaded into {DB_PATH}")