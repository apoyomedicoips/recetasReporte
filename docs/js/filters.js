// docs/js/filters.js - MANEJADOR DE FILTROS SIMPLIFICADO
class FiltersManager {
  constructor(dashboard) {
    this.dashboard = dashboard;
    this.filters = {
      farmacias: [],
      medicos: [],
      medicamentos: []
    };
  }

  async init() {
    await this.loadFilterOptions();
    this.bindEvents();
  }

  async loadFilterOptions() {
    try {
      // Cargar opciones de filtro
      const [farmacias, medicos, medicamentos] = await Promise.all([
        this.fetchOptions('data/filtro_farmacias.json'),
        this.fetchOptions('data/filtro_medicos.json'),
        this.fetchOptions('data/filtro_medicamentos.json')
      ]);

      // Cargar farmacias
      if (farmacias.length > 0) {
        const select = document.getElementById('filter-farmacia');
        farmacias.forEach(f => {
          const opt = document.createElement('option');
          opt.value = f.FarmaciaVentanilla || f.id || '';
          opt.textContent = f.nombre_farmacia || f.nombre || `Farmacia ${f.FarmaciaVentanilla || ''}`;
          select.appendChild(opt);
        });
        
        // Inicializar Select2 si está disponible
        if (typeof $ !== 'undefined' && $.fn.select2) {
          $(select).select2({
            placeholder: "Todas las farmacias",
            allowClear: true
          });
        }
      }

      // Cargar médicos
      if (medicos.length > 0) {
        const select = document.getElementById('filter-medico');
        medicos.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.CódigodelMédico || m.id || '';
          opt.textContent = m.nombre_medico || m.nombre || `Médico ${m.CódigodelMédico || ''}`;
          select.appendChild(opt);
        });
        
        if (typeof $ !== 'undefined' && $.fn.select2) {
          $(select).select2({
            placeholder: "Todos los médicos",
            allowClear: true
          });
        }
      }

      // Cargar medicamentos
      if (medicamentos.length > 0) {
        const select = document.getElementById('filter-medicamento');
        medicamentos.forEach(m => {
          const opt = document.createElement('option');
          opt.value = m.MedicamentoSAP || m.id || '';
          opt.textContent = m.nombre_medicamento || m.TextoBreveMedicamento || m.nombre || `Medicamento ${m.MedicamentoSAP || ''}`;
          select.appendChild(opt);
        });
        
        if (typeof $ !== 'undefined' && $.fn.select2) {
          $(select).select2({
            placeholder: "Todos los medicamentos",
            allowClear: true
          });
        }
      }

    } catch (err) {
      console.warn("Error cargando opciones de filtro:", err);
    }
  }

  async fetchOptions(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn(`No se pudo cargar ${url}:`, err);
      return [];
    }
  }

  bindEvents() {
    // Botón aplicar filtros
    const applyBtn = document.getElementById('apply-filters');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => this.applyFilters());
    }

    // Botón limpiar filtros
    const resetBtn = document.getElementById('reset-filters');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetFilters());
    }

    // Selectores de pacientes crónicos
    document.querySelectorAll('input[name="cronico"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.filters.cronico = e.target.value;
      });
    });

    // Slider de tasa
    const tasaSlider = document.getElementById('filter-tasa');
    if (tasaSlider) {
      tasaSlider.addEventListener('input', (e) => {
        const value = e.target.value;
        const valueSpan = document.getElementById('tasa-value');
        if (valueSpan) {
          valueSpan.textContent = value + '%';
        }
        this.filters.tasaMin = value / 100;
      });
    }
  }

  applyFilters() {
    // Obtener valores actuales
    this.filters.farmacias = this.getSelectValues('filter-farmacia');
    this.filters.medicos = this.getSelectValues('filter-medico');
    this.filters.medicamentos = this.getSelectValues('filter-medicamento');

    console.log('Filtros aplicados:', this.filters);
    
    // En una implementación real, aquí se filtrarían los datos
    // Por ahora solo mostramos notificación
    if (this.dashboard) {
      this.dashboard.showNotification('Filtros aplicados (funcionalidad en desarrollo)', 'info');
    }
  }

  getSelectValues(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return [];
    
    // Si tiene Select2, usar su API
    if (typeof $ !== 'undefined' && $(select).data('select2')) {
      return $(select).val() || [];
    }
    
    // Si no, obtener valores normalmente
    return Array.from(select.selectedOptions).map(opt => opt.value);
  }

  resetFilters() {
    this.filters = {
      farmacias: [],
      medicos: [],
      medicamentos: [],
      cronico: 'all',
      tasaMin: 0
    };

    // Limpiar selects
    ['filter-farmacia', 'filter-medico', 'filter-medicamento'].forEach(id => {
      const select = document.getElementById(id);
      if (select) {
        if (typeof $ !== 'undefined' && $(select).data('select2')) {
          $(select).val(null).trigger('change');
        } else {
          select.selectedIndex = -1;
        }
      }
    });

    // Restablecer radio buttons
    const allRadio = document.querySelector('input[name="cronico"][value="all"]');
    if (allRadio) allRadio.checked = true;

    // Restablecer slider
    const tasaSlider = document.getElementById('filter-tasa');
    const tasaValue = document.getElementById('tasa-value');
    if (tasaSlider) tasaSlider.value = 0;
    if (tasaValue) tasaValue.textContent = '0%';

    // Notificar al dashboard
    if (this.dashboard) {
      this.dashboard.showNotification('Filtros limpiados', 'info');
      // Recargar datos sin filtros
      this.dashboard.refreshData();
    }
  }
}

window.FiltersManager = FiltersManager;
