// docs/js/main.js
// VERSIÓN FINAL 100 % FUNCIONAL - ORQUESTADOR DEL TABLERO IPS 2025

document.addEventListener('DOMContentLoaded', () => {
    console.log("IPS Analytics Dashboard 2025 - Iniciando...");

    // Verificación básica de dependencias
    if (typeof Utils === "undefined") {
        console.error("Error crítico: Utils no está definido. Verifique js/utils.js en index.html.");
        return;
    }
    if (typeof Dashboard === "undefined") {
        console.error("Error crítico: Dashboard no está definido. Verifique js/dashboard.js en index.html.");
        return;
    }
    if (typeof FiltersManager === "undefined") {
        console.warn("Aviso: FiltersManager no está definido. El tablero funcionará pero sin filtros avanzados.");
    }

    // Instanciación del dashboard
    try {
        window.dashboard = new Dashboard();

        // init es asíncrono; se captura cualquier error durante la inicialización
        const initPromise = window.dashboard.init();
        if (initPromise && typeof initPromise.then === "function") {
            initPromise.catch(err => {
                console.error("Error durante la inicialización del dashboard:", err);
            });
        }

    } catch (err) {
        console.error("No fue posible instanciar Dashboard:", err);
        return;
    }

    // Estilos globales para animaciones y utilidades visuales
    const globalStyles = document.createElement("style");
    globalStyles.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to   { transform: translateX(0);   opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0);   opacity: 1; }
            to   { transform: translateX(100%); opacity: 0; }
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to   { opacity: 1; }
        }

        .notification {
            animation: slideIn 0.4s ease-out;
        }
        .notification.hide {
            animation: slideOut 0.4s ease-in forwards;
        }

        .text-danger  { color: #ef4444 !important; font-weight: 600; }
        .text-success { color: #10b981 !important; font-weight: 600; }
        .text-warning { color: #f59e0b !important; font-weight: 600; }
        .text-info    { color: #06b6d4 !important; font-weight: 600; }
        .fw-bold      { font-weight: 700 !important; }
        .text-sm      { font-size: 0.875rem; }
        .text-center  { text-align: center; }

        /* Ajustes para DataTables */
        .dataTables_wrapper .dataTables_length,
        .dataTables_wrapper .dataTables_filter {
            margin-bottom: 1rem;
        }
        .dataTables_wrapper .dataTables_info {
            font-size: 0.875rem;
            color: #64748b;
        }

        /* Indicador de carga */
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
            0%   { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        /* Tooltip simple */
        .dashboard-tooltip {
            position: absolute;
            background: #1e293b;
            color: #ffffff;
            padding: 0.5rem 0.75rem;
            border-radius: 6px;
            font-size: 0.75rem;
            z-index: 1000;
            white-space: nowrap;
        }
        .dashboard-tooltip::after {
            content: "";
            position: absolute;
            bottom: -5px;
            left: 50%;
            transform: translateX(-50%);
            border-width: 5px;
            border-style: solid;
            border-color: #1e293b transparent transparent transparent;
        }
    `;
    document.head.appendChild(globalStyles);

    // Inicialización de tooltips para elementos con data-tooltip
    const tooltipElements = document.querySelectorAll("[data-tooltip]");
    tooltipElements.forEach(el => {
        el.addEventListener("mouseenter", () => {
            const text = el.dataset.tooltip;
            if (!text) return;

            const rect = el.getBoundingClientRect();
            const tooltip = document.createElement("div");
            tooltip.className = "dashboard-tooltip";
            tooltip.textContent = text;
            tooltip.style.top = `${window.scrollY + rect.top - 36}px`;
            tooltip.style.left = `${window.scrollX + rect.left + rect.width / 2}px`;
            tooltip.style.transform = "translateX(-50%)";

            document.body.appendChild(tooltip);
            el._tooltip = tooltip;
        });

        el.addEventListener("mouseleave", () => {
            if (el._tooltip) {
                el._tooltip.remove();
                el._tooltip = null;
            }
        });
    });

    // Mensajes de estado en consola
    const now = new Date().toLocaleString("es-PY", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });

    console.log("%cIPS Analytics Dashboard 2025", "color:#3b82f6;font-size:20px;font-weight:bold;");
    console.log("%cDatos reales del IPS Paraguay, procesados con Polars", "color:#10b981;font-size:14px;");
    console.log(`Dashboard cargado correctamente a las ${now}`);
});

// Manejo global de errores en el navegador
window.addEventListener("error", (event) => {
    console.error("Error global no capturado:", event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
    console.error("Promesa no manejada:", event.reason);
});
