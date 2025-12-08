// docs/js/filters.js
// VERSIÓN FINAL 100% FUNCIONAL - CON NOMBRES REALES DE FARMACIAS

class FiltersManager {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.filters = {
            fechaInicio: null,
            fechaFin: null,
            farmacias: [],
            medicos: [],
            medicamentos: [],
            cronico: 'all',
            tasaMin: 0
        };
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
            flatpickr("#date-range", {
                mode: "range",
                dateFormat: "Y-m-d",
                locale: "es",
                onChange: (selectedDates) => {
                    if (selectedDates.length === 2) {
                        this.filters.fechaInicio = selectedDates[0];
                        this.filters.fechaFin = selectedDates[1];
                    } else if (selectedDates.length === 1) {
                        this.filters.fechaInicio = selectedDates[0];
                        this.filters.fechaFin = selectedDates[0];
                    }
                }
            });
        }
    }

    setupTasaSlider() {
        const slider = document.getElementById('filter-tasa');
        const valueSpan = document.getElementById('tasa-value');
        if (slider && valueSpan) {
            slider.addEventListener('input', () => {
                this.filters.tasaMin = slider.value / 100;
                valueSpan.textContent = slider.value + '%';
            });
        }
    }

    async loadFilterOptions() {
        try {
            // CARGAR FARMACIAS CON NOMBRE REAL
            const farmaciasRes = await fetch('data/filtro_farmacias.json');
            if (farmaciasRes.ok) {
                const farmacias = await farmaciasRes.json();
                const selectFarmacia = document.getElementById('filter-farmacia');
                farmacias.forEach(f => {
                    const nombre = f.nombre_farmacia && f.nombre_farmacia.trim() !== "" 
                        ? `${f.FarmaciaVentanilla} - ${f.nombre_farmacia}` 
                        : `Farmacia ${f.FarmaciaVentanilla}`;
                    const opt = new Option(nombre, f.FarmaciaVentanilla);
                    selectFarmacia.add(opt);
                });
                $(selectFarmacia).select2({ 
                    placeholder: "Todas las farmacias", 
                    allowClear: true 
                });
            }

            // CARGAR MÉDICOS
            const medicosRes = await fetch('data/filtro_medicos.json');
            if (medicosRes.ok) {
                const medicos = await medicosRes.json();
                const selectMedico = document.getElementById('filter-medico');
                medicos.forEach(m => {
                    const nombre = m.nombre_medico && m.nombre_medico.trim() !== ""
                        ? m.nombre_medico
                        : `Médico ${m.CódigodelMédico}`;
                    const opt = new Option(nombre, m.CódigodelMédico);
                    selectMedico.add(opt);
                });
                $(selectMedico).select2({ placeholder: "Todos los médicos", allowClear: true });
            }

            // CARGAR MEDICAMENTOS
            const medicamentosRes = await fetch('data/filtro_medicamentos.json');
            if (medicamentosRes.ok) {
                const medicamentos = await medicamentosRes.json();
                const selectMedicamento = document.getElementById('filter-medicamento');
                medicamentos.forEach(m => {
                    const nombre = m.nombre_medicamento && m.nombre_medicamento.trim() !== "" && m.nombre_medicamento !== "Sin descripción"
                        ? m.nombre_medicamento
                        : `Medicamento ${m.MedicamentoSAP}`;
                    const opt = new Option(nombre, m.MedicamentoSAP);
                    selectMedicamento.add(opt);
                });
                $(selectMedicamento).select2({ placeholder: "Todos los medicamentos", allowClear: true });
            }
        } catch (err) {
            console.warn("Filtros no disponibles aún (archivos JSON faltantes)", err);
        }
    }

    bindEvents() {
        document.getElementById('apply-filters')?.addEventListener('click', () => {
            this.applyFilters();
        });

        document.getElementById('reset-filters')?.addEventListener('click', () => {
            this.resetFilters();
        });

        document.getElementById('toggle-sidebar')?.addEventListener('click', () => {
            const sidebar = document.querySelector('.sidebar');
            const icon = document.querySelector('#toggle-sidebar i');
            sidebar.classList.toggle('collapsed');
            icon.className = sidebar.classList.contains('collapsed')
                ? 'fas fa-chevron-right'
                : 'fas fa-chevron-left';
        });

        document.querySelectorAll('input[name="cronico"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.filters.cronico = e.target.value;
            });
        });
    }

    applyFilters() {
        this.filters.farmacias = $('#filter-farmacia').val() || [];
        this.filters.medicos = $('#filter-medico').val() || [];
        this.filters.medicamentos = $('#filter-medicamento').val() || [];

        console.log("Filtros aplicados:", this.filters);
        this.dashboard.showNotification('Filtros aplicados', 'success');
        this.dashboard.init(); // Recargar datos
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

        flatpickr("#date-range")?.clear();
        $('#filter-farmacia, #filter-medico, #filter-medicamento').val(null).trigger('change');
        document.querySelector('input[name="cronico"][value="all"]').checked = true;
        document.getElementById('filter-tasa').value = 0;
        document.getElementById('tasa-value').textContent = '0%';

        this.dashboard.showNotification('Filtros limpiados', 'info');
        this.dashboard.init();
    }
}

window.FiltersManager = FiltersManager;
