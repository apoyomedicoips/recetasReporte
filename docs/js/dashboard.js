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
    const basePath = 'data_avanzado';

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
    if (!this.data.resumen) return [];
    if (this.currentYear === 'all') return this.data.resumen;
    return this.data.resumen.filter(r => r.anio === this.currentYear);
  }

  getUltimoPeriodo() {
    const resumen = this.getResumenFiltrado();
    if (!resumen || resumen.length === 0) return null;
    return resumen[resumen.length - 1];
  }

  populateYearFilter() {
    const resumen = this.data.resumen;
    const select = document.getElementById('year-filter');
    if (!select || !resumen || resumen.length === 0) return;

    const years = Array.from(new Set(resumen.map(r => r.anio))).sort();
    years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = String(y);
      opt.textContent = y;
      select.appendChild(opt);
    });
  }

  renderKPIs() {
    const resumen = this.getResumenFiltrado();
    if (!resumen || resumen.length === 0) return;

    // Agregados sobre todos los meses filtrados
    const totalLineas = resumen.reduce((s, r) => s + (r.total_lineas || 0), 0);
    const totalPacientes = resumen.reduce((s, r) => s + (r.pacientes_unicos || 0), 0);
    const totalMedicos = resumen.reduce((s, r) => s + (r.medicos_unicos || 0), 0);
    const totalRecetas = resumen.reduce((s, r) => s + (r.recetas_unicas || 0), 0);
    const totalRecetado = resumen.reduce((s, r) => s + (r.total_recetado || 0), 0);
    const totalDispensado = resumen.reduce((s, r) => s + (r.total_dispensado || 0), 0);
    const totalFaltante = resumen.reduce((s, r) => s + (r.total_faltante || 0), 0);

    const tasaGlobal = totalRecetado > 0 ? totalDispensado / totalRecetado : 0;

    document.getElementById('kpi-total').textContent = Utils.formatNumber(totalLineas);
    document.getElementById('kpi-pacientes').textContent = Utils.formatNumber(totalPacientes);
    document.getElementById('kpi-medicos').textContent = Utils.formatNumber(totalMedicos);
    document.getElementById('kpi-recetas').textContent = Utils.formatNumber(totalRecetas);
    document.getElementById('kpi-faltante').textContent = Utils.formatNumber(totalFaltante);
    document.getElementById('kpi-tasa-dispensacion').textContent = Utils.formatPercentage(tasaGlobal);

    this.updateTrends();

    // Metadatos en panel de resumen
    if (this.data.metadata) {
      const m = this.data.metadata;
      const periodo = m.date_range_start && m.date_range_end
        ? `${m.date_range_start} a ${m.date_range_end}`
        : 'Sin información';

      document.getElementById('info-total-registros').textContent =
        Utils.formatNumber(m.total_records || 0);
      document.getElementById('footer-total-records').textContent =
        Utils.formatNumber(m.total_records || 0);
      document.getElementById('info-pacientes-unicos').textContent =
        Utils.formatNumber(m.unique_patients || 0);
      document.getElementById('info-medicos-unicos').textContent =
        Utils.formatNumber(m.unique_doctors || 0);
      document.getElementById('info-farmacias-activas').textContent =
        Utils.formatNumber(m.unique_pharmacies || 0);
      document.getElementById('info-medicamentos-unicos').textContent =
        Utils.formatNumber(m.unique_medications || 0);
      document.getElementById('info-periodo').textContent = periodo;
    }
  }

  updateTrends() {
    const resumen = this.getResumenFiltrado();
    if (!resumen || resumen.length < 2) return;

    const ultimo = resumen[resumen.length - 1];
    const anterior = resumen[resumen.length - 2];

    const computeTrend = (actual, prev) => {
      if (prev === 0 || prev === null || prev === undefined) {
        return { value: 0, direction: 'up' };
      }
      const diff = ((actual - prev) / prev) * 100;
      return {
        value: Math.abs(diff).toFixed(1),
        direction: diff >= 0 ? 'up' : 'down'
      };
    };

    const map = {
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

    Object.entries(map).forEach(([id, t]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const icon = t.direction === 'up' ? 'fa-arrow-up' : 'fa-arrow-down';
      const cls = t.direction === 'up' ? 'positive' : 'negative';
      el.innerHTML = `<i class="fas ${icon} ${cls}"></i><span>${t.value}% vs mes anterior</span>`;
    });
  }

  renderCharts() {
    const resumen = this.getResumenFiltrado();
    if (!resumen || resumen.length === 0) return;

    const labels = resumen.map(r => Utils.monthLabel(r.anio, r.mes));
    const totalLineas = resumen.map(r => r.total_lineas || 0);
    const totalRecetado = resumen.map(r => r.total_recetado || 0);
    const totalDispensado = resumen.map(r => r.total_dispensado || 0);

    // Destruir gráficos previos si existen
    Object.values(this.charts).forEach(ch => {
      if (ch && typeof ch.destroy === 'function') ch.destroy();
    });
    this.charts = {};

    // Evolución
    const ctxEvo = document.getElementById('chart-evolucion');
    if (ctxEvo) {
      this.charts.evolucion = new Chart(ctxEvo.getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Líneas totales',
            data: totalLineas,
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

    // Distribución por mes
    const ctxDist = document.getElementById('chart-distribucion-mes');
    if (ctxDist) {
      this.charts.distribucion = new Chart(ctxDist.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: totalLineas,
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

    // Comparativa recetado vs dispensado
    const ctxComp = document.getElementById('chart-comparativa');
    if (ctxComp) {
      this.charts.comparativa = new Chart(ctxComp.getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Recetado',
              data: totalRecetado,
              backgroundColor: 'rgba(59,130,246,0.8)'
            },
            {
              label: 'Dispensado',
              data: totalDispensado,
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
    resumen.forEach(r => {
      const tasa = r.tasa_dispensacion_global || 0;
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

    if (this.tables.resumen) {
      this.tables.resumen.destroy();
    }
    this.tables.resumen = $('#tabla-resumen').DataTable({
      pageLength: 12,
      order: [[0, 'asc']],
      responsive: true,
      language: { url: '//cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' }
    });
  }

  renderTablaMedicamentos() {
    const ultimo = this.getUltimoPeriodo();
    const tbody = document.getElementById('tabla-medicamentos-body');
    if (!tbody || !ultimo) return;

    const { anio, mes } = ultimo;
    const datos = (this.data.topMedicamentos || [])
      .filter(d => d.anio === anio && d.mes === mes)
      .sort((a, b) => (a.ranking_mes || 9999) - (b.ranking_mes || 9999))
      .slice(0, 50);

    tbody.innerHTML = '';
    datos.forEach(d => {
      const faltante = (d.recetado || 0) - (d.dispensado || 0);
      const tasa = d.tasa_global || 0;
      const nombre =
        d.TextoBreveMedicamento ||
        d.medicamento_desc ||
        d.descripcion ||
        String(d.MedicamentoSAP || '');

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
        <td>#${d.ranking_mes || ''}</td>
      `;
      tbody.appendChild(row);
    });

    if (this.tables.medicamentos) {
      this.tables.medicamentos.destroy();
    }
    this.tables.medicamentos = $('#tabla-medicamentos').DataTable({
      pageLength: 20,
      order: [[3, 'desc']],
      responsive: true,
      language: { url: '//cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' }
    });
  }

  renderTablaFarmacias() {
    const tbody = document.getElementById('tabla-farmacias-body');
    if (!tbody) return;

    const datos = this.data.farmaciaSummary || [];
    tbody.innerHTML = '';

    datos.forEach(d => {
      const nombre =
        d.farmacia_nombre ||
        d.farmacia_desc ||
        `Farmacia ${d.farmacia_id || ''}`;
      const tasaDisp = d.tasa_dispensacion || 0;
      const tasaFalt = d.tasa_faltante || 0;
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

    if (this.tables.farmacias) {
      this.tables.farmacias.destroy();
    }
    this.tables.farmacias = $('#tabla-farmacias').DataTable({
      pageLength: 20,
      order: [[0, 'asc']],
      responsive: true,
      language: { url: '//cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' }
    });
  }

  renderTablaMedicos() {
    const tbody = document.getElementById('tabla-medicos-body');
    if (!tbody) return;

    const datos = this.data.medicoSummary || [];
    tbody.innerHTML = '';

    datos.forEach(d => {
      const nombre =
        d.medico_nombre ||
        d.medico_desc ||
        `Médico ${d.medico_id || ''}`;
      const propCronicas = d.porcentaje_cronicas || 0;
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

    if (this.tables.medicos) {
      this.tables.medicos.destroy();
    }
    this.tables.medicos = $('#tabla-medicos').DataTable({
      pageLength: 20,
      order: [[3, 'desc']],
      responsive: true,
      language: { url: '//cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' }
    });
  }

  renderTablaAlertas() {
    const tbody = document.getElementById('tabla-alertas-body');
    if (!tbody) return;

    const datos = this.data.stockAlerts || [];
    tbody.innerHTML = '';

    datos.forEach(d => {
      const farmacia =
        d.farmacia_nombre ||
        d.farmacia_desc ||
        `Farmacia ${d.farmacia_id || ''}`;
      const nombreMed =
        d.TextoBreveMedicamento ||
        d.medicamento_desc ||
        d.descripcion ||
        '';
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

    if (this.tables.alertas) {
      this.tables.alertas.destroy();
    }
    this.tables.alertas = $('#tabla-alertas').DataTable({
      pageLength: 20,
      order: [[3, 'asc']],
      responsive: true,
      language: { url: '//cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' }
    });
  }

  updateLastUpdate() {
    const meta = this.data.metadata;
    const lu = this.data.lastUpdate;
    const fuente = lu && lu.last_updated
      ? lu.last_updated
      : meta && meta.generated_at
        ? meta.generated_at
        : null;
    const texto = Utils.formatLocalDate(fuente);

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
    const original = btn.innerHTML;
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
      btn.innerHTML = original;
    }
  }

  exportData() {
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
  }

  toggleTheme() {
    const body = document.body;
    body.classList.toggle('dark-theme');
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    if (body.classList.contains('dark-theme')) {
      btn.innerHTML = '<i class="fas fa-sun"></i> Tema claro';
    } else {
      btn.innerHTML = '<i class="fas fa-moon"></i> Tema oscuro';
    }
  }

  switchTab(tabId) {
    document.querySelectorAll('.tabs-nav li').forEach(li => {
      li.classList.toggle('active', li.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-pane').forEach(p => {
      p.classList.toggle('active', p.id === tabId);
    });
  }

  updateChartMetric(metric) {
    const chart = this.charts.evolucion;
    if (!chart) return;

    const resumen = this.getResumenFiltrado();
    let data;
    let label;

    switch (metric) {
      case 'pacientes_unicos':
        data = resumen.map(r => r.pacientes_unicos || 0);
        label = 'Pacientes únicos';
        break;
      case 'total_dispensado':
        data = resumen.map(r => r.total_dispensado || 0);
        label = 'Unidades dispensadas';
        break;
      case 'total_faltante':
        data = resumen.map(r => r.total_faltante || 0);
        label = 'Unidades faltantes';
        break;
      default:
        data = resumen.map(r => r.total_lineas || 0);
        label = 'Líneas totales';
    }

    chart.data.datasets[0].data = data;
    chart.data.datasets[0].label = label;
    chart.update();
  }

  showHelp() {
    alert(
      'IPS Recetas Dashboard\n\n' +
      'Este tablero muestra indicadores agregados de recetas.\n\n' +
      '• Use el filtro de año para acotar el período.\n' +
      '• Los KPIs muestran totales sobre el período seleccionado.\n' +
      '• Los gráficos permiten visualizar tendencias y comparaciones.\n' +
      '• Las pestañas contienen detalles por mes, medicamento, farmacia y médico.\n\n' +
      'Los datos son agregados y anonimizados, no incluyen información identificable.'
    );
  }

  showNotification(message, type = 'info') {
    const div = document.createElement('div');
    div.className = `notification notification-${type === 'success' ? 'success' : 'error'}`;
    div.innerHTML = `
      <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
      <span>${message}</span>
    `;
    document.body.appendChild(div);

    setTimeout(() => {
      div.style.animation = 'slideOut 0.25s ease';
      setTimeout(() => div.remove(), 260);
    }, 2500);
  }

  showError(message) {
    const overlay = document.createElement('div');
    overlay.className = 'error-overlay';
    overlay.innerHTML = `
      <div class="error-content">
        <i class="fas fa-triangle-exclamation" style="font-size:2rem;color:#ef4444;"></i>
        <h3>Error al cargar el dashboard</h3>
        <p style="margin:0.6rem 0 1rem 0;">${message}</p>
        <button class="btn btn-primary" type="button">
          <i class="fas fa-rotate"></i> Reintentar
        </button>
      </div>
    `;
    overlay.querySelector('button').addEventListener('click', () => {
      window.location.reload();
    });
    document.body.appendChild(overlay);
  }
}

window.Dashboard = Dashboard;

