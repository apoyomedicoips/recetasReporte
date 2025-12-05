class Dashboard {
    constructor() {
        this.data = {
            resumen: [],
            topMedicamentos: [],
            metadata: {},
            lastUpdate: {}
        };
        
        this.charts = {};
        this.init();
    }

    async init() {
        console.log('Iniciando dashboard...');
        
        try {
            // Cargar datos
            await this.loadData();
            
            // Inicializar componentes
            this.renderKPIs();
            this.renderCharts();
            this.renderTables();
            this.updateLastUpdate();
            
            // Configurar eventos
            this.bindEvents();
            
            console.log('Dashboard inicializado correctamente');
        } catch (error) {
            console.error('Error inicializando dashboard:', error);
            this.showError('Error cargando datos. Verifica la consola para más detalles.');
        }
    }

    async loadData() {
        console.log('Cargando datos...');
        
        try {
            // Usar rutas relativas para GitHub Pages
            const basePath = window.location.hostname === 'localhost' 
                ? './data' 
                : '/recetasReporte/data';
            
            console.log('Base path:', basePath);
            
            // Cargar todos los datos en paralelo
            const [resumen, topMedicamentos, metadata, lastUpdate] = await Promise.all([
                this.fetchJSON(`${basePath}/resumen_mensual.json`),
                this.fetchJSON(`${basePath}/top_medicamentos.json`),
                this.fetchJSON(`${basePath}/metadata.json`),
                this.fetchJSON(`${basePath}/last_update.json`)
            ]);
            
            console.log('Datos cargados:', {
                resumen: resumen.length,
                topMedicamentos: topMedicamentos.length,
                metadata,
                lastUpdate
            });
            
            this.data.resumen = resumen;
            this.data.topMedicamentos = topMedicamentos;
            this.data.metadata = metadata;
            this.data.lastUpdate = lastUpdate;
            
        } catch (error) {
            console.error('Error cargando archivos JSON:', error);
            throw error;
        }
    }

    async fetchJSON(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Error cargando ${url}: ${response.status}`);
        }
        return await response.json();
    }

    renderKPIs() {
        console.log('Renderizando KPIs...');
        
        if (!this.data.resumen || this.data.resumen.length === 0) {
            console.warn('No hay datos de resumen para renderizar KPIs');
            return;
        }

        const resumen = this.data.resumen;
        
        // Calcular totales
        const totalLineas = resumen.reduce((sum, r) => sum + r.total_lineas, 0);
        const totalPacientes = resumen.reduce((sum, r) => sum + r.pacientes_unicos, 0);
        const totalMedicos = resumen.reduce((sum, r) => sum + r.medicos_unicos, 0);
        const totalRecetas = resumen.reduce((sum, r) => sum + r.recetas_unicas, 0);
        const totalRecetado = resumen.reduce((sum, r) => sum + r.total_recetado, 0);
        const totalDispensado = resumen.reduce((sum, r) => sum + r.total_dispensado, 0);
        const totalFaltante = resumen.reduce((sum, r) => sum + r.total_faltante, 0);
        
        // Calcular tasas
        const tasaDispensacionGlobal = totalRecetado > 0 
            ? (totalDispensado / totalRecetado * 100).toFixed(1) 
            : 0;
        
        // Actualizar elementos del DOM
        document.getElementById('kpi-total').textContent = totalLineas.toLocaleString();
        document.getElementById('kpi-pacientes').textContent = totalPacientes.toLocaleString();
        document.getElementById('kpi-medicos').textContent = totalMedicos.toLocaleString();
        document.getElementById('kpi-tasa-dispensacion').textContent = `${tasaDispensacionGlobal}%`;
        document.getElementById('kpi-recetas').textContent = totalRecetas.toLocaleString();
        document.getElementById('kpi-faltante').textContent = totalFaltante.toLocaleString();
        
        // Actualizar tendencias
        this.updateTrends();
        
        // Actualizar información del footer
        if (this.data.metadata) {
            document.getElementById('footer-total-records').textContent = 
                this.data.metadata.total_records.toLocaleString();
            document.getElementById('info-total-registros').textContent = 
                this.data.metadata.total_records.toLocaleString();
        }
        
        // Calcular período cubierto
        if (resumen.length > 0) {
            const meses = resumen.map(r => `${r.anio}-${String(r.mes).padStart(2, '0')}`);
            const periodo = `${meses[0]} a ${meses[meses.length - 1]}`;
            document.getElementById('info-periodo').textContent = periodo;
            
            // Calcular farmacias activas (máximo histórico)
            const maxFarmacias = Math.max(...resumen.map(r => r.farmacias_activas));
            document.getElementById('info-farmacias').textContent = maxFarmacias;
        }
    }

    updateTrends() {
        const resumen = this.data.resumen;
        if (resumen.length < 2) return;
        
        const ultimo = resumen[resumen.length - 1];
        const penultimo = resumen[resumen.length - 2];
        
        // Función para calcular tendencia
        const calcularTendencia = (actual, anterior) => {
            if (anterior === 0) return { porcentaje: 100, icono: 'fa-arrow-up', clase: 'positive' };
            const cambio = ((actual - anterior) / anterior * 100).toFixed(1);
            return {
                porcentaje: Math.abs(cambio),
                icono: cambio >= 0 ? 'fa-arrow-up' : 'fa-arrow-down',
                clase: cambio >= 0 ? 'positive' : 'negative'
            };
        };
        
        // Actualizar cada KPI con su tendencia
        const tendencias = {
            'kpi-total-trend': calcularTendencia(ultimo.total_lineas, penultimo.total_lineas),
            'kpi-pacientes-trend': calcularTendencia(ultimo.pacientes_unicos, penultimo.pacientes_unicos),
            'kpi-medicos-trend': calcularTendencia(ultimo.medicos_unicos, penultimo.medicos_unicos),
            'kpi-tasa-trend': calcularTendencia(ultimo.tasa_dispensacion_global * 100, penultimo.tasa_dispensacion_global * 100),
            'kpi-recetas-trend': calcularTendencia(ultimo.recetas_unicas, penultimo.recetas_unicas),
            'kpi-faltante-trend': calcularTendencia(ultimo.total_faltante, penultimo.total_faltante)
        };
        
        for (const [id, tendencia] of Object.entries(tendencias)) {
            const element = document.getElementById(id);
            if (element) {
                element.innerHTML = `
                    <i class="fas ${tendencia.icono} ${tendencia.clase}"></i>
                    <span>${tendencia.porcentaje}% vs mes anterior</span>
                `;
            }
        }
    }

    renderCharts() {
        console.log('Renderizando gráficos...');
        
        if (!this.data.resumen || this.data.resumen.length === 0) {
            console.warn('No hay datos para renderizar gráficos');
            return;
        }

        // Destruir gráficos existentes
        Object.values(this.charts).forEach(chart => {
            if (chart && chart.destroy) chart.destroy();
        });

        const resumen = this.data.resumen;
        const labels = resumen.map(r => `${r.anio}-${String(r.mes).padStart(2, '0')}`);
        
        // 1. Gráfico de evolución
        const ctxEvolucion = document.getElementById('chart-evolucion').getContext('2d');
        this.charts.evolucion = new Chart(ctxEvolucion, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Líneas Totales',
                    data: resumen.map(r => r.total_lineas),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Cantidad'
                        }
                    }
                }
            }
        });

        // 2. Gráfico de distribución por mes
        const ctxDistribucion = document.getElementById('chart-distribucion-mes').getContext('2d');
        this.charts.distribucion = new Chart(ctxDistribucion, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: resumen.map(r => r.total_lineas),
                    backgroundColor: [
                        '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
                        '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#0ea5e9',
                        '#a855f7', '#14b8a6'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            font: { size: 11 }
                        }
                    }
                }
            }
        });

        // 3. Gráfico comparativo
        const ctxComparativa = document.getElementById('chart-comparativa').getContext('2d');
        this.charts.comparativa = new Chart(ctxComparativa, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Recetado',
                        data: resumen.map(r => r.total_recetado),
                        backgroundColor: '#3b82f6',
                        borderColor: '#1d4ed8',
                        borderWidth: 1
                    },
                    {
                        label: 'Dispensado',
                        data: resumen.map(r => r.total_dispensado),
                        backgroundColor: '#10b981',
                        borderColor: '#047857',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: true }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Unidades'
                        }
                    }
                }
            }
        });
    }

    renderTables() {
        console.log('Renderizando tablas...');
        
        // Tabla de resumen mensual
        if (this.data.resumen && this.data.resumen.length > 0) {
            const tablaResumenBody = document.getElementById('tabla-resumen-body');
            tablaResumenBody.innerHTML = '';
            
            this.data.resumen.forEach(item => {
                const tasa = (item.tasa_dispensacion_global * 100).toFixed(1);
                const row = `
                    <tr>
                        <td>${item.anio}-${String(item.mes).padStart(2, '0')}</td>
                        <td>${item.total_lineas.toLocaleString()}</td>
                        <td>${item.recetas_unicas.toLocaleString()}</td>
                        <td>${item.pacientes_unicos.toLocaleString()}</td>
                        <td>${item.medicos_unicos.toLocaleString()}</td>
                        <td>${item.total_recetado.toLocaleString()}</td>
                        <td>${item.total_dispensado.toLocaleString()}</td>
                        <td>${item.total_faltante.toLocaleString()}</td>
                        <td>
                            <div class="progress">
                                <div class="progress-bar" style="width: ${tasa}%"></div>
                            </div>
                            <small>${tasa}%</small>
                        </td>
                    </tr>
                `;
                tablaResumenBody.innerHTML += row;
            });
            
            // Inicializar DataTable
            $('#tabla-resumen').DataTable({
                pageLength: 10,
                responsive: true,
                language: {
                    url: '//cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json'
                }
            });
        }

        // Tabla de medicamentos (top 20)
        if (this.data.topMedicamentos && this.data.topMedicamentos.length > 0) {
            const tablaMedsBody = document.getElementById('tabla-medicamentos-body');
            tablaMedsBody.innerHTML = '';
            
            // Filtrar para el último mes y tomar top 20
            const ultimoMes = this.data.topMedicamentos
                .filter(item => item.anio === 2025 && item.mes === 12)
                .slice(0, 20);
            
            ultimoMes.forEach(item => {
                const faltante = item.recetado - item.dispensado;
                const tasa = ((item.dispensado / item.recetado) * 100).toFixed(1);
                
                const row = `
                    <tr>
                        <td>${item.anio}-${String(item.mes).padStart(2, '0')}</td>
                        <td>${item.MedicamentoSAP}</td>
                        <td>${item.lineas.toLocaleString()}</td>
                        <td>${item.recetado.toLocaleString()}</td>
                        <td>${item.dispensado.toLocaleString()}</td>
                        <td>${faltante.toLocaleString()}</td>
                        <td>
                            <div class="progress">
                                <div class="progress-bar" style="width: ${tasa}%"></div>
                            </div>
                            <small>${tasa}%</small>
                        </td>
                        <td>#${item.ranking_mes}</td>
                    </tr>
                `;
                tablaMedsBody.innerHTML += row;
            });
            
            // Inicializar DataTable
            $('#tabla-medicamentos').DataTable({
                pageLength: 10,
                responsive: true,
                language: {
                    url: '//cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json'
                }
            });
        }
    }

    updateLastUpdate() {
        if (this.data.lastUpdate && this.data.lastUpdate.last_updated) {
            const fecha = new Date(this.data.lastUpdate.last_updated);
            const options = { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            };
            
            const fechaFormateada = fecha.toLocaleDateString('es-ES', options);
            
            document.getElementById('last-update-time').textContent = fechaFormateada;
            document.getElementById('footer-update-time').textContent = fechaFormateada;
            document.getElementById('info-ultima-actualizacion').textContent = fechaFormateada;
        }
    }

    bindEvents() {
        console.log('Configurando eventos...');
        
        // Botón de refresh
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.refreshData();
        });
        
        // Botón de exportar
        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportData();
        });
        
        // Cambiar tema
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });
        
        // Cambiar pestañas
        document.querySelectorAll('.tabs-nav li').forEach(tab => {
            tab.addEventListener('click', () => {
                this.switchTab(tab.dataset.tab);
            });
        });
        
        // Cambiar métrica del gráfico
        document.getElementById('chart-metric').addEventListener('change', (e) => {
            this.updateChartMetric(e.target.value);
        });
        
        // Botón de ayuda
        document.getElementById('help-btn').addEventListener('click', () => {
            this.showHelp();
        });
    }

    async refreshData() {
        const btn = document.getElementById('refresh-btn');
        const originalHTML = btn.innerHTML;
        
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
        btn.disabled = true;
        
        try {
            await this.loadData();
            this.renderKPIs();
            this.renderCharts();
            this.renderTables();
            this.updateLastUpdate();
            
            this.showNotification('Datos actualizados correctamente', 'success');
        } catch (error) {
            console.error('Error actualizando datos:', error);
            this.showNotification('Error actualizando datos', 'error');
        } finally {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    }

    exportData() {
        // Crear datos para exportación
        const exportData = {
            resumen: this.data.resumen,
            topMedicamentos: this.data.topMedicamentos,
            metadata: this.data.metadata,
            exportDate: new Date().toISOString()
        };
        
        // Convertir a JSON
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        
        // Crear enlace de descarga
        const exportFileDefaultName = `dashboard-export-${new Date().toISOString().slice(0, 10)}.json`;
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        this.showNotification('Datos exportados correctamente', 'success');
    }

    toggleTheme() {
        const body = document.body;
        const btn = document.getElementById('theme-toggle');
        const icon = btn.querySelector('i');
        
        if (body.classList.contains('dark-theme')) {
            body.classList.remove('dark-theme');
            icon.className = 'fas fa-moon';
            btn.innerHTML = '<i class="fas fa-moon"></i> Tema oscuro';
        } else {
            body.classList.add('dark-theme');
            icon.className = 'fas fa-sun';
            btn.innerHTML = '<i class="fas fa-sun"></i> Tema claro';
        }
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

    updateChartMetric(metric) {
        if (!this.charts.evolucion) return;
        
        const resumen = this.data.resumen;
        let data, label;
        
        switch(metric) {
            case 'pacientes_unicos':
                data = resumen.map(r => r.pacientes_unicos);
                label = 'Pacientes Únicos';
                break;
            case 'total_dispensado':
                data = resumen.map(r => r.total_dispensado);
                label = 'Unidades Dispensadas';
                break;
            case 'total_faltante':
                data = resumen.map(r => r.total_faltante);
                label = 'Unidades Faltantes';
                break;
            default:
                data = resumen.map(r => r.total_lineas);
                label = 'Líneas Totales';
        }
        
        this.charts.evolucion.data.datasets[0].data = data;
        this.charts.evolucion.data.datasets[0].label = label;
        this.charts.evolucion.update();
    }

    showHelp() {
        alert('IPS Analytics Dashboard\n\n' +
              'Este dashboard muestra estadísticas de recetas médicas.\n\n' +
              'KPIs: Indicadores clave de rendimiento\n' +
              'Gráficos: Visualización de tendencias\n' +
              'Tablas: Datos detallados\n\n' +
              'Use los botones para actualizar datos o exportar.');
    }

    showNotification(message, type = 'info') {
        // Crear elemento de notificación
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        // Estilos para la notificación
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : '#3b82f6'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            display: flex;
            align-items: center;
            gap: 0.5rem;
            z-index: 9999;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Remover después de 3 segundos
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-overlay';
        errorDiv.innerHTML = `
            <div class="error-content">
                <i class="fas fa-exclamation-triangle"></i>
                <h3>Error</h3>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="window.location.reload()">
                    <i class="fas fa-redo"></i> Reintentar
                </button>
            </div>
        `;
        
        // Estilos para el error
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
            z-index: 10000;
        `;
        
        errorDiv.querySelector('.error-content').style.cssText = `
            background: white;
            padding: 2rem;
            border-radius: 8px;
            text-align: center;
            max-width: 400px;
        `;
        
        document.body.appendChild(errorDiv);
    }
}

// Agregar estilos CSS para animaciones
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .positive { color: #10b981; }
    .negative { color: #ef4444; }
    
    .dark-theme {
        background-color: #0f172a;
        color: #f1f5f9;
    }
    
    .dark-theme .kpi-card,
    .dark-theme .chart-container,
    .dark-theme .tabs-container,
    .dark-theme .info-box {
        background-color: #1e293b;
        color: #f1f5f9;
    }
    
    .dark-theme .kpi-content p {
        color: #cbd5e1;
    }
`;
document.head.appendChild(style);
