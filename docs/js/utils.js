
const Utils = {
    formatNumber: (num) => new Intl.NumberFormat('es-PY').format(num || 0),
    formatPercentage: (num) => num ? num.toFixed(1) + '%' : '0%',
    formatDate: (dateString) => {
        if (!dateString) return "-";
        const date = new Date(dateString);
        return date.toLocaleDateString('es-PY', { year: 'numeric', month: 'long', day: 'numeric' });
    }
};
window.Utils = Utils;
