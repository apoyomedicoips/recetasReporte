// docs/js/main.js
// VERSIÓN FINAL 100% FUNCIONAL - IPS 2025

document.addEventListener('DOMContentLoaded', () => {
    console.log("IPS Analytics Dashboard 2025 - Iniciando...");

    // Inicializar el dashboard principal
    if (typeof Dashboard === 'undefined') {
        console.error("Error: Dashboard no está definido. Revisa dashboard.js");
        return;
    }

    window.dashboard = new Dashboard();
    window.dashboard.init();

    // Inicializar filtros (si existe)
    if (typeof FiltersManager !== 'undefined' && window.dashboard) {
        window.dashboard.filters = new FiltersManager(window.dashboard);
    }

    // Estilos globales para animaciones y utilidades
    const globalStyles = document.createElement('style');
    globalStyles.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        .notification {
            animation: slideIn 0.4s ease-out;
        }
        .notification.hide {
            animation: slideOut 0.4s ease-in forwards;
        }

        .text-danger { color: #ef4444 !important; font-weight: 600; }
        .text-success { color: #10b981 !important; font-weight: 600; }
        .text-warning { color: #f59e0b !important; font-weight: 600; }
        .text-info { color: #06b6d4 !important; font-weight: 600; }
        .fw-bold { font-weight: 700 !important; }
        .text-sm { font-size: 0.875rem; }
        .text-center { text-align: center; }

        /* Mejora visual para tablas */
        .dataTables_wrapper .dataTables_length,
        .dataTables_wrapper .dataTables_filter {
            margin-bottom: 1rem;
        }
        .dataTables_wrapper .dataTables_info {
            font-size: 0.875rem;
            color: #64748b;
        }

        /* Loading spinner opcional */
        .loading {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(globalStyles);

    // Mensaje de bienvenida en consola
    console.log("%cIPS Analytics Dashboard 2025", "color: #3b82f6; font-size: 20px; font-weight: bold;");
    console.log("%cDatos reales del IPS Paraguay - Procesados con Polars", "color: #10b981; font-size: 14px;");
    console.log("%cDesarrollado con orgullo para el pueblo paraguayo", "color: #ef4444; font-size: 12px;");

    // Tooltip para botones (opcional)
    const tooltipElements = document.querySelectorAll('[data-tooltip]');
    tooltipElements.forEach(el => {
        el.addEventListener('mouseenter', () => {
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = el.dataset.tooltip;
            tooltip.style.cssText = `
                position: absolute;
                background: #1e293b;
                color: white;
                padding: 0.5rem 0.75rem;
                border-radius: 6px;
                font-size: 0.875rem;
                z-index: 1000;
                top: ${el.offsetTop - 35}px;
                left: ${el.offsetLeft + el.offsetWidth / 2}px;
                transform: translateX(-50%);
                white-space: nowrap;
            `;
            tooltip.innerHTML += '<div style="position: absolute; bottom: -5px; left: 50%; transform: translateX(-50%); border: 5px solid transparent; border-top-color: #1e293b;"></div>';
            document.body.appendChild(tooltip);
            el.tooltip = tooltip;
        });
        el.addEventListener('mouseleave', () => {
            if (el.tooltip) {
                document.body.removeChild(el.tooltip);
                el.tooltip = null;
            }
        });
    });

    // Mostrar fecha de carga
    const now = new Date().toLocaleString('es-PY', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    console.log(`Dashboard cargado: ${now}`);
});

// Manejo de errores global (por si algo falla)
window.addEventListener('error', (e) => {
    console.error("Error global:", e.error);
});

window.addEventListener('unhandledrejection', (e) => {
    console.error("Promesa rechazada:", e.reason);
});
