// docs/js/dashboard.js - DASHBOARD SUPER GENIAL 2025
class Dashboard {
  constructor() {
    this.data = {
      resumen: [], topMedicamentos: [], topFarmacias: [], topMedicos: [],
      farmaciaSummary: [], medicoSummary: [], stockAlerts: [],
      metadata: {}, lastUpdate: {}
    };
    this.filters = { farmacias: [], medicos: [], medicamentos: [], cronico: 'all', tasaMin: 0 };
    this.charts = {};
    this.tables = {};
  }

  async init() {
    this.showLoading(true);
    await this.loadData();
    this.renderAll();
    this.bindEvents();
    this.showLoading(false);
  }

  async loadData() {
    const base = 'data';
    const files = [
      'resumen_mensual.json', 'top_medicamentos.json', 'top_farmacias.json', 'top_medicos.json',
      'farmacia_summary.json', 'medico_summary.json', 'stock_alerts.json',
      'metadata.json', 'last_update.json'
    ];
    const defaults = [[], [], [], [], [], [], [], {}, {}];

    const results = await Promise.all(
      files.map(file => this.safeFetch(`${base}/${file}`, defaults[files.indexOf(file)]))
    );

    this.data = {
      resumen: results[0],
      topMedicamentos: results[1],
      topFarmacias: results[2],
      topMedicos: results[3],
      farmaciaSummary: results[4],
      medicoSummary: results[5],
      stockAlerts: results[6],
      metadata: results[7],
      lastUpdate: results[8]
    };
  }

