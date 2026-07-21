import os
import pandas as pd
import sqlite3

CSV_URL = "https://stibamadadosabertosprd.blob.core.windows.net/dados-abertos/dados/SINAFLOR/AutSuprVegetacao/sinaflor-autorizacao-de-supressao-de-vegetacao.csv"
DB_PATH = "artifacts/sinaflor.db"

os.makedirs("artifacts", exist_ok=True)

print("Downloading SINAFLOR ASV data...")
# 1. Use utf-8-sig to automatically strip the ï»¿ BOM prefix
df = pd.read_csv(CSV_URL, sep=";", encoding="utf-8-sig", low_memory=False)

# 2. Convert lat/lon columns to clean float numbers upfront
coord_cols = ["LATITUDE_PONTO_CENTR_EMPREEND", "LONGITUDE_PONTO_CENTR_EMPREEND"]
for col in coord_cols:
    if col in df.columns:
        df[col] = (
            df[col]
            .astype(str)
            .str.replace(",", ".", regex=False)
        )
        df[col] = pd.to_numeric(df[col], errors="coerce")

# 3. Strip trailing/leading spaces from string columns
str_cols = df.select_dtypes(include="object").columns
df[str_cols] = df[str_cols].apply(lambda x: x.str.strip() if hasattr(x, "str") else x)

print("COLUMNS:", df.columns.tolist())
print("ROW COUNT:", len(df))
print("\nSample clean data:")
print(df[["NRO_AUTORIZACAO", "LATITUDE_PONTO_CENTR_EMPREEND", "LONGITUDE_PONTO_CENTR_EMPREEND", "SITUACAO"]].head(3))

# Save clean dataframe to SQLite
conn = sqlite3.connect(DB_PATH)
df.to_sql("asv_permits", conn, if_exists="replace", index=False)

# Add spatial indices on coordinates for lightning-fast queries
cursor = conn.cursor()
cursor.execute("CREATE INDEX IF NOT EXISTS idx_coords ON asv_permits(LATITUDE_PONTO_CENTR_EMPREEND, LONGITUDE_PONTO_CENTR_EMPREEND);")
conn.close()

print(f"\nSuccessfully cleaned and loaded into {DB_PATH} with spatial indices.")

#gemni fixxed this