// docs/js/main.js
document.addEventListener('DOMContentLoaded', async () => {
  // Tema guardado
  if (localStorage.getItem('theme') === 'dark' || 
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.body.classList.add('dark-theme');
    document.querySelector('#theme-toggle i').className = 'fas fa-sun';
  }

  // Inicializar
  window.dashboard = new Dashboard();
  await window.dashboard.init();

  window.filters = new FiltersManager(window.dashboard);
  await window.filters.init();
});