  async safeFetch(url, fallback) {
    try {
      const r = await fetch(url + '?t=' + Date.now());
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (e) {
      console.warn('Falló carga:', url, e);
      return fallback;
    }
  }

  renderAll() {
    this.renderKPIs();
    this.renderChartEvolucion();
    this.renderChartTopMedicamentos();
    this.renderChartDispensacionPie();
    this.renderTablaMedicamentos();
    this.renderTablaFarmacias();
    this.renderTablaMedicos();
    this.renderTablaStockAlerts();
    this.renderInsights();
    this.updateLastUpdate();
  }

  renderKPIs() {
    const src = this.data.resumen;
    const totalLineas = src.reduce((s, r) => s + (r.total_lineas || 0), 0);
    const totalPacientes = src.reduce((s, r) => s + (r.pacientes_unicos || 0), 0);
    const totalMedicos = src.reduce((s, r) => s + (r.medicos_unicos || 0), 0);
    const totalRecetado = src.reduce((s, r) => s + (r.total_recetado || 0), 0);
    const totalDispensado = src.reduce((s, r) => s + (r.total_dispensado || 0), 0);
    const faltante = totalRecetado - totalDispensado;
    const tasa = totalRecetado > 0 ? totalDispensado / totalRecetado : 0;

    document.getElementById('kpi-total').textContent = Utils.formatNumber(totalLineas);
    document.getElementById('kpi-pacientes').textContent = Utils.formatNumber(totalPacientes);
    document.getElementById('kpi-medicos').textContent = Utils.formatNumber(totalMedicos);
    document.getElementById('kpi-farmacias').textContent = Utils.formatNumber(this.data.farmaciaSummary.length || 0);
    document.getElementById('kpi-faltante').textContent = Utils.formatNumber(Math.max(0, faltante));
    document.getElementById('kpi-tasa-dispensacion').textContent = Utils.formatPercentage(tasa);
    if (this.data.metadata.total_records) {
      document.getElementById('footer-total-records').textContent = Utils.formatNumber(this.data.metadata.total_records);
    }
  }

  renderChartEvolucion() {
    const sorted = Utils.sortByKey(this.data.resumen, 'anio');
    const labels = sorted.map(r => Utils.monthLabel(r.anio, r.mes));
    const data = sorted.map(r => r.total_lineas || 0);

    const ctx = document.getElementById('chart-evolucion');
    if (!ctx) return;
    if (this.charts.evolucion) this.charts.evolucion.destroy();

    this.charts.evolucion = new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [{ label: 'Líneas por mes', data, borderColor: '#3b82f6', tension: 0.3, fill: true }] },
      options: { responsive: true, plugins: { legend: { position: 'top' } } }
    });
  }

  renderChartTopMedicamentos() {
    const top = Utils.sortByKey(this.data.topMedicamentos, 'total_lineas || lineas').slice(0, 10);
    const labels = top.map(m => (m.TextoBreveMedicamento || m.nombre_medicamento || 'Sin nombre').substring(0, 30));
    const values = top.map(m => m.total_lineas || m.lineas || 0);

    const ctx = document.getElementById('chart-top-medicamentos');
    if (!ctx) return;
    if (this.charts.topMed) this.charts.topMed.destroy();

    this.charts.topMed = new Chart(ctx.getContext('2d'), {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Líneas', data: values, backgroundColor: '#3b82f6' }] },
      options: { responsive: true, indexAxis: 'y' }
    });
  }

  renderChartDispensacionPie() {
    const rec = this.data.resumen.reduce((s, r) => s + (r.total_recetado || 0), 0);
    const disp = this.data.resumen.reduce((s, r) => s + (r.total_dispensado || 0), 0);
    const falt = rec - disp;

    const ctx = document.getElementById('chart-dispensacion-pie');
    if (!ctx) return;
    if (this.charts.pie) this.charts.pie.destroy();

    this.charts.pie = new Chart(ctx.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Dispensado', 'Faltante'],
        datasets: [{ data: [disp, falt], backgroundColor: ['#10b981', '#ef4444'] }]
      },
      options: { responsive: true }
    });
  }

  renderTablaMedicamentos() {
    const data = this.applyFilters(this.data.topMedicamentos);
    const tbody = document.querySelector('#tabla-medicamentos tbody');
    tbody.innerHTML = '';
    data.slice(0, 100).forEach(m => {
      const falt = (m.total_recetado || m.recetado || 0) - (m.total_dispensado || m.dispensado || 0);
      const tasa = m.tasa_global || 0;
      const nombre = m.TextoBreveMedicamento || m.nombre_medicamento || 'Sin nombre';
      tbody.innerHTML += `
        <tr>
          <td>${m.anio && m.mes ? Utils.monthLabel(m.anio, m.mes) : 'Total'}</td>
          <td>${nombre}</td>
          <td>${Utils.formatNumber(m.total_lineas || m.lineas || 0)}</td>
          <td>${Utils.formatNumber(m.total_recetado || m.recetado || 0)}</td>
          <td>${Utils.formatNumber(m.total_dispensado || m.dispensado || 0)}</td>
          <td>${Utils.formatNumber(falt)}</td>
          <td>${Utils.formatPercentage(tasa)}</td>
          <td>${m.ranking_mes || '-'}</td>
        </tr>`;
    });
    this.initDataTable('tabla-medicamentos');
  }

  renderTablaFarmacias() {
    const data = this.data.topFarmacias || this.data.farmaciaSummary;
    const tbody = document.querySelector('#tabla-farmacias tbody');
    tbody.innerHTML = '';
    data.slice(0, 50).forEach(f => {
      const falt = (f.total_recetado || 0) - (f.total_dispensado || 0);
      tbody.innerHTML += `
        <tr>
          <td>${f.nombre_farmacia || f.FarmaciaVentanilla || 'Desconocida'}</td>
          <td>${Utils.formatNumber(f.total_lineas || 0)}</td>
          <td>${Utils.formatNumber(f.pacientes_unicos || 0)}</td>
          <td>${Utils.formatNumber(f.total_dispensado || 0)}</td>
          <td>${Utils.formatNumber(falt)}</td>
          <td>${Utils.formatPercentage(f.tasa_dispensacion || 0)}</td>
        </tr>`;
    });
    this.initDataTable('tabla-farmacias');
  }

  renderTablaMedicos() {
    const data = this.data.topMedicos || this.data.medicoSummary;
    const tbody = document.querySelector('#tabla-medicos tbody');
    tbody.innerHTML = '';
    data.slice(0, 50).forEach(m => {
      const falt = (m.total_recetado || 0) - (m.total_dispensado || 0);
      tbody.innerHTML += `
        <tr>
          <td>${m.nombre_medico || 'Dr. ' + m.CódigodelMédico}</td>
          <td>${Utils.formatNumber(m.total_lineas || 0)}</td>
          <td>${Utils.formatNumber(m.pacientes_unicos || 0)}</td>
          <td>${Utils.formatNumber(m.total_dispensado || 0)}</td>
          <td>${Utils.formatNumber(falt)}</td>
          <td>${Utils.formatPercentage(m.tasa_dispensacion || 0)}</td>
        </tr>`;
    });
    this.initDataTable('tabla-medicos');
  }

  renderTablaStockAlerts() {
    const tbody = document.querySelector('#tabla-stock-alerts tbody');
    tbody.innerHTML = '';
    this.data.stockAlerts.slice(0, 100).forEach(a => {
      tbody.innerHTML += `
        <tr>
          <td>${a.farmacia_id || '-'}</td>
          <td>${a.MedicamentoSAP || '-'}</td>
          <td>${Utils.formatNumber(a.stock_actual || 0)}</td>
          <td>${Utils.formatNumber(a.demanda_mensual || 0)}</td>
          <td>${a.dias_para_agotarse || 'N/A'}</td>
        </tr>`;
    });
    this.initDataTable('tabla-stock-alerts');
  }

  applyFilters(data) {
    let filtered = [...data];
    if (this.filters.medicamentos.length > 0) {
      filtered = filtered.filter(i => this.filters.medicamentos.includes(i.MedicamentoSAP));
    }
    if (this.filters.tasaMin > 0) {
      filtered = filtered.filter(i => (i.tasa_global || 0) >= this.filters.tasaMin);
    }
    return filtered;
  }

  initDataTable(id) {
    if (!$.fn.DataTable) return;
    if (this.tables[id]) this.tables[id].destroy();
    this.tables[id] = $(`#${id}`).DataTable({
      pageLength: 10,
      responsive: true,
      language: { url: '//cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json' }
    });
  }

  renderInsights() {
    const container = document.getElementById('insights-list');
    if (!container) return;
    const medMaxFaltante = this.data.topMedicamentos.reduce((max, m) => {
      const f = (m.total_recetado || 0) - (m.total_dispensado || 0);
      return f > (max.f || 0) ? { n: m.TextoBreveMedicamento || 'Desconocido', f } : max;
    }, { f: 0 });

    const insights = [
      `Medicamento con más faltante: <strong>${medMaxFaltante.n}</strong> (${Utils.formatNumber(medMaxFaltante.f)} und)`,
      `Tendencia: ${this.data.resumen.length > 1 ? ((this.data.resumen.at(-1).total_lineas / this.data.resumen.at(-2).total_lineas - 1) * 100).toFixed(1) + '%' : 'N/A'}`,
      `Tasa global de dispensación: ${Utils.formatPercentage(this.data.resumen.reduce((s,r)=>s+(r.tasa_dispensacion||0),0)/this.data.resumen.length || 0)}`
    ];
    container.innerHTML = insights.map(i => `<div class="insight-card">${i}</div>`).join('');
  }

  updateLastUpdate() {
    const date = this.data.lastUpdate.last_updated || this.data.metadata.generated_at || null;
    const text = date ? Utils.formatLocalDate(date) : 'No disponible';
    document.getElementById('last-update-time').textContent = text;
    document.getElementById('footer-update-time').textContent = text;
  }

  bindEvents() {
    document.getElementById('refresh-btn')?.addEventListener('click', () => this.refresh());
    document.getElementById('theme-toggle')?.addEventListener('click', () => this.toggleTheme());
    document.querySelectorAll('.export-btn').forEach(btn => {
      btn.addEventListener('click', () => this.exportCSV(btn.dataset.table));
    });
    document.querySelectorAll('.tabs-nav li').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tabs-nav li').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
      });
    });
  }

  async refresh() {
    const btn = document.getElementById('refresh-btn');
    const old = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
    await this.loadData();
    this.renderAll();
    btn.disabled = false;
    btn.innerHTML = old;
    this.showNotification('Datos actualizados', 'success');
  }

  toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const isDark = document.body.classList.contains('dark-theme');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.querySelector('#theme-toggle i').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
  }

  showLoading(show) {
    document.getElementById('global-loader').style.display = show ? 'flex' : 'none';
  }

  showNotification(msg, type = 'info') {
    const n = document.createElement('div');
    n.className = `notification ${type}`;
    n.innerHTML = `${msg}<span class="close">&times;</span>`;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 4000);
  }

  exportCSV(tableId) {
    const table = document.getElementById(tableId);
    let csv = [];
    table.querySelectorAll('tr').forEach(row => {
      const cols = Array.from(row.querySelectorAll('th, td')).map(c => `"${c.textContent.trim().replace(/"/g, '""')}"`);
      csv.push(cols.join(','));
    });
    const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tableId}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }
}

window.Dashboard = Dashboard;
