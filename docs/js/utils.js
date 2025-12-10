const Utils = {
  formatNumber(value) {
    if (value === null || value === undefined || isNaN(value)) return '0';
    return new Intl.NumberFormat('es-PY').format(value);
  },
  formatPercentage(value, decimals = 1) {
    if (value === null || value === undefined || isNaN(value)) return '0%';
    return (Number(value) * 100).toFixed(decimals) + '%';
  },
  formatLocalDate(isoString) {
    if (!isoString) return '-';
    try {
      return new Date(isoString).toLocaleString('es-PY', {
        year: 'numeric', month: 'long', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
    } catch { return isoString; }
  },
  monthLabel(anio, mes) {
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    return `${meses[Number(mes)-1]} ${anio}`;
  }
};
window.Utils = Utils;
