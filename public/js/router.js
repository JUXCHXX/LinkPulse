// public/js/router.js
class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
  }

  register(path, handler) {
    this.routes.set(path, handler);
  }

  async navigate(path) {
    const handler = this.routes.get(path);
    if (!handler) {
      console.warn(`Ruta no encontrada: ${path}`);
      return;
    }

    try {
      await handler();
      this.currentRoute = path;
    } catch (err) {
      console.error(`Error en ruta ${path}:`, err);
    }
  }

  start() {
    // Manejar cambios de hash
    window.addEventListener('hashchange', () => {
      const path = location.hash.slice(1) || '/dashboard';
      this.navigate(path);
    });

    // Navegar a ruta actual
    const path = location.hash.slice(1) || '/dashboard';
    this.navigate(path);
  }
}

const router = new Router();
