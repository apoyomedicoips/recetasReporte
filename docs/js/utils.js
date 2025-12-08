// Utilidades generales para formato de números, fechas y tendencias
const Utils = {
  formatNumber(value) {
    if (value === null || value === undefined || isNaN(value)) return '0';
    return new Intl.NumberFormat('es-ES').format(value);
  },

  formatPercentage(value, decimals = 1) {
    if (value === null || value === undefined || isNaN(value)) return '0%';
    const v = Number(value) * 100;
    return v.toFixed(decimals) + '%';
  },

  formatLocalDate(isoString) {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  monthLabel(anio, mes) {
    const nombres = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    const m = mes - 1;
    const nombre = m >= 0 && m < 12 ? nombres[m] : mes;
    return `${nombre} ${anio}`;
  }
};

window.Utils = Utils;
