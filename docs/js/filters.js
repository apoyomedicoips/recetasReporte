// docs/js/filters.js
class FiltersManager {
  constructor(dashboard) {
    this.dashboard = dashboard;
  }

  async init() {
    await this.loadOptions();
    this.bindEvents();
  }

  async loadOptions() {
    const paths = ['filtro_farmacias.json', 'filtro_medicos.json', 'filtro_medicamentos.json'];
    const ids = ['filter-farmacia', 'filter-medico', 'filter-medicamento'];

    for (let i = 0; i < paths.length; i++) {
      try {
        const data = await fetch('data/' + paths[i]).then(r => r.json());
        const select = document.getElementById(ids[i]);
        data.forEach(item => {
          const opt = new Option(
            item.nombre_farmacia || item.nombre_medico || item.TextoBreveMedicamento || item.nombre,
            item.FarmaciaVentanilla || item.CódigodelMédico || item.MedicamentoSAP
          );
          select.add(opt);
        });
        if ($.fn.select2) $(select).select2({ placeholder: "Todos", allowClear: true });
      } catch (e) { console.warn('No se cargó filtro:', paths[i]); }
    }
  }

  bindEvents() {
    document.getElementById('apply-filters')?.addEventListener('click', () => this.apply());
    document.getElementById('reset-filters')?.addEventListener('click', () => this.reset());
    document.getElementById('filter-tasa')?.addEventListener('input', e => {
      document.getElementById('tasa-value').textContent = e.target.value + '%';
    });
  }

  apply() {
    this.dashboard.filters = {
      farmacias: Array.from(document.getElementById('filter-farmacia').selectedOptions).map(o => o.value),
      medicos: Array.from(document.getElementById('filter-medico').selectedOptions).map(o => o.value),
      medicamentos: Array.from(document.getElementById('filter-medicamento').selectedOptions).map(o => o.value),
      tasaMin: document.getElementById('filter-tasa').value / 100
    };
    this.dashboard.renderTablaMedicamentos();
    this.dashboard.showNotification('Filtros aplicados', 'success');
  }

  reset() {
    ['filter-farmacia','filter-medico','filter-medicamento'].forEach(id => {
      const el = document.getElementById(id);
      if ($.fn.select2) $(el).val(null).trigger('change');
      else el.selectedIndex = -1;
    });
    document.getElementById('filter-tasa').value = 0;
    document.getElementById('tasa-value').textContent = '0%';
    this.dashboard.filters = { farmacias: [], medicos: [], medicamentos: [], tasaMin: 0 };
    this.dashboard.renderAll();
  }
}

window.FiltersManager = FiltersManager;
