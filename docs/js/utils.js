// Funciones de utilidad
const Utils = {
    formatNumber: function(num) {
        if (num === null || num === undefined || isNaN(num)) return "0";
        return new Intl.NumberFormat('es-ES').format(num);
    },

    formatPercentage: function(num) {
        if (num === null || num === undefined || isNaN(num)) return "0.0%";
        return `${parseFloat(num).toFixed(1)}%`;
    },

    formatDate: function(dateString) {
        if (!dateString) return "-";
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    getMonthName: function(month) {
        const months = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        return months[month - 1] || '';
    }
};

window.Utils = Utils;
