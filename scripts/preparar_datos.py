# scripts/preparar_datos.py
# VERSIÓN 100% FUNCIONAL - LEE TUS ARCHIVOS REALES
import os
import requests
import polars as pl
from pathlib import Path
from datetime import datetime
import json

# Token desde secreto (seguro)
TOKEN = os.getenv("GH_TOKEN_DASHBOARD")
if not TOKEN:
    raise Exception("Falta el secreto GH_TOKEN_DASHBOARD")

# Repo privado con los Parquet
RAW_URL = f"https://{TOKEN}@raw.githubusercontent.com/apoyomedicoips/recteas_mensuales/main"

# Carpeta de salida
OUTPUT_DIR = Path(__file__).parent.parent / "docs" / "data"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Nombres EXACTOS como están en tu repo
MESES = {
    1: "recetas_01_enero_2025",
    2: "recetas_02_febrero_2025",
    3: "recetas_03_marz2025o_2025",
    4: "recetas_04_abril_2025",
    5: "recetas_05_mayo_2025",
    6: "recetas_06_junio_2025",
    7: "recetas_07_julio_2025",
    8: "recetas_08_agosto_2025",
    9: "recetas_09_septiembre_2025",
    10: "recetas_10_octubre_2025",
    11: "recetas_11_noviembre_2025",
    12: "recetas_12_diciembre_2025",
}

def descargar_parquet(mes: int) -> pl.DataFrame | None:
    nombre = MESES[mes]
    archivo = f"recetas_{nombre}.parquet"
    url = f"{RAW_URL}/{archivo}"
    
    print(f"Descargando {archivo}... ", end="")
    try:
        r = requests.get(url, timeout=60)
        if r.status_code == 404:
            print("No existe aún")
            return None
        r.raise_for_status()
        df = pl.read_parquet(r.content)
        print(f"OK → {len(df):,} filas")
        return df.with_columns([
            pl.lit(2025).alias("anio"),
            pl.lit(mes).alias("mes")
        ])
    except Exception as e:
        print(f"Error: {e}")
        return None

def main():
    print("IPS 2025 - Cargando datos desde repo privado...\n")
    
    dfs = []
    for mes in range(1, 13):
        df = descargar_parquet(mes)
        if df is not None:
            dfs.append(df)
    
    if not dfs:
        print("No se encontraron archivos Parquet. ¿Están subidos?")
        return
    
    print(f"\nCombinando {len(dfs)} meses...")
    df_total = pl.concat(dfs)
    print(f"Total registros: {len(df_total):,}\n")

    # === GENERAR RESUMEN MENSUAL ===
    resumen = (
        df_total.group_by(["anio", "mes"])
        .agg([
            pl.count().alias("total_lineas"),
            pl.col("NRecetaSAP").n_unique().alias("recetas_unicas"),
            pl.col("CédulaPaciente").n_unique().alias("pacientes_unicos"),
            pl.col("CódigodelMédico").n_unique().alias("medicos_unicos"),
            pl.col("CantidadRecetada").sum().alias("total_recetado"),
            pl.col("CantidadyaDispensada").sum().alias("total_dispensado"),
        ])
        .with_columns([
            (pl.col("total_recetado") - pl.col("total_dispensado")).alias("total_faltante"),
            pl.when(pl.col("total_recetado") > 0)
              .then((pl.col("total_dispensado") / pl.col("total_recetado") * 100).round(1))
              .otherwise(0)
              .alias("tasa_dispensacion_global")
        ])
        .sort("mes")
    )

    # === GUARDAR JSONS ===
    archivos = {
        "resumen_mensual.json": resumen.to_dicts(),
        "last_update.json": {"last_updated": datetime.now().isoformat()},
        "metadata.json": {
            "total_records": int(df_total.height),
            "generated_at": datetime.now().isoformat()
        }
    }

    for nombre, datos in archivos.items():
        path = OUTPUT_DIR / nombre
        with open(path, "w", encoding="utf-8") as f:
            json.dump(datos, f, ensure_ascii=False, indent=2)
        print(f"Guardado: {nombre}")

    print("\nDASHBOARD ACTUALIZADO CORRECTAMENTE!")
    print("→ https://apoyomedicoips.github.io/recetasReporte/")

if __name__ == "__main__":
    main()
