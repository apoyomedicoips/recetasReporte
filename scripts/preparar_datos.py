# scripts/preparar_datos.py
# VERSIÓN CORREGIDA PARA REPO PRIVADO + PUSH AUTOMÁTICO

from pathlib import Path
from datetime import datetime
import json
import polars as pl
import requests

# TU TOKEN PERSONAL (NUNCA lo compartas)
GITHUB_TOKEN = "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"  # ← REEMPLAZA AQUÍ

# Repositorio privado con los Parquet
RAW_REPO_URL = f"https://{GITHUB_TOKEN}@raw.githubusercontent.com/apoyomedicoips/recteas_mensuales/main"

OUTPUT_DIR = Path(__file__).parent.parent / "docs" / "data"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

MESES = {
    1: "01_enero_2025", 2: "02_febrero_2025", 3: "03_marzo_2025",
    4: "04_abril_2025", 5: "05_mayo_2025", 6: "06_junio_2025",
    7: "07_julio_2025", 8: "08_agosto_2025", 9: "09_septiembre_2025",
    10: "10_octubre_2025", 11: "11_noviembre_2025", 12: "12_diciembre_2025",
}

def descargar_parquet(mes: int) -> pl.DataFrame:
    nombre = MESES[mes]
    url = f"{RAW_REPO_URL}/recetas_{nombre}.parquet"
    print(f"Descargando {nombre}... ", end="")
    
    try:
        response = requests.get(url, timeout=30)
        if response.status_code == 404:
            print("No existe aún")
            return pl.DataFrame()
        response.raise_for_status()
        df = pl.read_parquet(response.content)
        print(f"OK ({len(df):,} filas)")
        return df.with_columns([pl.lit(2025).alias("anio"), pl.lit(mes).alias("mes")])
    except Exception as e:
        print(f"Error: {e}")
        return pl.DataFrame()

