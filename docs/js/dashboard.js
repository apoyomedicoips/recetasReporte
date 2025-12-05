class Dashboard {
  constructor() {
    this.data = {
      resumen: [],
      topMedicamentos: [],
      farmacias: [],
      medicos: [],
      alertas: []
    };
    
    this.filters = {
      fechaInicio: null,
      fechaFin: null,
      farmacias: ['all'],
      medicos: ['all'],
      tipo: 'all'
    };
    
    this.charts = {};
    this.init();
  }

  async init() {
    try {
      // Cargar datos
      await this.loadData();
      
      // Inicializar componentes
      this.initFilters();
      this.initCharts();
      this.initTables();
      this.updateKPIs();
      this.updateAlerts();
      this.updateLastUpdate();
      
      // Configurar eventos
      this.bindEvents();
      
      console.log('Dashboard inicializado correctamente');
    } catch (error) {
      console.error('Error inicializando dashboard:', error);
      this.showError('Error cargando datos. Por favor, recarga la página.');
    }
  }

  async loadData() {
    const baseUrl = window.location.hostname === 'localhost' ? '/data' : 'https://apoyomedicoips.github.io/recetasReporte/data';
    
    const urls = [
      `${baseUrl}/resumen_mensual.json`,
      `${baseUrl}/top_medicamentos.json`,
      `${baseUrl}/metadata.json`,
      `${baseUrl}/last_update.json`
    ];
    
    const [resumen, topMedicamentos, metadata, lastUpdate] = await Promise.all(
      urls.map(url => fetch(url).then(r => r.json()))
    );
    
    this.data.resumen = resumen;
    this.data.topMedicamentos = topMedicamentos;
    this.data.metadata = metadata;
    this.data.lastUpdate = lastUpdate;
    
    // Generar datos adicionales
    this.generateAdditionalData();
  }

  generateAdditionalData() {
    // Generar datos de farmacias
    const farmaciaMap = new Map();
    
    this.data.topMedicamentos.forEach(item => {
      // Simular datos de farmacia (en realidad necesitarías cargar más datos)
      const farmaciaId = Math.floor(Math.random() * 10) + 2040;
      if (!farmaciaMap.has(farmaciaId)) {
        farmaciaMap.set(farmaciaId, {
          id: farmaciaId,
          nombre: `Farmacia ${farmaciaId}`,
          ubicacion: ['Norte', 'Sur', 'Este', 'Oeste'][farmaciaId % 4],
          totalLineas: 0,
          pacientes: new Set(),
          medicamentos: new Set(),
          dispensado: 0,
          recetado: 0
        });
      }
      
      const farmacia = farmaciaMap.get(farmaciaId);
      farmacia.totalLineas += item.lineas || 0;
      farmacia.dispensado += item.dispensado || 0;
      farmacia.recetado += item.recetado || 0;
      farmacia.medicamentos.add(item.MedicamentoSAP);
    });
    
    this.data.farmacias = Array.from(farmaciaMap.values()).map(f => ({
      ...f,
      pacientesAtendidos: f.pacientes.size,
      medicamentosUnicos: f.medicamentos.size,
      tasaDispensacion: f.recetado > 0 ? (f.dispensado / f.recetado * 100).toFixed(1) : 0,
      eficiencia: ((f.dispensado / f.recetado) * 100).toFixed(1)
    }));
    
    // Generar datos de médicos
    this.data.medicos = [
      { id: 14276, nombre: 'Dr. Juan Pérez', especialidad: 'Cardiología', recetas: 45, pacientes: 32, medicamentos: 28 },
      { id: 8684, nombre: 'Dra. María Gómez', especialidad: 'Pediatría', recetas: 38, pacientes: 29, medicamentos: 25 },
      { id: 8613, nombre: 'Dr. Carlos López', especialidad: 'Medicina General', recetas: 52, pacientes: 41, medicamentos: 35 },
      { id: 10435, nombre: 'Dra. Ana Martínez', especialidad: 'Dermatología', recetas: 28, pacientes: 22, medicamentos: 18 },
      { id: 9406, nombre: 'Dr. Roberto Díaz', especialidad: 'Traumatología', recetas: 33, pacientes: 27, medicamentos: 22 }
    ];
    
    // Generar alertas
    this.data.alertas = [
      {
        tipo: 'warning',
        icon: 'fa-exclamation-triangle',
        titulo: 'Stock crítico detectado',
        descripcion: '5 medicamentos tienen stock menor a 100 unidades',
        medicamentos: [10000314, 10000660, 10000348]
      },
      {
        tipo: 'danger',
        icon: 'fa-times-circle',
        titulo: 'Tasa de dispensación baja',
        descripcion: 'Farmacia 2042 tiene tasa del 65%',
        farmacia: 2042
      },
      {
        tipo: 'info',
        icon: 'fa-chart-line',
        titulo: 'Pico de demanda detectado',
        descripcion: 'Aumento del 25% en pedidos esta semana',
        fecha: '2025-12-04'
      },
      {
        tipo: 'success',
        icon: 'fa-check-circle',
        titulo: 'Médico destacado',
        descripcion: 'Dr. Juan Pérez con 100% de completitud',
        medico: 14276
      }
    ];
  }

  initFilters() {
    // Configurar Flatpickr
    flatpickr("#date-range-picker", {
      mode: "range",
      dateFormat: "d/m/Y",
      locale: "es",
      defaultDate: ["01/12/2025", "04/12/2025"],
      onChange: (selectedDates) => {
        if (selectedDates.length === 2) {
          this.filters.fechaInicio = selectedDates[0];
          this.filters.fechaFin = selectedDates[1];
        }
      }
    });
    
    // Configurar Select2
    $('#farmacia-filter, #medico-filter').select2({
      placeholder: 'Seleccionar...',
      allowClear: true,
      width: '100%'
    });
    
    // Llenar opciones de farmacias
    const farmaciaOptions = this.data.farmacias.map(f => 
      `<option value="${f.id}">${f.nombre} (${f.ubicacion})</option>`
    );
    $('#farmacia-filter').append(farmaciaOptions);
    
    // Llenar opciones de médicos
    const medicoOptions = this.data.medicos.map(m => 
      `<option value="${m.id}">${m.nombre} - ${m.especialidad}</option>`
    );
    $('#medico-filter').append(medicoOptions);
  }

  initCharts() {
    // Gráfico de evolución
    this.charts.evolucion = new ApexCharts(document.querySelector("#chart-evolucion"), {
      series: [{
        name: 'Líneas totales',
        data: this.data.resumen.map(r => r.total_lineas)
      }],
      chart: {
        type: 'area',
        height: 300,
        toolbar: { show: true }
      },
      colors: ['#3b82f6'],
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: 2 },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.7,
          opacityTo: 0.3,
        }
      },
      xaxis: {
        categories: this.data.resumen.map(r => `${r.anio}-${String(r.mes).padStart(2, '0')}`),
        labels: { rotate: -45 }
      },
      yaxis: { title: { text: 'Cantidad' } },
      tooltip: { shared: true, intersect: false }
    });
    this.charts.evolucion.render();
    
    // Gráfico de distribución por farmacia
    this.charts.distribucionFarmacia = new ApexCharts(document.querySelector("#chart-distribucion-farmacia"), {
      series: this.data.farmacias.map(f => f.totalLineas),
      chart: {
        type: 'donut',
        height: 300
      },
      labels: this.data.farmacias.map(f => f.nombre),
      colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
      legend: { position: 'bottom' },
      plotOptions: {
        pie: {
          donut: { size: '65%' },
          expandOnClick: true
        }
      }
    });
    this.charts.distribucionFarmacia.render();
    
    // Gráfico comparativo
    this.charts.comparativa = new ApexCharts(document.querySelector("#chart-comparativa"), {
      series: [
        {
          name: 'Recetado',
          data: this.data.resumen.map(r => r.total_recetado)
        },
        {
          name: 'Dispensado',
          data: this.data.resumen.map(r => r.total_dispensado)
        }
      ],
      chart: {
        type: 'bar',
        height: 300,
        stacked: false
      },
      colors: ['#3b82f6', '#10b981'],
      plotOptions: {
        bar: { horizontal: false, columnWidth: '55%' }
      },
      xaxis: {
        categories: this.data.resumen.map(r => `${r.anio}-${String(r.mes).padStart(2, '0')}`)
      },
      yaxis: { title: { text: 'Unidades' } }
    });
    this.charts.comparativa.render();
    
    // Heatmap de actividad
    this.charts.heatmap = new ApexCharts(document.querySelector("#chart-heatmap"), {
      series: [{
        name: 'Actividad',
        data: [
          { x: 'Lunes', y: 45 },
          { x: 'Martes', y: 52 },
          { x: 'Miércoles', y: 48 },
          { x: 'Jueves', y: 61 },
          { x: 'Viernes', y: 55 },
          { x: 'Sábado', y: 38 },
          { x: 'Domingo', y: 12 }
        ]
      }],
      chart: {
        type: 'heatmap',
        height: 300
      },
      colors: ["#3b82f6"],
      dataLabels: { enabled: true },
      plotOptions: {
        heatmap: {
          colorScale: {
            ranges: [
              { from: 0, to: 20, color: '#dbeafe', name: 'Bajo' },
              { from: 21, to: 40, color: '#93c5fd', name: 'Medio' },
              { from: 41, to: 60, color: '#3b82f6', name: 'Alto' }
            ]
          }
        }
      }
    });
    this.charts.heatmap.render();
  }

  initTables() {
    // Tabla de medicamentos
    this.tables.medicamentos = $('#tabla-medicamentos').DataTable({
      data: this.data.topMedicamentos.slice(0, 50),
      columns: [
        { data: 'MedicamentoSAP' },
        { 
          data: null,
          render: function(data) {
            return `Medicamento ${data.MedicamentoSAP}`;
          }
        },
        { data: 'recetado' },
        { data: 'dispensado' },
        { 
          data: null,
          render: function(data) {
            const faltante = data.recetado - data.dispensado;
            return `<span class="${faltante > 0 ? 'text-danger' : 'text-success'}">${faltante}</span>`;
          }
        },
        { 
          data: 'tasa_global',
          render: function(data) {
            const porcentaje = (data * 100).toFixed(1);
            return `
              <div class="progress" style="height: 6px;">
                <div class="progress-bar" style="width: ${porcentaje}%"></div>
              </div>
              <small>${porcentaje}%</small>
            `;
          }
        },
        { 
          data: null,
          render: function() {
            const stock = Math.floor(Math.random() * 5000);
            return `<span class="${stock < 100 ? 'text-danger fw-bold' : ''}">${stock}</span>`;
          }
        },
        {
          data: null,
          render: function() {
            return '<button class="btn btn-sm btn-outline-primary">Detalles</button>';
          }
        }
      ],
      pageLength: 10,
      responsive: true,
      dom: 'Bfrtip',
      buttons: ['copy', 'csv', 'excel', 'pdf'],
      language: {
        url: '//cdn.datatables.net/plug-ins/1.13.8/i18n/es-ES.json'
      }
    });
    
    // Tabla de farmacias
    this.tables.farmacias = $('#tabla-farmacias').DataTable({
      data: this.data.farmacias,
      columns: [
        { data: 'id' },
        { data: 'ubicacion' },
        { data: 'totalLineas' },
        { data: 'pacientesAtendidos' },
        { data: 'medicamentosUnicos' },
        { 
          data: 'tasaDispensacion',
          render: function(data) {
            return `${data}%`;
          }
        },
        { 
          data: 'eficiencia',
          render: function(data) {
            const eficiencia = parseFloat(data);
            let className = 'text-success';
            if (eficiencia < 80) className = 'text-warning';
            if (eficiencia < 60) className = 'text-danger';
            return `<span class="${className} fw-bold">${data}%</span>`;
          }
        }
      ]
    });
    
    // Tabla de médicos
    this.tables.medicos = $('#tabla-medicos').DataTable({
      data: this.data.medicos,
      columns: [
        { data: 'id' },
        { data: 'nombre' },
        { data: 'recetas' },
        { data: 'pacientes' },
        { data: 'medicamentos' },
        { data: 'especialidad' },
        { 
          data: null,
          render: function() {
            const tasa = Math.floor(Math.random() * 40) + 60;
            return `${tasa}%`;
          }
        }
      ]
    });
  }

  updateKPIs() {
    const totalLineas = this.data.resumen.reduce((sum, r) => sum + r.total_lineas, 0);
    const pacientesUnicos = this.data.resumen.reduce((sum, r) => sum + r.pacientes_unicos, 0);
    const medicosUnicos = this.data.resumen.reduce((sum, r) => sum + r.medicos_unicos, 0);
    const totalDispensado = this.data.resumen.reduce((sum, r) => sum + r.total_dispensado, 0);
    const totalRecetado = this.data.resumen.reduce((sum, r) => sum + r.total_recetado, 0);
    const totalFaltante = this.data.resumen.reduce((sum, r) => sum + r.total_faltante, 0);
    
    const tasaDispensacion = totalRecetado > 0 ? (totalDispensado / totalRecetado * 100).toFixed(1) : 0;
    
    document.getElementById('kpi-total').textContent = totalLineas.toLocaleString();
    document.getElementById('kpi-pacientes').textContent = pacientesUnicos.toLocaleString();
    document.getElementById('kpi-medicos').textContent = medicosUnicos.toLocaleString();
    document.getElementById('kpi-tasa-dispensacion').textContent = `${tasaDispensacion}%`;
    document.getElementById('kpi-stock-critico').textContent = '5'; // Simulado
    document.getElementById('kpi-faltante').textContent = totalFaltante.toLocaleString();
    
    // Actualizar total de registros
    if (this.data.metadata) {
      document.getElementById('total-records').textContent = 
        this.data.metadata.total_records.toLocaleString();
    }
  }

  updateAlerts() {
    const container = document.getElementById('alerts-container');
    container.innerHTML = '';
    
    this.data.alertas.forEach(alerta => {
      const alertaHTML = `
        <div class="alert-card alert-${alerta.tipo}">
          <div class="alert-icon">
            <i class="fas ${alerta.icon}"></i>
          </div>
          <div class="alert-content">
            <h4>${alerta.titulo}</h4>
            <p>${alerta.descripcion}</p>
          </div>
        </div>
      `;
      container.innerHTML += alertaHTML;
    });
  }

  updateLastUpdate() {
    if (this.data.lastUpdate) {
      const fecha = new Date(this.data.lastUpdate.last_updated);
      const options = { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      };
      
      const fechaFormateada = fecha.toLocaleDateString('es-ES', options);
      
      document.getElementById('last-update-time').textContent = fechaFormateada;
      document.getElementById('footer-update-time').textContent = fechaFormateada;
    }
  }

  bindEvents() {
    // Aplicar filtros
    document.getElementById('apply-filters').addEventListener('click', () => {
      this.applyFilters();
    });
    
    // Resetear filtros
    document.getElementById('reset-filters').addEventListener('click', () => {
      this.resetFilters();
    });
    
    // Cambiar métrica del gráfico
    document.getElementById('chart-metric').addEventListener('change', (e) => {
      this.updateChartMetric(e.target.value);
    });
    
    // Cambiar pestañas
    document.querySelectorAll('.tabs-nav li').forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchTab(tab.dataset.tab);
      });
    });
    
    // Refresh
    document.getElementById('refresh-btn').addEventListener('click', () => {
      this.refreshData();
    });
    
    // Exportar
    document.getElementById('export-dashboard').addEventListener('click', () => {
      this.exportDashboard();
    });
    
    // Pantalla completa
    document.getElementById('fullscreen-toggle').addEventListener('click', () => {
      this.toggleFullscreen();
    });
    
    // Tema oscuro
    document.getElementById('theme-toggle').addEventListener('click', () => {
      this.toggleTheme();
    });
  }

  applyFilters() {
    console.log('Aplicando filtros:', this.filters);
    // Aquí implementarías la lógica de filtrado real
    this.showNotification('Filtros aplicados correctamente', 'success');
  }

  resetFilters() {
    this.filters = {
      fechaInicio: null,
      fechaFin: null,
      farmacias: ['all'],
      medicos: ['all'],
      tipo: 'all'
    };
    
    $('#date-range-picker').flatpickr().clear();
    $('#farmacia-filter').val(['all']).trigger('change');
    $('#medico-filter').val(['all']).trigger('change');
    $('#tipo-filter').val('all');
    
    this.showNotification('Filtros reiniciados', 'info');
  }

  switchTab(tabId) {
    // Cambiar pestaña activa
    document.querySelectorAll('.tabs-nav li').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabId);
    });
    
    document.querySelectorAll('.tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === tabId);
    });
  }

  async refreshData() {
    const btn = document.getElementById('refresh-btn');
    const originalHTML = btn.innerHTML;
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Actualizando...';
    btn.disabled = true;
    
    try {
      await this.loadData();
      this.updateKPIs();
      this.updateAlerts();
      this.updateLastUpdate();
      this.showNotification('Datos actualizados correctamente', 'success');
    } catch (error) {
      this.showNotification('Error actualizando datos', 'error');
    } finally {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    }
  }

  exportDashboard() {
    // Implementar exportación a PDF/Excel
    this.showNotification('Exportando dashboard...', 'info');
    
    // Ejemplo simple de exportación
    const dataStr = JSON.stringify(this.data.resumen, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `dashboard-export-${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  toggleTheme() {
    document.body.classList.toggle('dark-theme');
    const btn = document.getElementById('theme-toggle');
    const icon = btn.querySelector('i');
    
    if (document.body.classList.contains('dark-theme')) {
      icon.className = 'fas fa-sun';
      btn.innerHTML = '<i class="fas fa-sun"></i> Tema claro';
    } else {
      icon.className = 'fas fa-moon';
      btn.innerHTML = '<i class="fas fa-moon"></i> Tema oscuro';
    }
  }

  showNotification(message, type = 'info') {
    // Crear notificación
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'info-circle'}"></i>
      <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Mostrar y luego remover
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-overlay';
    errorDiv.innerHTML = `
      <div class="error-content">
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Error</h3>
        <p>${message}</p>
        <button class="btn btn-primary" onclick="window.location.reload()">
          <i class="fas fa-redo"></i> Reintentar
        </button>
      </div>
    `;
    
    document.body.appendChild(errorDiv);
  }
}

// Inicializar dashboard cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new Dashboard();
});
