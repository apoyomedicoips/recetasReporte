// docs/js/dashboard.js - VERSIÓN SIMPLIFICADA Y FUNCIONAL
class Dashboard {
  constructor() {
    this.data = {
      resumen: [],
      topMedicamentos: [],
      farmaciaSummary: [],
      medicoSummary: [],
      stockAlerts: [],
      metadata: null,
      lastUpdate: null
    };
    this.charts = {};
    this.tables = {};
  }

  async init() {
    try {
      await this.loadData();
      this.renderKPIs();
      this.renderChartEvolucion();
      this.renderTablaMedicamentos();
      this.updateLastUpdate();
      this.bindEvents();
      console.log("Dashboard inicializado correctamente");
    } catch (err) {
      console.error('Error inicializando dashboard:', err);
      this.showError('Ocurrió un error al cargar los datos del dashboard.');
    }
  }

  async loadData() {
    const basePath = './data';
    
    // Cargar todos los datos en paralelo
    const [
      resumen,
      topMedicamentos, 
      farmaciaSummary,
      medicoSummary,
      stockAlerts,
      metadata,
      lastUpdate
    ] = await Promise.all([
      this.safeFetch(`${basePath}/resumen_mensual.json`, []),
      this.safeFetch(`${basePath}/top_medicamentos.json`, []),
      this.safeFetch(`${basePath}/farmacia_summary.json`, []),
      this.safeFetch(`${basePath}/medico_summary.json`, []),
      this.safeFetch(`${basePath}/stock_alerts.json`, []),
      this.safeFetch(`${basePath}/metadata.json`, {}),
      this.safeFetch(`${basePath}/last_update.json`, {})
    ]);

    this.data = {
      resumen: Array.isArray(resumen) ? resumen : [],
      topMedicamentos: Array.isArray(topMedicamentos) ? topMedicamentos : [],
      farmaciaSummary: Array.isArray(farmaciaSummary) ? farmaciaSummary : [],
      medicoSummary: Array.isArray(medicoSummary) ? medicoSummary : [],
      stockAlerts: Array.isArray(stockAlerts) ? stockAlerts : [],
      metadata: metadata,
      lastUpdate: lastUpdate
    };
  }

