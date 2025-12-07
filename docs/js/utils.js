// utils.js
const Utils = {
    formatNumber: (num) => {
        if (num === null || num === undefined) return "0";
        return new Intl.NumberFormat('es-PY').format(num);
    },

    formatPercentage: (num) => {
        if (num === null || num === undefined) return "0.0%";
        return `${(num * 100).toFixed(1)}%`;
    },

    formatDate: (dateString) => {
        if (!dateString) return "-";
        const date = new Date(dateString);
        return date.toLocaleDateString('es-PY', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

window.Utils = Utils;