def main():
    print("IPS 2025 - Cargando datos desde repo privado...\n")
    
    dfs = [descargar_parquet(m) for m in range(1, 13)]
    dfs = [df for df in dfs if not df.is_empty()]
    
    if not dfs:
        print("No hay datos disponibles aún.")
        return
    
    df = pl.concat(dfs)
    df = pl.concat(dataframes)
    print(f"Total de registros: {len(df):,}\n")
    
    # === LIMPIEZA Y TRANSFORMACIÓN ===
    df = df.with_columns([
        pl.col("FechaNecesidad").str.strptime(pl.Date, format="%Y-%m-%d", strict=False),
        pl.col("FarmaciaVentanilla").cast(pl.Int32, strict=False).fill_null(0).alias("farmacia_id"),
        pl.col("CódigodelMédico").cast(pl.Int32, strict=False).fill_null(0).alias("medico_id"),
        pl.col("MedicamentoSAP").cast(pl.Int32, strict=False),
        pl.col("CantidadRecetada").cast(pl.Int32, strict=False).fill_null(0),
        pl.col("CantidadyaDispensada").cast(pl.Int32, strict=False).fill_null(0),
        pl.col("Crónico").cast(pl.Int8, strict=False).fill_null(0),
    ])
    
    df = df.with_columns([
        (pl.col("CantidadRecetada") - pl.col("CantidadyaDispensada")).clip_min(0).alias("faltante"),
        pl.when(pl.col("CantidadRecetada") > 0)
          .then(pl.col("CantidadyaDispensada") / pl.col("CantidadRecetada"))
          .otherwise(0)
          .alias("tasa_linea")
    ])

    # === RESUMEN MENSUAL ===
    resumen_mensual = (
        df.group_by(["anio", "mes"])
        .agg([
            pl.count().alias("total_lineas"),
            pl.col("NRecetaSAP").n_unique().alias("recetas_unicas"),
            pl.col("CédulaPaciente").n_unique().alias("pacientes_unicos"),
            pl.col("medico_id").n_unique().alias("medicos_unicos"),
            pl.col("farmacia_id").n_unique().alias("farmacias_activas"),
            pl.col("CantidadRecetada").sum().alias("total_recetado"),
            pl.col("CantidadyaDispensada").sum().alias("total_dispensado"),
            pl.col("faltante").sum().alias("total_faltante"),
            pl.col("Crónico").sum().alias("pacientes_cronicos"),
        ])
        .with_columns([
            pl.when(pl.col("total_recetado") > 0)
              .then(pl.col("total_dispensado") / pl.col("total_recetado"))
              .otherwise(0)
              .alias("tasa_dispensacion_global")
        ])
        .sort(["anio", "mes"])
    )

    # === TOP MEDICAMENTOS ===
    top_medicamentos = (
        df.group_by(["anio", "mes", "MedicamentoSAP"])
        .agg([
            pl.count().alias("lineas"),
            pl.col("CantidadRecetada").sum().alias("recetado"),
            pl.col("CantidadyaDispensada").sum().alias("dispensado"),
        ])
        .with_columns([
            (pl.col("recetado") - pl.col("dispensado")).alias("faltante"),
            pl.when(pl.col("recetado") > 0)
              .then(pl.col("dispensado") / pl.col("recetado"))
              .otherwise(0)
              .alias("tasa_global"),
            pl.col("lineas").rank("dense", descending=True).over(["anio", "mes"]).alias("ranking_mes")
        ])
        .sort(["anio", "mes", "ranking_mes"])
    )

    # === TOP FARMACIAS ===
    top_farmacias = (
        df.group_by("farmacia_id")
        .agg([
            pl.count().alias("total_lineas"),
            pl.col("CédulaPaciente").n_unique().alias("pacientes_atendidos"),
            pl.col("MedicamentoSAP").n_unique().alias("medicamentos_unicos"),
            pl.col("CantidadRecetada").sum().alias("recetado"),
            pl.col("CantidadyaDispensada").sum().alias("dispensado"),
        ])
        .with_columns([
            pl.when(pl.col("recetado") > 0)
              .then((pl.col("dispensado") / pl.col("recetado") * 100).round(1))
              .otherwise(0)
              .alias("tasa_dispensacion")
        ])
        .sort("total_lineas", descending=True)
    )

    # === TOP MÉDICOS ===
    top_medicos = (
        df.group_by("medico_id")
        .agg([
            pl.count().alias("recetas"),
            pl.col("CédulaPaciente").n_unique().alias("pacientes"),
            pl.col("MedicamentoSAP").n_unique().alias("medicamentos"),
        ])
        .with_columns([
            pl.format("Dr. {}", pl.col("medico_id")).alias("nombre")
        ])
        .sort("recetas", descending=True)
        .head(50)
    )

    # === ALERTAS ===
    alertas = [
        {
            "tipo": "warning",
            "icon": "fa-exclamation-triangle",
            "titulo": "Stock crítico",
            "descripcion": f"{df.filter(pl.col('StockenFarmaciaVentanilla') < 100).height} medicamentos con bajo stock"
        },
        {
            "tipo": "success",
            "icon": "fa-check-circle",
            "titulo": "Dashboard actualizado",
            "descripcion": f"Procesados {len(df):,} registros del 2025"
        }
    ]

    # === METADATA ===
    metadata = {
        "generated_at": datetime.now().isoformat(),
        "total_records": int(df.height),
        "unique_patients": int(df["CédulaPaciente"].n_unique()),
        "unique_doctors": int(df["medico_id"].n_unique()),
        "unique_pharmacies": int(df["farmacia_id"].n_unique()),
        "unique_medications": int(df["MedicamentoSAP"].n_unique()),
        "total_recetado": int(df["CantidadRecetada"].sum()),
        "total_dispensado": int(df["CantidadyaDispensada"].sum()),
        "total_faltante": int(df["faltante"].sum()),
    }

    # === GUARDAR TODO ===
    archivos = {
        "resumen_mensual.json": resumen_mensual.to_dicts(),
        "top_medicamentos.json": top_medicamentos.to_dicts(),
        "top_farmacias.json": top_farmacias.to_dicts(),
        "top_medicos.json": top_medicos.to_dicts(),
        "alertas.json": alertas,
        "metadata.json": metadata,
        "last_update.json": {"last_updated": datetime.now().isoformat()}
    }

    for nombre, datos in archivos.items():
        path = OUTPUT_DIR / nombre
        with open(path, "w", encoding="utf-8") as f:
            json.dump(datos, f, ensure_ascii=False, indent=2)
        print(f"Guardado: {nombre}")

    print("\n¡DASHBOARD ACTUALIZADO CORRECTAMENTE!")
    print(f"→ Abre: https://apoyomedicoips.github.io/recetasReporte/")

if __name__ == "__main__":
    main()