  async safeFetch(url, fallback) {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } catch (err) {
      console.warn('No se pudo cargar:', url, err);
      return fallback;
    }
  }

  renderKPIs() {
    const resumen = this.data.resumen;
    if (!resumen || resumen.length === 0) {
      console.warn("No hay datos de resumen para mostrar KPIs");
      return;
    }

    // Calcular totales de TODO el periodo (no solo último mes)
    const totalLineas = resumen.reduce((sum, r) => sum + (Number(r.total_lineas) || 0), 0);
    const totalPacientes = resumen.reduce((sum, r) => sum + (Number(r.pacientes_unicos) || 0), 0);
    const totalMedicos = resumen.reduce((sum, r) => sum + (Number(r.medicos_unicos) || 0), 0);
    const totalRecetas = resumen.reduce((sum, r) => sum + (Number(r.recetas_unicas) || 0), 0);
    const totalRecetado = resumen.reduce((sum, r) => sum + (Number(r.total_recetado) || 0), 0);
    const totalDispensado = resumen.reduce((sum, r) => sum + (Number(r.total_dispensado) || 0), 0);
    const totalFaltante = totalRecetado - totalDispensado;
    const tasaGlobal = totalRecetado > 0 ? (totalDispensado / totalRecetado) : 0;

    // Actualizar elementos del DOM (con IDs correctos)
    this.updateElement('kpi-total', Utils.formatNumber(totalLineas));
    this.updateElement('kpi-pacientes', Utils.formatNumber(totalPacientes));
    this.updateElement('kpi-medicos', Utils.formatNumber(totalMedicos));
    this.updateElement('kpi-recetas', Utils.formatNumber(totalRecetas));
    this.updateElement('kpi-faltante', Utils.formatNumber(Math.max(0, totalFaltante)));
    this.updateElement('kpi-tasa-dispensacion', Utils.formatPercentage(tasaGlobal));

    // Actualizar footer si existe
    if (this.data.metadata && this.data.metadata.total_records) {
      this.updateElement('footer-total-records', Utils.formatNumber(this.data.metadata.total_records));
    }
  }

  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  renderChartEvolucion() {
    const resumen = this.data.resumen;
    if (!resumen || resumen.length === 0) {
      console.warn("No hay datos para el gráfico de evolución");
      return;
    }

    // Ordenar por fecha
    const sorted = [...resumen].sort((a, b) => {
      if (a.anio !== b.anio) return a.anio - b.anio;
      return a.mes - b.mes;
    });

    const labels = sorted.map(r => Utils.monthLabel(r.anio, r.mes));
    const totalLineas = sorted.map(r => Number(r.total_lineas) || 0);

    const ctx = document.getElementById('chart-evolucion');
    if (!ctx) {
      console.warn("No se encontró el canvas para el gráfico");
      return;
    }

    // Destruir gráfico anterior si existe
    if (this.charts.evolucion) {
      this.charts.evolucion.destroy();
    }

    this.charts.evolucion = new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Líneas totales por mes',
          data: totalLineas,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'top'
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

  renderTablaMedicamentos() {
    const data = this.data.topMedicamentos;
    if (!data || data.length === 0) {
      console.warn("No hay datos de medicamentos");
      return;
    }

    // Tomar solo los últimos 50 registros o los más recientes
    const medicamentos = data.slice(0, 50);
    const tbody = document.querySelector('#tabla-medicamentos tbody');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    medicamentos.forEach((med, index) => {
      const row = document.createElement('tr');
      const faltante = (Number(med.recetado) || 0) - (Number(med.dispensado) || 0);
      const tasa = Number(med.tasa_global) || 0;
      const nombre = med.TextoBreveMedicamento || med.medicamento_desc || med.descripcion || '';
      
      row.innerHTML = `
        <td>${Utils.monthLabel(med.anio, med.mes)}</td>
        <td>${nombre}</td>
        <td>${Utils.formatNumber(med.lineas || 0)}</td>
        <td>${Utils.formatNumber(med.recetado || 0)}</td>
        <td>${Utils.formatNumber(med.dispensado || 0)}</td>
        <td>${Utils.formatNumber(faltante)}</td>
        <td>${Utils.formatPercentage(tasa)}</td>
        <td>${med.ranking_mes ? '#' + med.ranking_mes : 'N/A'}</td>
      `;
      tbody.appendChild(row);
    });

    // Inicializar DataTable si existe jQuery
    if (typeof $ !== 'undefined' && $.fn.DataTable) {
      if (this.tables.medicamentos) {
        this.tables.medicamentos.destroy();
      }
      
      this.tables.medicamentos = $('#tabla-medicamentos').DataTable({
        pageLength: 10,
        order: [[2, 'desc']], // Ordenar por líneas descendente
        responsive: true,
        language: {
          url: '//cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json'
        }
      });
    }
  }

  updateLastUpdate() {
    const meta = this.data.metadata;
    const lu = this.data.lastUpdate;
    
    let fecha = null;
    if (lu && lu.last_updated) fecha = lu.last_updated;
    else if (meta && meta.generated_at) fecha = meta.generated_at;
    
    const fechaFormateada = fecha ? Utils.formatLocalDate(fecha) : 'No disponible';
    
    this.updateElement('last-update-time', fechaFormateada);
    this.updateElement('footer-update-time', fechaFormateada);
  }

  bindEvents() {
    // Botón de actualizar
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshData());
    }

    // Botón de tema
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.toggleTheme());
      
      // Aplicar tema guardado
      const savedTheme = localStorage.getItem('dashboard-theme');
      if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        themeBtn.innerHTML = '<i class="fas fa-sun"></i> Tema claro';
      }
    }

    // Botón de ayuda
    const helpBtn = document.getElementById('help-btn');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => this.showHelp());
    }
  }

  async refreshData() {
    const btn = document.getElementById('refresh-btn');
    if (!btn) return;
    
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando';

    try {
      await this.loadData();
      this.renderKPIs();
      this.renderChartEvolucion();
      this.renderTablaMedicamentos();
      this.updateLastUpdate();
      this.showNotification('Datos actualizados correctamente', 'success');
    } catch (err) {
      console.error('Error al actualizar datos:', err);
      this.showNotification('Error al actualizar datos', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  }

  toggleTheme() {
    const body = document.body;
    const btn = document.getElementById('theme-toggle');
    
    body.classList.toggle('dark-theme');
    
    if (body.classList.contains('dark-theme')) {
      btn.innerHTML = '<i class="fas fa-sun"></i> Tema claro';
      localStorage.setItem('dashboard-theme', 'dark');
    } else {
      btn.innerHTML = '<i class="fas fa-moon"></i> Tema oscuro';
      localStorage.setItem('dashboard-theme', 'light');
    }
  }

  showHelp() {
    alert(
      'IPS Analytics Dashboard 2025\n\n' +
      'Este tablero muestra estadísticas agregadas de recetas médicas del IPS.\n\n' +
      '• Los KPIs muestran totales acumulados de todos los períodos\n' +
      '• El gráfico muestra la evolución mensual de líneas de receta\n' +
      '• La tabla muestra los medicamentos más recetados\n\n' +
      'Los datos son actualizados periódicamente y se muestran de forma anónima.'
    );
  }

  showNotification(message, type = 'info') {
    // Crear notificación
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
      <span>${message}</span>
      <button class="notification-close">&times;</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-eliminar después de 5 segundos
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 5000);
    
    // Botón para cerrar manualmente
    notification.querySelector('.notification-close').addEventListener('click', () => {
      notification.remove();
    });
  }

  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-overlay';
    errorDiv.innerHTML = `
      <div class="error-content">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Error</h3>
        <p>${message}</p>
        <button onclick="location.reload()" class="btn btn-primary">
          <i class="fas fa-redo"></i> Reintentar
        </button>
      </div>
    `;
    
    document.body.appendChild(errorDiv);
  }
}

window.Dashboard = Dashboard;
