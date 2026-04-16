// public/js/auth.js
class AuthManager {
  constructor() {
    this.token = null;
    this.user = null;
    this.config = null;
    this.loadFromStorage();
  }

  loadFromStorage() {
    const stored = localStorage.getItem('linkpulse_token');
    if (stored) {
      this.token = stored;
    }
  }

  saveToStorage() {
    if (this.token) {
      localStorage.setItem('linkpulse_token', this.token);
    } else {
      localStorage.removeItem('linkpulse_token');
    }
  }

  async loadConfig() {
    if (!this.config) {
      const res = await fetch('/api/public/config');
      this.config = await res.json();
    }
    return this.config;
  }

  async verifyToken(token) {
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        throw new Error('Token inválido');
      }

      const data = await res.json();
      this.token = data.token;
      this.user = data.user;
      this.saveToStorage();
      return true;
    } catch (err) {
      console.error('Error verificando token:', err);
      return false;
    }
  }

  async getMe() {
    if (!this.token) return null;

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${this.token}` },
      });

      if (!res.ok) throw new Error('Error obtiendo usuario');

      const user = await res.json();
      this.user = user;
      return user;
    } catch (err) {
      console.error('Error en getMe:', err);
      return null;
    }
  }

  async refreshToken() {
    if (!this.token) return false;

    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.token}` },
      });

      if (!res.ok) throw new Error('Error renovando token');

      const data = await res.json();
      this.token = data.token;
      this.saveToStorage();
      return true;
    } catch (err) {
      console.error('Error renovando token:', err);
      return false;
    }
  }

  isAuthenticated() {
    return !!this.token && !!this.user;
  }

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('linkpulse_token');
  }
}

const auth = new AuthManager();
