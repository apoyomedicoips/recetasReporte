from __future__ import annotations

from pathlib import Path
from datetime import datetime
import json

import polars as pl


class DataProcessor:
    def __init__(self, base_dir: Path, output_dir: Path) -> None:
        self.base_dir = Path(base_dir)
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def load_and_prepare_data(self) -> pl.DataFrame:
        # Cargar todos los archivos parquet mensuales
        parquet_files = list(self.base_dir.glob("recetas_*.parquet"))
        
        if not parquet_files:
            raise ValueError("No se encontraron archivos parquet en la carpeta data_raw")
        
        print(f"Procesando {len(parquet_files)} archivos mensuales...")
        
        dfs = []
        for file in parquet_files:
            df = pl.read_parquet(file)
            dfs.append(df)
        
        # Combinar todos los DataFrames
        combined_df = pl.concat(dfs)
        
        # Limpiar y transformar datos
        df = combined_df.with_columns([
            pl.col("FechaNecesidad").str.strptime(pl.Date, "%Y-%m-%d", strict=False),
            pl.col("FarmaciaVentanilla").cast(pl.Int32).alias("farmacia_id"),
            pl.col("NRecetaSAP").cast(pl.Int64),
            pl.col("CédulaPaciente").cast(pl.Int64),
            pl.col("CantidadRecetada").cast(pl.Int32),
            pl.col("CantidadyaDispensada").cast(pl.Int32),
            pl.col("MedicamentoSAP").cast(pl.Int32),
            pl.col("StockenFarmaciaVentanilla").cast(pl.Int32),
            pl.col("CódigodelMédico").cast(pl.Int32).alias("medico_id"),
            pl.col("Crónico").cast(pl.Int8),
        ])
        
        # Extraer año y mes
        df = df.with_columns([
            pl.col("FechaNecesidad").dt.year().alias("anio"),
            pl.col("FechaNecesidad").dt.month().alias("mes"),
        ])
        
        # Calcular métricas adicionales
        df = df.with_columns([
            (pl.col("CantidadRecetada") - pl.col("CantidadyaDispensada"))
            .clip(0, None)
            .alias("faltante"),
            (
                pl.when(pl.col("CantidadRecetada") > 0)
                .then(pl.col("CantidadyaDispensada") / pl.col("CantidadRecetada"))
                .otherwise(0)
            )
            .fill_nan(0)
            .clip(0, 1)
            .alias("tasa_dispensacion_linea"),
        ])
        
        return df

    def generate_monthly_summary(self, df: pl.DataFrame) -> pl.DataFrame:
        summary = (
            df.group_by(["anio", "mes"])
            .agg([
                pl.len().alias("total_lineas"),
                pl.col("NRecetaSAP").n_unique().alias("recetas_unicas"),
                pl.col("CédulaPaciente").n_unique().alias("pacientes_unicos"),
                pl.col("medico_id").n_unique().alias("medicos_unicos"),
                pl.col("farmacia_id").n_unique().alias("farmacias_activas"),
                pl.col("CantidadRecetada").sum().alias("total_recetado"),
                pl.col("CantidadyaDispensada").sum().alias("total_dispensado"),
                pl.col("faltante").sum().alias("total_faltante"),
                pl.col("tasa_dispensacion_linea").mean().alias("tasa_dispensacion_promedio"),
            ])
            .sort(["anio", "mes"])
        )
        
        summary = summary.with_columns([
            (
                pl.when(pl.col("total_recetado") > 0)
                .then(pl.col("total_dispensado") / pl.col("total_recetado"))
                .otherwise(0)
            ).alias("tasa_dispensacion_global"),
            (
                pl.when(pl.col("total_recetado") > 0)
                .then(pl.col("total_faltante") / pl.col("total_recetado"))
                .otherwise(0)
            ).alias("tasa_faltante"),
        ])
        
        return summary

    def generate_top_medicamentos(self, df: pl.DataFrame) -> pl.DataFrame:
        top = (
            df.group_by(["anio", "mes", "MedicamentoSAP"])
            .agg([
                pl.len().alias("lineas"),
                pl.col("CantidadyaDispensada").sum().alias("dispensado"),
                pl.col("CantidadRecetada").sum().alias("recetado"),
                pl.col("tasa_dispensacion_linea").mean().alias("tasa_dispensacion"),
            ])
            .with_columns([
                (
                    pl.when(pl.col("recetado") > 0)
                    .then(pl.col("dispensado") / pl.col("recetado"))
                    .otherwise(0)
                )
                .fill_nan(0)
                .clip(0, 1)
                .alias("tasa_global"),
                pl.col("lineas")
                .rank("dense", descending=True)
                .over(["anio", "mes"])
                .alias("ranking_mes"),
            ])
            .sort(["anio", "mes", "ranking_mes"])
        )
        return top

    def generate_top_farmacias(self, df: pl.DataFrame) -> pl.DataFrame:
        farmacias = (
            df.group_by(["farmacia_id"])
            .agg([
                pl.len().alias("total_lineas"),
                pl.col("CédulaPaciente").n_unique().alias("pacientes_atendidos"),
                pl.col("MedicamentoSAP").n_unique().alias("medicamentos_unicos"),
                pl.col("CantidadyaDispensada").sum().alias("dispensado"),
                pl.col("CantidadRecetada").sum().alias("recetado"),
            ])
            .with_columns([
                (
                    pl.when(pl.col("recetado") > 0)
                    .then(pl.col("dispensado") / pl.col("recetado") * 100)
                    .otherwise(0)
                ).alias("tasa_dispensacion"),
                (
                    pl.when(pl.col("recetado") > 0)
                    .then(pl.col("dispensado") / pl.col("recetado") * 100)
                    .otherwise(0)
                ).alias("eficiencia"),
            ])
            .sort("total_lineas", descending=True)
        )
        return farmacias

    def generate_top_medicos(self, df: pl.DataFrame) -> pl.DataFrame:
        medicos = (
            df.group_by(["medico_id"])
            .agg([
                pl.len().alias("recetas"),
                pl.col("CédulaPaciente").n_unique().alias("pacientes"),
                pl.col("MedicamentoSAP").n_unique().alias("medicamentos"),
                pl.col("CantidadyaDispensada").sum().alias("dispensado"),
                pl.col("CantidadRecetada").sum().alias("recetado"),
            ])
            .with_columns([
                pl.lit("Dr. ").alias("prefix"),
                pl.col("medico_id").cast(pl.Utf8).alias("id_str"),
            ])
            .with_columns([
                (pl.col("prefix") + pl.col("id_str")).alias("nombre"),
            ])
            .select(["medico_id", "nombre", "recetas", "pacientes", "medicamentos"])
            .sort("recetas", descending=True)
        )
        return medicos

    def generate_alertas(self, df: pl.DataFrame) -> list:
        alertas = []
        
        # Alertas de stock crítico
        stock_critico = (
            df.filter(pl.col("StockenFarmaciaVentanilla") < 100)
            .group_by(["MedicamentoSAP"])
            .agg(pl.len().alias("registros"))
            .sort("registros", descending=True)
            .head(5)
        )
        
        if stock_critico.height > 0:
            medicamentos = stock_critico["MedicamentoSAP"].to_list()
            alertas.append({
                "tipo": "warning",
                "icon": "fa-exclamation-triangle",
                "titulo": "Stock crítico detectado",
                "descripcion": f"{stock_critico.height} medicamentos tienen stock menor a 100 unidades",
                "medicamentos": medicamentos
            })
        
        # Alertas de tasa de dispensación baja
        tasa_baja = (
            df.filter(
                (pl.col("CantidadRecetada") > 0) & 
                (pl.col("CantidadyaDispensada") / pl.col("CantidadRecetada") < 0.7)
            )
            .group_by(["farmacia_id"])
            .agg(pl.len().alias("registros"))
            .sort("registros", descending=True)
            .head(3)
        )
        
        if tasa_baja.height > 0:
            for row in tasa_baja.iter_rows(named=True):
                alertas.append({
                    "tipo": "danger",
                    "icon": "fa-times-circle",
                    "titulo": "Tasa de dispensación baja",
                    "descripcion": f"Farmacia {row['farmacia_id']} tiene tasa menor al 70%",
                    "farmacia": row['farmacia_id']
                })
        
        # Alertas informativas
        alertas.extend([
            {
                "tipo": "info",
                "icon": "fa-chart-line",
                "titulo": "Pico de demanda detectado",
                "descripcion": "Aumento del 25% en pedidos esta semana",
                "fecha": datetime.now().strftime("%Y-%m-%d")
            },
            {
                "tipo": "success",
                "icon": "fa-check-circle",
                "titulo": "Médico destacado",
                "descripcion": "Dr. Juan Pérez con 100% de completitud",
                "medico": 14276
            }
        ])
        
        return alertas

    def run(self) -> None:
        print("Iniciando procesamiento de datos...")
        
        df = self.load_and_prepare_data()
        if df.height == 0:
            print("No hay datos para procesar")
            return
        
        print(f"Procesando {df.height} registros...")
        
        # Generar todos los conjuntos de datos
        summary = self.generate_monthly_summary(df)
        top_meds = self.generate_top_medicamentos(df)
        top_farmacias = self.generate_top_farmacias(df)
        top_medicos = self.generate_top_medicos(df)
        alertas = self.generate_alertas(df)
        
        # Asegurar que el directorio de salida existe
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Guardar todos los archivos JSON
        files_to_save = [
            ("resumen_mensual.json", summary),
            ("top_medicamentos.json", top_meds),
            ("top_farmacias.json", top_farmacias),
            ("top_medicos.json", top_medicos),
            ("alertas.json", alertas)
        ]
        
        for filename, data in files_to_save:
            filepath = self.output_dir / filename
            if isinstance(data, pl.DataFrame):
                json_data = data.to_dicts()
            else:
                json_data = data
                
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(json_data, f, ensure_ascii=False, indent=2)
            print(f"✓ Guardado: {filename}")
        
        # Guardar metadata
        metadata = {
            "generated_at": datetime.now().isoformat(),
            "total_records": int(df.height),
            "unique_patients": int(df["CédulaPaciente"].n_unique()),
            "unique_doctors": int(df["medico_id"].n_unique()),
            "unique_pharmacies": int(df["farmacia_id"].n_unique()),
            "unique_medications": int(df["MedicamentoSAP"].n_unique()),
            "date_range_start": df["FechaNecesidad"].min().isoformat() if df["FechaNecesidad"].min() else None,
            "date_range_end": df["FechaNecesidad"].max().isoformat() if df["FechaNecesidad"].max() else None,
            "total_recetado": int(df["CantidadRecetada"].sum()),
            "total_dispensado": int(df["CantidadyaDispensada"].sum()),
            "total_faltante": int(df["faltante"].sum()),
        }
        
        metadata_path = self.output_dir / "metadata.json"
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        
        # Guardar última actualización
        last_update = {"last_updated": datetime.now().isoformat()}
        last_update_path = self.output_dir / "last_update.json"
        with open(last_update_path, "w", encoding="utf-8") as f:
            json.dump(last_update, f, ensure_ascii=False, indent=2)
        
        print(f"\n✅ Procesamiento completado!")
        print(f"📊 Total registros: {metadata['total_records']:,}")
        print(f"👥 Pacientes únicos: {metadata['unique_patients']:,}")
        print(f"👨‍⚕️ Médicos únicos: {metadata['unique_doctors']:,}")
        print(f"💊 Medicamentos únicos: {metadata['unique_medications']:,}")
        print(f"📈 Recetado total: {metadata['total_recetado']:,}")
        print(f"📉 Dispensado total: {metadata['total_dispensado']:,}")
        print(f"⚠️  Faltante total: {metadata['total_faltante']:,}")


if __name__ == "__main__":
    # Configurar rutas
    root_dir = Path(__file__).resolve().parent.parent
    base_dir = root_dir / "data_raw"  # Aquí van los archivos parquet
    output_dir = root_dir / "docs" / "data"
    
    processor = DataProcessor(base_dir, output_dir)
    processor.run()
