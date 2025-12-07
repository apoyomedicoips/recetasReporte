// dashboard.js
class Dashboard {
    constructor() {
        this.data = {
            resumen: [],
            topMedicamentos: [],
            topFarmacias: [],
            topMedicos: [],
            alertas: [],
            metadata: {},
            lastUpdate: {}
        };
        this.charts = {};
        this.tables = {};
        this.filters = null;
    }

    async init() {
        try {
            this.filters = new FiltersManager(this);
            await this.loadAllData();
            this.renderKPIs();
            this.renderCharts();
            this.renderTables();
            this.updateLastUpdate();
            this.bindGlobalEvents();
            console.log("Dashboard IPS 2025 inicializado correctamente");
        } catch (err) {
            console.error(err);
            this.showError("Error crítico al cargar el dashboard");
        }
    }

    async loadAllData() {
        const base = "data";
        const files = [
            "resumen_mensual.json",
            "top_medicamentos.json",
            "top_farmacias.json",
            "top_medicos.json",
            "alertas.json",
            "metadata.json",
            "last_update.json"
        ];

        const promises = files.map(file =>
            fetch(`${base}/${file}`).then(r => r.ok ? r.json() : [])
        );

        const [
            resumen, topMeds, topFarm, topMed, alertas, metadata, lastUpdate
        ] = await Promise.all(promises);

        this.data = { resumen, topMedicamentos: topMeds, topFarmacias: topFarm, topMedicos: topMed, alertas, metadata, lastUpdate };
    }

    renderKPIs() {
        const r = this.data.resumen;
        if (!r.length) return;

        const totales = r.reduce((acc, m) => ({
            lineas: acc.lineas + (m.total_lineas || 0),
            pacientes: acc.pacientes + (m.pacientes_unicos || 0),
            medicos: acc.medicos + (m.medicos_unicos || 0),
            recetado: acc.recetado + (m.total_recetado || 0),
            dispensado: acc.dispensado + (m.total_dispensado || 0),
            cronicos: acc.cronicos + (m.pacientes_cronicos || 0)
        }), { lineas: 0, pacientes: 0, medicos: 0, recetado: 0, dispensado: 0, cronicos: 0 });

        const tasa = totales.recetado > 0 ? totales.dispensado / totales.recetado : 0;

        document.getElementById('kpi-lineas').textContent = Utils.formatNumber(totales.lineas);
        document.getElementById('kpi-pacientes').textContent = Utils.formatNumber(totales.pacientes);
        document.getElementById('kpi-medicos').textContent = Utils.formatNumber(totales.medicos);
        document.getElementById('kpi-tasa').textContent = Utils.formatPercentage(tasa);
        document.getElementById('kpi-faltante').textContent = Utils.formatNumber(totales.recetado - totales.dispensado);
        document.getElementById('kpi-cronicos').textContent = totales.pacientes > 0 ?
            Math.round((totales.cronicos / totales.pacientes) * 100) + '%' : '0%';
    }

    renderCharts() {
        this.renderEvolucionChart();
        this.renderTopMedsChart();
    }

    renderEvolucionChart() {
        const ctx = document.getElementById('chart-evolucion').getContext('2d');
        const labels = this.data.resumen.map(m => `${m.anio}-${String(m.mes).padStart(2, '0')}`);

        if (this.charts.evolucion) this.charts.evolucion.destroy();

        this.charts.evolucion = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Líneas Totales',
                        data: this.data.resumen.map(m => m.total_lineas),
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'top' } }
            }
        });
    }

    renderTopMedsChart() {
        const ctx = document.getElementById('chart-top-meds').getContext('2d');
        const top10 = this.data.topMedicamentos.slice(0, 10);

        if (this.charts.topMeds) this.charts.topMeds.destroy();

        this.charts.topMeds = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: top10.map(m => m.MedicamentoSAP),
                datasets: [{
                    label: 'Dispensado',
                    data: top10.map(m => m.dispensado),
                    backgroundColor: '#10b981'
                }]
            },
            options: {
                responsive: true,
                plugins: { title: { display: true, text: 'Top 10 Medicamentos Dispensados' } }
            }
        });
    }

    renderTables() {
        this.renderTable('tabla-medicamentos', this.data.topMedicamentos);
        // Más tablas aquí...
    }

    renderTable(id, data) {
        if ($.fn.DataTable.isDataTable(`#${id}`)) {
            $(`#${id}`).DataTable().clear().destroy();
        }

        $(`#${id}`).DataTable({
            data: data.slice(0, 50),
            columns: [
            { data: 'mes', title: 'Mes' },
            { data: 'MedicamentoSAP', title: 'Código SAP' },
            { data: 'lineas', title: 'Líneas' },
            { data: 'recetado', title: 'Recetado' },
            { data: 'dispensado', title: 'Dispensado' },
            { 
                data: null, 
                title: 'Faltante',
                render: function(data, type, row) {
                    return Utils.formatNumber(row.recetado - row.dispensado);
                }
            },
            { 
                data: 'tasa_global', 
                title: 'Tasa %', 
                render: d => d ? Utils.formatPercentage(d) : '0%'
            },
            { data: 'ranking_mes', title: 'Ranking' }
        ],
            pageLength: 10,
            responsive: true,
            language: { url: "//cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json" }
        });
    }

    applyFilters(filters) {
        // Aquí aplicas los filtros a los datos y vuelves a renderizar
        console.log("Aplicando filtros:", filters);
        this.renderKPIs(); // Recalcular con filtros
        this.renderCharts();
        this.renderTables();
    }

    updateLastUpdate() {
        if (this.data.lastUpdate?.last_updated) {
            const fecha = Utils.formatDate(this.data.lastUpdate.last_updated);
            document.getElementById('last-update-time').textContent = fecha;
            document.getElementById('footer-update-time').textContent = fecha;
        }
    }

    bindGlobalEvents() {
        document.getElementById('refresh-btn').addEventListener('click', async () => {
            await this.loadAllData();
            this.renderKPIs();
            this.renderCharts();
            this.renderTables();
            this.showNotification('Datos actualizados', 'success');
        });

        document.getElementById('theme-toggle').addEventListener('click', () => {
            document.body.classList.toggle('dark-theme');
        });
    }

    showNotification(msg, type = 'info') {
        const n = Object.assign(document.createElement('div'), {
            className: `notification notification-${type}`,
            innerHTML: msg,
            style: `position:fixed;top:20px;right:20px;padding:1rem 1.5rem;background:${type==='success'?'#16a34a':type==='error'?'#dc2626':'#3b82f6'};color:white;border-radius:8px;z-index:9999;`
        });
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 3000);
    }

    showError(msg) {
        alert("Error: " + msg);
    }
}

// Iniciar cuando cargue el DOM
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
    window.dashboard.init();
});
