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
        df = pl.read_csv(
            self.base_dir / "recetas2025_procesado_codificado.csv",
            infer_schema_length=10000,
            try_parse_dates=True,
        )
        df = df.with_columns(
            [
                pl.col("FechaNecesidad").str.strptime(pl.Date, "%d/%m/%Y", strict=False),
                pl.col("FarmaciaVentanilla").cast(pl.Int32).alias("farmacia_id"),
                pl.col("NRecetaSAP").cast(pl.Int64),
                pl.col("CédulaPaciente").cast(pl.Int64),
                pl.col("CantidadRecetada").cast(pl.Int32),
                pl.col("CantidadyaDispensada").cast(pl.Int32),
                pl.col("MedicamentoSAP").cast(pl.Int32),
                pl.col("StockenFarmaciaVentanilla").cast(pl.Int32),
                pl.col("CódigodelMédico").cast(pl.Int32).alias("medico_id"),
            ]
        )
        df = df.with_columns(
            [
                pl.col("FechaNecesidad").dt.year().alias("anio"),
                pl.col("FechaNecesidad").dt.month().alias("mes"),
            ]
        )
        df = df.with_columns(
            (
                pl.col("CantidadRecetada") - pl.col("CantidadyaDispensada")
            ).clip(0, None).alias("faltante")
        )
        return df

    def generate_monthly_summary(self, df: pl.DataFrame) -> pl.DataFrame:
        summary = (
            df.group_by(["anio", "mes"])
            .agg(
                [
                    pl.len().alias("total_lineas"),
                    pl.col("NRecetaSAP").n_unique().alias("recetas_unicas"),
                    pl.col("CédulaPaciente").n_unique().alias("pacientes_unicos"),
                    pl.col("medico_id").n_unique().alias("medicos_unicos"),
                    pl.col("farmacia_id").n_unique().alias("farmacias_activas"),
                    pl.col("CantidadRecetada").sum().alias("total_recetado"),
                    pl.col("CantidadyaDispensada").sum().alias("total_dispensado"),
                    pl.col("faltante").sum().alias("total_faltante"),
                ]
            )
            .sort(["anio", "mes"])
        )
        summary = summary.with_columns(
            [
                (pl.col("total_dispensado") / pl.col("total_recetado")).alias("tasa_dispensacion_global"),
                (pl.col("total_faltante") / pl.col("total_recetado")).alias("tasa_faltante"),
            ]
        )
        return summary

    def generate_top_medicamentos(self, df: pl.DataFrame) -> pl.DataFrame:
        top = (
            df.group_by(["anio", "mes", "MedicamentoSAP"])
            .agg(
                [
                    pl.len().alias("lineas"),
                    pl.col("CantidadyaDispensada").sum().alias("dispensado"),
                    pl.col("CantidadRecetada").sum().alias("recetado"),
                ]
            )
            .with_columns(
                [
                    (pl.col("dispensado") / pl.col("recetado")).fill_nan(0).alias("tasa_global"),
                    pl.col("lineas").rank("dense", descending=True).over(["anio", "mes"]).alias("ranking_mes"),
                ]
            )
            .sort(["anio", "mes", "ranking_mes"])
        )
        return top

    def run(self) -> None:
        df = self.load_and_prepare_data()
        summary = self.generate_monthly_summary(df)
        top_meds = self.generate_top_medicamentos(df)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        summary.write_json(self.output_dir / "resumen_mensual.json", row_oriented=True)
        top_meds.write_json(self.output_dir / "top_medicamentos.json", row_oriented=True)
        metadata = {
            "generated_at": datetime.now().isoformat(),
            "total_records": int(df.height),
        }
        with open(self.output_dir / "metadata.json", "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)
        last_update = {"last_updated": datetime.now().isoformat()}
        with open(self.output_dir / "last_update.json", "w", encoding="utf-8") as f:
            json.dump(last_update, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    BASE_DIR = Path(r"D:\IPS_APOYO_MEDICO\monitor_recetas\base_mensuales_todos_almacenes")
    OUTPUT_DIR = Path(__file__).parent.parent / "docs" / "data"
    DataProcessor(BASE_DIR, OUTPUT_DIR).run()
