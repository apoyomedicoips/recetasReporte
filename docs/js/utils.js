// docs/js/utils.js
const Utils = {
  formatNumber(value) {
    if (value === null || value === undefined || isNaN(value)) return '0';
    return new Intl.NumberFormat('es-PY').format(value);
  },

  formatPercentage(value, decimals = 1) {
    if (value === null || value === undefined || isNaN(value)) return '0%';
    const v = Number(value) * 100;
    return v.toFixed(decimals) + '%';
  },

  formatLocalDate(isoString) {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleString('es-PY', {
        year: 'numeric',
        month: 'long',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  },

  monthLabel(anio, mes) {
    const nombres = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const m = Number(mes) - 1;
    return m >= 0 && m < 12 ? `${nombres[m]} ${anio}` : `${mes}/${anio}`;
  },

  sortByKey(array, key, desc = true) {
    return [...array].sort((a, b) => {
      const A = a[key] || 0;
      const B = b[key] || 0;
      return desc ? B - A : A - B;
    });
  }
};

window.Utils = Utils;
