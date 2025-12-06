# IPS Analytics Dashboard

Dashboard estático para monitoreo de recetas médicas del IPS, pensado para publicarse en GitHub Pages.

## Estructura del proyecto

- `docs/index.html` : página principal del dashboard.
- `docs/css/styles.css` : hoja de estilos.
- `docs/js/utils.js` : utilitarios JavaScript.
- `docs/js/dashboard.js` : lógica del dashboard.
- `docs/data/*.json` : datos agregados para consumo del dashboard.
- `scripts/preparar_datos.py` : script en Python (polars) para generar los JSON desde el CSV detallado.
- `data_raw/` : carpeta donde debe copiarse el archivo `recetas2025_procesado_codificado.csv`.

## Uso local

1. Copiar el CSV original dentro de la carpeta `data_raw/` con nombre `recetas2025_procesado_codificado.csv`.
2. Crear un entorno con `polars` instalado.
3. Ejecutar:

   ```bash
   python scripts/preparar_datos.py
   ```

4. Abrir en el navegador el archivo `docs/index.html`.

## Publicación en GitHub Pages

1. Subir todo el contenido del directorio `recetasReporte` a un repositorio.
2. En la configuración del repositorio, seleccionar GitHub Pages con carpeta raíz `docs/`.
3. Acceder a la URL generada por GitHub Pages.

Los archivos JSON generados son resúmenes agregados por mes y por medicamento, por lo que el tamaño total se mantiene muy por debajo de los 25 MB permitidos por GitHub.
