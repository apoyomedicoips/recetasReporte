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
        ruta = self.base_dir / "recetas2025_procesado_codificado.csv"

        cols = (
            pl.read_csv(
                ruta,
                n_rows=0,
                has_header=True,
                infer_schema_length=0,
                try_parse_dates=False,
            )
            .columns
        )

        df = pl.read_csv(
            ruta,
            has_header=True,
            dtypes={c: pl.Utf8 for c in cols},
            null_values=["", "NA", "NaN"],
            try_parse_dates=False,
        )

        df = df.with_columns(
            pl.coalesce(
                [
                    pl.col("FechaNecesidad").str.strptime(
                        pl.Date, "%d/%m/%Y", strict=False
                    ),
                    pl.col("FechaNecesidad").str.strptime(
                        pl.Date, "%m/%d/%Y", strict=False
                    ),
                ]
            ).alias("FechaNecesidad")
        )

        df = df.with_columns(
            [
                pl.col("FarmaciaVentanilla")
                .str.replace(".", "")
                .cast(pl.Int32, strict=False)
                .alias("farmacia_id"),
                pl.col("NRecetaSAP")
                .str.replace(".", "")
                .cast(pl.Int64, strict=False),
                pl.col("CédulaPaciente")
                .str.replace(".", "")
                .cast(pl.Int64, strict=False),
                pl.col("CantidadRecetada")
                .str.replace(".", "")
                .cast(pl.Int32, strict=False),
                pl.col("CantidadyaDispensada")
                .str.replace(".", "")
                .cast(pl.Int32, strict=False),
                pl.col("MedicamentoSAP")
                .str.replace(".", "")
                .cast(pl.Int32, strict=False),
                pl.col("StockenFarmaciaVentanilla")
                .str.replace(".", "")
                .cast(pl.Int32, strict=False),
                pl.col("CódigodelMédico")
                .str.replace(".", "")
                .cast(pl.Int32, strict=False)
                .alias("medico_id"),
                pl.col("Crónico").cast(pl.Int8, strict=False),
            ]
        )

        df = df.with_columns(
            [
                pl.col("FechaNecesidad").dt.year().alias("anio"),
                pl.col("FechaNecesidad").dt.month().alias("mes"),
            ]
        )

        df = df.with_columns(
            [
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
            ]
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
                    pl.col("tasa_dispensacion_linea").mean().alias(
                        "tasa_dispensacion_promedio"
                    ),
                ]
            )
            .sort(["anio", "mes"])
        )

        summary = summary.with_columns(
            [
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
                    pl.col("tasa_dispensacion_linea").mean().alias(
                        "tasa_dispensacion"
                    ),
                ]
            )
            .with_columns(
                [
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
                ]
            )
            .sort(["anio", "mes", "ranking_mes"])
        )
        return top

    def run(self) -> None:
        df = self.load_and_prepare_data()
        if df.height == 0:
            return

        summary = self.generate_monthly_summary(df)
        top_meds = self.generate_top_medicamentos(df)

        self.output_dir.mkdir(parents=True, exist_ok=True)

        resumen_path = self.output_dir / "resumen_mensual.json"
        top_path = self.output_dir / "top_medicamentos.json"

        with open(resumen_path, "w", encoding="utf-8") as f:
            json.dump(summary.to_dicts(), f, ensure_ascii=False)

        with open(top_path, "w", encoding="utf-8") as f:
            json.dump(top_meds.to_dicts(), f, ensure_ascii=False)

        metadata = {
            "generated_at": datetime.now().isoformat(),
            "total_records": int(df.height),
            "unique_patients": int(df["CédulaPaciente"].n_unique()),
            "unique_doctors": int(df["medico_id"].n_unique()),
            "unique_pharmacies": int(df["farmacia_id"].n_unique()),
            "unique_medications": int(df["MedicamentoSAP"].n_unique()),
            "date_range_start": df["FechaNecesidad"].min().isoformat()
            if df["FechaNecesidad"].min()
            else None,
            "date_range_end": df["FechaNecesidad"].max().isoformat()
            if df["FechaNecesidad"].max()
            else None,
        }

        metadata_path = self.output_dir / "metadata.json"
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, ensure_ascii=False, indent=2)

        last_update = {"last_updated": datetime.now().isoformat()}
        last_update_path = self.output_dir / "last_update.json"
        with open(last_update_path, "w", encoding="utf-8") as f:
            json.dump(last_update, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    root_dir = Path(__file__).resolve().parent.parent
    base_dir = root_dir / "data_raw"
    output_dir = root_dir / "docs" / "data"

    processor = DataProcessor(base_dir, output_dir)
    processor.run()
