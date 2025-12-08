
class FiltersManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.filters = { fechaInicio: null, fechaFin: null, farmacias: [], medicos: [], medicamentos: [], cronico: 'all', tasaMin: 0 };
        this.init();
    }

    init() {
        this.setupDatePicker();
        this.setupTasaSlider();
        this.bindEvents();
        this.loadFilterOptions();
    }

    setupDatePicker() {
        if (document.getElementById('date-range')) {
            flatpickr("#date-range", { mode: "range", dateFormat: "Y-m-d", locale: "es", onChange: (dates) => {
                if (dates.length === 2) {
                    this.filters.fechaInicio = dates[0];
                    this.filters.fechaFin = dates[1];
                }
            } });
        }
    }

    setupTasaSlider() {
        const slider = document.getElementById('filter-tasa');
        const value = document.getElementById('tasa-value');
        if (slider && value) {
            slider.addEventListener('input', () => {
                this.filters.tasaMin = slider.value / 100;
                value.textContent = slider.value + '%';
            });
        }
    }

    async loadFilterOptions() {
        try {
            const farmaciasRes = await fetch('data/filtro_farmacias.json');
            if (farmaciasRes.ok) {
                const farmacias = await farmaciasRes.json();
                const select = document.getElementById('filter-farmacia');
                farmacias.forEach(f => {
                    const opt = new Option(f.nombre_farmacia || `Farmacia ${f.FarmaciaVentanilla}`, f.FarmaciaVentanilla);
                    select.add(opt);
                });
                $(select).select2({ placeholder: "Todas las farmacias", allowClear: true });
            }

            const medicosRes = await fetch('data/filtro_medicos.json');
            if (medicosRes.ok) {
                const medicos = await medicosRes.json();
                const select = document.getElementById('filter-medico');
                medicos.forEach(m => {
                    const opt = new Option(m.nombre_medico || `Médico ${m.CódigodelMédico}`, m.CódigodelMédico);
                    select.add(opt);
                });
                $(select).select2({ placeholder: "Todos los médicos", allowClear: true });
            }

            const medicamentosRes = await fetch('data/filtro_medicamentos.json');
            if (medicamentosRes.ok) {
                const medicamentos = await medicamentosRes.json();
                const select = document.getElementById('filter-medicamento');
                medicamentos.forEach(m => {
                    const opt = new Option(m.nombre_medicamento || `Medicamento ${m.MedicamentoSAP}`, m.MedicamentoSAP);
                    select.add(opt);
                });
                $(select).select2({ placeholder: "Todos los medicamentos", allowClear: true });
            }
        } catch (err) {
            console.warn("Filtros no cargados", err);
        }
    }

    bindEvents() {
        document.getElementById('apply-filters')?.addEventListener('click', () => this.applyFilters());
        document.getElementById('reset-filters')?.addEventListener('click', () => this.resetFilters());
        document.getElementById('toggle-sidebar')?.addEventListener('click', () => {
            const sidebar = document.querySelector('.sidebar');
            sidebar.classList.toggle('collapsed');
        });
        document.querySelectorAll('input[name="cronico"]').forEach(r => r.addEventListener('change', e => this.filters.cronico = e.target.value));
    }

    applyFilters() {
        this.filters.farmacias = $('#filter-farmacia').val() || [];
        this.filters.medicos = $('#filter-medico').val() || [];
        this.filters.medicamentos = $('#filter-medicamento').val() || [];
        console.log("Filtros:", this.filters);
        this.dashboard.showNotification('Filtros aplicados', 'success');
    }

    resetFilters() {
        this.filters = { fechaInicio: null, fechaFin: null, farmacias: [], medicos: [], medicamentos: [], cronico: 'all', tasaMin: 0 };
        flatpickr("#date-range")?.clear();
        $('#filter-farmacia, #filter-medico, #filter-medicamento').val(null).trigger('change');
        document.querySelector('input[name="cronico"][value="all"]').checked = true;
        document.getElementById('filter-tasa').value = 0;
        document.getElementById('tasa-value').textContent = '0%';
        this.dashboard.showNotification('Filtros limpiados', 'info');
    }
}

window.FiltersManager = FiltersManager;
