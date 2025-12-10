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
    this.currentYear = 'all';
  }

  async init() {
    try {
      await this.loadData();
      this.populateYearFilter();
      this.renderKPIs();
      this.renderCharts();
      this.renderTables();
      this.updateLastUpdate();
      this.bindEvents();
    } catch (err) {
      console.error('Error inicializando dashboard', err);
      this.showError('Ocurrió un error al cargar los datos del dashboard.');
    }
  }

  async loadData() {
    const basePath = './data'; // CORREGIDO: Agregado ./ para ruta relativa

    this.data.resumen = await this.safeFetch(`${basePath}/resumen_mensual.json`, []);
    this.data.topMedicamentos = await this.safeFetch(`${basePath}/top_medicamentos.json`, []);
    this.data.farmaciaSummary = await this.safeFetch(`${basePath}/farmacia_summary.json`, []);
    this.data.medicoSummary = await this.safeFetch(`${basePath}/medico_summary.json`, []);
    this.data.stockAlerts = await this.safeFetch(`${basePath}/stock_alerts.json`, []);
    this.data.metadata = await this.safeFetch(`${basePath}/metadata.json`, null);
    this.data.lastUpdate = await this.safeFetch(`${basePath}/last_update.json`, null);
  }

  async safeFetch(url, fallback) {
    try {
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      return await resp.json();
    } catch (err) {
      console.warn('No se pudo cargar', url, err);
      return fallback;
    }
  }

  getResumenFiltrado() {
    if (!this.data.resumen || !Array.isArray(this.data.resumen)) return [];
    if (this.currentYear === 'all') return this.data.resumen;
    return this.data.resumen.filter(r => String(r.anio) === String(this.currentYear));
  }

  getUltimoPeriodo() {
    const resumen = this.getResumenFiltrado();
    if (!resumen || resumen.length === 0) return null;
    
    // Ordenar por año y mes para obtener el más reciente
    const sorted = [...resumen].sort((a, b) => {
      if (a.anio !== b.anio) return b.anio - a.anio;
      return b.mes - a.mes;
    });
    
    return sorted[0];
  }

  populateYearFilter() {
    const resumen = this.data.resumen;
    const select = document.getElementById('year-filter');
    if (!select || !resumen || !Array.isArray(resumen) || resumen.length === 0) return;

    const years = Array.from(new Set(resumen.map(r => r.anio).filter(Boolean))).sort((a, b) => b - a);
    
    // Limpiar opciones existentes (excepto "Todos")
    while (select.options.length > 1) {
      select.remove(1);
    }
    
    years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = String(y);
      opt.textContent = y;
      select.appendChild(opt);
    });
  }

  renderKPIs() {
    const resumen = this.getResumenFiltrado();
    if (!resumen || resumen.length === 0) {
      this.setDefaultKPIs();
      return;
    }

    // Agregados sobre todos los meses filtrados
    const totalLineas = resumen.reduce((s, r) => s + (Number(r.total_lineas) || 0), 0);
    const totalPacientes = resumen.reduce((s, r) => s + (Number(r.pacientes_unicos) || 0), 0);
    const totalMedicos = resumen.reduce((s, r) => s + (Number(r.medicos_unicos) || 0), 0);
    const totalRecetas = resumen.reduce((s, r) => s + (Number(r.recetas_unicas) || 0), 0);
    const totalRecetado = resumen.reduce((s, r) => s + (Number(r.total_recetado) || 0), 0);
    const totalDispensado = resumen.reduce((s, r) => s + (Number(r.total_dispensado) || 0), 0);
    const totalFaltante = resumen.reduce((s, r) => s + (Number(r.total_faltante) || 0), 0);

    const tasaGlobal = totalRecetado > 0 ? totalDispensado / totalRecetado : 0;

    this.setKPIValue('kpi-total', totalLineas);
    this.setKPIValue('kpi-pacientes', totalPacientes);
    this.setKPIValue('kpi-medicos', totalMedicos);
    this.setKPIValue('kpi-recetas', totalRecetas);
    this.setKPIValue('kpi-faltante', totalFaltante);
    this.setKPIValue('kpi-tasa-dispensacion', tasaGlobal, true);

    this.updateTrends();

    // Metadatos en panel de resumen
    if (this.data.metadata) {
      const m = this.data.metadata;
      const periodo = m.date_range_start && m.date_range_end
        ? `${m.date_range_start} a ${m.date_range_end}`
        : 'Sin información';

      this.setInfoValue('info-total-registros', m.total_records);
      this.setInfoValue('footer-total-records', m.total_records);
      this.setInfoValue('info-pacientes-unicos', m.unique_patients);
      this.setInfoValue('info-medicos-unicos', m.unique_doctors);
      this.setInfoValue('info-farmacias-activas', m.unique_pharmacies);
      this.setInfoValue('info-medicamentos-unicos', m.unique_medications);
      
      const infoPeriodo = document.getElementById('info-periodo');
      if (infoPeriodo) infoPeriodo.textContent = periodo;
    }
  }

  setKPIValue(elementId, value, isPercentage = false) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = isPercentage ? 
        Utils.formatPercentage(value) : 
        Utils.formatNumber(value);
    }
  }

  setInfoValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
      element.textContent = Utils.formatNumber(value || 0);
    }
  }

  setDefaultKPIs() {
    this.setKPIValue('kpi-total', 0);
    this.setKPIValue('kpi-pacientes', 0);
    this.setKPIValue('kpi-medicos', 0);
    this.setKPIValue('kpi-recetas', 0);
    this.setKPIValue('kpi-faltante', 0);
    this.setKPIValue('kpi-tasa-dispensacion', 0, true);
    
    // Limpiar tendencias
    const trendIds = [
      'kpi-total-trend',
      'kpi-pacientes-trend',
      'kpi-medicos-trend',
      'kpi-recetas-trend',
      'kpi-faltante-trend',
      'kpi-tasa-trend'
    ];
    
    trendIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<span>Sin datos</span>';
    });
  }

  updateTrends() {
    const resumen = this.getResumenFiltrado();
    if (!resumen || resumen.length < 2) {
      this.clearTrends();
      return;
    }

    // Ordenar por fecha
    const sorted = [...resumen].sort((a, b) => {
      if (a.anio !== b.anio) return a.anio - b.anio;
      return a.mes - b.mes;
    });

    const ultimo = sorted[sorted.length - 1];
    const anterior = sorted[sorted.length - 2];

    const computeTrend = (actual, prev) => {
      if (prev === 0 || prev === null || prev === undefined) {
        return { value: 0, direction: 'neutral' };
      }
      const diff = ((actual - prev) / prev) * 100;
      return {
        value: Math.abs(diff).toFixed(1),
        direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral'
      };
    };

    const trends = {
      'kpi-total-trend': computeTrend(ultimo.total_lineas || 0, anterior.total_lineas || 0),
      'kpi-pacientes-trend': computeTrend(ultimo.pacientes_unicos || 0, anterior.pacientes_unicos || 0),
      'kpi-medicos-trend': computeTrend(ultimo.medicos_unicos || 0, anterior.medicos_unicos || 0),
      'kpi-recetas-trend': computeTrend(ultimo.recetas_unicas || 0, anterior.recetas_unicas || 0),
      'kpi-faltante-trend': computeTrend(ultimo.total_faltante || 0, anterior.total_faltante || 0),
      'kpi-tasa-trend': computeTrend(
        (ultimo.tasa_dispensacion_global || 0) * 100,
        (anterior.tasa_dispensacion_global || 0) * 100
      )
    };

    Object.entries(trends).forEach(([id, t]) => {
      const el = document.getElementById(id);
      if (!el) return;
      
      let icon, cls;
      if (t.direction === 'up') {
        icon = 'fa-arrow-up';
        cls = 'positive';
      } else if (t.direction === 'down') {
        icon = 'fa-arrow-down';
        cls = 'negative';
      } else {
        icon = 'fa-minus';
        cls = 'neutral';
      }
      
      el.innerHTML = `<i class="fas ${icon} ${cls}"></i><span>${t.value}% vs mes anterior</span>`;
    });
  }

  clearTrends() {
    const trendIds = [
      'kpi-total-trend',
      'kpi-pacientes-trend',
      'kpi-medicos-trend',
      'kpi-recetas-trend',
      'kpi-faltante-trend',
      'kpi-tasa-trend'
    ];
    
    trendIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '<span>Sin datos comparativos</span>';
    });
  }

  renderCharts() {
    const resumen = this.getResumenFiltrado();
    if (!resumen || resumen.length === 0) {
      this.clearCharts();
      return;
    }

    // Ordenar por fecha
    const sorted = [...resumen].sort((a, b) => {
      if (a.anio !== b.anio) return a.anio - b.anio;
      return a.mes - b.mes;
    });

    const labels = sorted.map(r => Utils.monthLabel(r.anio, r.mes));
    const totalLineas = sorted.map(r => Number(r.total_lineas) || 0);
    const totalRecetado = sorted.map(r => Number(r.total_recetado) || 0);
    const totalDispensado = sorted.map(r => Number(r.total_dispensado) || 0);

    // Destruir gráficos previos si existen
    Object.values(this.charts).forEach(ch => {
      if (ch && typeof ch.destroy === 'function') ch.destroy();
    });
    this.charts = {};

    // Evolución
    this.renderChartEvolucion(labels, totalLineas);
    
    // Distribución por mes
    this.renderChartDistribucion(labels, totalLineas);
    
    // Comparativa recetado vs dispensado
    this.renderChartComparativa(labels, totalRecetado, totalDispensado);
  }

  renderChartEvolucion(labels, data) {
    const ctxEvo = document.getElementById('chart-evolucion');
    if (!ctxEvo) return;

    this.charts.evolucion = new Chart(ctxEvo.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Líneas totales',
          data: data,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.15)',
          borderWidth: 2,
          tension: 0.35,
          fill: true
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
            ticks: { callback: v => Utils.formatNumber(v) }
          }
        }
      }
    });
  }

  renderChartDistribucion(labels, data) {
    const ctxDist = document.getElementById('chart-distribucion-mes');
    if (!ctxDist) return;

    this.charts.distribucion = new Chart(ctxDist.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: data,
          backgroundColor: [
            '#3b82f6', '#10b981', '#f97316', '#ef4444',
            '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b',
            '#e11d48', '#0ea5e9', '#a855f7', '#14b8a6'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 10, font: { size: 10 } }
          }
        }
      }
    });
  }

  renderChartComparativa(labels, recetado, dispensado) {
    const ctxComp = document.getElementById('chart-comparativa');
    if (!ctxComp) return;

    this.charts.comparativa = new Chart(ctxComp.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Recetado',
            data: recetado,
            backgroundColor: 'rgba(59,130,246,0.8)'
          },
          {
            label: 'Dispensado',
            data: dispensado,
            backgroundColor: 'rgba(16,185,129,0.8)'
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

  clearCharts() {
    // Destruir gráficos existentes
    Object.values(this.charts).forEach(ch => {
      if (ch && typeof ch.destroy === 'function') ch.destroy();
    });
    this.charts = {};

    // Mostrar mensaje en contenedores de gráficos
    const chartContainers = [
      'chart-evolucion',
      'chart-distribucion-mes',
      'chart-comparativa'
    ];

    chartContainers.forEach(id => {
      const canvas = document.getElementById(id);
      if (canvas) {
        const parent = canvas.parentElement;
        parent.innerHTML = `
          <div class="no-data-message">
            <i class="fas fa-chart-line"></i>
            <p>No hay datos disponibles para el período seleccionado</p>
          </div>
        `;
      }
    });
  }

  renderTables() {
    this.renderTablaResumen();
    this.renderTablaMedicamentos();
    this.renderTablaFarmacias();
    this.renderTablaMedicos();
    this.renderTablaAlertas();
  }

  renderTablaResumen() {
    const resumen = this.getResumenFiltrado();
    const tbody = document.getElementById('tabla-resumen-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    if (resumen.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="9" class="text-center">No hay datos disponibles</td>`;
      tbody.appendChild(row);
    } else {
      // Ordenar por fecha
      const sorted = [...resumen].sort((a, b) => {
        if (a.anio !== b.anio) return b.anio - a.anio;
        return b.mes - a.mes;
      });

      sorted.forEach(r => {
        const tasa = Number(r.tasa_dispensacion_global) || 0;
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${Utils.monthLabel(r.anio, r.mes)}</td>
          <td>${Utils.formatNumber(r.total_lineas || 0)}</td>
          <td>${Utils.formatNumber(r.recetas_unicas || 0)}</td>
          <td>${Utils.formatNumber(r.pacientes_unicos || 0)}</td>
          <td>${Utils.formatNumber(r.medicos_unicos || 0)}</td>
          <td>${Utils.formatNumber(r.total_recetado || 0)}</td>
          <td>${Utils.formatNumber(r.total_dispensado || 0)}</td>
          <td>${Utils.formatNumber(r.total_faltante || 0)}</td>
          <td>
            <div class="progress"><div class="progress-bar" style="width:${(tasa * 100).toFixed(1)}%"></div></div>
            <small>${Utils.formatPercentage(tasa)}</small>
          </td>
        `;
        tbody.appendChild(row);
      });
    }

    // Inicializar/Reinicializar DataTable
    if ($.fn.DataTable.isDataTable('#tabla-resumen')) {
      this.tables.resumen.destroy();
    }
    
    this.tables.resumen = $('#tabla-resumen').DataTable({
      pageLength: 12,
      order: [[0, 'desc']],
      responsive: true,
      language: { 
        url: '//cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json',
        emptyTable: "No hay datos disponibles en la tabla"
      }
    });
  }

  renderTablaMedicamentos() {
    const ultimo = this.getUltimoPeriodo();
    const tbody = document.getElementById('tabla-medicamentos-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    
    if (!ultimo || !this.data.topMedicamentos || !Array.isArray(this.data.topMedicamentos)) {
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="9" class="text-center">No hay datos disponibles</td>`;
      tbody.appendChild(row);
    } else {
      const { anio, mes } = ultimo;
      const datos = (this.data.topMedicamentos || [])
        .filter(d => d.anio === anio && d.mes === mes)
        .sort((a, b) => (Number(a.ranking_mes) || 9999) - (Number(b.ranking_mes) || 9999))
        .slice(0, 50);

      if (datos.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="9" class="text-center">No hay datos para el período ${Utils.monthLabel(anio, mes)}</td>`;
        tbody.appendChild(row);
      } else {
        datos.forEach(d => {
          const faltante = (Number(d.recetado) || 0) - (Number(d.dispensado) || 0);
          const tasa = Number(d.tasa_global) || 0;
          const nombre = d.TextoBreveMedicamento || d.medicamento_desc || d.descripcion || String(d.MedicamentoSAP || '');

          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${Utils.monthLabel(d.anio, d.mes)}</td>
            <td>${d.MedicamentoSAP || ''}</td>
            <td>${nombre}</td>
            <td>${Utils.formatNumber(d.lineas || 0)}</td>
            <td>${Utils.formatNumber(d.recetado || 0)}</td>
            <td>${Utils.formatNumber(d.dispensado || 0)}</td>
            <td>${Utils.formatNumber(faltante)}</td>
            <td>
              <div class="progress"><div class="progress-bar" style="width:${(tasa * 100).toFixed(1)}%"></div></div>
              <small>${Utils.formatPercentage(tasa)}</small>
            </td>
            <td>${d.ranking_mes ? '#' + d.ranking_mes : ''}</td>
          `;
          tbody.appendChild(row);
        });
      }
    }

    // Inicializar/Reinicializar DataTable
    if (this.tables.medicamentos && $.fn.DataTable.isDataTable('#tabla-medicamentos')) {
      this.tables.medicamentos.destroy();
    }
    
    this.tables.medicamentos = $('#tabla-medicamentos').DataTable({
      pageLength: 20,
      order: [[3, 'desc']],
      responsive: true,
      language: { 
        url: '//cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json',
        emptyTable: "No hay datos disponibles en la tabla"
      }
    });
  }

  renderTablaFarmacias() {
    const tbody = document.getElementById('tabla-farmacias-body');
    if (!tbody) return;

    const datos = Array.isArray(this.data.farmaciaSummary) ? this.data.farmaciaSummary : [];
    tbody.innerHTML = '';

    if (datos.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="10" class="text-center">No hay datos disponibles</td>`;
      tbody.appendChild(row);
    } else {
      datos.forEach(d => {
        const nombre = d.farmacia_nombre || d.farmacia_desc || `Farmacia ${d.farmacia_id || ''}`;
        const tasaDisp = Number(d.tasa_dispensacion) || 0;
        const tasaFalt = Number(d.tasa_faltante) || 0;
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${nombre}</td>
          <td>${d.anio || ''}</td>
          <td>${d.mes || ''}</td>
          <td>${Utils.formatNumber(d.total_lineas || 0)}</td>
          <td>${Utils.formatNumber(d.pacientes_unicos || 0)}</td>
          <td>${Utils.formatNumber(d.total_recetado || 0)}</td>
          <td>${Utils.formatNumber(d.total_dispensado || 0)}</td>
          <td>${Utils.formatNumber(d.total_faltante || 0)}</td>
          <td>${Utils.formatPercentage(tasaDisp)}</td>
          <td>${Utils.formatPercentage(tasaFalt)}</td>
        `;
        tbody.appendChild(row);
      });
    }

    // Inicializar/Reinicializar DataTable
    if (this.tables.farmacias && $.fn.DataTable.isDataTable('#tabla-farmacias')) {
      this.tables.farmacias.destroy();
    }
    
    this.tables.farmacias = $('#tabla-farmacias').DataTable({
      pageLength: 20,
      order: [[0, 'asc']],
      responsive: true,
      language: { 
        url: '//cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json',
        emptyTable: "No hay datos disponibles en la tabla"
      }
    });
  }

  renderTablaMedicos() {
    const tbody = document.getElementById('tabla-medicos-body');
    if (!tbody) return;

    const datos = Array.isArray(this.data.medicoSummary) ? this.data.medicoSummary : [];
    tbody.innerHTML = '';

    if (datos.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="9" class="text-center">No hay datos disponibles</td>`;
      tbody.appendChild(row);
    } else {
      datos.forEach(d => {
        const nombre = d.medico_nombre || d.medico_desc || `Médico ${d.medico_id || ''}`;
        const propCronicas = Number(d.porcentaje_cronicas) || 0;
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${nombre}</td>
          <td>${d.anio || ''}</td>
          <td>${d.mes || ''}</td>
          <td>${Utils.formatNumber(d.total_recetas || 0)}</td>
          <td>${Utils.formatNumber(d.pacientes_unicos || 0)}</td>
          <td>${Utils.formatNumber(d.medicamentos_prescritos || 0)}</td>
          <td>${Utils.formatNumber(d.total_recetado || 0)}</td>
          <td>${Utils.formatNumber(d.total_dispensado || 0)}</td>
          <td>${Utils.formatPercentage(propCronicas)}</td>
        `;
        tbody.appendChild(row);
      });
    }

    // Inicializar/Reinicializar DataTable
    if (this.tables.medicos && $.fn.DataTable.isDataTable('#tabla-medicos')) {
      this.tables.medicos.destroy();
    }
    
    this.tables.medicos = $('#tabla-medicos').DataTable({
      pageLength: 20,
      order: [[3, 'desc']],
      responsive: true,
      language: { 
        url: '//cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json',
        emptyTable: "No hay datos disponibles en la tabla"
      }
    });
  }

  renderTablaAlertas() {
    const tbody = document.getElementById('tabla-alertas-body');
    if (!tbody) return;

    const datos = Array.isArray(this.data.stockAlerts) ? this.data.stockAlerts : [];
    tbody.innerHTML = '';

    if (datos.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = `<td colspan="6" class="text-center">No hay alertas de stock disponibles</td>`;
      tbody.appendChild(row);
    } else {
      datos.forEach(d => {
        const farmacia = d.farmacia_nombre || d.farmacia_desc || `Farmacia ${d.farmacia_id || ''}`;
        const nombreMed = d.TextoBreveMedicamento || d.medicamento_desc || d.descripcion || '';
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${farmacia}</td>
          <td>${nombreMed}</td>
          <td>${d.MedicamentoSAP || ''}</td>
          <td>${Utils.formatNumber(d.stock_minimo || 0)}</td>
          <td>${Utils.formatNumber(d.demanda_mensual || 0)}</td>
          <td>${Utils.formatNumber(d.veces_solicitado || 0)}</td>
        `;
        tbody.appendChild(row);
      });
    }

    // Inicializar/Reinicializar DataTable
    if (this.tables.alertas && $.fn.DataTable.isDataTable('#tabla-alertas')) {
      this.tables.alertas.destroy();
    }
    
    this.tables.alertas = $('#tabla-alertas').DataTable({
      pageLength: 20,
      order: [[3, 'asc']],
      responsive: true,
      language: { 
        url: '//cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json',
        emptyTable: "No hay datos disponibles en la tabla"
      }
    });
  }

  updateLastUpdate() {
    const meta = this.data.metadata;
    const lu = this.data.lastUpdate;
    let fuente = null;

    if (lu && lu.last_updated) {
      fuente = lu.last_updated;
    } else if (meta && meta.generated_at) {
      fuente = meta.generated_at;
    }

    const texto = fuente ? Utils.formatLocalDate(fuente) : 'No disponible';

    const ids = ['last-update-time', 'footer-update-time'];
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = texto;
    });
    
    const info = document.getElementById('info-ultima-actualizacion');
    if (info) info.textContent = texto;
  }

  bindEvents() {
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.refreshData());
    }

    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportData());
    }

    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => this.toggleTheme());
      // Inicializar texto del botón según tema actual
      const body = document.body;
      if (body.classList.contains('dark-theme')) {
        themeBtn.innerHTML = '<i class="fas fa-sun"></i> Tema claro';
      } else {
        themeBtn.innerHTML = '<i class="fas fa-moon"></i> Tema oscuro';
      }
    }

    const helpBtn = document.getElementById('help-btn');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => this.showHelp());
    }

    const yearSelect = document.getElementById('year-filter');
    if (yearSelect) {
      yearSelect.addEventListener('change', e => {
        const val = e.target.value;
        this.currentYear = val === 'all' ? 'all' : parseInt(val, 10);
        this.renderKPIs();
        this.renderCharts();
        this.renderTables();
      });
    }

    const metricSelect = document.getElementById('chart-metric');
    if (metricSelect) {
      metricSelect.addEventListener('change', e => {
        this.updateChartMetric(e.target.value);
      });
    }

    // Tabs navigation
    document.querySelectorAll('.tabs-nav li').forEach(li => {
      li.addEventListener('click', () => {
        const tabId = li.dataset.tab;
        this.switchTab(tabId);
      });
    });
  }

  async refreshData() {
    const btn = document.getElementById('refresh-btn');
    if (!btn) return;
    
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando';

    try {
      await this.loadData();
      this.populateYearFilter();
      this.renderKPIs();
      this.renderCharts();
      this.renderTables();
      this.updateLastUpdate();
      this.showNotification('Datos actualizados correctamente', 'success');
    } catch (err) {
      console.error('Error al actualizar datos', err);
      this.showNotification('Error al actualizar datos', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = originalHTML;
    }
  }

  exportData() {
    try {
      const payload = {
        resumen_mensual: this.data.resumen,
        top_medicamentos: this.data.topMedicamentos,
        farmacia_summary: this.data.farmaciaSummary,
        medico_summary: this.data.medicoSummary,
        stock_alerts: this.data.stockAlerts,
        metadata: this.data.metadata,
        exported_at: new Date().toISOString()
      };
      
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `ips_recetas_dashboard_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showNotification('Archivo JSON exportado', 'success');
    } catch (err) {
      console.error('Error al exportar datos', err);
      this.showNotification('Error al exportar datos', 'error');
    }
  }

  toggleTheme() {
    const body = document.body;
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    
    body.classList.toggle('dark-theme');
    
    if (body.classList.contains('dark-theme')) {
      btn.innerHTML = '<i class="fas fa-sun"></i> Tema claro';
      localStorage.setItem('dashboard-theme', 'dark');
    } else {
      btn.innerHTML = '<i class="fas fa-moon"></i> Tema oscuro';
      localStorage.setItem('dashboard-theme', 'light');
    }
  }

  switchTab(tabId) {
    // Actualizar navegación
    document.querySelectorAll('.tabs-nav li').forEach(li => {
      li.classList.toggle('active', li.dataset.tab === tabId);
    });
    
    // Mostrar/ocultar paneles
    document.querySelectorAll('.tab-pane').forEach(p => {
      p.classList.toggle('active', p.id === tabId);
    });
  }

  updateChartMetric(metric) {
    const chart = this.charts.evolucion;
    if (!chart) return;

    const resumen = this.getResumenFiltrado();
    if (!resumen || resumen.length === 0) return;

    // Ordenar por fecha
    const sorted = [...resumen].sort((a, b) => {
      if (a.anio !== b.anio) return a.anio - b.anio;
      return a.mes - b.mes;
    });

    let data;
    let label;
    let color;

    switch (metric) {
      case 'pacientes_unicos':
        data = sorted.map(r => Number(r.pacientes_unicos) || 0);
        label = 'Pacientes únicos';
        color = '#10b981';
        break;
      case 'total_dispensado':
        data = sorted.map(r => Number(r.total_dispensado) || 0);
        label = 'Unidades dispensadas';
        color = '#22c55e';
        break;
      case 'total_faltante':
        data = sorted.map(r => Number(r.total_faltante) || 0);
        label = 'Unidades faltantes';
        color = '#ef4444';
        break;
      default:
        data = sorted.map(r => Number(r.total_lineas) || 0);
        label = 'Líneas totales';
        color = '#3b82f6';
    }

    chart.data.datasets[0].data = data;
    chart.data.datasets[0].label = label;
    chart.data.datasets[0].borderColor = color;
    chart.data.datasets[0].backgroundColor = color.replace(')', ',0.15)').replace('rgb', 'rgba');
    chart.update();
  }

  showHelp() {
    // Crear modal de ayuda
    const modal = document.createElement('div');
    modal.className = 'help-modal';
    modal.innerHTML = `
      <div class="help-modal-content">
        <div class="help-modal-header">
          <h3><i class="fas fa-circle-info"></i> Ayuda del Dashboard</h3>
          <button class="help-modal-close">&times;</button>
        </div>
        <div class="help-modal-body">
          <p><strong>IPS Recetas Dashboard</strong></p>
          <p>Este tablero muestra indicadores agregados de recetas.</p>
          
          <h4><i class="fas fa-filter"></i> Filtros</h4>
          <ul>
            <li><strong>Filtro por año:</strong> Seleccione un año específico o "Todos" para ver todos los períodos.</li>
            <li><strong>Métrica del gráfico:</strong> Cambie la métrica mostrada en el gráfico de evolución.</li>
          </ul>
          
          <h4><i class="fas fa-chart-line"></i> Indicadores (KPIs)</h4>
          <ul>
            <li><strong>Líneas totales:</strong> Número total de líneas de receta procesadas.</li>
            <li><strong>Pacientes únicos:</strong> Cantidad de pacientes diferentes atendidos.</li>
            <li><strong>Médicos únicos:</strong> Cantidad de médicos diferentes que han emitido recetas.</li>
            <li><strong>Recetas únicas:</strong> Número total de recetas diferentes.</li>
            <li><strong>Faltante total:</strong> Diferencia entre unidades recetadas y dispensadas.</li>
            <li><strong>Tasa de dispensación:</strong> Porcentaje de unidades dispensadas sobre recetadas.</li>
          </ul>
          
          <h4><i class="fas fa-table"></i> Pestañas</h4>
          <ul>
            <li><strong>Resumen mensual:</strong> Detalle de indicadores por mes.</li>
            <li><strong>Top medicamentos:</strong> Medicamentos más recetados en el último período.</li>
            <li><strong>Farmacias:</strong> Desempeño por farmacia.</li>
            <li><strong>Médicos:</strong> Actividad por médico.</li>
            <li><strong>Alertas de stock:</strong> Medicamentos con bajo stock o alta demanda.</li>
          </ul>
          
          <p class="note"><i class="fas fa-shield-alt"></i> Los datos son agregados y anonimizados, no incluyen información identificable.</p>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Cerrar modal
    modal.querySelector('.help-modal-close').addEventListener('click', () => {
      modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  showNotification(message, type = 'info') {
    // Crear elemento de notificación
    const div = document.createElement('div');
    div.className = `notification notification-${type}`;
    div.innerHTML = `
      <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
      <span>${message}</span>
      <button class="notification-close">&times;</button>
    `;
    
    document.body.appendChild(div);
    
    // Botón para cerrar
    div.querySelector('.notification-close').addEventListener('click', () => {
      div.remove();
    });
    
    // Auto-eliminar después de 5 segundos
    setTimeout(() => {
      if (div.parentNode) {
        div.style.opacity = '0';
        setTimeout(() => {
          if (div.parentNode) div.remove();
        }, 300);
      }
    }, 5000);
  }

  showError(message) {
    const overlay = document.createElement('div');
    overlay.className = 'error-overlay';
    overlay.innerHTML = `
      <div class="error-content">
        <i class="fas fa-triangle-exclamation" style="font-size:2rem;color:#ef4444;"></i>
        <h3>Error al cargar el dashboard</h3>
        <p style="margin:0.6rem 0 1rem 0;">${message}</p>
        <button class="btn btn-primary" type="button" id="retry-btn">
          <i class="fas fa-rotate"></i> Reintentar
        </button>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Configurar evento para el botón de reintentar
    overlay.querySelector('#retry-btn').addEventListener('click', () => {
      overlay.remove();
      this.init();
    });
  }
}

// Asegurar que Dashboard esté disponible globalmente
window.Dashboard = Dashboard;
