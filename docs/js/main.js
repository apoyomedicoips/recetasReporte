// docs/js/main.js - ORQUESTADOR PRINCIPAL
document.addEventListener('DOMContentLoaded', () => {
  console.log("IPS Analytics Dashboard 2025 - Iniciando...");

  // Verificar dependencias críticas
  if (typeof Utils === "undefined") {
    console.error("Error: Utils no está definido.");
    return;
  }
  if (typeof Dashboard === "undefined") {
    console.error("Error: Dashboard no está definido.");
    return;
  }

  // Inicializar dashboard
  try {
    window.dashboard = new Dashboard();
    window.dashboard.init().catch(err => {
      console.error("Error en inicialización:", err);
    });
  } catch (err) {
    console.error("No se pudo instanciar Dashboard:", err);
  }
});

// Manejo global de errores
window.addEventListener("error", (event) => {
  console.error("Error global:", event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Promesa no manejada:", event.reason);
});
