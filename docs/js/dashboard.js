class Dashboard {
    constructor() {
        this.data = {
            resumen: [],
            topMedicamentos: [],
            metadata: {},
            lastUpdate: {}
        };
        this.charts = {};
    }

    async init() {
        try {
            await this.loadData();
            this.renderKPIs();
            this.renderCharts();
            this.renderTables();
            this.updateLastUpdate();
            this.bindEvents();
        } catch (error) {
            console.error(error);
            this.showError('Error cargando datos. Verifique los archivos JSON en la carpeta data.');
        }
    }

    async loadData() {
        const basePath = "data";
        const [resumen, topMedicamentos, metadata, lastUpdate] = await Promise.all([
            this.fetchJSON(`${basePath}/resumen_mensual.json`),
            this.fetchJSON(`${basePath}/top_medicamentos.json`),
            this.fetchJSON(`${basePath}/metadata.json`),
            this.fetchJSON(`${basePath}/last_update.json`)
        ]);
        this.data.resumen = resumen || [];
        this.data.topMedicamentos = topMedicamentos || [];
        this.data.metadata = metadata || {};
        this.data.lastUpdate = lastUpdate || {};
    }

    async fetchJSON(url) {
        const resp = await fetch(url);
        if (!resp.ok) {
            throw new Error(`No se pudo cargar ${url}`);
        }
        return await resp.json();
    }

    renderKPIs() {
        if (!this.data.resumen.length) return;
        const r = this.data.resumen;

        const totalLineas = r.reduce((s, x) => s + (x.total_lineas || 0), 0);
        const totalPacientes = r.reduce((s, x) => s + (x.pacientes_unicos || 0), 0);
        const totalMedicos = r.reduce((s, x) => s + (x.medicos_unicos || 0), 0);
        const totalRecetas = r.reduce((s, x) => s + (x.recetas_unicas || 0), 0);
        const totalRecetado = r.reduce((s, x) => s + (x.total_recetado || 0), 0);
        const totalDispensado = r.reduce((s, x) => s + (x.total_dispensado || 0), 0);
        const totalFaltante = r.reduce((s, x) => s + (x.total_faltante || 0), 0);

        const tasaGlobal = totalRecetado > 0 ? (totalDispensado / totalRecetado * 100) : 0;

        document.getElementById('kpi-total').textContent = Utils.formatNumber(totalLineas);
        document.getElementById('kpi-pacientes').textContent = Utils.formatNumber(totalPacientes);
        document.getElementById('kpi-medicos').textContent = Utils.formatNumber(totalMedicos);
        document.getElementById('kpi-recetas').textContent = Utils.formatNumber(totalRecetas);
        document.getElementById('kpi-faltante').textContent = Utils.formatNumber(totalFaltante);
        document.getElementById('kpi-tasa-dispensacion').textContent = Utils.formatPercentage(tasaGlobal);

        this.updateTrends();

        if (this.data.metadata && this.data.metadata.total_records !== undefined) {
            document.getElementById('footer-total-records').textContent =
                Utils.formatNumber(this.data.metadata.total_records);
            document.getElementById('info-total-registros').textContent =
                Utils.formatNumber(this.data.metadata.total_records);
        }

        if (r.length > 0) {
            const meses = r.map(x => `${x.anio}-${String(x.mes).padStart(2, "0")}`);
            document.getElementById('info-periodo').textContent =
                `${meses[0]} a ${meses[meses.length - 1]}`;
            const maxFarmacias = Math.max(...r.map(x => x.farmacias_activas || 0));
            document.getElementById('info-farmacias').textContent = Utils.formatNumber(maxFarmacias);
        }
    }

    updateTrends() {
        const r = this.data.resumen;
        if (r.length < 2) return;
        const ultimo = r[r.length - 1];
        const penultimo = r[r.length - 2];

        const calcular = (a, b) => {
            if (!b || b === 0) return { valor: 0, icono: "fa-minus", clase: "" };
            const delta = ((a - b) / b) * 100;
            return {
                valor: Math.abs(delta).toFixed(1),
                icono: delta >= 0 ? "fa-arrow-up" : "fa-arrow-down",
                clase: delta >= 0 ? "positive" : "negative"
            };
        };

        const items = {
            "kpi-total-trend": calcular(ultimo.total_lineas, penultimo.total_lineas),
            "kpi-pacientes-trend": calcular(ultimo.pacientes_unicos, penultimo.pacientes_unicos),
            "kpi-medicos-trend": calcular(ultimo.medicos_unicos, penultimo.medicos_unicos),
            "kpi-recetas-trend": calcular(ultimo.recetas_unicas, penultimo.recetas_unicas),
            "kpi-faltante-trend": calcular(ultimo.total_faltante, penultimo.total_faltante),
            "kpi-tasa-trend": calcular(
                (ultimo.tasa_dispensacion_global || 0) * 100,
                (penultimo.tasa_dispensacion_global || 0) * 100
            )
        };

        Object.entries(items).forEach(([id, info]) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.innerHTML = `<i class="fas ${info.icono} ${info.clase}"></i>
                            <span>${info.valor}% vs mes anterior</span>`;
        });
    }

    renderCharts() {
        if (!this.data.resumen.length) return;
        Object.values(this.charts).forEach(ch => ch && ch.destroy && ch.destroy());

        const r = this.data.resumen;
        const labels = r.map(x => `${x.anio}-${String(x.mes).padStart(2, "0")}`);

        // Evolución
        const ctxEvol = document.getElementById('chart-evolucion').getContext('2d');
        this.charts.evolucion = new Chart(ctxEvol, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Líneas totales',
                    data: r.map(x => x.total_lineas || 0),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.12)',
                    borderWidth: 2,
                    tension: 0.35,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true } },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: v => Utils.formatNumber(v) }
                    }
                }
            }
        });

        // Distribución
        const ctxDist = document.getElementById('chart-distribucion-mes').getContext('2d');
        this.charts.distribucion = new Chart(ctxDist, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: r.map(x => x.total_lineas || 0),
                    backgroundColor: [
                        '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
                        '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16',
                        '#f97316', '#0ea5e9', '#a855f7', '#14b8a6'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { boxWidth: 12, font: { size: 11 } }
                    }
                }
            }
        });

        // Comparativa
        const ctxComp = document.getElementById('chart-comparativa').getContext('2d');
        this.charts.comparativa = new Chart(ctxComp, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Recetado',
                        data: r.map(x => x.total_recetado || 0)
                    },
                    {
                        label: 'Dispensado',
                        data: r.map(x => x.total_dispensado || 0)
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true } },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: v => Utils.formatNumber(v) }
                    }
                }
            }
        });
    }

    renderTables() {
        // Resumen mensual
        if (this.data.resumen.length) {
            const body = document.getElementById('tabla-resumen-body');
            body.innerHTML = "";
            this.data.resumen.forEach(x => {
                const tasa = ((x.tasa_dispensacion_global || 0) * 100).toFixed(1);
                body.insertAdjacentHTML("beforeend", `
                    <tr>
                        <td>${x.anio}-${String(x.mes).padStart(2, "0")}</td>
                        <td>${Utils.formatNumber(x.total_lineas)}</td>
                        <td>${Utils.formatNumber(x.recetas_unicas)}</td>
                        <td>${Utils.formatNumber(x.pacientes_unicos)}</td>
                        <td>${Utils.formatNumber(x.medicos_unicos)}</td>
                        <td>${Utils.formatNumber(x.total_recetado)}</td>
                        <td>${Utils.formatNumber(x.total_dispensado)}</td>
                        <td>${Utils.formatNumber(x.total_faltante)}</td>
                        <td>
                            <div class="progress">
                                <div class="progress-bar" style="width: ${tasa}%;"></div>
                            </div>
                            <small>${tasa}%</small>
                        </td>
                    </tr>
                `);
            });

            if ($.fn.DataTable.isDataTable('#tabla-resumen')) {
                $('#tabla-resumen').DataTable().clear().destroy();
            }
            $('#tabla-resumen').DataTable({
                pageLength: 10,
                responsive: true,
                language: {
                    url: "//cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json"
                }
            });
        }

        // Top medicamentos (último mes disponible)
        if (this.data.topMedicamentos.length && this.data.resumen.length) {
            const bodyM = document.getElementById('tabla-medicamentos-body');
            bodyM.innerHTML = "";

            const ult = this.data.resumen[this.data.resumen.length - 1];
            const subset = this.data.topMedicamentos
                .filter(x => x.anio === ult.anio && x.mes === ult.mes)
                .slice(0, 30);

            subset.forEach(x => {
                const faltante = (x.recetado || 0) - (x.dispensado || 0);
                const tasa = (x.recetado || 0) > 0
                    ? ((x.dispensado || 0) / x.recetado * 100).toFixed(1)
                    : "0.0";
                bodyM.insertAdjacentHTML("beforeend", `
                    <tr>
                        <td>${x.anio}-${String(x.mes).padStart(2, "0")}</td>
                        <td>${x.MedicamentoSAP}</td>
                        <td>${Utils.formatNumber(x.lineas)}</td>
                        <td>${Utils.formatNumber(x.recetado)}</td>
                        <td>${Utils.formatNumber(x.dispensado)}</td>
                        <td>${Utils.formatNumber(faltante)}</td>
                        <td>
                            <div class="progress">
                                <div class="progress-bar" style="width: ${tasa}%;"></div>
                            </div>
                            <small>${tasa}%</small>
                        </td>
                        <td>#${x.ranking_mes}</td>
                    </tr>
                `);
            });

            if ($.fn.DataTable.isDataTable('#tabla-medicamentos')) {
                $('#tabla-medicamentos').DataTable().clear().destroy();
            }
            $('#tabla-medicamentos').DataTable({
                pageLength: 10,
                responsive: true,
                language: {
                    url: "//cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json"
                }
            });
        }
    }

    updateLastUpdate() {
        if (this.data.lastUpdate && this.data.lastUpdate.last_updated) {
            const fecha = Utils.formatDate(this.data.lastUpdate.last_updated);
            document.getElementById('last-update-time').textContent = fecha;
            document.getElementById('footer-update-time').textContent = fecha;
            document.getElementById('info-ultima-actualizacion').textContent = fecha;
        }
    }

    bindEvents() {
        const refreshBtn = document.getElementById('refresh-btn');
        refreshBtn.addEventListener('click', async () => {
            const old = refreshBtn.innerHTML;
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
            refreshBtn.disabled = true;
            try {
                await this.loadData();
                this.renderKPIs();
                this.renderCharts();
                this.renderTables();
                this.updateLastUpdate();
                this.showNotification('Datos actualizados correctamente', 'success');
            } catch (e) {
                console.error(e);
                this.showNotification('Error actualizando datos', 'error');
            } finally {
                refreshBtn.innerHTML = old;
                refreshBtn.disabled = false;
            }
        });

        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        document.getElementById('help-btn').addEventListener('click', () => {
            this.showHelp();
        });

        document.querySelectorAll('.tabs-nav li').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });

        document.getElementById('chart-metric').addEventListener('change', e => {
            this.updateChartMetric(e.target.value);
        });
    }

    exportData() {
        const exportData = {
            resumen: this.data.resumen,
            topMedicamentos: this.data.topMedicamentos,
            metadata: this.data.metadata,
            exportDate: new Date().toISOString()
        };
        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ips_dashboard_export_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        this.showNotification('Datos exportados en formato JSON', 'success');
    }

    toggleTheme() {
        const body = document.body;
        const btn = document.getElementById('theme-toggle');
        const isDark = body.classList.toggle('dark-theme');
        btn.innerHTML = isDark
            ? '<i class="fas fa-sun"></i> Tema claro'
            : '<i class="fas fa-moon"></i> Tema oscuro';
    }

    switchTab(tabId) {
        document.querySelectorAll('.tabs-nav li').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tabId);
        });
        document.querySelectorAll('.tab-pane').forEach(p => {
            p.classList.toggle('active', p.id === tabId);
        });
    }

    updateChartMetric(metric) {
        if (!this.charts.evolucion) return;
        const r = this.data.resumen;
        let data, label;
        switch (metric) {
            case 'pacientes_unicos':
                data = r.map(x => x.pacientes_unicos || 0);
                label = 'Pacientes únicos';
                break;
            case 'total_dispensado':
                data = r.map(x => x.total_dispensado || 0);
                label = 'Unidades dispensadas';
                break;
            case 'total_faltante':
                data = r.map(x => x.total_faltante || 0);
                label = 'Unidades faltantes';
                break;
            default:
                data = r.map(x => x.total_lineas || 0);
                label = 'Líneas totales';
        }
        this.charts.evolucion.data.datasets[0].data = data;
        this.charts.evolucion.data.datasets[0].label = label;
        this.charts.evolucion.update();
    }

    showHelp() {
        alert(
            'IPS Analytics Dashboard\n\n' +
            'KPIs: indicadores clave de desempeño.\n' +
            'Gráficos: resumen de tendencia de líneas, recetado y dispensado.\n' +
            'Tablas: resumen mensual y top de medicamentos.\n\n' +
            'Puede cambiar la métrica principal, el tema claro/oscuro y exportar los datos.'
        );
    }

    showNotification(message, type = 'info') {
        const n = document.createElement('div');
        n.className = `notification notification-${type}`;
        n.innerHTML = `<span>${message}</span>`;
        Object.assign(n.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            color: '#ffffff',
            background: type === 'success' ? '#16a34a' : (type === 'error' ? '#dc2626' : '#3b82f6'),
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            zIndex: 9999
        });
        document.body.appendChild(n);
        setTimeout(() => {
            n.style.opacity = '0';
            setTimeout(() => n.remove(), 300);
        }, 2500);
    }

    showError(message) {
        const overlay = document.createElement('div');
        overlay.innerHTML = `
            <div class="error-content">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error</h3>
                <p>${message}</p>
                <button class="btn btn-primary" id="reload-btn">
                    <i class="fas fa-redo"></i> Reintentar
                </button>
            </div>
        `;
        Object.assign(overlay.style, {
            position: 'fixed',
            inset: '0',
            background: 'rgba(15,23,42,0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
        });
        const content = overlay.querySelector('.error-content');
        Object.assign(content.style, {
            background: '#ffffff',
            padding: '2rem',
            borderRadius: '12px',
            maxWidth: '420px',
            textAlign: 'center'
        });
        document.body.appendChild(overlay);
        document.getElementById('reload-btn').addEventListener('click', () => {
            window.location.reload();
        });
    }
}
