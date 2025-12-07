// filters.js
class FiltersManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.filters = {
            fechaInicio: null,
            fechaFin: null,
            farmacias: [],
            medicos: [],
            medicamentos: [],
            cronico: 'all', // 'all', '1', '0'
            tasaMin: 0
        };
        this.init();
    }

    init() {
        this.setupDatePicker();
        this.setupSelects();
        this.setupTasaSlider();
        this.bindEvents();
    }

    setupDatePicker() {
        flatpickr("#date-range", {
            mode: "range",
            dateFormat: "Y-m-d",
            locale: "es",
            onChange: (selectedDates) => {
                if (selectedDates.length === 2) {
                    this.filters.fechaInicio = selectedDates[0];
                    this.filters.fechaFin = selectedDates[1];
                }
            }
        });
    }

    setupSelects() {
        $('#filter-farmacia').select2({ 
            placeholder: "Todas las farmacias", 
            allowClear: true,
            width: '100%'
        });
        $('#filter-medico').select2({ 
            placeholder: "Todos los médicos", 
            allowClear: true,
            width: '100%'
        });
        $('#filter-medicamento').select2({ 
            placeholder: "Todos los medicamentos", 
            allowClear: true,
            width: '100%'
        });

        // Cargar opciones desde datos
        setTimeout(() => this.loadFilterOptions(), 2000);
    }

    loadFilterOptions() {
        const { farmacias, medicos, medicamentos } = this.dashboard.data;

        // Farmacias
        if (farmacias && farmacias.length > 0) {
            const farmaciaOpts = farmacias.map(f => `<option value="${f.id}">${f.id} - Farmacia ${f.id}</option>`).join('');
            $('#filter-farmacia').append(farmaciaOpts).trigger('change');
        }

        // Médicos
        if (medicos && medicos.length > 0) {
            const medicoOpts = medicos.map(m => `<option value="${m.id}">${m.nombre || m.id}</option>`).join('');
            $('#filter-medico').append(medicoOpts).trigger('change');
        }

        // Medicamentos
        if (medicamentos && medicamentos.length > 0) {
            const medOpts = medicamentos.slice(0, 100).map(m => `<option value="${m.MedicamentoSAP}">${m.MedicamentoSAP}</option>`).join('');
            $('#filter-medicamento').append(medOpts).trigger('change');
        }
    }

    setupTasaSlider() {
        const slider = document.getElementById('filter-tasa');
        const value = document.getElementById('tasa-value');
        if (slider) {
            slider.addEventListener('input', () => {
                this.filters.tasaMin = slider.value / 100;
                value.textContent = slider.value + '%';
            });
        }
    }

    bindEvents() {
        // Aplicar filtros
        const applyBtn = document.getElementById('apply-filters');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this.applyFilters();
            });
        }

        // Resetear filtros
        const resetBtn = document.getElementById('reset-filters');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetFilters();
            });
        }

        // Colapsar sidebar
        const collapseBtn = document.getElementById('collapse-sidebar');
        if (collapseBtn) {
            collapseBtn.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }

        // Crónico radio buttons
        document.querySelectorAll('input[name="cronico"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.filters.cronico = e.target.value;
            });
        });
    }

    applyFilters() {
        // Recopilar valores actuales
        this.filters.farmacias = $('#filter-farmacia').val() || [];
        this.filters.medicos = $('#filter-medico').val() || [];
        this.filters.medicamentos = $('#filter-medicamento').val() || [];

        this.dashboard.applyFilters(this.filters);
        this.dashboard.showNotification('Filtros aplicados', 'success');
    }

    resetFilters() {
        this.filters = {
            fechaInicio: null,
            fechaFin: null,
            farmacias: [],
            medicos: [],
            medicamentos: [],
            cronico: 'all',
            tasaMin: 0
        };

        flatpickr("#date-range").clear();
        $('#filter-farmacia, #filter-medico, #filter-medicamento').val(null).trigger('change');
        document.querySelector('input[name="cronico"][value="all"]').checked = true;
        document.getElementById('filter-tasa').value = 0;
        document.getElementById('tasa-value').textContent = '0%';

        this.dashboard.loadAllData();
        this.dashboard.showNotification('Filtros limpiados', 'info');
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const icon = document.querySelector('#collapse-sidebar i');
        sidebar.classList.toggle('collapsed');
        
        if (sidebar.classList.contains('collapsed')) {
            icon.className = 'fas fa-chevron-right';
        } else {
            icon.className = 'fas fa-chevron-left';
        }
    }
}

window.FiltersManager = FiltersManager;
