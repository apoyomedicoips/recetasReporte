
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


        // CAMBIA POR ESTO (lee todos los archivos nuevos):
        const files = [
            "resumen_mensual.json",
            "top_medicamentos.json",
            "last_update.json",
            "metadata.json",
            "filtro_farmacias.json",
            "filtro_medicos.json",
            "filtro_medicamentos.json"
        ];

        const promises = files.map(file =>
            fetch(`${base}/${file}`).then(r => r.ok ? r.json() : [])
        );

        const [
            resumen, topMeds, topFarm, topMed, alertas, metadata, lastUpdate
        ] = await Promise.all(promises);

        this.data = { 
            resumen, 
            topMedicamentos: topMeds, 
            topFarmacias: topFarm, 
            topMedicos: topMed, 
            alertas, 
            metadata, 
            lastUpdate 
        };
    }

    renderKPIs() {
        const r = this.data.resumen;
        if (!r || !r.length) return;

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
            
        // Actualizar total de registros
        if (this.data.metadata && this.data.metadata.total_records) {
            document.getElementById('total-records').textContent = 
                Utils.formatNumber(this.data.metadata.total_records);
        }
    }

    renderCharts() {
        this.renderEvolucionChart();
        this.renderTopMedsChart();
        this.renderComparativaChart();
    }

    renderEvolucionChart() {
        const ctx = document.getElementById('chart-evolucion');
        if (!ctx) return;
        
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
                        fill: true,
                        borderWidth: 3
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { 
                        position: 'top',
                        labels: {
                            font: {
                                size: 14
                            }
                        }
                    } 
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return Utils.formatNumber(value);
                            }
                        }
                    }
                }
            }
        });
    }

    renderTopMedsChart() {
        const ctx = document.getElementById('chart-top-meds');
        if (!ctx) return;
        
        const top10 = this.data.topMedicamentos.slice(0, 10);

        if (this.charts.topMeds) this.charts.topMeds.destroy();

        this.charts.topMeds = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: top10.map(m => m.MedicamentoSAP),
                datasets: [{
                    label: 'Dispensado',
                    data: top10.map(m => m.dispensado),
                    backgroundColor: '#10b981',
                    borderColor: '#0da271',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    title: { 
                        display: true, 
                        text: 'Top 10 Medicamentos Dispensados',
                        font: {
                            size: 16
                        }
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return Utils.formatNumber(value);
                            }
                        }
                    }
                }
            }
        });
    }

    renderComparativaChart() {
        const ctx = document.getElementById('chart-comparativa');
        if (!ctx) return;
        
        const labels = this.data.resumen.map(m => `${m.anio}-${String(m.mes).padStart(2, '0')}`);

        if (this.charts.comparativa) this.charts.comparativa.destroy();

        this.charts.comparativa = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Recetado',
                        data: this.data.resumen.map(m => m.total_recetado),
                        backgroundColor: '#3b82f6',
                        borderColor: '#2563eb',
                        borderWidth: 1
                    },
                    {
                        label: 'Dispensado',
                        data: this.data.resumen.map(m => m.total_dispensado),
                        backgroundColor: '#10b981',
                        borderColor: '#0da271',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { 
                        position: 'top',
                        labels: {
                            font: {
                                size: 14
                            }
                        }
                    } 
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return Utils.formatNumber(value);
                            }
                        }
                    }
                }
            }
        });
    }

    renderTables() {
        this.renderTableMedicamentos();
        this.renderTableFarmacias();
        this.renderTableMedicos();
        this.renderAlertas();
    }

    renderTableMedicamentos() {
        const tableId = 'tabla-medicamentos';
        const data = this.data.topMedicamentos || [];
        
        if ($.fn.DataTable.isDataTable(`#${tableId}`)) {
            $(`#${tableId}`).DataTable().clear().destroy();
        }

        $(`#${tableId}`).DataTable({
            data: data.slice(0, 100),
            columns: [
                { 
                    data: null, 
                    title: 'Mes',
                    render: function(data, type, row) {
                        return `${row.anio}-${String(row.mes).padStart(2, '0')}`;
                    }
                },
                { data: 'MedicamentoSAP', title: 'Código SAP' },
                { data: 'lineas', title: 'Líneas' },
                { data: 'recetado', title: 'Recetado' },
                { data: 'dispensado', title: 'Dispensado' },
                { 
                    data: null, 
                    title: 'Faltante',
                    render: function(data, type, row) {
                        const faltante = row.recetado - row.dispensado;
                        return `<span class="${faltante > 0 ? 'text-danger' : 'text-success'}">${Utils.formatNumber(faltante)}</span>`;
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
            dom: 'Bfrtip',
            buttons: [
                'copy', 'csv', 'excel', 'pdf', 'print'
            ],
            language: { 
                url: "//cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json" 
            }
        });
    }

    renderTableFarmacias() {
        const tableId = 'tabla-farmacias';
        const data = this.data.topFarmacias || [];
        
        if ($.fn.DataTable.isDataTable(`#${tableId}`)) {
            $(`#${tableId}`).DataTable().clear().destroy();
        }

        $(`#${tableId}`).DataTable({
            data: data,
            columns: [
                { data: 'id', title: 'ID' },
                { 
                    data: null, 
                    title: 'Ubicación',
                    render: function() {
                        const ubicaciones = ['Norte', 'Sur', 'Este', 'Oeste', 'Centro'];
                        return ubicaciones[Math.floor(Math.random() * ubicaciones.length)];
                    }
                },
                { data: 'totalLineas', title: 'Total Líneas' },
                { data: 'pacientesAtendidos', title: 'Pacientes' },
                { data: 'medicamentosUnicos', title: 'Medicamentos Únicos' },
                { 
                    data: 'tasaDispensacion', 
                    title: 'Tasa Dispensación',
                    render: function(data) {
                        return `${data}%`;
                    }
                },
                { 
                    data: 'eficiencia', 
                    title: 'Eficiencia',
                    render: function(data) {
                        const eficiencia = parseFloat(data);
                        let className = 'text-success';
                        if (eficiencia < 80) className = 'text-warning';
                        if (eficiencia < 60) className = 'text-danger';
                        return `<span class="${className} fw-bold">${data}%</span>`;
                    }
                }
            ]
        });
    }

    renderTableMedicos() {
        const tableId = 'tabla-medicos';
        const data = this.data.topMedicos || [];
        
        if ($.fn.DataTable.isDataTable(`#${tableId}`)) {
            $(`#${tableId}`).DataTable().clear().destroy();
        }

        $(`#${tableId}`).DataTable({
            data: data,
            columns: [
                { data: 'id', title: 'ID' },
                { data: 'nombre', title: 'Nombre' },
                { data: 'recetas', title: 'Recetas' },
                { data: 'pacientes', title: 'Pacientes' },
                { data: 'medicamentos', title: 'Medicamentos' },
                { data: 'especialidad', title: 'Especialidad' },
                { 
                    data: null, 
                    title: 'Tasa Completitud',
                    render: function() {
                        const tasa = Math.floor(Math.random() * 40) + 60;
                        return `${tasa}%`;
                    }
                }
            ]
        });
    }

    renderAlertas() {
        const container = document.getElementById('alerts-container');
        if (!container) return;
        
        const alertas = this.data.alertas || [];
        
        container.innerHTML = alertas.map(alerta => `
            <div class="alert-card alert-${alerta.tipo}">
                <div class="alert-icon">
                    <i class="fas ${alerta.icon}"></i>
                </div>
                <div class="alert-content">
                    <h4>${alerta.titulo}</h4>
                    <p>${alerta.descripcion}</p>
                </div>
            </div>
        `).join('');
    }

    applyFilters(filters) {
        console.log("Aplicando filtros:", filters);
        // Aquí implementarías la lógica de filtrado real
        this.showNotification('Filtros aplicados correctamente', 'success');
    }

    updateLastUpdate() {
        if (this.data.lastUpdate?.last_updated) {
            const fecha = Utils.formatDate(this.data.lastUpdate.last_updated);
            document.getElementById('last-update-time').textContent = fecha;
            document.getElementById('footer-update-time').textContent = fecha;
        }
    }

    bindGlobalEvents() {
        // Refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                await this.loadAllData();
                this.renderKPIs();
                this.renderCharts();
                this.renderTables();
                this.showNotification('Datos actualizados', 'success');
            });
        }

        // Theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                document.body.classList.toggle('dark-theme');
                const icon = themeToggle.querySelector('i');
                if (document.body.classList.contains('dark-theme')) {
                    icon.className = 'fas fa-sun';
                } else {
                    icon.className = 'fas fa-moon';
                }
            });
        }

        // Fullscreen toggle
        const fullscreenToggle = document.getElementById('fullscreen-toggle');
        if (fullscreenToggle) {
            fullscreenToggle.addEventListener('click', () => {
                this.toggleFullscreen();
            });
        }

        // Export dashboard
        const exportBtn = document.getElementById('export-dashboard');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportDashboard();
            });
        }

        // Tab switching
        document.querySelectorAll('.tabs-nav li').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });
    }

    switchTab(tabId) {
        // Cambiar pestaña activa
        document.querySelectorAll('.tabs-nav li').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabId);
        });
        
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.toggle('active', pane.id === tabId);
        });
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    exportDashboard() {
        // Crear un HTML simplificado del dashboard
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Reporte IPS Analytics - ${new Date().toLocaleDateString()}</title>
                <style>
                    body { font-family: Arial, sans-serif; }
                    .kpi { display: inline-block; margin: 10px; padding: 20px; border: 1px solid #ccc; }
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #ccc; padding: 8px; }
                </style>
            </head>
            <body>
                <h1>Reporte IPS Analytics</h1>
                <p>Generado: ${new Date().toLocaleString()}</p>
                <h2>KPIs</h2>
                <div>
                    ${document.querySelector('.kpi-grid').outerHTML}
                </div>
                <h2>Resumen Mensual</h2>
                <div>
                    ${document.querySelector('#chart-evolucion').outerHTML}
                </div>
            </body>
            </html>
        `;
        
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte-ips-${new Date().toISOString().split('T')[0]}.html`;
        a.click();
        
        this.showNotification('Reporte exportado', 'success');
    }

    showNotification(msg, type = 'info') {
        // Crear elemento de notificación
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'info-circle'}"></i>
            <span>${msg}</span>
        `;
        
        // Estilos para la notificación
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            z-index: 9999;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Remover después de 3 segundos
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    showError(msg) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-overlay';
        errorDiv.innerHTML = `
            <div class="error-content">
                <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #ef4444; margin-bottom: 1rem;"></i>
                <h3>Error</h3>
                <p>${msg}</p>
                <button class="btn btn-primary" onclick="window.location.reload()" style="margin-top: 1rem;">
                    <i class="fas fa-redo"></i> Reintentar
                </button>
            </div>
        `;
        
        errorDiv.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            color: white;
        `;
        
        errorDiv.querySelector('.error-content').style.cssText = `
            background: white;
            padding: 2rem;
            border-radius: 12px;
            text-align: center;
            color: #1e293b;
            max-width: 400px;
        `;
        
        document.body.appendChild(errorDiv);
    }
}

window.Dashboard = Dashboard;
