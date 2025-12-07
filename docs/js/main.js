// main.js
document.addEventListener('DOMContentLoaded', () => {
    // Inicializar dashboard
    window.dashboard = new Dashboard();
    window.dashboard.init();
    
    // Agregar estilos para animaciones
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        .text-danger { color: #ef4444 !important; }
        .text-success { color: #10b981 !important; }
        .text-warning { color: #f59e0b !important; }
        .fw-bold { font-weight: bold !important; }
    `;
    document.head.appendChild(style);
});
