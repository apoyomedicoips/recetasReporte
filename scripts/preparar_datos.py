# scripts/preparar_datos.py
# VERSIÓN FINAL - LEE TUS ARCHIVOS REALES DEL 2025
import os
import requests
import polars as pl
from pathlib import Path
from datetime import datetime
import json

# Token desde secreto de GitHub (seguro)
TOKEN = os.getenv("GH_TOKEN_DASHBOARD")
if not TOKEN:
    raise Exception("Configura el secreto GH_TOKEN_DASHBOARD en Settings > Secrets")

RAW_URL = f"https://{TOKEN}@raw.githubusercontent.com/apoyomedicoips/recteas_mensuales/main"
OUTPUT_DIR = Path(__file__).parent.parent / "docs" / "data"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

MESES = {
    1: "01_enero_2025", 2: "02_febrero_2025", 3: "03_marzo_2025",
    4: "04_abril_2025", 5: "05_mayo_2025", 6: "06_junio_2025",
    7: "07_julio_2025", 8: "08_agosto_2025", 9: "09_septiembre_2025",
    10: "10_octubre_2025", 11: "11_noviembre_2025", 12: "12_diciembre_2025",
}

def descargar_parquet(mes: int) -> pl.DataFrame | None:
    nombre = MESES[mes]
    archivo = f"recetas_{nombre}.parquet"
    url = f"{RAW_URL}/{archivo}"
    
    print(f"→ {archivo}... ", end="")
    try:
        r = requests.get(url, timeout=60)
        if r.status_code == 404:
            print("No existe aún")
            return None
        r.raise_for_status()
        df = pl.read_parquet(r.content)
        print(f"OK ({len(df):,} filas)")
        return df.with_columns(pl.lit(mes).alias("mes"), pl.lit(2025).alias("anio"))
    except Exception as e:
        print(f"Error: {e}")
        return None

def main():
    print("IPS 2025 - Procesando datos reales desde repo privado\n")
    
    dfs = []
    for mes in range(1, 13):
        df = descargar_parquet(mes)
        if df is not None:
            dfs.append(df)
    
    if not dfs:
        print("No hay archivos Parquet disponibles aún.")
        return
    
    df = pl.concat(dfs)
    print(f"\nTotal registros cargados: {len(df):,}\n")

    # Procesamiento real con tus columnas
    resumen = (
        df.group_by(["anio", "mes"])
        .agg([
            pl.count().alias("total_lineas"),
            pl.col("NRecetaSAP").n_unique().alias("recetas_unicas"),
            pl.col("CédulaPaciente").n_unique().alias("pacientes_unicos"),
            pl.col("CódigodelMédico").n_unique().alias("medicos_unicos"),
            pl.col("FarmaciaVentanilla").n_unique().alias("farmacias_activas"),
            pl.col("CantidadRecetada").sum().alias("total_recetado"),
            pl.col("CantidadyaDispensada").sum().alias("total_dispensado"),
            pl.col("Crónico").sum().alias("pacientes_cronicos"),
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

    # Guardar archivos clave
    archivos = {
        "resumen_mensual.json": resumen.to_dicts(),
        "last_update.json": {"last_updated": datetime.now().isoformat()},
        "metadata.json": {
            "generated_at": datetime.now().isoformat(),
            "total_records": int(df.height),
            "rango_fechas": f"{df['FechaNecesidad'].min()} a {df['FechaNecesidad'].max()}"
        }
    }

    for nombre, datos in archivos.items():
        (OUTPUT_DIR / nombre).write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"Guardado: {nombre}")

    print("\nDASHBOARD ACTUALIZADO CON DATOS REALES!")
    print("→ https://apoyomedicoips.github.io/recetasReporte/")

if __name__ == "__main__":
    main()
