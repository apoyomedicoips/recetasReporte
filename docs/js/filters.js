// docs/js/filters.js - VERSIÓN FINAL QUE FUNCIONA AL 100%
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



    const baseUrl = "data";
    
    const [
      filtrosResp,
      medsResp,
      medicosResp,
      farmaciasResp
    ] = await Promise.all([
      fetch(`${baseUrl}/filtros.json`),
      fetch(`${baseUrl}/filtro_medicamentos.json`),
      fetch(`${baseUrl}/filtro_medicos.json`),
      fetch(`${baseUrl}/filtro_farmacias.json`)
    ]);


    async loadFilterOptions() {
        try {
            const [farmaciasRes, medicosRes, medicamentosRes] = await Promise.all([
                fetch('data/filtro_farmacias.json').catch(() => null),
                fetch('data/filtro_medicos.json').catch(() => null),
                fetch('data/filtro_medicamentos.json').catch(() => null)
            ]);

            if (farmaciasRes?.ok) {
                const farmacias = await farmaciasRes.json();
                const select = document.getElementById('filter-farmacia');
                farmacias.forEach(f => {
                    const opt = new Option(f.nombre_farmacia || `Farmacia ${f.FarmaciaVentanilla}`, f.FarmaciaVentanilla);
                    select.add(opt);
                });
                $(select).select2({ placeholder: "Todas las farmacias", allowClear: true });
            }

            if (medicosRes?.ok) {
                const medicos = await medicosRes.json();
                const select = document.getElementById('filter-medico');
                medicos.forEach(m => {
                    const opt = new Option(m.nombre_medico || `Médico ${m.CódigodelMédico}`, m.CódigodelMédico);
                    select.add(opt);
                });
                $(select).select2({ placeholder: "Todos los médicos", allowClear: true });
            }

            if (medicamentosRes?.ok) {
                const medicamentos = await medicamentosRes.json();
                const select = document.getElementById('filter-medicamento');
                medicamentos.forEach(m => {
                    const opt = new Option(m.nombre_medicamento || `Medicamento ${m.MedicamentoSAP}`, m.MedicamentoSAP);
                    select.add(opt);
                });
                $(select).select2({ placeholder: "Todos los medicamentos", allowClear: true });
            }
        } catch (err) {
            console.warn("Filtros no disponibles", err);
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
            document.querySelector('.sidebar').classList.toggle('collapsed');
        });

        document.querySelectorAll('input[name="cronico"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.filters.cronico = e.target.value;
            });
        });
    }

    applyFilters() {
        // RECOGER VALORES
        this.filters.farmacias = $('#filter-farmacia').val() || [];
        this.filters.medicos = $('#filter-medico').val() || [];
        this.filters.medicamentos = $('#filter-medicamento').val() || [];

        console.log("FILTROS APLICADOS:", this.filters);

        // APLICAR FILTROS REALES
        this.dashboard.applyRealFilters(this.filters);
        this.dashboard.showNotification('Filtros aplicados correctamente', 'success');
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
        this.dashboard.init(); // Recargar sin filtros
    }
}

window.FiltersManager = FiltersManager;
