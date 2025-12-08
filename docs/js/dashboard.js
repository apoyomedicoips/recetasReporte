
// dashboard.js - VERSIÓN FINAL FUNCIONANDO
class Dashboard {
    constructor() {
        this.data = { resumen: [], topMedicamentos: [], metadata: {}, lastUpdate: {} };
        this.charts = {};
    }

    async init() {
        try {
            await this.loadAllData();
            this.renderKPIs();
            this.renderCharts();
            this.renderTables();
            this.updateLastUpdate();
            console.log("Dashboard IPS 2025 cargado");
        } catch (err) {
            console.error(err);
            this.showError("Error al cargar datos");
        }
    }

    async loadAllData() {
        const files = ["resumen_mensual.json", "top_medicamentos.json", "last_update.json", "metadata.json"];
        const responses = await Promise.all(files.map(file => fetch(`data/${file}`)));
        const data = await Promise.all(responses.map(r => r.ok ? r.json() : null));
        this.data.resumen = data[0] || [];
        this.data.topMedicamentos = data[1] || [];
        this.data.lastUpdate = data[2] || {};
        this.data.metadata = data[3] || {};
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

        const tasa = totales.recetado > 0 ? (totales.dispensado / totales.recetado * 100).toFixed(1) : 0;

        document.getElementById('kpi-lineas').textContent = Utils.formatNumber(totales.lineas);
        document.getElementById('kpi-pacientes').textContent = Utils.formatNumber(totales.pacientes);
        document.getElementById('kpi-medicos').textContent = Utils.formatNumber(totales.medicos);
        document.getElementById('kpi-tasa').textContent = tasa + '%';
        document.getElementById('kpi-faltante').textContent = Utils.formatNumber(totales.recetado - totales.dispensado);
        document.getElementById('kpi-cronicos').textContent = totales.pacientes > 0 ? Math.round((totales.cronicos / totales.pacientes) * 100) + '%' : '0%';
    }

    renderCharts() {
        this.renderEvolucionChart();
        this.renderTopMedsChart();
    }

    renderEvolucionChart() {
        const ctx = document.getElementById('chart-evolucion')?.getContext('2d');
        if (!ctx || !this.data.resumen.length) return;

        const labels = this.data.resumen.map(m => {
            const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
            return meses[m.mes - 1] + " 2025";
        });

        if (this.charts.evolucion) this.charts.evolucion.destroy();

        this.charts.evolucion = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Líneas de Receta',
                    data: this.data.resumen.map(m => m.total_lineas),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    renderTopMedsChart() {
        const ctx = document.getElementById('chart-top-meds')?.getContext('2d');
        if (!ctx || !this.data.topMedicamentos.length) return;

        const top10 = this.data.topMedicamentos.slice(0, 10);

        if (this.charts.topMeds) this.charts.topMeds.destroy();

        this.charts.topMeds = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: top10.map(m => m.nombre_medicamento || m.MedicamentoSAP),
                datasets: [{
                    label: 'Unidades Dispensadas',
                    data: top10.map(m => m.dispensado),
                    backgroundColor: '#10b981'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { title: { display: true, text: 'Top 10 Medicamentos' } }
            }
        });
    }

    renderTables() {
        this.renderMedicamentosTable();
    }

    renderMedicamentosTable() {
        const table = $('#tabla-medicamentos');
        if (!table.length || !this.data.topMedicamentos.length) return;

        if ($.fn.DataTable.isDataTable(table)) {
            table.DataTable().destroy();
        }

        table.DataTable({
            data: this.data.topMedicamentos,
            columns: [
                { data: "mes", title: "Mes", render: m => ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][m - 1] + " 2025" },
                { data: "nombre_medicamento", title: "Medicamento" },
                { data: "lineas", title: "Líneas", render: Utils.formatNumber },
                { data: "recetado", title: "Recetado", render: Utils.formatNumber },
                { data: "dispensado", title: "Dispensado", render: Utils.formatNumber },
                { data: null, title: "Faltante", render: row => Utils.formatNumber(row.recetado - row.dispensado) },
                { data: "tasa_global", title: "Tasa %", render: d => d ? d.toFixed(1) + "%" : "0%" },
                { data: "ranking_mes", title: "Ranking", render: d => `#${d}` }
            ],
            pageLength: 25,
            responsive: true,
            order: [[0, 'desc'], [6, 'desc']],
            language: { url: "https://cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json" }
        });
    }

    updateLastUpdate() {
        const fecha = this.data.lastUpdate?.last_updated 
            ? new Date(this.data.lastUpdate.last_updated).toLocaleString('es-PY')
            : "No disponible";
        document.getElementById('last-update-time').textContent = fecha;
    }

    bindEvents() {
        document.getElementById('refresh-btn')?.addEventListener('click', () => this.init());
        document.getElementById('theme-toggle')?.addEventListener('click', () => document.body.classList.toggle('dark-theme'));
    }

    showNotification(msg, type = 'info') {
        const n = document.createElement('div');
        n.className = `notification notification-${type}`;
        n.innerHTML = `<i class="fas fa-info-circle"></i> ${msg}`;
        n.style.cssText = `position: fixed; top: 20px; right: 20px; padding: 1rem 1.5rem; background: ${type === 'success' ? '#10b981' : '#3b82f6'}; color: white; border-radius: 8px; z-index: 9999;`;
        document.body.appendChild(n);
        setTimeout(() => n.remove(), 3000);
    }

    showError(msg) {
        alert("Error: " + msg);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new Dashboard();
    window.dashboard.init();
});
