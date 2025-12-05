// Funciones de utilidad
const Utils = {
    formatNumber: function(num) {
        return new Intl.NumberFormat('es-ES').format(num);
    },
    
    formatPercentage: function(num) {
        return `${parseFloat(num).toFixed(1)}%`;
    },
    
    formatDate: function(dateString) {
        const date = new Date(dateString);
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
    },
    
    calculateTrend: function(current, previous) {
        if (previous === 0) return { value: 100, direction: 'up' };
        const change = ((current - previous) / previous) * 100;
        return {
            value: Math.abs(change),
            direction: change >= 0 ? 'up' : 'down'
        };
    }
};

// Exportar para uso global
window.Utils = Utils;
