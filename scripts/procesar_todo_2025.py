
# procesar_todo_2025.py - VERSIÓN FINAL FUNCIONANDO
import polars as pl
from pathlib import Path
import json
from datetime import datetime

PARQUET_DIR = Path("D:/IPS_APOYO_MEDICO/base_mensuales_todos_almacenes/recetas_por_mes_parquet")
CATALOGOS_DIR = Path("D:/IPS_APOYO_MEDICO/base_mensuales_todos_almacenes")
SALIDA_DIR = Path("D:/IPS_APOYO_MEDICO/dashboard_json")
SALIDA_DIR.mkdir(exist_ok=True)

print("IPS 2025 - GENERANDO DASHBOARD COMPLETO
")

# CARGAR CATÁLOGOS
print("Cargando catálogos...")
medicos = pl.read_csv(CATALOGOS_DIR / "recetas2025_codigosmedicos.csv", encoding="utf-8-sig")
productos = pl.read_csv(CATALOGOS_DIR / "recetas2025_codigosproductos.csv", encoding="utf-8-sig")
almacenes = pl.read_csv(CATALOGOS_DIR / "recetas2025_codigosalmacenes.csv", separator=";", encoding="utf-8-sig")

dict_medicos = dict(zip(medicos["CódigodelMédico"].cast(pl.Int64, strict=False).fill_null(0), medicos["NombredelMédico"].fill_null("Médico sin nombre")))
dict_productos = dict(zip(productos["maxcod"].cast(pl.Int64, strict=False).fill_null(0), productos["TextoBreveMedicamento"].fill_null("Sin descripción")))
dict_almacenes = dict(zip(almacenes["almacen_codigo"].cast(pl.Int32, strict=False).fill_null(0), almacenes["almacen_descripcion"].fill_null("Farmacia desconocida")))

print(f"Catálogos: {len(dict_medicos)} médicos, {len(dict_productos)} productos, {len(dict_almacenes)} farmacias
")

# CARGAR PARQUET
archivos = list(PARQUET_DIR.glob("*.parquet"))
if not archivos:
    raise FileNotFoundError("No Parquet encontrados")

dfs = []
for archivo in archivos:
    print(f"Leyendo {archivo.name}...", end=" ")
    df = pl.read_parquet(archivo)
    mes = int(archivo.stem.split("_")[1])
    df = df.with_columns([
        pl.col("CantidadRecetada").cast(pl.Int64, strict=False).fill_null(0),
        pl.col("CantidadyaDispensada").cast(pl.Int64, strict=False).fill_null(0),
        pl.col("CódigodelMédico").cast(pl.Int64, strict=False).fill_null(0),
        pl.col("CédulaPaciente").cast(pl.Int64, strict=False).fill_null(0),
        pl.col("FarmaciaVentanilla").cast(pl.Int32, strict=False).fill_null(0),
        pl.col("MedicamentoSAP").cast(pl.Int64, strict=False).fill_null(0),
        pl.col("Crónico").cast(pl.Int8, strict=False).fill_null(0),
        pl.lit(2025).alias("anio"),
        pl.lit(mes).alias("mes"),
        pl.col("CódigodelMédico").replace(dict_medicos, default="Médico sin nombre").alias("nombre_medico"),
        pl.col("MedicamentoSAP").replace(dict_productos, default="Sin descripción").alias("nombre_medicamento"),
        pl.col("FarmaciaVentanilla").replace(dict_almacenes, default="Farmacia desconocida").alias("nombre_farmacia"),
    ])
    dfs.append(df)
    print(f"OK → {len(df):,} filas")

df_total = pl.concat(dfs)
print(f"
TOTAL REGISTROS: {len(df_total):,}
")

# RESUMEN MENSUAL
resumen = (
    df_total.group_by(["anio", "mes"])
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

# TOP MEDICAMENTOS
top_medicamentos = (
    df_total.group_by(["anio", "mes", "MedicamentoSAP", "nombre_medicamento"])
    .agg([
        pl.count().alias("lineas"),
        pl.col("CantidadRecetada").sum().alias("recetado"),
        pl.col("CantidadyaDispensada").sum().alias("dispensado"),
    ])
    .with_columns([
        (pl.col("recetado") - pl.col("dispensado")).alias("faltante"),
        pl.when(pl.col("recetado") > 0)
          .then((pl.col("dispensado") / pl.col("recetado") * 100).round(1))
          .otherwise(0)
          .alias("tasa_global")
    ])
    .sort("mes", pl.col("lineas").desc())
    .with_columns([
        pl.col("lineas").rank("dense", descending=True).over("mes").alias("ranking_mes")
    ])
)

# GUARDAR
archivos = {
    "resumen_mensual.json": resumen.to_dicts(),
    "top_medicamentos.json": top_medicamentos.to_dicts(),
    "last_update.json": {"last_updated": datetime.now().isoformat()},
    "metadata.json": {
        "generated_at": datetime.now().isoformat(),
        "total_records": int(df_total.height),
        "total_farmacias": len(dict_almacenes),
        "mensaje": "Dashboard IPS 2025 - CON NOMBRES REALES"
    }
}

for nombre, datos in archivos.items():
    (SALIDA_DIR / nombre).write_text(json.dumps(datos, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Guardado: {nombre}")

# FILTROS
with open(SALIDA_DIR / "filtro_farmacias.json", "w", encoding="utf-8") as f:
    farmacias_lista = df_total.select(["FarmaciaVentanilla", "nombre_farmacia"]).unique().sort("FarmaciaVentanilla").to_dicts()
    json.dump(farmacias_lista, f, ensure_ascii=False, indent=2)

with open(SALIDA_DIR / "filtro_medicos.json", "w", encoding="utf-8") as f:
    json.dump(df_total.select(["CódigodelMédico", "nombre_medico"]).unique().to_dicts(), f, ensure_ascii=False, indent=2)

with open(SALIDA_DIR / "filtro_medicamentos.json", "w", encoding="utf-8") as f:
    json.dump(df_total.select(["MedicamentoSAP", "nombre_medicamento"]).unique().head(1000).to_dicts(), f, ensure_ascii=False, indent=2)

print(f"
¡DASHBOARD LISTO!")
print(f"Sube los archivos de: {SALIDA_DIR}")
print("→ https://github.com/apoyomedicoips/recetasReporte/tree/main/docs/data")
